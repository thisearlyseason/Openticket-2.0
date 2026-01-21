import supabase from '../services/supabase.js';
import { createRequire } from 'module';
import { generateUniqueTickets } from '../utils/ticketGenerator.js';
import fraudPreventionService from '../services/fraudPreventionService.js';

const require = createRequire(import.meta.url);

const getStripe = () => {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
};

export const createRegistration = async (req, res) => {
    try {
        const registrationData = req.body;
        
        // 1. Validate Capacity
        const { data: eventData } = await supabase
            .from('events')
            .select('capacity, registered_count')
            .eq('id', registrationData.event_id)
            .single();
        
        // Calculate total ticket count from quantities
        let requestedQty = 0;
        if (registrationData.tickets && Array.isArray(registrationData.tickets)) {
            requestedQty = registrationData.tickets.reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);
        } else {
            requestedQty = 1;
        }

        if (eventData && eventData.capacity && (eventData.registered_count || 0) + requestedQty > eventData.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 2. Transform tickets to unique ticket structure
        if (registrationData.tickets && Array.isArray(registrationData.tickets)) {
            const attendeeName = registrationData.attendee_name || 'Guest';
            const assignedNames = registrationData.assigned_names || []; // Optional: names assigned during checkout
            
            registrationData.tickets = generateUniqueTickets(
                registrationData.tickets,
                null, // Registration ID not yet available
                attendeeName,
                assignedNames
            );
            
            console.log(`[Registration] Generated ${registrationData.tickets.length} unique tickets with IDs and QR codes`);
        }

        // 3. Sanitize & Secure Security Status
        const payload = {
            ...registrationData,
            payment_status: 'pending',
            approval_status: 'approved',
            created_at: new Date()
        };

        // If organizer is logged in, they might be manually adding a 'paid' guest
        if (req.user) {
            const { data: event } = await supabase
                .from('events')
                .select('owner_id')
                .eq('id', registrationData.event_id)
                .single();
            if (event && event.owner_id === req.user.uid) {
                payload.payment_status = registrationData.payment_status || 'paid';
            }
        }

        const { data, error } = await supabase
            .from('registrations')
            .insert([payload])
            .select();

        if (error) throw error;
        
        console.log(`[Registration] Created registration ${data[0].id} with ${data[0].tickets?.length || 0} unique tickets`);
        res.status(201).json({ registration: data[0] });
    } catch (error) {
        console.error("Create Registration Error:", error);
        res.status(400).json({ error: error.message });
    }
};

