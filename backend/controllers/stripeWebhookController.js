import crypto from 'crypto';
import supabase from '../services/supabase.js';
import { createRequire } from 'module';
import { AuditLogService } from '../services/auditLogService.js';
import { generateUniqueTickets } from '../utils/ticketGenerator.js';
import PushService from '../services/pushService.js';
import { getValidatedStripe } from '../utils/stripeHelper.js';
const require = createRequire(import.meta.url);

// FIX: Use Server-Side Email Service (Nodemailer), not Client-Side (Firebase)
import { EmailService } from '../services/serverEmail.js';

// Processed webhook event IDs cache (prevent replay attacks)
const processedWebhookEvents = new Set();
const MAX_CACHE_SIZE = 10000; // Prevent memory leak
let cacheCleanupCounter = 0;

const getStripe = () => getValidatedStripe();

/**
 * COMPREHENSIVE STRIPE WEBHOOK HANDLER
 * Handles all financial events for payment reconciliation
 */
export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log('[Webhook] Handler called');
    console.log('[Webhook] Signature present:', !!sig);
    console.log('[Webhook] Secret configured:', !!endpointSecret);
    console.log('[Webhook] Secret value:', endpointSecret ? endpointSecret.substring(0, 15) + '...' : 'MISSING');

    if (!endpointSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET is missing from environment');
        console.error('[Webhook] Available env keys:', Object.keys(process.env).filter(k => k.includes('STRIPE')).join(', '));
        return res.status(400).send('Webhook Error: Secret not configured');
    }

    let event;
    const stripe = getStripe();

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Signature Verification Failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ FIX: Prevent webhook replay attacks
    const eventId = event.id;
    
    if (processedWebhookEvents.has(eventId)) {
        console.log(`[Webhook] Duplicate event detected: ${eventId}. Skipping.`);
        return res.json({ received: true, status: 'duplicate' });
    }

    // Add to processed cache
    processedWebhookEvents.add(eventId);
    
    // Cleanup cache periodically to prevent memory leak
    cacheCleanupCounter++;
    if (cacheCleanupCounter > 1000) {
        if (processedWebhookEvents.size > MAX_CACHE_SIZE) {
            // Remove oldest 50% of entries (Set is insertion-ordered)
            const entries = Array.from(processedWebhookEvents);
            const toRemove = entries.slice(0, Math.floor(entries.length / 2));
            toRemove.forEach(id => processedWebhookEvents.delete(id));
            console.log(`[Webhook] Cache cleanup: removed ${toRemove.length} old entries`);
        }
        cacheCleanupCounter = 0;
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

            case 'payout.failed':
                await handlePayoutFailed(event.data.object);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;

            case 'checkout.session.expired':
            case 'checkout.session.async_payment_failed':
                await handlePaymentFailed(stripe, event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(stripe, event.data.object);
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

    // 2. Transform tickets to unique ticket structure with IDs, numbers, and QR codes
    let finalizedTickets = reg.tickets || [];
    
    // Check if tickets already have unique IDs (from createRegistration)
    const hasUniqueIds = finalizedTickets.length > 0 && finalizedTickets[0].ticketId;
    
    if (!hasUniqueIds) {
        // Legacy tickets without unique IDs - generate them now
        console.log(`[Webhook] Generating unique ticket IDs for ${finalizedTickets.length} tickets`);
        finalizedTickets = generateUniqueTickets(
            finalizedTickets,
            reg.id,
            reg.attendee_name || 'Guest',
            [] // No assigned names at this point
        );
    } else {
        // Tickets already have unique IDs, just ensure status is set
        finalizedTickets = finalizedTickets.map(ticket => ({
            ...ticket,
            status: ticket.status || 'valid',
            purchaseDate: new Date().toISOString()
        }));
        console.log(`[Webhook] Tickets already have unique IDs: ${finalizedTickets.map(t => t.ticketNumber).join(', ')}`);
    }

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
    // ✅ FIX: Use conservative estimate (international rate)
    if (stripeFee === 0) {
        console.warn(`[Webhook] Unable to retrieve actual Stripe fee for ${session.payment_intent}`);
        // Standard Stripe rate: 2.9% + $0.30
        stripeFee = Number(((grossAmount * 0.029) + 0.30).toFixed(2));
        console.warn(`[Webhook] Using estimated fee (2.9% + $0.30): $${stripeFee}`);
    }

    // 4. Parse metadata for financial reconciliation
    const platformFee = Number(session.metadata?.platformFee || 0);
    const taxAmount = Number(session.metadata?.taxAmount || 0);
    const discountAmount = Number(session.metadata?.discountAmount || 0);
    const affiliateCode = session.metadata?.affiliateCode || null;

    // NOTE: Affiliate commissions are ONLY for subscriptions, NOT ticket sales
    // Affiliates earn 15% recurring commission on subscription payments only
    const affiliateCommission = 0;
    if (affiliateCode) {
        console.log(`[Webhook] Affiliate code ${affiliateCode} tracked for analytics only. No ticket commission.`);
    }

    // 6. Calculate organizer net earnings (no affiliate commission deducted for tickets)
    const organizerNet = Number((grossAmount - platformFee - stripeFee).toFixed(2));

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
        // Fallback: Update registration directly including charged currency
        const chargedCurrency = session.currency?.toUpperCase() || 'USD';
        const chargedAmount = centsToDollars(session.amount_total);
        await supabase
            .from('registrations')
            .update({
                payment_status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                tickets: finalizedTickets,
                charged_currency: chargedCurrency,
                charged_amount: chargedAmount,
                answers: {
                    ...reg.answers,
                    _metadata: {
                        ...(reg.answers?._metadata || {}),
                        charged_currency: chargedCurrency,
                        charged_amount: chargedAmount,
                    }
                }
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
    } else {
        // RPC succeeded - also update charged_currency on registration (RPC may not handle this)
        const chargedCurrency = session.currency?.toUpperCase() || 'USD';
        const chargedAmount = centsToDollars(session.amount_total);
        await supabase
            .from('registrations')
            .update({
                charged_currency: chargedCurrency,
                charged_amount: chargedAmount,
                answers: {
                    ...reg.answers,
                    _metadata: {
                        ...(reg.answers?._metadata || {}),
                        charged_currency: chargedCurrency,
                        charged_amount: chargedAmount,
                    }
                }
            })
            .eq('id', reg.id);
        console.log(`[Stripe] Transaction Processed via RPC for Session ${session.id}`);
    }

    // 8. Log to Audit Trail
    try {
        await AuditLogService.logTicketPurchase({
            actorId: session.metadata?.userId || 'guest',
            actorType: session.metadata?.userId ? 'guest' : 'guest',
            actorEmail: reg.attendee_email,
            eventId: reg.event_id,
            registrationId: reg.id,
            grossAmount: grossAmount,
            stripeFee: stripeFee,
            platformFee: platformFee,
            netAmount: organizerNet,
            currency: session.currency || 'usd',
            stripePaymentIntentId: session.payment_intent,
            stripeSessionId: session.id,
            ticketCount: finalizedTickets.length,
            metadata: {
                eventTitle: reg.event?.title,
                attendeeName: reg.attendee_name,
                promoCode: session.metadata?.promoCode
            }
        });
    } catch (auditError) {
        console.error("[AuditLog] Failed to log ticket purchase:", auditError.message);
    }

    // 9. AUTO-CREATE ATTENDEE ACCOUNT (Critical Feature)
    try {
        console.log(`[Webhook] Checking if attendee account exists: ${reg.attendee_email}`);
        
        // Check if user already exists
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('email', reg.attendee_email.toLowerCase())
            .single();

        if (!existingUser) {
            // Generate a random password
            const generatePassword = () => {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
                let password = '';
                // Ensure at least one of each required type
                password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]; // uppercase
                password += '23456789'[Math.floor(Math.random() * 8)]; // number
                password += '!@#$%'[Math.floor(Math.random() * 5)]; // special
                // Fill the rest
                for (let i = 0; i < 5; i++) {
                    password += chars[Math.floor(Math.random() * chars.length)];
                }
                // Shuffle the password
                return password.split('').sort(() => Math.random() - 0.5).join('');
            };

            const tempPassword = generatePassword();
            
            // Create Firebase auth user
            const { createUserWithEmailAndPassword, getAuth } = await import('firebase-admin/auth');
            const admin = (await import('firebase-admin')).default;
            
            // Initialize Firebase Admin if not already done
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.applicationDefault()
                });
            }
            
            let firebaseUid = null;
            try {
                // Try to create Firebase user
                const userRecord = await admin.auth().createUser({
                    email: reg.attendee_email.toLowerCase(),
                    password: tempPassword,
                    displayName: reg.attendee_name
                });
                firebaseUid = userRecord.uid;
                console.log(`[Webhook] Created Firebase user: ${firebaseUid}`);
            } catch (firebaseError) {
                // If Firebase user already exists, get their UID
                if (firebaseError.code === 'auth/email-already-exists') {
                    try {
                        const existingFirebaseUser = await admin.auth().getUserByEmail(reg.attendee_email.toLowerCase());
                        firebaseUid = existingFirebaseUser.uid;
                        console.log(`[Webhook] Firebase user already exists: ${firebaseUid}`);
                    } catch (e) {
                        console.error('[Webhook] Could not get existing Firebase user:', e.message);
                    }
                } else {
                    console.error('[Webhook] Firebase user creation failed:', firebaseError.message);
                }
            }

            // Create profile in Supabase
            const newUserId = firebaseUid || `attendee-${crypto.randomUUID()}`;
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: newUserId,
                    email: reg.attendee_email.toLowerCase(),
                    name: reg.attendee_name,
                    role: 'attendee',
                    balance_due: 0,
                    available_payout: 0,
                    created_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('[Webhook] Profile creation failed:', profileError.message);
            } else {
                console.log(`[Webhook] Created attendee profile: ${newUserId}`);
                
                // Send credentials email
                try {
                    const eventDate = reg.event?.date ? new Date(reg.event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : null;
                    
                    await EmailService.sendAttendeeCredentials(
                        reg.attendee_email,
                        reg.attendee_name,
                        tempPassword,
                        reg.event?.title,
                        eventDate,
                        reg.event?.location
                    );
                    console.log(`[Webhook] Sent credentials email to: ${reg.attendee_email}`);
                } catch (credEmailError) {
                    console.error('[Email] Failed to send credentials:', credEmailError.message);
                }
            }
        } else {
            console.log(`[Webhook] Attendee account already exists: ${existingUser.id}`);
        }
    } catch (accountError) {
        console.error('[Webhook] Auto-account creation failed:', accountError.message);
        // Non-blocking - continue with the rest of the webhook
    }

    // 10. Send confirmation email (check if enabled in event settings)
    try {
        const emailSettings = reg.event?.email_settings || {};
        // Default to enabled if not explicitly disabled
        if (emailSettings.confirmationEnabled !== false) {
            console.log(`[Webhook] Sending confirmation email to: ${reg.attendee_email}`);
            await EmailService.sendConfirmation(reg.attendee_email, finalizedTickets, reg.event);
        } else {
            console.log(`[Webhook] Confirmation email disabled for event: ${reg.event?.title}`);
        }
    } catch (emailError) {
        console.error("[Email] Failed to send confirmation:", emailError.message);
    }

    // 11. Send affiliate conversion notification if applicable
    if (affiliateCode && affiliateCommission > 0) {
        try {
            // Get affiliate's email
            const { data: affiliate } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('affiliate_code', affiliateCode)
                .single();

            if (affiliate?.email) {
                console.log(`[Webhook] Sending affiliate conversion email to: ${affiliate.email}`);
                await EmailService.sendAffiliateConversionNotification(
                    affiliate.email,
                    affiliate.name,
                    reg.attendee_name,
                    reg.event?.title,
                    grossAmount.toFixed(2),
                    affiliateCommission
                );
            }
        } catch (affEmailError) {
            console.error("[Email] Failed to send affiliate notification:", affEmailError.message);
        }
    }

    // 12. Send push notification to organizer about new sale
    try {
        const organizerId = reg.event?.created_by;
        if (organizerId) {
            const ticketCount = finalizedTickets.length;
            const currency = (session.currency || 'usd').toUpperCase();
            
            // Create notification payload
            const notification = {
                title: '🎟️ New Ticket Sale!',
                body: `${reg.attendee_name} purchased ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} for ${reg.event?.title} • ${currency} ${grossAmount.toFixed(2)}`,
                tag: `sale_${reg.id}`,
                data: {
                    type: 'new_sale',
                    eventId: reg.event_id,
                    registrationId: reg.id,
                    attendeeName: reg.attendee_name,
                    ticketCount,
                    amount: grossAmount,
                    currency,
                    url: `/#/manage/${reg.event_id}/attendees`
                }
            };
            
            // Send browser push notification
            const pushSent = await PushService.sendNotification(organizerId, notification);
            console.log(`[Webhook] Push notification ${pushSent ? 'sent' : 'skipped'} to organizer: ${organizerId}`);
            
            // Also save to in-app notifications database
            try {
                await supabase
                    .from('notifications')
                    .insert({
                        user_id: organizerId,
                        type: 'new_sale',
                        title: notification.title,
                        message: notification.body,
                        read: false,
                        data: notification.data,
                        created_at: new Date().toISOString()
                    });
                console.log('[Webhook] Sale notification saved to database');
            } catch (dbError) {
                console.warn('[Webhook] Could not save notification to database:', dbError.message);
            }
        }
    } catch (pushError) {
        console.error("[Push] Failed to send sale notification:", pushError.message);
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

    // Send push notification to organizer about at-door sale
    try {
        const organizerId = reg.event?.created_by;
        if (organizerId) {
            const ticketCount = reg.tickets?.length || 1;
            const currency = (paymentIntent.currency || 'usd').toUpperCase();
            
            const notification = {
                title: '💰 At-Door Payment Received!',
                body: `${reg.attendee_name} paid at the door for ${reg.event?.title} • ${currency} ${grossAmount.toFixed(2)}`,
                tag: `door_sale_${registrationId}`,
                data: {
                    type: 'door_sale',
                    eventId: reg.event_id,
                    registrationId: registrationId,
                    attendeeName: reg.attendee_name,
                    ticketCount,
                    amount: grossAmount,
                    currency,
                    url: `/#/manage/${reg.event_id}/attendees`
                }
            };
            
            // Send browser push notification
            await PushService.sendNotification(organizerId, notification);
            
            // Save to in-app notifications
            await supabase
                .from('notifications')
                .insert({
                    user_id: organizerId,
                    type: 'door_sale',
                    title: notification.title,
                    message: notification.body,
                    read: false,
                    data: notification.data,
                    created_at: new Date().toISOString()
                });
            console.log('[Webhook] At-door sale notification sent to organizer');
        }
    } catch (pushError) {
        console.error("[Push] Failed to send at-door sale notification:", pushError.message);
    }
}

