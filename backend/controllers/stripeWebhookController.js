import Stripe from 'stripe';
import crypto from 'crypto';
import supabase from '../services/supabase.js';

// FIX: Use Server-Side Email Service (Nodemailer), not Client-Side (Firebase)
import { EmailService } from '../services/serverEmail.js';

export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is missing');
        return res.status(500).send('Webhook Error: Secret missing');
    }

    let event;

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            console.log(`[Webhook] Payment succeeded for session: ${session.id}`);

            // 1. Idempotency Check: Fetch Registration FIRST
            const { data: reg, error: fetchError } = await supabase
                .from('registrations')
                .select('*, event:events(*)')
                .eq('stripe_checkout_session_id', session.id)
                .single();

            if (fetchError || !reg) {
                console.error('[Webhook] Registration not found for session:', session.id);
                return res.status(404).send('Registration not found');
            }

            // CRITICAL: Idempotency Check
            if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
                console.log(`[Webhook] Idempotent Event: Registration ${reg.id} already paid. Skipping.`);
                return res.json({ received: true, status: 'already_paid' });
            }

            // 2. Finalize Tickets
            const finalizedTickets = (reg.tickets || []).map(ticket => ({
                ...ticket,
                id: crypto.randomUUID(),
                status: 'valid',
                purchaseDate: new Date().toISOString()
            }));

            // 3. Prepare Financial Data
            const centsToDollars = (cents) => (cents ? cents / 100 : 0);

            let stripeFee = 0;
            try {
                if (session.payment_intent) {
                    const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
                        expand: ['latest_charge.balance_transaction']
                    });
                    const charge = pi.latest_charge;
                    if (charge && charge.balance_transaction && charge.balance_transaction.fee) {
                        stripeFee = centsToDollars(charge.balance_transaction.fee);
                        console.log(`[Stripe] Retrieved Actual Fee: $${stripeFee}`);
                    }
                }
            } catch (feeError) {
                console.warn("[Stripe] Could not retrieve actual fee, falling back to estimate:", feeError.message);
                stripeFee = (centsToDollars(session.amount_total) * 0.029) + 0.30;
            }
            if (stripeFee === 0) {
                stripeFee = (centsToDollars(session.amount_total) * 0.029) + 0.30;
            }

            const platformFee = Number(session.metadata?.serviceFee || 0); // Gross
            const taxAmount = Number(session.metadata?.taxAmount || 0);

            // Affiliate Commission Logic
            const affiliateCode = session.metadata?.affiliateCode || null;
            let affiliateCommission = 0;

            if (affiliateCode) {
                try {
                    // Check if the code is authorized for this event
                    const eventAffiliates = reg.event?.affiliates || [];
                    const isAuthorized = eventAffiliates.some(a => a.code === affiliateCode);

                    if (!isAuthorized) {
                        console.warn(`[Affiliate] Unauthorized code ${affiliateCode} used for event ${reg.event_id}.`);
                        affiliateCommission = 0;
                    } else {
                        const { data: affiliate } = await supabase
                            .from('profiles')
                            .select('id, commission_rate')
                            .eq('affiliate_code', affiliateCode)
                            .single();

                        if (affiliate) {
                            // FRAUD PREVENTION: Check for self-referral
                            const buyerId = session.metadata?.userId;
                            if (buyerId && affiliate.id === buyerId) {
                                console.warn(`[Affiliate] Self-referral detected for user ${buyerId}. Commission set to 0.`);
                                affiliateCommission = 0;
                            } else {
                                // Priority: Affiliate user rate, else fallback to a default (e.g. 10%) or event specific if we add it later
                                // For now, we trust the profile rate set by admin/system
                                const rate = affiliate.commission_rate || 10; // 10% default for authorized affiliates if not set

                                // Commission is calculated on the subtotal (Base Price + Custom Fees)
                                const baseSubtotal = centsToDollars(session.amount_total) - platformFee - taxAmount;
                                affiliateCommission = Number((baseSubtotal * (rate / 100)).toFixed(2));
                                console.log(`[Affiliate] Calculated ${rate}% Commission for ${affiliateCode}: $${affiliateCommission}`);
                            }
                        }
                    }
                } catch (affError) {
                    console.warn("[Affiliate] Error processing commission:", affError.message);
                }
            }

            const organizerNet = Number((centsToDollars(session.amount_total) - platformFee - taxAmount - affiliateCommission).toFixed(2));

            // 4. ATOMIC RPC: Update Registration (incl Tickets) + Insert Financial Record
            console.log(`[Webhook] Calling RPC process_checkout_success for ${session.id}...`);

            const { data: rpcData, error: rpcError } = await supabase.rpc('process_checkout_success', {
                p_session_id: session.id,
                p_payment_intent_id: session.payment_intent,
                p_total_amount: centsToDollars(session.amount_total),
                p_platform_fee: platformFee,
                p_stripe_fee: stripeFee,
                p_tax_amount: taxAmount,
                p_organizer_net: organizerNet,
                p_currency: session.currency,
                p_event_id: session.metadata.eventId,
                p_transaction_type: 'ticket_sale',
                p_tickets: finalizedTickets,
                p_affiliate_code: affiliateCode,
                p_affiliate_commission: affiliateCommission
            });

            if (rpcError || (rpcData && !rpcData.success)) {
                console.error("RPC Transaction Failed:", rpcError || rpcData?.error);
                return res.status(500).json({ error: "Transaction Failed" });
            }

            console.log(`[Stripe] Transaction Processed Atomically for Session ${session.id}`);

            // 5. Send Email (Server Side)
            console.log(`[Webhook] Registration verified: ${reg.id}. Sending Confirmation...`);
            await EmailService.sendConfirmation(reg.attendee_email, finalizedTickets, reg.event);
        }

        res.json({ received: true });
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
};
