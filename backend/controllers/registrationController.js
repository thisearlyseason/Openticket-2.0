import supabase from '../services/supabase.js';
import Stripe from 'stripe';

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });


export const createRegistration = async (req, res) => {
    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
        const registrationData = req.body;
        // 1. Validate Capacity
        const { data: eventData } = await supabase.from('events').select('capacity, registered_count').eq('id', registrationData.event_id).single();
        const requestedQty = registrationData.tickets ? registrationData.tickets.length : 1;

        if (eventData && eventData.capacity && (eventData.registered_count || 0) + requestedQty > eventData.capacity) {
            return res.status(400).json({ error: "Event capacity reached." });
        }

        // 2. Sanitize & Secure Security Status
        const payload = {
            ...registrationData,
            payment_status: 'pending', // Default to pending for public creation
            approval_status: 'approved', // Usually auto-approved unless event says otherwise
            created_at: new Date()
        };

        // If organizer is logged in, they might be manually adding a 'paid' guest
        if (req.user) {
            const { data: event } = await supabase.from('events').select('owner_id').eq('id', registrationData.event_id).single();
            if (event && event.owner_id === req.user.uid) {
                // Keep the incoming status if authorized
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

        const { data, error } = await supabase
            .from('registrations')
            .select('*, financial_transactions(stripe_fee)')
            .eq('event_id', eventId);

        if (error) throw error;
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

        // Verify ownership of the event associated with this registration
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

        // SECURITY FIX: Do not allow dumping the entire table without filters.
        if (!stripe_checkout_session_id && !email) {
            // Check if Admin?
            // Since this route logic didn't assume req.user was set/verified, we need to be careful.
            // If verifyToken wasn't used on this route, req.user is undefined.
            // Best to just BLOCK default dumps.
            return res.status(403).json({ error: "Missing filter parameters (session_id or email required)." });
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

export const refundRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const { tickets, reason } = req.body; // tickets: [] means full order refund

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

        let updates = {};

        // 2. Logic & Refund Amount Calculation
        let amountToRefund = 0; // in cents
        let isFullRefund = false;

        if (Array.isArray(tickets) && tickets.length === 0) {
            // Full Refund
            updates = {
                payment_status: 'refunded',
            };
            isFullRefund = true;
            if (reg.tickets) {
                const cancelledTickets = reg.tickets.map(t => ({ ...t, status: 'refunded' }));
                updates.tickets = cancelledTickets;
            }
        } else {
            // Partial / Specific Ticket Update
            updates = {
                tickets: tickets
            };
            // Identify which items are being refunded to calc amount
            // We compare incoming `tickets` vs `reg.tickets`.
            // Any ticket in incoming `tickets` with status 'refunded' that WAS NOT 'refunded' before is a new refund.
            // Assumption: The frontend sends the *Updated Complete State* of tickets array.
            // So we loop and see differences.
            if (reg.tickets) {
                tickets.forEach((t, idx) => {
                    const oldT = reg.tickets[idx];
                    if (t.status === 'refunded' && oldT && oldT.status !== 'refunded') {
                        amountToRefund += Math.round((t.pricePerTicket || 0) * 100) * (t.quantity || 1);
                    }
                });
            }

            const allRefunded = tickets.every(t => t.status === 'refunded');
            if (allRefunded) {
                updates.payment_status = 'refunded';
            }
        }

        // 3. Process Stripe Refund
        if (reg.stripe_checkout_session_id) {
            // Retrieve Payment Intent from Session
            const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
            if (session && session.payment_intent) {
                const refundParams = {
                    payment_intent: session.payment_intent,
                };
                if (!isFullRefund && amountToRefund > 0) {
                    refundParams.amount = amountToRefund;
                }

                // Idempotency / Error handling: If already refunded, capture error but proceed with DB update?
                // Or fail? Better to fail so user knows money didn't move.
                await stripe.refunds.create(refundParams);
            }
        }

        // 4. Save DB Updates
        const { data, error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        // TODO: Trigger Stripe Refund here if payment_intent exists and logic allows.
        // For now, we update the record which stops the 404.

        res.json({ registration: data[0] });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const refundAddOn = async (req, res) => {
    try {
        const { id } = req.params;
        const owner_id = req.user.uid;
        const { addonIndex, reason } = req.body; // We expect index or ID? StorageService sends index.

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

        // 2. Update Addon Status & Calc Refund
        const updatedAddOns = [...reg.add_ons];
        const targetAddon = updatedAddOns[addonIndex];

        if (targetAddon.status === 'refunded') {
            return res.status(400).json({ error: 'Add-on already refunded' });
        }

        targetAddon.status = 'refunded';

        let amountToRefund = Math.round((targetAddon.price || 0) * 100);
        // Note: quantity handling? 'price' in AddOn is usually unit price.
        // If reg.addOns uses [ { id, price, quantity: 1 }, ... ] per LINE item.
        // Or if quantity > 1, do we refund ALL?
        // StorageService logic in UI treats it as one row per item line.
        // The price in the object should be total for that line? Or unit?
        // Schema definition for PurchasedAddOn: `price: number` (Total or Unit?).
        // Usually unit.
        // If quantity > 1, we should refund price * quantity?
        // Let's check logic:
        // `total += Number(a.price) || 0` in Dashboard.
        // If quantity > 1, Dashboard logic assumes `a.price` is TOTAL?
        // Wait, Dashboard logic: `total += r.addOns.reduce(...)`.
        // If `a` has quantity, Dashboard ignores it.
        // Assuming `price` is TOTAL for the line item or quantity is 1.
        // Safest: Refund `price * (quantity || 1)`.

        amountToRefund = Math.round((targetAddon.price || 0) * 100) * (targetAddon.quantity || 1);

        // 3. Process Stripe Refund
        if (reg.stripe_checkout_session_id) {
            const session = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id);
            if (session && session.payment_intent) {
                await stripe.refunds.create({
                    payment_intent: session.payment_intent,
                    amount: amountToRefund
                });
            }
        }

        const { data, error } = await supabase
            .from('registrations')
            .update({ add_ons: updatedAddOns })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({ registration: data[0] });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