/**
 * Handle charge.refunded and refund.created events
 * IMPORTANT: This is the ONLY place refund emails should be sent
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

    // Find the financial transaction (ticket_sale only, to get original)
    const { data: transaction, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .eq('transaction_type', 'ticket_sale')
        .maybeSingle();

    // Find the registration by payment_intent_id
    const { data: registration } = await supabase
        .from('registrations')
        .select('id, payment_status, total_amount')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

    if (!registration) {
        console.warn('[Webhook] No registration found for payment_intent:', paymentIntentId);
        return;
    }

    const originalAmount = transaction?.gross_amount || registration?.total_amount || refundAmountDollars;
    const isFullRefund = refundAmountDollars >= (originalAmount - 0.01);

    console.log(`[Webhook] Refund: $${refundAmountDollars} of $${originalAmount} (full=${isFullRefund}) for reg ${registration.id}`);

    // 1. Update registration payment status
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';
    await supabase
        .from('registrations')
        .update({ payment_status: newStatus })
        .eq('id', registration.id);
    console.log(`[Webhook] Registration ${registration.id} status → ${newStatus}`);

    // 2. Insert refund financial transaction (only if we have the original transaction to calculate proportions)
    if (transaction) {
        // Check total refunds don't exceed original transaction
        const { data: existingRefunds } = await supabase
            .from('financial_transactions')
            .select('gross_amount')
            .eq('stripe_payment_intent_id', paymentIntentId)
            .eq('transaction_type', 'refund');

        const totalRefunded = (existingRefunds || [])
            .reduce((sum, r) => sum + Math.abs(r.gross_amount), 0);

        if (totalRefunded + refundAmountDollars > originalAmount + 0.01) {
            console.error(`[Webhook] Total refunds ($${totalRefunded + refundAmountDollars}) would exceed original ($${originalAmount})`);
        } else {
            const refundRatio = transaction.gross_amount > 0
                ? refundAmountDollars / transaction.gross_amount
                : 0;

            const platformFeeRefund = Number((transaction.platform_fee * refundRatio).toFixed(2));
            const stripeFeeRefund = Number((transaction.stripe_fee * refundRatio).toFixed(2));
            const organizerNetRefund = Number((transaction.organizer_net * refundRatio).toFixed(2));

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
            if (isFullRefund) {
                await supabase
                    .from('financial_transactions')
                    .update({ status: 'refunded' })
                    .eq('id', transaction.id);
            }
        }
    } else {
        // No financial transaction found — insert a basic refund record from Stripe data
        console.warn(`[Webhook] No financial_transaction found for ${paymentIntentId}, inserting basic refund record`);
        await supabase.from('financial_transactions').insert({
            registration_id: registration.id,
            stripe_payment_intent_id: paymentIntentId,
            gross_amount: -refundAmountDollars,
            platform_fee: 0,
            stripe_fee: 0,
            organizer_net: -refundAmountDollars,
            currency: refundData.currency || 'usd',
            status: 'refunded',
            payout_status: 'settled',
            transaction_type: 'refund',
        });
    }

    // Log to Audit Trail
    try {
        await AuditLogService.logRefund({
            actorId: 'system',
            actorType: 'system',
            eventId: transaction.event_id,
            registrationId: transaction.registration_id,
            refundAmount: refundAmountDollars,
            stripeFeeRefund: stripeFeeRefund,
            platformFeeRefund: platformFeeRefund,
            netRefund: organizerNetRefund,
            currency: transaction.currency,
            stripePaymentIntentId: paymentIntentId,
            stripeRefundId: refundData.id,
            reason: 'Stripe refund processed'
        });
    } catch (auditError) {
        console.error("[AuditLog] Failed to log refund:", auditError.message);
    }

    // ========== SEND REFUND CONFIRMATION EMAIL ==========
    try {
        const { refundConfirmation } = await import('../services/unifiedEmailTemplates.js');
        const emailAudit = await import('../services/emailAuditService.js');
        const { sendEmailWithProvider } = await import('../services/cronService.js');

        // Get registration and event details first to check email settings
        const { data: registration } = await supabase
            .from('registrations')
            .select('*, event:events(title, date, location, owner_id, email_settings)')
            .eq('id', transaction.registration_id)
            .single();

        // Check if refund emails are enabled for this event
        const emailSettings = registration?.event?.email_settings || {};
        if (emailSettings.refundEnabled === false) {
            console.log(`[Webhook] Refund email disabled for event: ${registration?.event?.title}`);
        } else {
            // Check if email already sent (prevent duplicates)
            const alreadySent = await emailAudit.wasEmailSent(
                emailAudit.TRIGGER_TYPES.STRIPE_REFUND_SUCCEEDED,
                emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION,
                transaction.registration_id
            );

            if (alreadySent) {
                console.log('[Webhook] Refund email already sent, skipping');
            } else if (registration && registration.attendee_email) {
                const eventDate = registration.event?.date 
                    ? new Date(registration.event.date).toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })
                    : 'N/A';

                // Count tickets refunded
                const ticketsRefunded = registration.tickets 
                    ? registration.tickets.filter(t => t.status === 'refunded').length
                    : 1;

                const { subject, html } = refundConfirmation({
                    attendeeName: registration.attendee_name || 'Guest',
                    eventTitle: registration.event?.title || 'Event',
                    eventDate,
                    eventLocation: registration.event?.location || 'TBD',
                    refundAmount: refundAmountDollars,
                    ticketsRefunded,
                    orderId: transaction.registration_id.substring(0, 8).toUpperCase(),
                    refundReason: registration.refund_reason || '',
                    refundDate: new Date().toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                    })
                });

                const emailResult = await sendEmailWithProvider(
                    registration.attendee_email,
                    subject,
                    html,
                    registration.event?.owner_id
                );

                // Log the email send
                await emailAudit.logEmailSend({
                    triggerType: emailAudit.TRIGGER_TYPES.STRIPE_REFUND_SUCCEEDED,
                    emailType: emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION,
                    recipient: registration.attendee_email,
                    registrationId: transaction.registration_id,
                    eventId: transaction.event_id,
                    success: emailResult.sent || emailResult.simulated,
                    messageId: emailResult.messageId,
                    error: emailResult.error,
                    metadata: { refundAmount: refundAmountDollars, stripeRefundId: refundData.id }
                });

                if (emailResult.sent || emailResult.simulated) {
                    emailAudit.markEmailSent(
                        emailAudit.TRIGGER_TYPES.STRIPE_REFUND_SUCCEEDED,
                        emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION,
                        transaction.registration_id
                    );
                    console.log(`[Webhook] ✅ Refund email sent to ${registration.attendee_email}`);
                }
            }
        }
    } catch (emailError) {
        console.error('[Webhook] Failed to send refund email:', emailError.message);
    }

    console.log(`[Webhook] Refund transaction recorded: $${refundAmountDollars}`);
}

/**
 * Handle account.updated for Connect accounts
 */
