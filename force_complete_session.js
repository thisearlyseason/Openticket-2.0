
import fetch from 'node-fetch'; // or built-in in Node 18+
import dotenv from 'dotenv';
import crypto from 'crypto';
import supabase from './backend/services/supabase.js';

dotenv.config();

// 1. Determine Session ID
async function getSessionId() {
    // If ID provided in args, use it
    if (process.argv[2]) return process.argv[2];

    console.log("No Session ID provided. Looking for the most recent PENDING registration...");

    // Fetch latest pending
    const { data: regs, error } = await supabase
        .from('registrations')
        .select('stripe_checkout_session_id, attendee_email, created_at')
        // Check both statuses just in case
        .in('payment_status', ['pending', 'pending_payment'])
        .neq('stripe_checkout_session_id', null)
        .order('created_at', { ascending: false }) // or timestamp
        .limit(1);

    if (error || !regs || regs.length === 0) {
        return null; // found nothing
    }

    console.log(`Found recent pending order for ${regs[0].attendee_email}`);
    return regs[0].stripe_checkout_session_id;
}

// ... main execution ...
async function forceComplete() {
    const targetSessionId = await getSessionId();
    if (!targetSessionId) {
        console.error("Could not find any pending registrations to complete!");
        return;
    }

    console.log(`Forcing completion for Session: ${targetSessionId}...`);

    try {
        // 1. Fetch current reg to get details
        const { data: reg, error: fetchError } = await supabase
            .from('registrations')
            .select('*, event:events(*)')
            .eq('stripe_checkout_session_id', targetSessionId)
            .single();

        if (fetchError || !reg) {
            console.error("Registration not found!", fetchError);
            return;
        }

        console.log(`Found Registration: ${reg.id} (${reg.attendee_email})`);

        // 2. Prepare Data
        const finalizedTickets = (reg.tickets || []).map(t => ({
            ...t,
            id: crypto.randomUUID(),
            status: 'valid'
        }));

        // 3. Call RPC
        const { data, error } = await supabase.rpc('process_checkout_success', {
            p_session_id: targetSessionId,
            p_payment_intent_id: 'pi_forced_' + Date.now(),
            p_total_amount: reg.total_amount || 100,
            p_platform_fee: 0, // approx
            p_stripe_fee: (reg.total_amount * 0.029) + 0.30, // Estimate for manual fix
            p_tax_amount: 0,
            p_organizer_net: reg.total_amount,
            p_currency: 'usd',
            p_event_id: reg.event_id, // Text ID now? Yes.
            p_transaction_type: 'ticket_sale',
            p_tickets: finalizedTickets
        });

        if (error) {
            console.error("RPC Failed (Transport Error):", error);
        } else {
            console.log("RPC Response Data:", JSON.stringify(data, null, 2));
            if (data && data.success === false) {
                console.error("RPC Logic Failed:", data.error);
            } else {
                console.log("Success! Order marked as paid.");
            }
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

forceComplete();
