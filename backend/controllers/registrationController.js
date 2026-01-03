import supabase from '../services/supabase.js';
import { createRequire } from 'module';
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
            
        const requestedQty = registrationData.tickets ? registrationData.tickets.length : 1;

        if (eventData && eventData.capacity && (eventData.registered_count || 0) + requestedQty > eventData.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 2. Sanitize & Secure Security Status
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
        const { stripe_checkout_session_id, email } = req.query;

        // SECURITY FIX: Require filters
        if (!stripe_checkout_session_id && !email) {
            return res.status(403).json({ error: "Missing filter parameters" });
        }

        let query = supabase.from('registrations').select('*');

        if (stripe_checkout_session_id) {
            query = query.eq('stripe_checkout_session_id', stripe_checkout_session_id);
        }
        if (email) {
            query = query.eq('attendee_email', email);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json({ registrations: data });
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

        let updates = {};
        let amountToRefundCents = 0;
        let isFullRefund = false;

        // 2. Calculate refund amount
        if (Array.isArray(tickets) && tickets.length === 0) {
            // Full Refund
            isFullRefund = true;
            updates = {
                payment_status: 'refunded',
                refund_reason: reason,
            };
            
            if (reg.tickets) {
                updates.tickets = reg.tickets.map(t => ({ ...t, status: 'refunded' }));
                
                // Calculate full refund amount
                reg.tickets.forEach(t => {
                    if (t.status !== 'refunded') {
                        amountToRefundCents += Math.round((t.pricePerTicket || 0) * (t.quantity || 1) * 100);
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
        if (reg.stripe_checkout_session_id && amountToRefundCents > 0) {
            try {
                const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
                
                if (session && session.payment_intent) {
                    const refundParams = {
                        payment_intent: session.payment_intent,
                        reason: 'requested_by_customer',
                        metadata: {
                            registrationId: id,
                            eventId: reg.event_id,
                            reason: reason || 'Organizer initiated refund',
                        },
                    };

                    if (!isFullRefund && amountToRefundCents > 0) {
                        refundParams.amount = amountToRefundCents;
                    }

                    const refund = await stripe.refunds.create(refundParams);
                    stripeRefundId = refund.id;
                    
                    console.log(`[Refund] Created Stripe refund: ${refund.id}, amount: $${amountToRefundCents / 100}`);
                }
            } catch (stripeError) {
                console.error('[Refund] Stripe error:', stripeError.message);
                // Continue with DB update even if Stripe fails
            }
        }

        // 4. Update registration in DB
        updates.refunded_amount = (reg.refunded_amount || 0) + (amountToRefundCents / 100);
        updates.refund_reason = reason;
        if (stripeRefundId) {
            updates.stripe_refund_id = stripeRefundId;
        }

        const { data, error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        // 5. Financial record is created by webhook (charge.refunded)
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
        }

        res.json({ 
            registration: data[0],
            refundAmount: amountToRefundCents / 100,
            stripeRefundId,
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

        // 4. Update DB
        const { data, error } = await supabase
            .from('registrations')
            .update({ 
                add_ons: updatedAddOns,
                refunded_amount: (reg.refunded_amount || 0) + (amountToRefundCents / 100),
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

export const transferTicket = async (req, res) => {
    res.status(501).json({ error: "Transfer not implemented yet" });
};
