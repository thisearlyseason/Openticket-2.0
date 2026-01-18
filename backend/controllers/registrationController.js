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
            query = query.eq('attendee_email', email);
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

        // Check if already refunding or refunded (use payment_status since refund_status column may not exist)
        if (reg.payment_status === 'refunding') {
            return res.status(400).json({ 
                error: 'A refund is already being processed for this registration',
                canRefund: false
            });
        }
        
        if (reg.payment_status === 'refunded') {
            return res.status(400).json({ 
                error: 'This registration has already been refunded',
                canRefund: false
            });
        }

        // Validate payment status before refund - must be paid to refund
        if (reg.payment_status !== 'paid' && reg.payment_status !== 'completed') {
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
            
            try {
                console.log('[Refund] Retrieving Stripe session:', reg.stripe_checkout_session_id);
                const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
                
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
                    // Session exists but no payment intent - might be incomplete or free
                    console.warn('[Refund] Session has no payment intent, treating as manual refund:', {
                        sessionId: reg.stripe_checkout_session_id,
                        sessionStatus: session.status
                    });
                    // Continue without Stripe refund - just mark as refunded in DB
                    stripeAttempted = false;
                    
                } else {
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

                    console.log('[Refund] Calling Stripe API:', {
                        paymentIntent: session.payment_intent,
                        amount: refundParams.amount ? `$${refundParams.amount / 100}` : 'FULL',
                        isPartialRefund: !!refundParams.amount
                    });

                    const refund = await stripe.refunds.create(refundParams);
                    stripeRefundId = refund.id;
                    
                    console.log('[Refund] ✅ Stripe refund created:', {
                        refundId: refund.id,
                        amount: `$${amountToRefundCents / 100}`,
                        status: refund.status,
                        currency: refund.currency
                    });
                }
            } catch (err) {
                stripeError = err.message;
                console.error('[Refund] ❌ Stripe API error:', {
                    error: err.message,
                    code: err.code,
                    type: err.type
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
                    canRefund: false,
                    diagnostics: {
                        errorCode: err.code,
                        errorType: err.type,
                        registrationId: id,
                        sessionId: reg.stripe_checkout_session_id
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

        res.json({ 
            success: true,
            registration: data[0],
            refundAmount: amountToRefundCents / 100,
            stripeRefundId: stripeRefundId || null,
            ticketsRefunded: ticketsBeingRefunded,
            message: `Successfully refunded ${ticketsBeingRefunded} ticket(s) for $${(amountToRefundCents / 100).toFixed(2)}. ${refundTypeMessage}`,
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