export const getRegistrationsByEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const owner_id = req.user.uid;

        // Verify that the user owns the event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', eventId)
            .single();

        if (eventError || event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized to view registrations for this event' });
        }

        // Fetch registrations with financial data
        const { data, error } = await supabase
            .from('registrations')
            .select('*, financial_transactions(stripe_fee, platform_fee, organizer_net, gross_amount, status)')
            .eq('event_id', eventId);

        if (error) throw error;
        
        // Auto-fix: Update payment_status to 'paid' for registrations that have stripe_payment_intent_id
        // This helps clean up old data without requiring manual SQL
        const pendingWithPayment = data.filter(r => 
            r.payment_status === 'pending' && r.stripe_payment_intent_id
        );
        
        if (pendingWithPayment.length > 0) {
            console.log(`[AutoFix] Updating ${pendingWithPayment.length} registrations from pending to paid`);
            await Promise.all(pendingWithPayment.map(r => 
                supabase.from('registrations')
                    .update({ payment_status: 'paid' })
                    .eq('id', r.id)
            ));
            // Update the local data to reflect changes
            pendingWithPayment.forEach(r => r.payment_status = 'paid');
        }
        
        res.json({ registrations: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const updates = req.body;

        // Verify ownership
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('event_id')
            .eq('id', id)
            .single();

        if (regError) throw regError;

        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('owner_id')
            .eq('id', reg.event_id)
            .single();

        if (eventError || event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized to update this registration' });
        }

        const { data, error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ registration: data[0] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getAllRegistrations = async (req, res) => {
    try {
        const { stripe_checkout_session_id, email, user_id } = req.query;

        // SECURITY FIX: Require valid filters (not empty strings)
        const hasValidSessionId = stripe_checkout_session_id && stripe_checkout_session_id.trim() !== '';
        const hasValidEmail = email && email.trim() !== '';
        const hasValidUserId = user_id && user_id.trim() !== '';
        
        if (!hasValidSessionId && !hasValidEmail && !hasValidUserId) {
            return res.status(403).json({ error: "Missing filter parameters" });
        }

        let query = supabase.from('registrations').select('*');

        if (hasValidSessionId) {
            query = query.eq('stripe_checkout_session_id', stripe_checkout_session_id);
        }
        if (hasValidEmail) {
            // Case-insensitive email matching using ilike
            const normalizedEmail = email.toLowerCase().trim();
            query = query.ilike('attendee_email', normalizedEmail);
        }
        if (hasValidUserId) {
            query = query.eq('user_id', user_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        console.log(`[Registrations] Found ${data?.length || 0} registrations for query`, { 
            email: email ? '***' : null, 
            user_id: user_id ? '***' : null 
        });
        
        res.json({ registrations: data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Process refund via Stripe and update financial records
 */
export const refundRegistration = async (req, res) => {
    try {
        const stripe = getStripe();
        const { id } = req.params;
        const owner_id = req.user.uid;
        const { tickets, reason } = req.body;

        // 1. Verify Ownership
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(owner_id, title)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if already fully refunded
        if (reg.payment_status === 'refunded') {
            return res.status(400).json({ 
                error: 'This registration has already been fully refunded',
                canRefund: false
            });
        }

        // If partial refund requested, check if those specific tickets are already refunding/refunded
        if (Array.isArray(tickets) && tickets.length > 0 && reg.tickets) {
            const alreadyRefunding = tickets.some(ticketIdx => {
                const ticket = reg.tickets[ticketIdx];
                return ticket && (ticket.status === 'refunding' || ticket.status === 'refunded');
            });
            
            if (alreadyRefunding) {
                return res.status(400).json({ 
                    error: 'One or more selected tickets are already being refunded',
                    canRefund: false
                });
            }
        }
        
        // Allow refund if payment was completed (even if status is 'refunding' for other tickets)
        if (reg.payment_status !== 'paid' && reg.payment_status !== 'completed' && reg.payment_status !== 'refunding') {
            console.error('[Refund] Cannot refund - payment not complete:', reg.payment_status);
            return res.status(400).json({ 
                error: 'Cannot refund: Payment is not complete',
                paymentStatus: reg.payment_status,
                canRefund: false
            });
        }

        let updates = {};
        let amountToRefundCents = 0;
        let isFullRefund = false;
        let ticketsBeingRefunded = 0; // Track how many tickets to decrement from registered_count

        // 2. Calculate refund amount
        if (Array.isArray(tickets) && tickets.length === 0) {
            // Full Refund
            isFullRefund = true;
            updates = {
                payment_status: 'refunded'
            };
            
            if (reg.tickets) {
                updates.tickets = reg.tickets.map(t => ({ ...t, status: 'refunded' }));
                
                // Calculate full refund amount and count tickets
                reg.tickets.forEach(t => {
                    if (t.status !== 'refunded') {
                        amountToRefundCents += Math.round((t.pricePerTicket || 0) * (t.quantity || 1) * 100);
                        ticketsBeingRefunded += (t.quantity || 1);
                    }
                });
            }
            
            // Add add-ons to refund
            if (reg.add_ons) {
                updates.add_ons = reg.add_ons.map(a => ({ ...a, status: 'refunded' }));
                reg.add_ons.forEach(a => {
                    if (a.status !== 'refunded') {
                        amountToRefundCents += Math.round((a.price || 0) * (a.quantity || 1) * 100);
                    }
                });
            }
        } else {
            // Partial / Specific Ticket Update
            updates.tickets = tickets;
            
            if (reg.tickets) {
                tickets.forEach((t, idx) => {
                    const oldT = reg.tickets[idx];
                    if (t.status === 'refunded' && oldT && oldT.status !== 'refunded') {
                        amountToRefundCents += Math.round((t.pricePerTicket || 0) * (t.quantity || 1) * 100);
                        ticketsBeingRefunded += (t.quantity || 1);
                    }
                });
            }

            const allRefunded = tickets.every(t => t.status === 'refunded');
            if (allRefunded && (!reg.add_ons || reg.add_ons.every(a => a.status === 'refunded'))) {
                updates.payment_status = 'refunded';
            }
        }

        // 3. Process Stripe Refund
        let stripeRefundId = null;
        let stripeError = null;
        let stripeAttempted = false;
        
        // Log refund request details
        console.log('[Refund] Request Details:', {
            registrationId: id,
            eventId: reg.event_id,
            ticketsToRefund: ticketsBeingRefunded,
            amountCents: amountToRefundCents,
            amountDollars: (amountToRefundCents / 100).toFixed(2),
            isFullRefund,
            hasStripeSession: !!reg.stripe_checkout_session_id,
            paymentStatus: reg.payment_status
        });
        
        // Set to "refunding" state NOW (after all validations, before Stripe call)
        // Only use payment_status since refund_status column may not exist in DB
        await supabase
            .from('registrations')
            .update({ 
                payment_status: 'refunding'
            })
            .eq('id', id);
        
        // Check if this is a Stripe payment or a manual/cash payment
        const isStripePayment = !!reg.stripe_checkout_session_id;
        const isManualPayment = !isStripePayment && (reg.payment_status === 'paid' || reg.payment_status === 'completed');
        
        if (isStripePayment && amountToRefundCents > 0) {
            stripeAttempted = true;
            let session = null; // Declare outside try block for error handling
            
            try {
                console.log('[Refund] Retrieving Stripe session:', reg.stripe_checkout_session_id);
                session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
                
                if (!session) {
                    stripeError = 'Stripe session not found';
                    console.error('[Refund] Session not found:', reg.stripe_checkout_session_id);
                    
                    // Reset payment_status since we can't process
                    await supabase
                        .from('registrations')
                        .update({ 
                            payment_status: reg.payment_status  // Restore original
                        })
                        .eq('id', id);
                    
                    // CRITICAL: Block refund if Stripe session not found
                    return res.status(400).json({
                        error: 'Cannot refund: Stripe session not found',
                        stripeError,
                        canRefund: false,
                        diagnostics: {
                            sessionId: reg.stripe_checkout_session_id,
                            registrationId: id
                        }
                    });
                    
                } else if (!session.payment_intent) {
                    // Session exists but no payment intent - incomplete checkout or free event
                    console.warn('[Refund] Session has no payment intent, treating as manual refund:', {
                        sessionId: reg.stripe_checkout_session_id,
                        sessionStatus: session.status,
                        paymentStatus: session.payment_status
                    });
                    // Continue without Stripe refund - just mark as refunded in DB
                    // This happens when: checkout was abandoned, free event, or payment failed
                    stripeAttempted = false;
                    stripeError = null; // Clear any error - this is expected for incomplete checkouts
                    
                } else if (session.payment_status !== 'paid' && session.payment_status !== 'succeeded') {
                    // Session has payment intent but payment was not completed
                    console.warn('[Refund] Session payment not completed, treating as manual refund:', {
                        sessionId: reg.stripe_checkout_session_id,
                        sessionStatus: session.status,
                        paymentStatus: session.payment_status,
                        paymentIntent: session.payment_intent
                    });
                    stripeAttempted = false;
                    stripeError = null;
                    
                } else {
                    // Validate payment intent before attempting refund
                    console.log('[Refund] Validating payment intent:', session.payment_intent);
                    
                    // Retrieve the payment intent to check its status
                    let paymentIntent;
                    try {
                        paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent);
                        console.log('[Refund] Payment Intent details:', {
                            id: paymentIntent.id,
                            status: paymentIntent.status,
                            amount: paymentIntent.amount,
                            currency: paymentIntent.currency,
                            chargeId: paymentIntent.latest_charge,
                            amountReceived: paymentIntent.amount_received,
                            amountRefunded: paymentIntent.amount_refunded || 0,
                            refundable: (paymentIntent.amount_received || paymentIntent.amount) - (paymentIntent.amount_refunded || 0)
                        });
                        
                        // VALIDATION 1: Check payment intent status
                        if (paymentIntent.status !== 'succeeded') {
                            throw new Error(`Payment intent status is '${paymentIntent.status}', must be 'succeeded' to refund`);
                        }
                        
                        // VALIDATION 2: Check if already fully refunded
                        const amountRefunded = paymentIntent.amount_refunded || 0;
                        const amountReceived = paymentIntent.amount_received || paymentIntent.amount;
                        const refundableAmount = amountReceived - amountRefunded;
                        
                        if (refundableAmount <= 0) {
                            throw new Error(`Payment has already been fully refunded. Amount refunded: $${amountRefunded / 100}, Amount received: $${amountReceived / 100}`);
                        }
                        
                        // VALIDATION 3: Check if requested amount exceeds refundable
                        if (!isFullRefund && amountToRefundCents > refundableAmount) {
                            throw new Error(`Requested refund ($${amountToRefundCents / 100}) exceeds refundable amount ($${refundableAmount / 100})`);
                        }
                        
                        // VALIDATION 4: Ensure there's a charge to refund
                        if (!paymentIntent.latest_charge) {
                            throw new Error('Payment intent has no charge to refund');
                        }
                        
                    } catch (validationError) {
                        console.error('[Refund] ❌ Validation failed:', validationError.message);
                        
                        // Reset payment_status
                        await supabase
                            .from('registrations')
                            .update({ payment_status: reg.payment_status })
                            .eq('id', id);
                        
                        return res.status(400).json({
                            error: 'Refund validation failed',
                            stripeError: validationError.message,
                            canRefund: false,
                            diagnostics: {
                                paymentIntent: session.payment_intent,
                                paymentIntentStatus: paymentIntent?.status,
                                amountReceived: paymentIntent?.amount_received,
                                amountRefunded: paymentIntent?.amount_refunded,
                                refundableAmount: paymentIntent ? (paymentIntent.amount_received || paymentIntent.amount) - (paymentIntent.amount_refunded || 0) : 0,
                                requestedAmount: amountToRefundCents
                            }
                        });
                    }
                    
                    const refundParams = {
                        payment_intent: session.payment_intent,
                        reason: 'requested_by_customer',
                        metadata: {
                            registrationId: id,
                            eventId: reg.event_id,
                            reason: reason || 'Organizer initiated refund',
                            ticketsRefunded: ticketsBeingRefunded.toString()
                        },
                    };

                    if (!isFullRefund && amountToRefundCents > 0) {
                        refundParams.amount = amountToRefundCents;
                    }

                    console.log('[Refund] 🔄 Calling Stripe refunds.create API:', {
                        paymentIntent: session.payment_intent,
                        amount: refundParams.amount ? `$${refundParams.amount / 100}` : 'FULL',
                        amountInCents: refundParams.amount || 'FULL',
                        isPartialRefund: !!refundParams.amount,
                        currency: paymentIntent.currency
                    });

                    const refund = await stripe.refunds.create(refundParams);
                    stripeRefundId = refund.id;
                    
                    console.log('[Refund] ✅ Stripe refund created successfully:', {
                        refundId: refund.id,
                        amount: `$${(refund.amount || amountToRefundCents) / 100}`,
                        status: refund.status,
                        currency: refund.currency,
                        paymentIntent: refund.payment_intent,
                        charge: refund.charge
                    });
                }
            } catch (err) {
                stripeError = err.message;
                console.error('[Refund] ❌ Stripe API error:', {
                    error: err.message,
                    code: err.code,
                    type: err.type,
                    rawError: err,
                    registrationId: id,
                    sessionId: reg.stripe_checkout_session_id,
                    paymentIntent: session?.payment_intent
                });
                
                // CRITICAL: Reset payment_status since Stripe failed
                await supabase
                    .from('registrations')
                    .update({ 
                        payment_status: reg.payment_status  // Restore original payment status
                    })
                    .eq('id', id);
                
                // CRITICAL: Block refund if Stripe API fails
                return res.status(400).json({
                    error: 'Stripe refund failed',
                    stripeError: err.message,
                    stripeCode: err.code,
                    stripeType: err.type,
                    canRefund: false,
                    diagnostics: {
                        errorCode: err.code,
                        errorType: err.type,
                        registrationId: id,
                        sessionId: reg.stripe_checkout_session_id,
                        paymentIntent: session?.payment_intent,
                        attemptedAmount: amountToRefundCents
                    }
                });
            }
        } else if (!reg.stripe_checkout_session_id && amountToRefundCents > 0) {
            // Manual/offline payment - no Stripe refund needed
            console.log('[Refund] Manual/offline registration - no Stripe session');
            stripeAttempted = false;
        }

        // CRITICAL: Only proceed with DB update if:
        // 1. Stripe refund succeeded (stripeRefundId exists), OR
        // 2. No Stripe payment exists (manual/offline registration)
        if (!stripeAttempted || stripeRefundId) {
            console.log('[Refund] Proceeding with DB update:', {
                stripeRefundId: stripeRefundId || 'N/A (manual)',
                reason: stripeRefundId ? 'Stripe confirmed' : 'No Stripe payment'
            });
        } else {
            // This should never be reached due to early returns above
            console.error('[Refund] ❌ CRITICAL: Reached DB update without Stripe confirmation');
            return res.status(500).json({
                error: 'Internal error: Refund validation failed',
                canRefund: false
            });
        }

        // 4. Update registration in DB (only reached if Stripe succeeded or not needed)
        // Only use columns that are guaranteed to exist in the schema
        updates.payment_status = stripeRefundId || !stripeAttempted ? 'refunded' : reg.payment_status;
        
        // Store refund metadata in tickets array or a JSON field if available
        // For now, just update the payment_status which is the critical field

        const { data, error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('[Refund] Failed to update registration:', error);
            throw new Error(`Failed to update registration: ${error.message}`);
        }

        // 5. Decrement registered_count
        if (ticketsBeingRefunded > 0) {
            try {
                // Try RPC first
                const { error: countError } = await supabase.rpc('decrement_registered_count', {
                    p_event_id: reg.event_id,
                    p_count: ticketsBeingRefunded
                });

                if (countError) {
                    console.warn('[Refund] RPC decrement failed, using direct update:', countError.message);
                    // Fallback: manual decrement
                    const { data: eventData } = await supabase
                        .from('events')
                        .select('registered_count')
                        .eq('id', reg.event_id)
                        .single();

                    if (eventData) {
                        await supabase
                            .from('events')
                            .update({ registered_count: Math.max(0, (eventData.registered_count || 0) - ticketsBeingRefunded) })
                            .eq('id', reg.event_id);
                    }
                }

                console.log(`[Refund] Decremented registered_count by ${ticketsBeingRefunded} for event ${reg.event_id}`);
            } catch (countErr) {
                console.error('[Refund] Failed to decrement count:', countErr);
                // Don't fail the refund if count update fails
            }
        }

        // 6. Financial record is created by webhook (charge.refunded)
        // But we can create it here as backup if webhook doesn't fire
        if (!reg.stripe_checkout_session_id && amountToRefundCents > 0) {
            // Manual/offline registration refund - create financial record
            await supabase.from('financial_transactions').insert({
                registration_id: id,
                event_id: reg.event_id,
                gross_amount: -(amountToRefundCents / 100),
                platform_fee: 0,
                stripe_fee: 0,
                organizer_net: -(amountToRefundCents / 100),
                currency: 'usd',
                status: 'refunded',
                payout_status: 'settled',
                transaction_type: 'refund',
            });
        } else if (stripeRefundId && amountToRefundCents > 0) {
            // Stripe refund - create backup financial record marked as pending_webhook
            try {
                await supabase.from('financial_transactions').insert({
                    registration_id: id,
                    event_id: reg.event_id,
                    gross_amount: -(amountToRefundCents / 100),
                    platform_fee: 0,
                    stripe_fee: 0,
                    organizer_net: -(amountToRefundCents / 100),
                    currency: 'usd',
                    status: 'refunded',
                    payout_status: 'pending_webhook',
                    transaction_type: 'refund',
                    stripe_refund_id: stripeRefundId,
                });
                console.log(`[Refund] Created backup financial record for Stripe refund ${stripeRefundId}`);
            } catch (finError) {
                console.warn('[Refund] Failed to create backup financial record:', finError.message);
                // Don't fail the refund if backup record creation fails
            }
        }

        const isManualRefund = !stripeRefundId && !stripeAttempted;
        const refundTypeMessage = isManualRefund 
            ? 'Manual refund recorded (no Stripe payment to refund)' 
            : (stripeRefundId ? 'Stripe refund processed successfully' : 'Refund recorded but Stripe processing failed');

        // 7. Send refund confirmation email (ALWAYS send for successful refunds)
        // This ensures email delivery regardless of webhook status
        let emailSent = false;
        let emailError = null;
        
        try {
            const { refundConfirmation } = await import('../services/emailTemplates.js');
            const emailAudit = await import('../services/emailAuditService.js');
            const { sendEmailWithProvider } = await import('../services/cronService.js');

            // Get event details for the email
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('title, date, location, owner_id, email_settings, ticket_design, organizer')
                .eq('id', reg.event_id)
                .single();

            if (eventError) {
                console.warn('[Refund] Could not fetch event details:', eventError.message);
            }

            const emailSettings = eventData?.email_settings || {};
            
            // Send refund email if:
            // 1. Refund emails are NOT explicitly disabled (default: enabled)
            // 2. Attendee has an email address
            const shouldSendEmail = emailSettings.refundEnabled !== false && reg.attendee_email;
            
            console.log(`[Refund] Email check: shouldSend=${shouldSendEmail}, email=${reg.attendee_email}, refundEnabled=${emailSettings.refundEnabled}`);
            
            if (shouldSendEmail) {
                // Check if email was already sent (by webhook) to prevent duplicates
                const alreadySent = await emailAudit.wasEmailSent(
                    'refund_api',
                    emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION,
                    id
                );

                if (!alreadySent) {
                    console.log(`[Refund] Preparing refund email for ${reg.attendee_email}...`);
                    
                    const eventDate = eventData?.date 
                        ? new Date(eventData.date).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })
                        : 'Date not available';

                    const { subject, html } = refundConfirmation({
                        attendeeName: reg.attendee_name || 'Guest',
                        eventTitle: eventData?.title || 'Event',
                        eventDate,
                        eventLocation: eventData?.location || 'TBD',
                        refundAmount: amountToRefundCents / 100,
                        ticketsRefunded: ticketsBeingRefunded,
                        orderId: id.substring(0, 8).toUpperCase(),
                        refundReason: reason || '',
                        refundDate: new Date().toLocaleDateString('en-US', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        }),
                        ticketDesign: eventData?.ticket_design,  // Pass event's visual design for themed emails
                        organizerName: eventData?.organizer || 'Event Organizer'
                    });

                    console.log(`[Refund] Sending email with subject: ${subject}`);

                    const emailResult = await sendEmailWithProvider(
                        reg.attendee_email,
                        subject,
                        html,
                        eventData?.owner_id
                    );

                    // Log the email attempt
                    await emailAudit.logEmailSend({
                        triggerType: 'refund_api',
                        emailType: emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION,
                        recipient: reg.attendee_email,
                        registrationId: id,
                        eventId: reg.event_id,
                        success: emailResult.sent || emailResult.simulated,
                        messageId: emailResult.messageId,
                        error: emailResult.error,
                        metadata: { 
                            refundAmount: amountToRefundCents / 100, 
                            stripeRefundId,
                            ticketsRefunded: ticketsBeingRefunded 
                        }
                    });

                    if (emailResult.sent) {
                        await emailAudit.markEmailSent('refund_api', emailAudit.EMAIL_TYPES.REFUND_CONFIRMATION, id);
                        console.log(`[Refund] ✅ Refund email SENT to ${reg.attendee_email}`);
                        emailSent = true;
                    } else if (emailResult.simulated) {
                        console.log(`[Refund] 📧 Refund email SIMULATED for ${reg.attendee_email} (Resend not configured)`);
                        emailSent = true; // Count simulation as success for response
                    } else {
                        console.error(`[Refund] ❌ Failed to send refund email: ${emailResult.error}`);
                        emailError = emailResult.error;
                    }
                } else {
                    console.log(`[Refund] ℹ️ Refund email already sent for registration ${id}`);
                    emailSent = true; // Already sent counts as success
                }
            } else {
                if (!reg.attendee_email) {
                    console.log(`[Refund] ⚠️ No email address for registration ${id}`);
                } else {
                    console.log(`[Refund] ⚠️ Refund emails disabled for this event`);
                }
            }
        } catch (emailErr) {
            console.error('[Refund] ❌ Email sending exception:', emailErr.message);
            console.error('[Refund] Stack:', emailErr.stack);
            emailError = emailErr.message;
        }

        res.json({ 
            success: true,
            registration: data[0],
            refundAmount: amountToRefundCents / 100,
            stripeRefundId: stripeRefundId || null,
            ticketsRefunded: ticketsBeingRefunded,
            message: `Successfully refunded ${ticketsBeingRefunded} ticket(s) for $${(amountToRefundCents / 100).toFixed(2)}. ${refundTypeMessage}`,
            emailStatus: {
                sent: emailSent,
                error: emailError,
                recipient: reg.attendee_email || null
            },
            isManualRefund,
            stripeError: stripeError || undefined,
            warning: stripeError ? 'Registration marked as refunded, but Stripe refund failed. You may need to process the refund manually in Stripe dashboard.' : undefined,
            diagnostics: {
                hadStripeSession: !!reg.stripe_checkout_session_id,
                stripeAttempted,
                stripeRefundId: stripeRefundId || null,
                paymentIntent: stripeAttempted ? 'Retrieved from session' : 'N/A',
                refundStatus: stripeRefundId ? 'completed' : (stripeAttempted ? 'failed' : 'manual'),
                dbUpdated: true,
                countDecremented: ticketsBeingRefunded,
                originalPaymentStatus: reg.payment_status,
                refundTimestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[Refund] Error:', error);
        res.status(400).json({ error: error.message });
    }
};

/**
 * Refund a specific add-on
 */
export const refundAddOn = async (req, res) => {
    try {
        const stripe = getStripe();
        const { id } = req.params;
        const owner_id = req.user.uid;
        const { addonIndex, reason } = req.body;

        // 1. Verify Ownership
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(owner_id)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!reg.add_ons || !reg.add_ons[addonIndex]) {
            return res.status(400).json({ error: 'Add-on not found at index' });
        }

        // 2. Update Addon Status & Calculate Refund
        const updatedAddOns = [...reg.add_ons];
        const targetAddon = updatedAddOns[addonIndex];

        if (targetAddon.status === 'refunded') {
            return res.status(400).json({ error: 'Add-on already refunded' });
        }

        targetAddon.status = 'refunded';
        const amountToRefundCents = Math.round((targetAddon.price || 0) * (targetAddon.quantity || 1) * 100);

        // 3. Process Stripe Refund
        let stripeRefundId = null;
        if (reg.stripe_checkout_session_id && amountToRefundCents > 0) {
            try {
                const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
                
                if (session && session.payment_intent) {
                    const refund = await stripe.refunds.create({
                        payment_intent: session.payment_intent,
                        amount: amountToRefundCents,
                        reason: 'requested_by_customer',
                        metadata: {
                            registrationId: id,
                            addonIndex: addonIndex.toString(),
                            addonName: targetAddon.name,
                        },
                    });
                    stripeRefundId = refund.id;
                }
            } catch (stripeError) {
                console.error('[Refund AddOn] Stripe error:', stripeError.message);
            }
        }

        // 4. Update DB - only use columns that exist
        const { data, error } = await supabase
            .from('registrations')
            .update({ 
                add_ons: updatedAddOns
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ 
            registration: data[0],
            refundAmount: amountToRefundCents / 100,
            stripeRefundId,
        });

    } catch (error) {
        console.error('[Refund AddOn] Error:', error);
        res.status(400).json({ error: error.message });
    }
};

/**
 * Check-in a specific ticket by ticket ID
 * POST /api/registrations/checkin
 */
export const checkInTicket = async (req, res) => {
    try {
        const { ticketId, eventId } = req.body;
        const organizerId = req.user.uid;
        
        console.log(`[CheckIn] Attempting check-in: ticketId=${ticketId}, eventId=${eventId}`);
        
        if (!ticketId) {
            return res.status(400).json({ error: 'Ticket ID is required' });
        }
        
        // 1. Verify event ownership
        if (eventId) {
            const { data: event, error: eventError } = await supabase
                .from('events')
                .select('owner_id')
                .eq('id', eventId)
                .single();
            
            if (eventError || !event) {
                return res.status(404).json({ error: 'Event not found' });
            }
            
            if (event.owner_id !== organizerId) {
                return res.status(403).json({ error: 'Unauthorized: You do not own this event' });
            }
        }
        
        // 2. Find the registration containing this ticket ID
        const { data: registrations, error: searchError } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', eventId || '');
        
        if (searchError) {
            console.error('[CheckIn] Search error:', searchError);
            return res.status(500).json({ error: 'Failed to search for ticket' });
        }
        
        // 3. Search through all registrations for the ticket
        let targetRegistration = null;
        let ticketIndex = -1;
        
        for (const reg of registrations) {
            if (!reg.tickets || !Array.isArray(reg.tickets)) continue;
            
            const index = reg.tickets.findIndex(t => 
                t.ticketId === ticketId || 
                t.qrCodeData === ticketId ||
                t.ticketNumber === ticketId
            );
            
            if (index !== -1) {
                targetRegistration = reg;
                ticketIndex = index;
                break;
            }
        }
        
        if (!targetRegistration || ticketIndex === -1) {
            console.log(`[CheckIn] Ticket not found: ${ticketId}`);
            return res.status(404).json({ 
                error: 'Ticket not found',
                message: 'This ticket does not exist in this event or has been invalidated'
            });
        }
        
        const ticket = targetRegistration.tickets[ticketIndex];
        
        // 4. Validate ticket status
        if (ticket.status === 'refunded') {
            return res.status(400).json({ 
                error: 'Ticket refunded',
                message: 'This ticket has been refunded and is no longer valid'
            });
        }
        
        if (ticket.status === 'cancelled') {
            return res.status(400).json({ 
                error: 'Ticket cancelled',
                message: 'This ticket has been cancelled'
            });
        }
        
        if (ticket.checkedIn) {
            return res.status(400).json({ 
                error: 'Already checked in',
                message: `This ticket was already checked in${ticket.checkedInAt ? ' at ' + new Date(ticket.checkedInAt).toLocaleString() : ''}`,
                ticket: {
                    ticketNumber: ticket.ticketNumber,
                    attendeeName: ticket.attendeeName,
                    checkedInAt: ticket.checkedInAt
                }
            });
        }
        
        // 5. Update ticket check-in status
        const updatedTickets = [...targetRegistration.tickets];
        updatedTickets[ticketIndex] = {
            ...ticket,
            checkedIn: true,
            checkedInAt: new Date().toISOString(),
            checkedInBy: organizerId
        };
        
        const { data: updatedReg, error: updateError } = await supabase
            .from('registrations')
            .update({ tickets: updatedTickets })
            .eq('id', targetRegistration.id)
            .select()
            .single();
        
        if (updateError) {
            console.error('[CheckIn] Update error:', updateError);
            return res.status(500).json({ error: 'Failed to update ticket status' });
        }
        
        console.log(`[CheckIn] Success: ${ticket.ticketNumber} for ${ticket.attendeeName}`);
        
        // 6. Return success with ticket details
        res.json({
            success: true,
            message: 'Check-in successful',
            ticket: {
                ticketId: ticket.ticketId,
                ticketNumber: ticket.ticketNumber,
                attendeeName: ticket.attendeeName,
                originalAttendeeName: ticket.originalAttendeeName,
                tierName: ticket.name,
                checkedInAt: updatedTickets[ticketIndex].checkedInAt,
                transferStatus: ticket.transferStatus,
                transferredFrom: ticket.transferredFromEmail
            }
        });
        
    } catch (error) {
        console.error('[CheckIn] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const transferTicket = async (req, res) => {
    try {
        const { id } = req.params; // Registration ID
        const { recipientEmail, ticketKey } = req.body;
        const senderUserId = req.user.uid;

        console.log(`[Transfer] Initiating transfer: registration=${id}, ticket=${ticketKey}, to=${recipientEmail}`);

        // 1. Validate input
        if (!recipientEmail || !ticketKey) {
            return res.status(400).json({ error: 'Recipient email and ticket key are required' });
        }

        // 2. Fetch the registration
        const { data: registration, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', id)
            .single();

        if (regError || !registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // 3. Verify sender owns this registration
        // Check both user_id and email (for backward compatibility and guest checkouts)
        let senderOwnsTicket = false;
        
        // First check: user_id match (if available)
        if (registration.user_id && registration.user_id === senderUserId) {
            senderOwnsTicket = true;
            console.log('[Transfer] Ownership verified by user_id');
        }
        
        // Second check: Get user's email from profile and match with registration email
        if (!senderOwnsTicket) {
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', senderUserId)
                .single();
            
            if (userProfile && userProfile.email === registration.attendee_email) {
                senderOwnsTicket = true;
                console.log('[Transfer] Ownership verified by email match');
            }
        }
        
        if (!senderOwnsTicket) {
            console.log('[Transfer] Ownership verification failed:', {
                regUserId: registration.user_id,
                senderUserId: senderUserId,
                regEmail: registration.attendee_email
            });
            return res.status(403).json({ error: 'You do not own this ticket' });
        }

        // 4. Find the specific ticket
        const tickets = registration.tickets || [];
        
        console.log('[Transfer] Looking for ticket:', { ticketKey });
        console.log('[Transfer] Available tickets:', JSON.stringify(tickets.map(t => ({ 
            ticketId: t.ticketId,
            key: t.key, 
            id: t.id, 
            tierId: t.tierId, 
            name: t.name,
            quantity: t.quantity 
        }))));
        
        // Try multiple matching strategies
        let ticketIndex = -1;
        
        // Strategy 0: NEW - Match by unique ticketId (for new ticket structure)
        ticketIndex = tickets.findIndex(t => t.ticketId === ticketKey);
        if (ticketIndex !== -1) {
            console.log('[Transfer] Matched by ticketId (new structure)');
        }
        
        // Strategy 1: Direct key match (legacy)
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.key === ticketKey);
            if (ticketIndex !== -1) console.log('[Transfer] Matched by key');
        }
        
        // Strategy 2: Direct id match (legacy)
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.id === ticketKey);
            if (ticketIndex !== -1) console.log('[Transfer] Matched by id');
        }
        
        // For legacy format, parse the key
        const keyParts = ticketKey.split('-');
        const tierIdPart = keyParts.slice(0, -1).join('-');
        const indexPart = keyParts[keyParts.length - 1];
        const ticketKeyIndex = parseInt(indexPart, 10);
        
        // Strategy 3: Match by tierId (legacy)
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.tierId === tierIdPart);
            if (ticketIndex !== -1) console.log('[Transfer] Matched by tierId');
        }
        
        // Strategy 4: Match by id equals tierIdPart (legacy)
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.id === tierIdPart);
            if (ticketIndex !== -1) console.log('[Transfer] Matched by id=tierIdPart');
        }
        
        // Strategy 5: For single ticket registrations, just use index 0
        if (ticketIndex === -1 && tickets.length === 1) {
            ticketIndex = 0;
            console.log('[Transfer] Using single ticket fallback');
        }
        
        // Strategy 6: Match by index if within bounds and quantity > ticketKeyIndex (legacy)
        if (ticketIndex === -1 && !isNaN(ticketKeyIndex)) {
            // Find ticket where the index falls within its quantity
            let runningIndex = 0;
            for (let i = 0; i < tickets.length; i++) {
                const t = tickets[i];
                const qty = t.quantity || 1;
                if (ticketKeyIndex < runningIndex + qty) {
                    ticketIndex = i;
                    console.log('[Transfer] Matched by quantity index:', { ticketIndex, ticketKeyIndex, runningIndex, qty });
                    break;
                }
                runningIndex += qty;
            }
        }
        
        if (ticketIndex === -1) {
            console.log('[Transfer] Ticket not found after all strategies');
            return res.status(404).json({ error: 'Ticket not found in registration' });
        }

        const ticket = tickets[ticketIndex];
        // Store the ticketKey for later use (fraud checks, etc.)
        const effectiveTicketKey = ticket.key || ticket.id || ticket.tierId || ticketKey;

        // 5. ENHANCED FRAUD PREVENTION CHECKS
        
        // 5a. Check if ticket is already checked in
        const checkInStatuses = registration.check_in_statuses || {};
        if (checkInStatuses[effectiveTicketKey]?.checkedIn || checkInStatuses[ticketKey]?.checkedIn || registration.checked_in) {
            return res.status(400).json({ error: 'Cannot transfer a checked-in ticket' });
        }

        // 5b. Check if ticket is already pending transfer
        if (ticket.transferStatus === 'pending') {
            return res.status(400).json({ error: 'This ticket already has a pending transfer' });
        }

        // 5c. Check if ticket was already transferred out
        if (ticket.transferStatus === 'transferred_out') {
            return res.status(400).json({ error: 'This ticket has already been transferred' });
        }

        // 5d. Run comprehensive fraud prevention checks
        const fraudCheck = await fraudPreventionService.performFraudChecks({
            ticketKey: effectiveTicketKey,
            userId: senderUserId,
            userEmail: registration.attendee_email,
            recipientEmail: recipientEmail
        });

        if (fraudCheck.blocked) {
            console.log(`[Transfer] Blocked by fraud prevention: ${fraudCheck.reason}`);
            return res.status(fraudCheck.reason === 'temporary_ban' || fraudCheck.reason === 'auto_ban' ? 403 : 429).json({
                error: fraudCheck.message,
                reason: fraudCheck.reason,
                strikes: fraudCheck.strikes,
                expiresAt: fraudCheck.expiresAt,
                fraudFlag: true
            });
        }

        console.log(`[Transfer] Fraud checks passed for user ${senderUserId} (${fraudCheck.strikes || 0} strikes)`);


        // 6. Find or verify recipient exists (optional - can transfer to any email)
        const { data: recipientProfile } = await supabase
            .from('profiles')
            .select('id, email, name')
            .eq('email', recipientEmail.toLowerCase())
            .single();

        // 7. Create transfer record with PENDING status
        const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { data: transferRecord, error: transferError } = await supabase
            .from('ticket_transfers')
            .insert({
                id: transferId,
                registration_id: id,
                ticket_key: effectiveTicketKey,
                event_id: registration.event_id,
                sender_user_id: senderUserId,
                sender_email: registration.attendee_email,
                sender_name: registration.attendee_name,
                recipient_email: recipientEmail.toLowerCase(),
                recipient_user_id: recipientProfile?.id || null,
                recipient_name: recipientProfile?.name || null,
                status: 'pending',
                undo_expires_at: new Date(Date.now() + 5000).toISOString(), // 5 seconds
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (transferError) {
            console.error('[Transfer] Error creating transfer record:', transferError);
            throw transferError;
        }

        // 8. Update ticket status to pending
        const updatedTickets = [...tickets];
        updatedTickets[ticketIndex] = {
            ...ticket,
            transferStatus: 'pending',
            transferId: transferId,
            transferInitiatedAt: new Date().toISOString()
        };

        const { error: updateError } = await supabase
            .from('registrations')
            .update({ 
                tickets: updatedTickets
            })
            .eq('id', id);

        if (updateError) {
            // Rollback transfer record
            await supabase.from('ticket_transfers').delete().eq('id', transferId);
            throw updateError;
        }

        // 9. Log the transfer initiation
        await supabase.from('security_audit_logs').insert({
            action: 'TRANSFER_INITIATED',
            entity_type: 'ticket',
            entity_id: effectiveTicketKey,
            user_id: senderUserId,
            user_email: registration.attendee_email,
            details: {
                transferId,
                recipientEmail,
                registrationId: id,
                eventId: registration.event_id
            },
            severity: 'info',
            created_at: new Date().toISOString()
        });

        console.log(`[Transfer] Transfer initiated: ${transferId}`);

        res.json({
            success: true,
            transferId,
            status: 'pending',
            undoExpiresAt: transferRecord.undo_expires_at,
            message: 'Transfer initiated. You have 5 seconds to undo.'
        });

    } catch (error) {
        console.error('[Transfer] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Undo a pending transfer (within 5 second window)
 * POST /api/registrations/:id/transfer/undo
 */
export const undoTransfer = async (req, res) => {
    try {
        const { id } = req.params;
        const { transferId } = req.body;
        const userId = req.user.uid;

        console.log(`[Transfer] Undo requested: transfer=${transferId}`);

        // 1. Fetch transfer record
        const { data: transfer, error: transferError } = await supabase
            .from('ticket_transfers')
            .select('*')
            .eq('id', transferId)
            .single();

        if (transferError || !transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        // 2. Verify sender owns the transfer
        if (transfer.sender_user_id !== userId) {
            return res.status(403).json({ error: 'You cannot undo this transfer' });
        }

        // 3. Check if still within undo window
        if (transfer.status !== 'pending') {
            return res.status(400).json({ error: 'Transfer already finalized or cancelled' });
        }

        const undoExpires = new Date(transfer.undo_expires_at);
        if (new Date() > undoExpires) {
            return res.status(400).json({ error: 'Undo window has expired' });
        }

        // 4. Cancel the transfer
        const { error: cancelError } = await supabase
            .from('ticket_transfers')
            .update({
                status: 'cancelled',
                undone_at: new Date().toISOString()
            })
            .eq('id', transferId);

        if (cancelError) throw cancelError;

        // 5. Restore ticket to active status
        const { data: registration } = await supabase
            .from('registrations')
            .select('tickets')
            .eq('id', id)
            .single();

        if (registration) {
            const tickets = registration.tickets || [];
            const ticketIndex = tickets.findIndex(t => t.key === transfer.ticket_key || t.id === transfer.ticket_key);
            
            if (ticketIndex !== -1) {
                tickets[ticketIndex] = {
                    ...tickets[ticketIndex],
                    transferStatus: 'active',
                    transferId: null,
                    transferInitiatedAt: null
                };

                await supabase
                    .from('registrations')
                    .update({ tickets })
                    .eq('id', id);
            }
        }

        // 6. Log the undo
        await supabase.from('security_audit_logs').insert({
            action: 'TRANSFER_UNDONE',
            entity_type: 'ticket',
            entity_id: transfer.ticket_key,
            user_id: userId,
            details: { transferId, reason: 'User undone within undo window' },
            severity: 'info',
            created_at: new Date().toISOString()
        });

        console.log(`[Transfer] Transfer undone: ${transferId}`);

        res.json({ success: true, message: 'Transfer cancelled successfully' });

    } catch (error) {
        console.error('[Transfer] Undo error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Finalize a pending transfer (called by cron or after undo window)
 * POST /api/registrations/:id/transfer/finalize
 */
export const finalizeTransfer = async (req, res) => {
    try {
        const { transferId } = req.body;

        console.log(`[Transfer] ========== START FINALIZE ==========`);
        console.log(`[Transfer] Finalizing transfer: ${transferId}`);

        // 1. Fetch transfer record
        const { data: transfer, error: transferError } = await supabase
            .from('ticket_transfers')
            .select('*')
            .eq('id', transferId)
            .single();

        console.log(`[Transfer] Transfer record:`, JSON.stringify(transfer, null, 2));
        console.log(`[Transfer] Transfer error:`, transferError);

        if (transferError || !transfer) {
            console.log(`[Transfer] ERROR: Transfer not found`);
            return res.status(404).json({ error: 'Transfer not found' });
        }

        // 2. Check if still pending
        if (transfer.status !== 'pending') {
            console.log(`[Transfer] ERROR: Transfer status is ${transfer.status}, not pending`);
            return res.status(400).json({ error: `Transfer is ${transfer.status}, not pending` });
        }

        // 3. Verify undo window has expired
        const undoExpires = new Date(transfer.undo_expires_at);
        const now = new Date();
        console.log(`[Transfer] Undo expires at: ${undoExpires.toISOString()}`);
        console.log(`[Transfer] Current time: ${now.toISOString()}`);
        console.log(`[Transfer] Has expired: ${now >= undoExpires}`);
        
        if (now < undoExpires) {
            console.log(`[Transfer] ERROR: Undo window has not expired yet`);
            return res.status(400).json({ error: 'Undo window has not expired yet' });
        }

        // 4. Get original registration
        console.log(`[Transfer] Fetching registration: ${transfer.registration_id}`);
        const { data: originalReg, error: regError } = await supabase
            .from('registrations')
            .select('*')
            .eq('id', transfer.registration_id)
            .single();

        console.log(`[Transfer] Original registration:`, JSON.stringify(originalReg, null, 2));
        console.log(`[Transfer] Registration error:`, regError);

        if (!originalReg) {
            console.log(`[Transfer] ERROR: Original registration not found`);
            return res.status(404).json({ error: 'Original registration not found' });
        }

        // 5. Find the ticket - use same matching logic as transfer initiation
        const tickets = originalReg.tickets || [];
        const ticketKeyParts = transfer.ticket_key.split('-');
        const tierIdPart = ticketKeyParts.slice(0, -1).join('-');
        
        console.log(`[Transfer] Looking for ticket with key: ${transfer.ticket_key}`);
        console.log(`[Transfer] Tier ID part: ${tierIdPart}`);
        console.log(`[Transfer] Available tickets:`, JSON.stringify(tickets, null, 2));
        
        let ticketIndex = -1;
        
        // Try multiple matching strategies
        ticketIndex = tickets.findIndex(t => t.key === transfer.ticket_key);
        console.log(`[Transfer] Match by key: ${ticketIndex}`);
        
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.id === transfer.ticket_key);
            console.log(`[Transfer] Match by id: ${ticketIndex}`);
        }
        
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.tierId === tierIdPart);
            console.log(`[Transfer] Match by tierId: ${ticketIndex}`);
        }
        
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.id === tierIdPart);
            console.log(`[Transfer] Match by id (tierId part): ${ticketIndex}`);
        }
        
        if (ticketIndex === -1) {
            ticketIndex = tickets.findIndex(t => t.transferId === transferId);
            console.log(`[Transfer] Match by transferId: ${ticketIndex}`);
        }
        
        if (ticketIndex === -1 && tickets.length === 1) {
            ticketIndex = 0;
            console.log(`[Transfer] Only one ticket, using index 0`);
        }
        
        if (ticketIndex === -1) {
            console.log('[Transfer Finalize] ERROR: Ticket not found. ticket_key:', transfer.ticket_key);
            console.log('[Transfer Finalize] Available tickets:', JSON.stringify(tickets));
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const ticket = tickets[ticketIndex];
        console.log(`[Transfer] Found ticket at index ${ticketIndex}:`, JSON.stringify(ticket, null, 2));

        // 6. Update sender's ticket to transferred_out
        tickets[ticketIndex] = {
            ...ticket,
            transferStatus: 'transferred_out',
            transferId: transferId,
            transferFinalizedAt: new Date().toISOString(),
            transferredToEmail: transfer.recipient_email,
            transferredToUserId: transfer.recipient_user_id
        };

        console.log(`[Transfer] Updating sender's registration with modified tickets`);
        const { data: updatedSenderReg, error: updateError } = await supabase
            .from('registrations')
            .update({ 
                tickets
            })
            .eq('id', transfer.registration_id)
            .select();

        console.log(`[Transfer] Sender registration update result:`, updatedSenderReg);
        console.log(`[Transfer] Sender registration update error:`, updateError);
        
        if (updateError) {
            console.log(`[Transfer] ERROR updating sender registration:`, updateError);
            throw updateError;
        }

        // 7. Create new registration for recipient (or add to existing)
        let recipientRegistrationId;

        // Check if recipient already has a registration for this event
        console.log(`[Transfer] Checking for existing recipient registration...`);
        console.log(`[Transfer] Event ID: ${transfer.event_id}`);
        console.log(`[Transfer] Recipient email: ${transfer.recipient_email}`);
        
        const { data: existingRecipientReg, error: recipientCheckError } = await supabase
            .from('registrations')
            .select('*')
            .eq('event_id', transfer.event_id)
            .eq('attendee_email', transfer.recipient_email)
            .eq('payment_status', 'paid')
            .single();

        console.log(`[Transfer] Existing recipient reg:`, JSON.stringify(existingRecipientReg, null, 2));
        console.log(`[Transfer] Recipient check error:`, recipientCheckError);

        const transferredTicket = {
            ...ticket,
            key: `${ticket.key || ticket.id || ticket.tierId}_transferred_${Date.now()}`,
            transferStatus: 'transferred_in',
            transferId: transferId,
            transferredFromEmail: transfer.sender_email,
            transferredFromUserId: transfer.sender_user_id,
            transferredAt: new Date().toISOString(),
            originalTicketKey: ticket.key || ticket.id || ticket.tierId
        };

        console.log(`[Transfer] Transferred ticket object:`, JSON.stringify(transferredTicket, null, 2));

        if (existingRecipientReg) {
            // Add ticket to existing registration
            console.log(`[Transfer] Adding ticket to existing recipient registration: ${existingRecipientReg.id}`);
            const existingTickets = existingRecipientReg.tickets || [];
            const { data: updatedRecipientReg, error: recipientUpdateError } = await supabase
                .from('registrations')
                .update({
                    tickets: [...existingTickets, transferredTicket]
                })
                .eq('id', existingRecipientReg.id)
                .select();
            
            console.log(`[Transfer] Updated recipient reg:`, updatedRecipientReg);
            console.log(`[Transfer] Recipient update error:`, recipientUpdateError);
            
            if (recipientUpdateError) {
                console.log(`[Transfer] ERROR updating recipient registration:`, recipientUpdateError);
                throw recipientUpdateError;
            }
            
            recipientRegistrationId = existingRecipientReg.id;
        } else {
            // Create new registration for recipient
            console.log(`[Transfer] Creating new registration for recipient`);
            const newRegPayload = {
                event_id: transfer.event_id,
                user_id: transfer.recipient_user_id,
                attendee_name: transfer.recipient_name || transfer.recipient_email.split('@')[0],
                attendee_email: transfer.recipient_email,
                tickets: [transferredTicket],
                payment_status: 'paid',
                approval_status: 'approved',
                created_at: new Date().toISOString()
            };
            
            console.log(`[Transfer] New registration payload:`, JSON.stringify(newRegPayload, null, 2));
            
            const { data: newReg, error: newRegError } = await supabase
                .from('registrations')
                .insert(newRegPayload)
                .select()
                .single();

            console.log(`[Transfer] New registration created:`, JSON.stringify(newReg, null, 2));
            console.log(`[Transfer] New registration error:`, newRegError);

            if (newRegError) {
                console.log(`[Transfer] ERROR creating new registration:`, newRegError);
                throw newRegError;
            }
            recipientRegistrationId = newReg.id;
        }

        // 8. Update transfer record to completed
        console.log(`[Transfer] Updating transfer record to completed`);
        const { data: updatedTransfer, error: transferUpdateError } = await supabase
            .from('ticket_transfers')
            .update({
                status: 'completed',
                recipient_registration_id: recipientRegistrationId,
                finalized_at: new Date().toISOString()
            })
            .eq('id', transferId)
            .select();

        console.log(`[Transfer] Updated transfer record:`, updatedTransfer);
        console.log(`[Transfer] Transfer update error:`, transferUpdateError);
        
        if (transferUpdateError) {
            console.log(`[Transfer] ERROR updating transfer record:`, transferUpdateError);
            throw transferUpdateError;
        }

        // 9. Create notification for recipient
        if (transfer.recipient_user_id) {
            console.log(`[Transfer] Creating notification for recipient`);
            const { error: notifError } = await supabase.from('notifications').insert({
                user_id: transfer.recipient_user_id,
                type: 'transfer',
                title: '🎟️ Ticket Received!',
                message: `${transfer.sender_name || transfer.sender_email} has transferred a ticket to you.`,
                read: false,
                data: { transferId, eventId: transfer.event_id },
                created_at: new Date().toISOString()
            });
            
            if (notifError) {
                console.log(`[Transfer] WARNING: Failed to create notification:`, notifError);
            }
        }

        // 10. Log finalization
        console.log(`[Transfer] Creating security audit log`);
        const { error: auditError } = await supabase.from('security_audit_logs').insert({
            action: 'TRANSFER_COMPLETED',
            entity_type: 'ticket',
            entity_id: transfer.ticket_key,
            user_id: transfer.sender_user_id,
            user_email: transfer.sender_email,
            details: {
                transferId,
                recipientEmail: transfer.recipient_email,
                recipientUserId: transfer.recipient_user_id,
                recipientRegistrationId
            },
            severity: 'info',
            created_at: new Date().toISOString()
        });
        
        if (auditError) {
            console.log(`[Transfer] WARNING: Failed to create security audit log:`, auditError);
        } else {
            console.log(`[Transfer] Security audit log created successfully`);
        }

        console.log(`[Transfer] ========== FINALIZE COMPLETE ==========`);
        console.log(`[Transfer] Transfer completed successfully: ${transferId}`);

        res.json({ 
            success: true, 
            message: 'Transfer completed successfully',
            recipientRegistrationId
        });

    } catch (error) {
        console.error('[Transfer] Finalize error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get transfer status
 * GET /api/registrations/:id/transfer/:transferId
 */
export const debugTransfers = async (req, res) => {
    try {
        const { data: transfers, error } = await supabase
            .from('ticket_transfers')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        res.json({ transfers });
    } catch (error) {
        console.error('Debug transfers error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getTransferStatus = async (req, res) => {
    try {
        const { transferId } = req.params;

        const { data: transfer, error } = await supabase
            .from('ticket_transfers')
            .select('*')
            .eq('id', transferId)
            .single();

        if (error || !transfer) {
            return res.status(404).json({ error: 'Transfer not found' });
        }

        res.json({ transfer });

    } catch (error) {
        console.error('[Transfer] Get status error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Delete a registration (soft delete or full delete for unpaid/refunded)
 * DELETE /api/registrations/:id
 * Only allows deletion of pending, free, or refunded registrations
 */
export const deleteRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        // Get the registration with event details
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(owner_id, title)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify ownership - must own the event
        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized - You do not own this event' });
        }

        // Payment-aware deletion logic (use payment_status only - refund_status may not exist)
        const paymentStatus = reg.payment_status?.toLowerCase();
        
        // Block deletion of paid tickets that haven't been refunded
        if ((paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === 'succeeded')) {
            return res.status(400).json({ 
                error: 'Cannot delete paid registration. Please refund it first.',
                paymentStatus: reg.payment_status
            });
        }

        // Block deletion of tickets being refunded
        if (paymentStatus === 'refunding') {
            return res.status(400).json({ 
                error: 'Cannot delete registration while refund is processing. Please wait for refund to complete.',
                paymentStatus: reg.payment_status
            });
        }

        // Calculate ticket count to decrement
        let ticketCount = 0;
        if (reg.tickets && Array.isArray(reg.tickets)) {
            ticketCount = reg.tickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
        } else {
            ticketCount = 1; // Legacy single ticket
        }

        // Delete the registration
        const { error: deleteError } = await supabase
            .from('registrations')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('[Delete Registration] Error:', deleteError);
            return res.status(500).json({ error: 'Failed to delete registration' });
        }

        // Decrement registered_count on the event
        if (ticketCount > 0 && reg.event_id) {
            const { error: rpcError } = await supabase.rpc('decrement_registered_count', {
                event_id: reg.event_id,
                decrement_by: ticketCount
            });

            if (rpcError) {
                console.warn('[Delete Registration] Failed to decrement count:', rpcError);
                // Non-blocking - registration is already deleted
            }
        }

        console.log('[Delete Registration] Success:', {
            registrationId: id,
            eventId: reg.event_id,
            ticketsDeleted: ticketCount,
            wasRefunded: refundStatus === 'refunded'
        });

        res.json({ 
            success: true, 
            message: 'Registration deleted successfully',
            ticketsDeleted: ticketCount
        });

    } catch (error) {
        console.error('[Delete Registration] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Resend confirmation email for a registration
 * POST /api/registrations/:id/resend-email
 * Uses backend email templates - no frontend email sending
 */
export const resendConfirmationEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        // Get registration with event and profile details
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(id, title, date, time, location, venue_name, owner_id, ticket_design, email_settings)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify ownership
        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized - You do not own this event' });
        }

        // Check if email exists
        if (!reg.attendee_email) {
            return res.status(400).json({ error: 'No email address found for this attendee' });
        }

        // Check if confirmation emails are enabled
        const emailSettings = reg.event.email_settings || {};
        if (emailSettings.confirmationEnabled === false) {
            return res.status(400).json({ error: 'Confirmation emails are disabled for this event. Enable them in event settings.' });
        }

        // Import email services
        const { purchaseConfirmation } = await import('../services/emailTemplates.js');
        const emailAudit = await import('../services/emailAuditService.js');
        const { sendEmailWithProvider } = await import('../services/cronService.js');

        // Format event details
        const eventDate = new Date(reg.event.date).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const eventLocation = reg.event.location || reg.event.venue_name || 'TBD';

        // Build ticket URL
        const ticketUrl = `${process.env.FRONTEND_URL || 'https://openticket.events'}/#/ticket/${reg.id}`;

        // Generate tickets display
        const ticketsDisplay = (reg.tickets || [])
            .filter(t => t.status !== 'refunded')
            .map(t => `${t.quantity || 1}x ${t.name || 'Ticket'}`)
            .join(', ') || '1x General Admission';

        // Calculate order total
        const orderTotal = (reg.tickets || [])
            .filter(t => t.status !== 'refunded')
            .reduce((sum, t) => sum + ((t.pricePerTicket || t.price || 0) * (t.quantity || 1)), 0);

        // Generate email with the event's ticket design for theming
        const { subject, html } = purchaseConfirmation({
            attendeeName: reg.attendee_name || 'Guest',
            eventTitle: reg.event.title,
            eventDate,
            eventTime: reg.event.time || 'TBD',
            eventLocation,
            tickets: (reg.tickets || [])
                .filter(t => t.status !== 'refunded')
                .map(t => ({
                    name: t.name || 'Ticket',
                    quantity: t.quantity || 1,
                    price: t.pricePerTicket || t.price || 0
                })),
            totalPaid: orderTotal,
            orderId: reg.id.substring(0, 8).toUpperCase(),
            organizerName: reg.event.organizer || 'Event Organizer',
            ticketDesign: reg.event.ticket_design  // Pass the event's visual design for themed emails
        });

        // Send the email
        const emailResult = await sendEmailWithProvider(
            reg.attendee_email,
            subject,
            html,
            reg.event.owner_id
        );

        // Log the resend (use different trigger type to allow multiple resends)
        await emailAudit.logEmailSend({
            triggerType: 'manual_resend',
            emailType: emailAudit.EMAIL_TYPES.PURCHASE_CONFIRMATION,
            recipient: reg.attendee_email,
            registrationId: reg.id,
            eventId: reg.event_id,
            success: emailResult.sent || emailResult.simulated,
            messageId: emailResult.messageId,
            error: emailResult.error,
            metadata: { resent: true, resentBy: owner_id }
        });

        if (emailResult.sent || emailResult.simulated) {
            console.log(`[Resend] ✅ Confirmation email sent to ${reg.attendee_email}`);
            res.json({ 
                success: true, 
                message: `Confirmation email sent to ${reg.attendee_email}`,
                simulated: emailResult.simulated || false
            });
        } else {
            throw new Error(emailResult.error || 'Failed to send email');
        }

    } catch (error) {
        console.error('[Resend Email] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve a registration and send approval email
 * POST /api/registrations/:id/approve
 * Uses backend email templates - no frontend email sending
 */
export const approveRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        // Get registration with event details
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(id, title, date, time, location, venue_name, owner_id, email_settings, organizer)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify ownership
        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized - You do not own this event' });
        }

        // Update approval status
        const { error: updateError } = await supabase
            .from('registrations')
            .update({ approval_status: 'approved' })
            .eq('id', id);

        if (updateError) {
            throw new Error('Failed to update approval status');
        }

        // Send approval email if attendee has email
        if (reg.attendee_email) {
            try {
                const { sendEmailWithProvider } = await import('../services/cronService.js');
                const emailAudit = await import('../services/emailAuditService.js');

                // Format event details
                const eventDate = new Date(reg.event.date).toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                const eventLocation = reg.event.location || reg.event.venue_name || 'TBD';
                const ticketUrl = `${process.env.FRONTEND_URL || 'https://openticket.events'}/#/ticket/${reg.id}`;

                // Generate approval email HTML
                const subject = `🎉 Approved! Your Registration for ${reg.event.title}`;
                const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">You're Approved! 🎉</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi <strong>${reg.attendee_name || 'there'}</strong>,
                            </p>
                            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                Great news! Your registration for <strong>${reg.event.title}</strong> has been approved by the organizer.
                            </p>
                            <table width="100%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 20px;">
                                        <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 10px 0;">${reg.event.title}</p>
                                        <p style="color: #6b7280; font-size: 14px; margin: 0;">📅 ${eventDate}</p>
                                        <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">🕐 ${reg.event.time || 'TBD'}</p>
                                        <p style="color: #6b7280; font-size: 14px; margin: 5px 0 0 0;">📍 ${eventLocation}</p>
                                    </td>
                                </tr>
                            </table>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="center" style="padding: 20px 0;">
                                        <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Ticket</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                                We look forward to seeing you there!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Organized by ${reg.event.organizer || 'Event Organizer'}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

                const emailResult = await sendEmailWithProvider(
                    reg.attendee_email,
                    subject,
                    html,
                    reg.event.owner_id
                );

                // Log the email
                await emailAudit.logEmailSend({
                    triggerType: 'manual_approval',
                    emailType: 'approval_confirmation',
                    recipient: reg.attendee_email,
                    registrationId: reg.id,
                    eventId: reg.event_id,
                    success: emailResult.sent || emailResult.simulated,
                    messageId: emailResult.messageId,
                    error: emailResult.error
                });

                console.log(`[Approve] ✅ Approval email sent to ${reg.attendee_email}`);
            } catch (emailError) {
                console.error('[Approve] Failed to send approval email:', emailError.message);
                // Don't fail the approval if email fails
            }
        }

        res.json({ 
            success: true, 
            message: 'Registration approved' + (reg.attendee_email ? ' and email sent' : '')
        });

    } catch (error) {
        console.error('[Approve Registration] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Force complete a stuck refund
 * POST /api/registrations/:id/force-complete-refund
 * For tickets stuck in "refunding" status
 */
export const forceCompleteRefund = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        console.log(`[ForceCompleteRefund] Processing stuck refund for registration ${id}`);

        // Get registration with event details
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(id, title, owner_id)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify ownership
        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized - You do not own this event' });
        }

        // Check if already refunded
        if (reg.payment_status === 'refunded') {
            return res.status(400).json({ error: 'Registration is already fully refunded' });
        }

        // Check if in refunding state
        if (reg.payment_status !== 'refunding') {
            return res.status(400).json({ 
                error: 'Registration is not in refunding state', 
                currentStatus: reg.payment_status 
            });
        }

        // Calculate refunded amount and remaining tickets
        let totalRefunded = 0;
        let activeTickets = 0;
        let refundedTickets = 0;

        if (reg.tickets && Array.isArray(reg.tickets)) {
            reg.tickets.forEach(ticket => {
                if (ticket.status === 'refunded') {
                    totalRefunded += (ticket.pricePerTicket || 0) * (ticket.quantity || 1);
                    refundedTickets++;
                } else if (ticket.status === 'active' || ticket.status === 'paid') {
                    activeTickets++;
                }
            });
        }

        // Determine final status
        const finalStatus = activeTickets > 0 ? 'paid' : 'refunded';

        console.log(`[ForceCompleteRefund] Completing refund - Active: ${activeTickets}, Refunded: ${refundedTickets}, Final Status: ${finalStatus}`);

        // Update registration status
        const { error: updateError } = await supabase
            .from('registrations')
            .update({ 
                payment_status: finalStatus,
                refunded_amount: totalRefunded
            })
            .eq('id', id);

        if (updateError) {
            throw updateError;
        }

        // Update event refund count
        try {
            if (finalStatus === 'refunded') {
                await supabase.rpc('increment_event_refund_count', {
                    p_event_id: reg.event_id,
                    increment_by: 1
                });
            }
        } catch (countError) {
            console.warn('[ForceCompleteRefund] Failed to update refund count:', countError.message);
        }

        res.json({ 
            success: true, 
            message: `Refund completed. Status changed from "refunding" to "${finalStatus}"`,
            finalStatus,
            activeTickets,
            refundedTickets,
            totalRefunded
        });

    } catch (error) {
        console.error('[ForceCompleteRefund] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Sync refund status from Stripe
 * POST /api/registrations/:id/sync-stripe-refund
 * For tickets that were refunded in Stripe but database not updated
 */
export const syncStripeRefundStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;

        console.log(`[SyncStripeRefund] Checking Stripe refund status for registration ${id}`);

        // Get registration
        const { data: reg, error: regError } = await supabase
            .from('registrations')
            .select('*, event:events(id, title, owner_id)')
            .eq('id', id)
            .single();

        if (regError || !reg) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Verify ownership
        if (reg.event.owner_id !== owner_id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Check if there's a Stripe session
        if (!reg.stripe_checkout_session_id && !reg.stripe_payment_intent_id) {
            return res.status(400).json({ 
                error: 'No Stripe payment found for this registration',
                action: 'Use Force Complete Refund instead'
            });
        }

        const stripe = getStripe();
        
        // Get payment intent
        let paymentIntentId = reg.stripe_payment_intent_id;
        
        if (!paymentIntentId && reg.stripe_checkout_session_id) {
            try {
                const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
                paymentIntentId = session.payment_intent;
            } catch (sessionError) {
                console.error('[SyncStripeRefund] Failed to get session:', sessionError.message);
                return res.status(400).json({ error: 'Failed to retrieve Stripe session' });
            }
        }

        if (!paymentIntentId) {
            return res.status(400).json({ error: 'No payment intent found' });
        }

        // Get payment intent and check for refunds
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        console.log(`[SyncStripeRefund] Payment Intent status: ${paymentIntent.status}`);
        console.log(`[SyncStripeRefund] Amount refunded: ${paymentIntent.amount_refunded}`);

        if (paymentIntent.amount_refunded === 0) {
            return res.json({ 
                synced: false, 
                message: 'No refunds found in Stripe for this charge',
                currentStatus: reg.payment_status
            });
        }

        // Calculate refund details
        const totalCharged = paymentIntent.amount / 100; // Convert cents to dollars
        const totalRefunded = paymentIntent.amount_refunded / 100;
        const isFullyRefunded = paymentIntent.amount_refunded === paymentIntent.amount;

        console.log(`[SyncStripeRefund] Total charged: $${totalCharged}, Refunded: $${totalRefunded}, Fully refunded: ${isFullyRefunded}`);

        // Update registration status
        const newStatus = isFullyRefunded ? 'refunded' : 'paid';
        
        // Mark all tickets as refunded if fully refunded
        let updatedTickets = reg.tickets;
        if (isFullyRefunded && updatedTickets) {
            updatedTickets = updatedTickets.map(ticket => ({
                ...ticket,
                status: 'refunded'
            }));
        }

        const { error: updateError } = await supabase
            .from('registrations')
            .update({ 
                payment_status: newStatus,
                refunded_amount: totalRefunded,
                tickets: updatedTickets
            })
            .eq('id', id);

        if (updateError) {
            throw updateError;
        }

        // Create financial transaction record if doesn't exist
        try {
            await supabase.from('financial_transactions').insert({
                registration_id: id,
                event_id: reg.event_id,
                gross_amount: -totalRefunded,
                platform_fee: 0,
                stripe_fee: 0,
                organizer_net: -totalRefunded,
                currency: 'usd',
                status: 'refunded',
                payout_status: 'settled',
                transaction_type: 'refund',
                stripe_refund_id: paymentIntent.charges?.data[0]?.refunds?.data[0]?.id || 'synced'
            });
            console.log('[SyncStripeRefund] Created financial transaction record');
        } catch (finError) {
            // Ignore if already exists
            console.warn('[SyncStripeRefund] Financial record may already exist:', finError.message);
        }

        res.json({ 
            synced: true, 
            message: 'Refund status synced from Stripe',
            oldStatus: reg.payment_status,
            newStatus,
            totalRefunded,
            isFullyRefunded
        });

    } catch (error) {
        console.error('[SyncStripeRefund] Error:', error);
        res.status(500).json({ error: error.message });
    }
};

};