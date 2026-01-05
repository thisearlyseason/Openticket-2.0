import supabase from '../services/supabase.js';
import { createRequire } from 'module';
import { calculateOrderBreakdown, buildStripeLineItems } from '../utils/priceCalculator.js';
import { EmailService } from '../services/serverEmail.js';
const require = createRequire(import.meta.url);

/**
 * STRIPE CHECKOUT CONTROLLER
 * Creates Stripe Checkout sessions with proper Connect destination
 */

const getStripe = () => {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
};

export const createOrder = async (req, res) => {
    try {
        const stripe = getStripe();

        const {
            eventId,
            ticketSelections,
            addOnSelections,
            promoCode,
            affiliateCode,
            customerEmail,
            customerName,
            successUrl,
            cancelUrl,
            userId,
            assignments,
            phoneNumber
        } = req.body;

        console.log(`[Stripe] createOrder called for event: ${eventId}`);
        console.log(`[Stripe] successUrl: ${successUrl}`);
        console.log(`[Stripe] cancelUrl: ${cancelUrl}`);

        // Validate URLs
        if (!successUrl || !cancelUrl) {
            return res.status(400).json({ error: "Missing success or cancel URL" });
        }

        // Ensure URLs are valid (Stripe doesn't accept hash routes)
        const validateUrl = (url) => {
            try {
                const parsed = new URL(url);
                // Stripe requires http or https
                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        if (!validateUrl(successUrl) || !validateUrl(cancelUrl)) {
            console.error(`[Stripe] Invalid URLs - success: ${successUrl}, cancel: ${cancelUrl}`);
            return res.status(400).json({ error: "Invalid success or cancel URL format" });
        }

        // 1. Fetch Event with owner info
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*, owner:profiles!owner_id(id, stripe_connect_id, stripe_onboarding_complete, subscription)')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            console.error(`[Stripe] Event not found: ${eventId}`, eventError);
            return res.status(404).json({ error: "Event not found" });
        }

        // 2. Validate Capacity
        let requestedQty = 0;
        Object.values(ticketSelections || {}).forEach((val) => requestedQty += (Number(val) || 0));

        if (event.capacity && (event.registered_count || 0) + requestedQty > event.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 3. Validate promo code if provided
        let validPromoCode = null;
        if (promoCode && event.promo_codes) {
            const code = event.promo_codes.find(c => c.code === promoCode);
            if (code) {
                let isValid = true;
                if (code.max_usage && code.usage_count >= code.max_usage) isValid = false;
                if (code.expiry_date && Date.now() > code.expiry_date) isValid = false;
                if (isValid) validPromoCode = code;
            }
        }

        // 4. Calculate order using SINGLE SOURCE OF TRUTH
        const organizerPlan = event.owner?.subscription?.plan || 'free';
        const breakdown = calculateOrderBreakdown({
            event,
            ticketSelections: ticketSelections || {},
            addOnSelections: addOnSelections || {},
            promoCode: validPromoCode,
            organizerPlan,
        });

        if (breakdown.items.length === 0) {
            return res.status(400).json({ error: "No items selected" });
        }

        // 5. Build Stripe line items
        const lineItems = buildStripeLineItems(breakdown, event.title);

        // 6. Build tickets data for DB
        const ticketsData = [];
        for (const item of breakdown.items) {
            if (item.type !== 'ticket') continue;
            for (let i = 0; i < item.quantity; i++) {
                // Get assignment if available
                const assignment = assignments?.[item.id]?.[i] || {};
                ticketsData.push({
                    id: `tix-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
                    tierId: item.id,
                    name: item.name,
                    pricePerTicket: item.unitPrice,
                    quantity: 1,
                    status: 'valid',
                    attendeeName: assignment.name || customerName,
                    attendeeEmail: assignment.email || customerEmail,
                });
            }
        }

        // 7. Build add-ons data for DB
        const addOnsData = [];
        for (const item of breakdown.items) {
            if (item.type !== 'addon') continue;
            addOnsData.push({
                id: item.id,
                name: item.name,
                price: item.unitPrice,
                quantity: item.quantity,
                status: 'valid',
            });
        }

        // 8. Prepare Checkout Session options
        const finalSuccessUrl = successUrl.includes('?')
            ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}`
            : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`;

        const sessionOptions = {
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: finalSuccessUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata: {
                eventId,
                userId: userId || 'guest',
                affiliateCode: affiliateCode || '',
                // Store breakdown for webhook reconciliation
                platformFee: breakdown.platformFee.toString(),
                taxAmount: breakdown.taxAmount.toString(),
                discountAmount: breakdown.discountAmount.toString(),
                promoCode: validPromoCode?.code || '',
            },
        };

        // 9. CRITICAL: Add Stripe Connect destination for split payments
        const organizerStripeId = event.owner?.stripe_connect_id;
        const isRealStripeAccount = organizerStripeId && 
            !organizerStripeId.startsWith('mock_') && 
            event.owner?.stripe_onboarding_complete;

        if (isRealStripeAccount && breakdown.grandTotal > 0) {
            // Calculate application fee (platform commission)
            // This is the platform fee + any absorbed fees
            const applicationFeeAmount = Math.round(breakdown.platformFee * 100); // cents

            sessionOptions.payment_intent_data = {
                application_fee_amount: applicationFeeAmount,
                transfer_data: {
                    destination: organizerStripeId,
                },
                metadata: {
                    eventId,
                    organizerId: event.owner_id,
                },
            };

            console.log(`[Stripe] Creating session with Connect destination: ${organizerStripeId}, app_fee: $${breakdown.platformFee}`);
        } else {
            console.log(`[Stripe] Creating session WITHOUT Connect (mock account or no account)`);
        }

        // 10. Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create(sessionOptions);

        // 11. Create pending registration record
        const registrationPayload = {
            event_id: eventId,
            attendee_email: customerEmail,
            attendee_name: customerName,
            user_id: userId !== 'guest' ? userId : null,
            payment_status: 'pending',
            approval_status: event.requires_approval ? 'pending' : 'approved',
            tickets: ticketsData,
            add_ons: addOnsData,
            stripe_checkout_session_id: session.id,
            answers: {},
            created_at: new Date(),
            phone_number: phoneNumber,
            promo_code_used: validPromoCode?.code || null,
            discount_amount: breakdown.discountAmount,
            total_amount: breakdown.grandTotal,
            service_fee: breakdown.platformFee,
            tax_amount: breakdown.taxAmount,
            custom_fees_amount: breakdown.customFeesAmount,
            affiliate_code: affiliateCode || null,
        };

        const { error: insertError } = await supabase
            .from('registrations')
            .insert([registrationPayload]);

        if (insertError) {
            console.error("Failed to save pending registration:", insertError);
            // Don't fail the checkout - webhook will handle verification
        }

        console.log(`[Stripe] Checkout session created: ${session.id}`);
        res.json({ url: session.url, id: session.id });

    } catch (error) {
        console.error("Create Order Error:", error);
        // Provide more detailed error message
        const errorMessage = error.raw?.message || error.message || 'Unknown error';
        res.status(500).json({ error: errorMessage });
    }
};

export const createPortalSession = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', userId)
            .single();

        if (!profile?.stripe_customer_id) {
            return res.status(400).json({ error: 'No billing account found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: profile.stripe_customer_id,
            return_url: `${req.headers.origin}/#/billing`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error("Portal Session Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create a PaymentIntent for at-door payments
 * POST /api/stripe/create-payment-intent
 */
export const createPaymentIntent = async (req, res) => {
    try {
        const stripe = getStripe();
        const { registrationId, amount } = req.body;

        // Fetch registration with event owner
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*, owner:profiles!owner_id(stripe_connect_id, stripe_onboarding_complete))')
            .eq('id', registrationId)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        const organizerStripeId = reg.event?.owner?.stripe_connect_id;
        const isRealAccount = organizerStripeId && 
            !organizerStripeId.startsWith('mock_') && 
            reg.event?.owner?.stripe_onboarding_complete;

        const paymentIntentData = {
            amount: Math.round(amount * 100), // cents
            currency: 'usd',
            metadata: {
                registrationId,
                eventId: reg.event_id,
                source: 'checkin_portal',
            },
        };

        if (isRealAccount) {
            // Calculate platform fee (simplified - use same structure)
            const platformFeePercent = 0.0275; // Default free plan
            const platformFee = Math.round(amount * platformFeePercent * 100);

            paymentIntentData.application_fee_amount = platformFee;
            paymentIntentData.transfer_data = {
                destination: organizerStripeId,
            };
        }

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error) {
        console.error("Create PaymentIntent Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get order calculation preview (for frontend validation)
 * POST /api/stripe/calculate-order
 */
export const calculateOrder = async (req, res) => {
    try {
        const { eventId, ticketSelections, addOnSelections, promoCode } = req.body;

        const { data: event, error } = await supabase
            .from('events')
            .select('*, owner:profiles!owner_id(subscription)')
            .eq('id', eventId)
            .single();

        if (error || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Validate promo code
        let validPromoCode = null;
        if (promoCode && event.promo_codes) {
            const code = event.promo_codes.find(c => c.code === promoCode);
            if (code) {
                let isValid = true;
                if (code.max_usage && code.usage_count >= code.max_usage) isValid = false;
                if (code.expiry_date && Date.now() > code.expiry_date) isValid = false;
                if (isValid) validPromoCode = code;
            }
        }

        const organizerPlan = event.owner?.subscription?.plan || 'free';
        const breakdown = calculateOrderBreakdown({
            event,
            ticketSelections: ticketSelections || {},
            addOnSelections: addOnSelections || {},
            promoCode: validPromoCode,
            organizerPlan,
        });

        res.json(breakdown);
    } catch (error) {
        console.error("Calculate Order Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Verify a checkout session and update registration status
 * POST /api/stripe/verify-session
 * This is used when webhooks don't fire (e.g., development environment)
 */
export const verifySession = async (req, res) => {
    try {
        const stripe = getStripe();
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        console.log(`[Stripe] Verifying session: ${sessionId}`);

        // Retrieve the session from Stripe with expanded payment intent
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent.latest_charge.balance_transaction']
        });

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }

        // Check payment status
        if (session.payment_status !== 'paid') {
            return res.status(200).json({ 
                status: 'pending',
                message: 'Payment not yet completed'
            });
        }

        // Find the registration with event data
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*)')
            .eq('stripe_checkout_session_id', sessionId)
            .single();

        if (regError || !reg) {
            console.error('[Stripe] Registration not found for session:', sessionId);
            return res.status(404).json({ error: 'Registration not found' });
        }

        // IDEMPOTENCY: If already paid, return success without re-processing
        if (reg.payment_status === 'paid' || reg.payment_status === 'completed') {
            return res.json({ 
                status: 'success',
                registration: reg
            });
        }

        // ========== FULL POST-PAYMENT PROCESSING ==========
        console.log(`[Stripe] Processing full payment for registration: ${reg.id}`);

        // 1. Finalize Tickets with unique IDs
        const finalizedTickets = (reg.tickets || []).map(ticket => ({
            ...ticket,
            id: ticket.id || `tix-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            status: 'valid',
            purchaseDate: new Date().toISOString()
        }));

        // 2. Calculate financial breakdown
        const centsToDollars = (cents) => (cents ? cents / 100 : 0);
        let grossAmount = centsToDollars(session.amount_total);
        
        // Get actual Stripe fee from balance transaction
        let stripeFee = 0;
        try {
            const paymentIntent = session.payment_intent;
            if (paymentIntent && typeof paymentIntent === 'object') {
                const charge = paymentIntent.latest_charge;
                if (charge && typeof charge === 'object' && charge.balance_transaction) {
                    const bt = charge.balance_transaction;
                    if (typeof bt === 'object' && bt.fee) {
                        stripeFee = centsToDollars(bt.fee);
                        console.log(`[Stripe] Actual fee from balance_transaction: $${stripeFee}`);
                    }
                }
            }
        } catch (feeError) {
            console.warn("[Stripe] Could not retrieve actual fee:", feeError.message);
        }

        // Fallback fee estimation if actual fee not available
        if (stripeFee === 0 && grossAmount > 0) {
            stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
            console.log(`[Stripe] Estimated fee: $${stripeFee}`);
        }

        // Parse metadata for financial reconciliation
        const platformFee = Number(session.metadata?.platformFee || reg.service_fee || 0);
        const taxAmount = Number(session.metadata?.taxAmount || reg.tax_amount || 0);
        const discountAmount = Number(session.metadata?.discountAmount || reg.discount_amount || 0);
        const affiliateCode = session.metadata?.affiliateCode || reg.affiliate_code || null;

        // Calculate affiliate commission if applicable
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
                        const buyerId = session.metadata?.userId;
                        if (buyerId && affiliate.id === buyerId) {
                            console.warn(`[Affiliate] Self-referral detected. Commission set to 0.`);
                        } else {
                            const rate = affiliate.commission_rate || 10;
                            const baseSubtotal = grossAmount - platformFee - taxAmount;
                            affiliateCommission = Number((baseSubtotal * (rate / 100)).toFixed(2));
                        }
                    }
                }
            } catch (affError) {
                console.warn("[Affiliate] Error processing commission:", affError.message);
            }
        }

        // Calculate organizer net earnings
        const organizerNet = Number((grossAmount - platformFee - stripeFee - affiliateCommission).toFixed(2));

        // 3. Update registration with all data
        const paymentIntentId = typeof session.payment_intent === 'object' 
            ? session.payment_intent.id 
            : session.payment_intent;

        const { data: updatedReg, error: updateError } = await supabase
            .from('registrations')
            .update({
                payment_status: 'paid',
                stripe_payment_intent_id: paymentIntentId,
                tickets: finalizedTickets,
                total_amount: grossAmount,
                service_fee: platformFee,
                tax_amount: taxAmount,
                discount_amount: discountAmount
            })
            .eq('id', reg.id)
            .select()
            .single();

        if (updateError) {
            console.error('[Stripe] Failed to update registration:', updateError);
            return res.status(500).json({ error: 'Failed to update registration' });
        }

        // 4. Insert financial transaction record
        const { error: txError } = await supabase.from('financial_transactions').insert({
            registration_id: reg.id,
            event_id: reg.event_id,
            stripe_session_id: session.id,
            stripe_payment_intent_id: paymentIntentId,
            gross_amount: grossAmount,
            platform_fee: platformFee,
            stripe_fee: stripeFee,
            tax_amount: taxAmount,
            organizer_net: organizerNet,
            currency: session.currency || 'usd',
            status: 'succeeded',
            payout_status: 'pending',
            transaction_type: 'ticket_sale',
            discount_amount: discountAmount,
            affiliate_code: affiliateCode,
            affiliate_commission: affiliateCommission,
            created_at: new Date().toISOString()
        });

        if (txError) {
            console.error('[Stripe] Failed to insert financial transaction:', txError);
            // Don't fail the request - registration is already paid
        } else {
            console.log(`[Stripe] Financial transaction created for ${sessionId}`);
        }

        // 5. Update event's registered count
        const ticketCount = finalizedTickets.length;
        if (ticketCount > 0 && reg.event_id) {
            const { error: countError } = await supabase.rpc('increment_registered_count', {
                p_event_id: reg.event_id,
                p_count: ticketCount
            });
            
            if (countError) {
                // Fallback: direct update
                console.warn('[Stripe] RPC increment failed, trying direct update:', countError);
                const { data: eventData } = await supabase
                    .from('events')
                    .select('registered_count')
                    .eq('id', reg.event_id)
                    .single();
                
                if (eventData) {
                    await supabase
                        .from('events')
                        .update({ registered_count: (eventData.registered_count || 0) + ticketCount })
                        .eq('id', reg.event_id);
                }
            }
            console.log(`[Stripe] Updated event registered count (+${ticketCount})`);
        }

        // 6. Insert audit log
        try {
            await supabase.from('audit_logs').insert({
                timestamp: new Date().toISOString(),
                actor_id: session.metadata?.userId || 'guest',
                actor_type: session.metadata?.userId ? 'user' : 'guest',
                actor_email: reg.attendee_email,
                action: 'ticket_purchase',
                target_type: 'registration',
                target_id: reg.id,
                details: {
                    eventId: reg.event_id,
                    eventTitle: reg.event?.title,
                    grossAmount: grossAmount,
                    stripeFee: stripeFee,
                    platformFee: platformFee,
                    netAmount: organizerNet,
                    currency: session.currency || 'usd',
                    ticketCount: ticketCount,
                    stripeSessionId: session.id,
                    stripePaymentIntentId: paymentIntentId
                }
            });
            console.log(`[Stripe] Audit log created for ${sessionId}`);
        } catch (auditError) {
            console.error('[Stripe] Failed to create audit log:', auditError);
        }

        console.log(`[Stripe] Full payment processing complete for session: ${sessionId}`);
        console.log(`[Stripe] Breakdown: Gross=$${grossAmount}, StripeFee=$${stripeFee}, PlatformFee=$${platformFee}, OrganizerNet=$${organizerNet}`);

        res.json({ 
            status: 'success',
            registration: updatedReg
        });

    } catch (error) {
        console.error("Verify Session Error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Record an at-door payment (cash, card, or transfer)
 * POST /api/stripe/record-at-door-payment
 * This creates a financial transaction record for offline payments
 */
export const recordAtDoorPayment = async (req, res) => {
    try {
        const { registrationId, amount, method } = req.body;

        if (!registrationId || !amount || !method) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get registration with event data
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(*, owner:profiles!owner_id(subscription))')
            .eq('id', registrationId)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Calculate platform fee based on organizer's plan
        const organizerPlan = reg.event?.owner?.subscription?.plan || 'free';
        const PLAN_FEES = {
            free: { percent: 0.0275, fixed: 1.25 },
            pro: { percent: 0.015, fixed: 0.75 },
            premium: { percent: 0.0075, fixed: 0 }
        };
        const planFee = PLAN_FEES[organizerPlan] || PLAN_FEES.free;
        const platformFee = Number((amount * planFee.percent + planFee.fixed).toFixed(2));
        
        // No Stripe fee for cash/transfer payments
        const stripeFee = method === 'card' ? Number((amount * 0.029 + 0.30).toFixed(2)) : 0;
        
        const organizerNet = Number((amount - platformFee - stripeFee).toFixed(2));

        // Insert financial transaction record
        const { data: tx, error: txError } = await supabase
            .from('financial_transactions')
            .insert({
                registration_id: registrationId,
                event_id: reg.event_id,
                gross_amount: amount,
                platform_fee: platformFee,
                stripe_fee: stripeFee,
                tax_amount: reg.tax_amount || 0,
                organizer_net: organizerNet,
                currency: 'usd',
                status: 'succeeded',
                payout_status: method === 'cash' ? 'collected' : 'pending',
                transaction_type: 'at_door_payment',
                payment_method: method,
                affiliate_code: reg.affiliate_code || null,
                affiliate_commission: 0, // At-door payments don't typically carry affiliate commission
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (txError) {
            console.error('[At-Door Payment] Failed to record transaction:', txError);
            // Don't fail - the payment was collected
        }

        // Create audit log
        try {
            await supabase.from('audit_logs').insert({
                timestamp: new Date().toISOString(),
                actor_id: req.user?.uid || 'staff',
                actor_type: 'staff',
                action: 'at_door_payment',
                target_type: 'registration',
                target_id: registrationId,
                details: {
                    eventId: reg.event_id,
                    amount: amount,
                    method: method,
                    platformFee: platformFee,
                    organizerNet: organizerNet
                }
            });
        } catch (auditError) {
            console.error('[At-Door Payment] Audit log failed:', auditError);
        }

        console.log(`[At-Door Payment] Recorded ${method} payment of $${amount} for registration ${registrationId}`);
        
        res.json({
            recorded: true,
            transactionId: tx?.id,
            breakdown: {
                gross: amount,
                platformFee: platformFee,
                stripeFee: stripeFee,
                organizerNet: organizerNet
            }
        });

    } catch (error) {
        console.error('Record At-Door Payment Error:', error);
        res.status(500).json({ error: error.message });
    }
};
