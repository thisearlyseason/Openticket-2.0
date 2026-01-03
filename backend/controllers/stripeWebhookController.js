import crypto from 'crypto';
import supabase from '../services/supabase.js';
import { createRequire } from 'module';
import { AuditLogService } from '../services/auditLogService.js';
const require = createRequire(import.meta.url);

// FIX: Use Server-Side Email Service (Nodemailer), not Client-Side (Firebase)
import { EmailService } from '../services/serverEmail.js';

const getStripe = () => {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
};

/**
 * COMPREHENSIVE STRIPE WEBHOOK HANDLER
 * Handles all financial events for payment reconciliation
 */
export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
        console.error('STRIPE_WEBHOOK_SECRET is missing');
        return res.status(500).send('Webhook Error: Secret missing');
    }

    let event;
    const stripe = getStripe();

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(stripe, event.data.object);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(stripe, event.data.object);
                break;

            case 'charge.refunded':
            case 'refund.created':
                await handleRefund(stripe, event.data.object);
                break;

            case 'account.updated':
                await handleAccountUpdated(event.data.object);
                break;

            case 'payout.paid':
                await handlePayoutPaid(event.data.object);
                break;

            default:
                console.log(`[Webhook] Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
};

/**
 * Handle checkout.session.completed
 * Main handler for successful Stripe Checkout payments
 */
async function handleCheckoutCompleted(stripe, session) {
    console.log(`[Webhook] Processing checkout.session.completed: ${session.id}`);

    // 1. Idempotency Check: Fetch Registration FIRST
    const { data: reg, error: fetchError } = await supabase
        .from('registrations')
        .select('*, event:events(*)')
        .eq('stripe_checkout_session_id', session.id)
        .single();

    if (fetchError || !reg) {
        console.error('[Webhook] Registration not found for session:', session.id);
        return;
    }

    // CRITICAL: Idempotency Check
    if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
        console.log(`[Webhook] Idempotent Event: Registration ${reg.id} already paid. Skipping.`);
        return;
    }

    // 2. Finalize Tickets with unique IDs
    const finalizedTickets = (reg.tickets || []).map(ticket => ({
        ...ticket,
        id: crypto.randomUUID(),
        status: 'valid',
        purchaseDate: new Date().toISOString()
    }));

    // 3. Retrieve actual Stripe fees
    const centsToDollars = (cents) => (cents ? cents / 100 : 0);

    let stripeFee = 0;
    let grossAmount = centsToDollars(session.amount_total);

    try {
        if (session.payment_intent) {
            const pi = await stripe.paymentIntents.retrieve(session.payment_intent, {
                expand: ['latest_charge.balance_transaction']
            });
            const charge = pi.latest_charge;
            if (charge?.balance_transaction?.fee) {
                stripeFee = centsToDollars(charge.balance_transaction.fee);
                console.log(`[Stripe] Retrieved Actual Fee: $${stripeFee}`);
            }
        }
    } catch (feeError) {
        console.warn("[Stripe] Could not retrieve actual fee:", feeError.message);
    }

    // Fallback estimation if actual fee not available
    if (stripeFee === 0) {
        stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
    }

    // 4. Parse metadata for financial reconciliation
    const platformFee = Number(session.metadata?.platformFee || 0);
    const taxAmount = Number(session.metadata?.taxAmount || 0);
    const discountAmount = Number(session.metadata?.discountAmount || 0);
    const affiliateCode = session.metadata?.affiliateCode || null;

    // 5. Calculate affiliate commission
    let affiliateCommission = 0;
    if (affiliateCode) {
        try {
            const eventAffiliates = reg.event?.affiliates || [];
            const isAuthorized = eventAffiliates.some(a => a.code === affiliateCode);

            if (isAuthorized) {
                const { data: affiliate } = await supabase
                    .from('profiles')
                    .select('id, commission_rate')
                    .eq('affiliate_code', affiliateCode)
                    .single();

                if (affiliate) {
                    // Fraud prevention: Check for self-referral
                    const buyerId = session.metadata?.userId;
                    if (buyerId && affiliate.id === buyerId) {
                        console.warn(`[Affiliate] Self-referral detected. Commission set to 0.`);
                    } else {
                        const rate = affiliate.commission_rate || 10; // 10% default
                        const baseSubtotal = grossAmount - platformFee - taxAmount;
                        affiliateCommission = Number((baseSubtotal * (rate / 100)).toFixed(2));
                        console.log(`[Affiliate] ${rate}% Commission for ${affiliateCode}: $${affiliateCommission}`);
                    }
                }
            }
        } catch (affError) {
            console.warn("[Affiliate] Error processing commission:", affError.message);
        }
    }

    // 6. Calculate organizer net earnings
    const organizerNet = Number((grossAmount - platformFee - stripeFee - affiliateCommission).toFixed(2));

    // 7. ATOMIC RPC: Update Registration + Insert Financial Record
    console.log(`[Webhook] Calling RPC process_checkout_success_v2 for ${session.id}...`);

    const { data: rpcData, error: rpcError } = await supabase.rpc('process_checkout_success_v2', {
        p_session_id: session.id,
        p_payment_intent_id: session.payment_intent,
        p_gross_amount: grossAmount,
        p_platform_fee: platformFee,
        p_stripe_fee: stripeFee,
        p_tax_amount: taxAmount,
        p_organizer_net: organizerNet,
        p_event_id: session.metadata?.eventId || reg.event_id,
        p_registration_id: reg.id,
        p_tickets: finalizedTickets,
        p_currency: session.currency || 'usd',
        p_transaction_type: 'ticket_sale',
        p_discount_amount: discountAmount,
        p_affiliate_code: affiliateCode,
        p_affiliate_commission: affiliateCommission
    });

    if (rpcError) {
        console.error("RPC Transaction Failed:", rpcError);
        // Fallback: Update registration directly
        await supabase
            .from('registrations')
            .update({
                payment_status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                tickets: finalizedTickets,
            })
            .eq('id', reg.id);

        // Insert financial transaction
        await supabase.from('financial_transactions').insert({
            registration_id: reg.id,
            event_id: reg.event_id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            gross_amount: grossAmount,
            platform_fee: platformFee,
            stripe_fee: stripeFee,
            tax_amount: taxAmount,
            organizer_net: organizerNet,
            currency: session.currency || 'usd',
            status: 'succeeded',
            payout_status: 'pending',
            transaction_type: 'ticket_sale',
            affiliate_code: affiliateCode,
            affiliate_commission: affiliateCommission,
        });
    }

    console.log(`[Stripe] Transaction Processed for Session ${session.id}`);

    // 8. Send confirmation email
    try {
        console.log(`[Webhook] Sending confirmation email to: ${reg.attendee_email}`);
        await EmailService.sendConfirmation(reg.attendee_email, finalizedTickets, reg.event);
    } catch (emailError) {
        console.error("[Email] Failed to send confirmation:", emailError.message);
    }
}

/**
 * Handle payment_intent.succeeded
 * For at-door payments or direct PaymentIntent creations
 */
async function handlePaymentIntentSucceeded(stripe, paymentIntent) {
    console.log(`[Webhook] Processing payment_intent.succeeded: ${paymentIntent.id}`);

    const registrationId = paymentIntent.metadata?.registrationId;
    if (!registrationId) {
        console.log('[Webhook] No registrationId in metadata, skipping...');
        return;
    }

    // Update registration payment status
    const { data: reg, error } = await supabase
        .from('registrations')
        .select('*, event:events(*)')
        .eq('id', registrationId)
        .single();

    if (error || !reg) {
        console.error('[Webhook] Registration not found:', registrationId);
        return;
    }

    if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
        console.log('[Webhook] Registration already paid, skipping...');
        return;
    }

    const centsToDollars = (cents) => (cents ? cents / 100 : 0);
    const grossAmount = centsToDollars(paymentIntent.amount);

    // Get actual Stripe fee
    let stripeFee = 0;
    try {
        const charge = paymentIntent.latest_charge;
        if (typeof charge === 'string') {
            const chargeObj = await stripe.charges.retrieve(charge, {
                expand: ['balance_transaction']
            });
            if (chargeObj.balance_transaction?.fee) {
                stripeFee = centsToDollars(chargeObj.balance_transaction.fee);
            }
        }
    } catch (e) {
        stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
    }

    const platformFee = centsToDollars(paymentIntent.application_fee_amount || 0);
    const organizerNet = grossAmount - platformFee - stripeFee;

    // Update registration
    await supabase
        .from('registrations')
        .update({
            payment_status: 'paid',
            stripe_payment_intent_id: paymentIntent.id,
        })
        .eq('id', registrationId);

    // Insert financial transaction
    await supabase.from('financial_transactions').insert({
        registration_id: registrationId,
        event_id: reg.event_id,
        stripe_payment_intent_id: paymentIntent.id,
        gross_amount: grossAmount,
        platform_fee: platformFee,
        stripe_fee: stripeFee,
        organizer_net: organizerNet,
        currency: paymentIntent.currency || 'usd',
        status: 'succeeded',
        payout_status: 'pending',
        transaction_type: 'checkin_payment',
    });

    console.log(`[Webhook] At-door payment processed for registration: ${registrationId}`);
}

/**
 * Handle charge.refunded and refund.created events
 */
async function handleRefund(stripe, refundData) {
    console.log(`[Webhook] Processing refund event`);

    // For charge.refunded, refundData is the charge
    // For refund.created, refundData is the refund
    const paymentIntentId = refundData.payment_intent;
    const refundAmount = refundData.amount_refunded || refundData.amount;

    if (!paymentIntentId) {
        console.log('[Webhook] No payment_intent in refund data');
        return;
    }

    const centsToDollars = (cents) => (cents ? cents / 100 : 0);
    const refundAmountDollars = centsToDollars(refundAmount);

    // Find the financial transaction
    const { data: transaction, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (error || !transaction) {
        console.log('[Webhook] No financial transaction found for payment_intent:', paymentIntentId);
        return;
    }

    // Calculate refund proportions
    const refundRatio = transaction.gross_amount > 0 
        ? refundAmountDollars / transaction.gross_amount 
        : 0;

    const platformFeeRefund = Number((transaction.platform_fee * refundRatio).toFixed(2));
    const stripeFeeRefund = Number((transaction.stripe_fee * refundRatio).toFixed(2));
    const organizerNetRefund = Number((transaction.organizer_net * refundRatio).toFixed(2));

    // Insert refund transaction
    await supabase.from('financial_transactions').insert({
        registration_id: transaction.registration_id,
        event_id: transaction.event_id,
        stripe_payment_intent_id: paymentIntentId,
        gross_amount: -refundAmountDollars,
        platform_fee: -platformFeeRefund,
        stripe_fee: -stripeFeeRefund,
        organizer_net: -organizerNetRefund,
        currency: transaction.currency,
        status: 'refunded',
        payout_status: 'settled',
        transaction_type: 'refund',
    });

    // Update original transaction status if full refund
    if (refundAmountDollars >= transaction.gross_amount) {
        await supabase
            .from('financial_transactions')
            .update({ status: 'refunded' })
            .eq('id', transaction.id);
    }

    console.log(`[Webhook] Refund transaction recorded: $${refundAmountDollars}`);
}

/**
 * Handle account.updated for Connect accounts
 */
async function handleAccountUpdated(account) {
    console.log(`[Webhook] Processing account.updated: ${account.id}`);

    const isComplete = account.charges_enabled && account.payouts_enabled;

    // Update profile with onboarding status
    const { error } = await supabase
        .from('profiles')
        .update({ stripe_onboarding_complete: isComplete })
        .eq('stripe_connect_id', account.id);

    if (error) {
        console.error('[Webhook] Failed to update profile:', error);
    }

    console.log(`[Webhook] Account ${account.id} onboarding complete: ${isComplete}`);
}

/**
 * Handle payout.paid for tracking organizer payouts
 */
async function handlePayoutPaid(payout) {
    console.log(`[Webhook] Processing payout.paid: ${payout.id}`);

    // This is a payout to the connected account
    // We could track this, but Stripe Connect handles payouts automatically
    // This is mainly for audit/reporting purposes

    // For now, just log it
    console.log(`[Webhook] Payout ${payout.id} paid: $${payout.amount / 100}`);
}