async function handleAccountUpdated(account) {
    console.log(`[Webhook] Processing account.updated: ${account.id}`);

    const isComplete = account.charges_enabled && account.payouts_enabled;

    // Get profile for logging
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('stripe_connect_id', account.id)
        .single();

    // Update profile with onboarding status
    const { error } = await supabase
        .from('profiles')
        .update({ stripe_onboarding_complete: isComplete })
        .eq('stripe_connect_id', account.id);

    if (error) {
        console.error('[Webhook] Failed to update profile:', error);
    }

    // Log to Audit Trail
    if (profile && isComplete) {
        try {
            await AuditLogService.logStripeConnect({
                actorId: profile.id,
                actorEmail: profile.email,
                stripeAccountId: account.id,
                status: 'completed',
                metadata: {
                    chargesEnabled: account.charges_enabled,
                    payoutsEnabled: account.payouts_enabled
                }
            });
        } catch (auditError) {
            console.error("[AuditLog] Failed to log Stripe Connect:", auditError.message);
        }
    }

    console.log(`[Webhook] Account ${account.id} onboarding complete: ${isComplete}`);
}

/**
 * Handle payout.paid for tracking organizer payouts
 */
async function handlePayoutPaid(payout) {
    console.log(`[Webhook] Processing payout.paid: ${payout.id}`);

    try {
        // ✅ FIX: Update financial transactions to 'paid' status
        const stripeAccountId = payout.destination || payout.account;
        
        // Find which organizer this payout is for
        const { data: organizer } = await supabase
            .from('profiles')
            .select('id')
            .eq('stripe_connect_id', stripeAccountId)
            .single();

        if (organizer) {
            // Update all transactions that were requested/scheduled to 'paid'
            const { data: updated, error } = await supabase
                .from('financial_transactions')
                .update({
                    payout_status: 'paid',
                    payout_date: new Date(payout.arrival_date * 1000).toISOString(),
                    payout_metadata: {
                        stripe_payout_id: payout.id,
                        amount: payout.amount / 100,
                        currency: payout.currency
                    }
                })
                .eq('organizer_id', organizer.id)
                .in('payout_status', ['requested', 'scheduled'])
                .select('id');

            if (error) {
                console.error('[Webhook] Failed to update payout status:', error);
            } else {
                console.log(`[Webhook] Updated ${updated?.length || 0} transactions to 'paid' status for organizer ${organizer.id}`);
            }
        } else {
            console.log(`[Webhook] Payout is for account ${stripeAccountId} - logging for audit`);
        }

        // Log audit trail
        await AuditLogService.log({
            timestamp: new Date().toISOString(),
            actorId: 'stripe',
            actorType: 'system',
            action: 'payout_completed',
            targetType: 'payout',
            targetId: payout.id,
            details: {
                stripe_account_id: stripeAccountId,
                amount: payout.amount / 100,
                currency: payout.currency,
                arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
                type: payout.type
            }
        });

    } catch (error) {
        console.error('[Webhook] Error handling payout.paid:', error);
    }
}

/**
 * Handle payout.failed
 * Track failed payouts and notify affected organizers
 */
async function handlePayoutFailed(payout) {
    console.error(`[Webhook] Processing payout.failed: ${payout.id}`);
    console.error(`[Webhook] Failure reason: ${payout.failure_message || 'Unknown'}`);
    console.error(`[Webhook] Amount: ${payout.currency.toUpperCase()} ${payout.amount / 100}`);

    try {
        // 1. Log to audit trail
        await AuditLogService.log({
            timestamp: new Date().toISOString(),
            actorId: 'system',
            actorType: 'system',
            action: 'payout_failed',
            targetType: 'payout',
            targetId: payout.id,
            details: {
                stripePayoutId: payout.id,
                stripeAccountId: payout.destination || payout.account,
                amount: payout.amount / 100,
                currency: payout.currency,
                failureCode: payout.failure_code,
                failureMessage: payout.failure_message,
                failureBalanceTransaction: payout.failure_balance_transaction,
                arrivalDate: payout.arrival_date,
            }
        });

        // 2. Find the affected organizer
        const stripeAccountId = payout.destination || payout.account;
        const { data: organizer, error } = await supabase
            .from('profiles')
            .select('id, email, name, business_name')
            .eq('stripe_connect_id', stripeAccountId)
            .single();

        if (error || !organizer) {
            console.error(`[Webhook] Could not find organizer for Stripe account: ${stripeAccountId}`);
            return;
        }

        // 3. Send notification email to organizer
        try {
            const displayName = organizer.business_name || organizer.name || 'there';
            const formattedAmount = `${payout.currency.toUpperCase()} ${(payout.amount / 100).toFixed(2)}`;
            
            await EmailService.sendEmail({
                to: organizer.email,
                subject: `⚠️ Payout Failed - Action Required`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #e74c3c;">Payout Failed</h2>
                        
                        <p>Hi ${displayName},</p>
                        
                        <p>Unfortunately, your recent payout of <strong>${formattedAmount}</strong> has failed.</p>
                        
                        <p><strong>Failure Reason:</strong> ${payout.failure_message || 'Please contact support for details'}</p>
                        
                        <p>Please update your bank account information or contact our support team for assistance.</p>
                        
                        <p>Best regards,<br>OpenTicket Team</p>
                    </div>
                `
            });
            console.log(`[Webhook] Notification email sent to ${organizer.email}`);
        } catch (emailError) {
            console.error('[Webhook] Failed to send notification email:', emailError);
        }

    } catch (error) {
        console.error('[Webhook] Error handling payout.failed:', error);
    }
}

/**
 * ✅ FIX: Handle invoice.paid (subscription payments)
 * Track subscription revenue in financial_transactions
 */
async function handleInvoicePaid(invoice) {
    console.log(`[Webhook] Processing invoice.paid: ${invoice.id}`);

    try {
        // Check if it's a subscription invoice
        if (!invoice.subscription) {
            console.log('[Webhook] Invoice is not for a subscription, skipping');
            return;
        }

        const stripeSubscriptionId = invoice.subscription;

        // Find user by subscription ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, name')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single();

        if (profileError || !profile) {
            console.error(`[Webhook] Could not find profile for subscription: ${stripeSubscriptionId}`);
            return;
        }

        // Check if already recorded (idempotency)
        const { data: existing } = await supabase
            .from('financial_transactions')
            .select('id')
            .eq('stripe_payment_intent_id', invoice.payment_intent)
            .single();

        if (existing) {
            console.log(`[Webhook] Invoice ${invoice.id} already recorded. Skipping.`);
            return;
        }

        // Calculate amounts
        const grossAmount = invoice.amount_paid / 100;
        const stripeFee = invoice.charge 
            ? (await getActualStripeFee(invoice.charge)) 
            : (grossAmount * 0.029 + 0.30); // Fallback estimate: 2.9% + $0.30

        // Insert financial transaction
        const { error: txError } = await supabase
            .from('financial_transactions')
            .insert({
                user_id: profile.id,
                transaction_type: invoice.metadata?.subscription_type || 'subscription',
                type: 'subscription',
                gross_amount: grossAmount,
                platform_fee: grossAmount, // Platform keeps 100% of subscription revenue
                stripe_fee: stripeFee,
                organizer_net: 0,
                status: 'succeeded',
                stripe_payment_intent_id: invoice.payment_intent,
                currency: invoice.currency,
                created_at: new Date(invoice.created * 1000).toISOString(),
                metadata: {
                    invoice_id: invoice.id,
                    subscription_id: stripeSubscriptionId,
                    billing_reason: invoice.billing_reason
                }
            });

        if (txError) {
            console.error('[Webhook] Failed to insert subscription transaction:', txError);
        } else {
            console.log(`[Webhook] Recorded subscription payment: $${grossAmount} for user ${profile.email}`);
        }

    } catch (error) {
        console.error('[Webhook] Error handling invoice.paid:', error);
    }
}

/**
 * Handle invoice.payment_failed (subscription payment failures)
 */
async function handleInvoicePaymentFailed(invoice) {
    console.log(`[Webhook] Processing invoice.payment_failed: ${invoice.id}`);

    try {
        if (!invoice.subscription) {
            return;
        }

        const stripeSubscriptionId = invoice.subscription;

        // Find user
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, name')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .single();

        if (profile) {
            // Log audit trail
            await AuditLogService.log({
                timestamp: new Date().toISOString(),
                actorId: profile.id,
                actorType: 'user',
                action: 'subscription_payment_failed',
                targetType: 'subscription',
                targetId: stripeSubscriptionId,
                details: {
                    invoice_id: invoice.id,
                    amount: invoice.amount_due / 100,
                    currency: invoice.currency,
                    attempt_count: invoice.attempt_count,
                    next_payment_attempt: invoice.next_payment_attempt
                }
            });

            console.log(`[Webhook] Subscription payment failed for user ${profile.email}`);
        }
    } catch (error) {
        console.error('[Webhook] Error handling invoice.payment_failed:', error);
    }
}

/**
 * Helper: Get actual Stripe fee from charge
 */
async function getActualStripeFee(chargeId) {
    try {
        const stripe = getStripe();
        const charge = await stripe.charges.retrieve(chargeId, {
            expand: ['balance_transaction']
        });
        
        if (charge?.balance_transaction?.fee) {
            return charge.balance_transaction.fee / 100;
        }
    } catch (err) {
        console.warn('[Webhook] Could not retrieve actual stripe fee:', err.message);
    }
    return 0;
}



/**
 * Handle checkout.session.expired or async payment failed
 */
async function handlePaymentFailed(stripe, session) {
    console.log(`[Webhook] Processing payment failure for session: ${session.id}`);

    try {
        // Try to get the customer email and event info from metadata
        const metadata = session.metadata || {};
        const customerEmail = session.customer_details?.email || session.customer_email || metadata.customerEmail;
        const eventTitle = metadata.eventTitle || "Event Registration";
        const amount = session.amount_total ? (session.amount_total / 100) : 0;

        if (customerEmail) {
            await EmailService.sendPaymentFailedNotification(
                customerEmail,
                session.customer_details?.name || metadata.customerName || "Customer",
                eventTitle,
                amount,
                "Your payment session expired or was cancelled."
            );
            console.log(`[Webhook] Payment failed notification sent to ${customerEmail}`);
        }
    } catch (error) {
        console.error("[Webhook] Error handling payment failure:", error);
    }
}

/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(stripe, paymentIntent) {
    console.log(`[Webhook] Processing payment_intent.payment_failed: ${paymentIntent.id}`);

    try {
        const customerEmail = paymentIntent.receipt_email || 
            paymentIntent.metadata?.customerEmail ||
            paymentIntent.charges?.data?.[0]?.billing_details?.email;

        const failureMessage = paymentIntent.last_payment_error?.message || 
            "Your card was declined or there was an issue processing your payment.";

        const amount = paymentIntent.amount ? (paymentIntent.amount / 100) : 0;
        const eventTitle = paymentIntent.metadata?.eventTitle || "Event Registration";

        if (customerEmail) {
            await EmailService.sendPaymentFailedNotification(
                customerEmail,
                paymentIntent.metadata?.customerName || "Customer",
                eventTitle,
                amount,
                failureMessage
            );
            console.log(`[Webhook] Payment failed notification sent to ${customerEmail}`);
        } else {
            console.log("[Webhook] No customer email found for payment failed notification");
        }
    } catch (error) {
        console.error("[Webhook] Error handling payment intent failure:", error);
    }
}
