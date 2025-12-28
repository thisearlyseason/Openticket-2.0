
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugFullInsert() {
    console.log("Testing Full Payload Insert...");

    const registrationData = {
        id: 'reg_debug_' + Date.now(),
        event_id: 'evt-1766591216974',
        attendee_name: 'Debug Full',
        attendee_email: 'debug_full@test.com',
        payment_status: 'pending_payment',
        approval_status: 'approved',
        tickets: [
            {
                tierId: 'general',
                name: 'General Admission',
                pricePerTicket: 1.00,
                attendeeName: 'Debug Full',
                attendeeEmail: 'debug_full@test.com',
                status: 'pending'
            }
        ],
        add_ons: { 'addon_123': 1 }, // Map format used in controller? No, controller uses Summary Object?
        // Controller line 268: add_ons: addOnSummary.
        // I need to verify what addOnSummary looks like. Array or Object?
        // Viewed Controller line 401 sent from Frontend: Object { id: qty }.
        // Backend line 28 (destructure addOnSelections).
        // Backend seems to save addOnSummary. 
        // Let's assume it's an object or array. Schema says JSONB.

        service_fee: 1.50,
        tax_amount: 0,
        custom_fees_amount: 0,
        stripe_checkout_session_id: 'sess_debug_' + Date.now(),
        total_amount: 27.50,
        user_id: 'firebase_string_id_12345' // Known to work now?
    };

    console.log("Payload:", JSON.stringify(registrationData, null, 2));

    const { error } = await supabase.from('registrations').insert([registrationData]);

    if (error) {
        console.error("FULL INSERT FAILED:", error);
    } else {
        console.log("FULL INSERT SUCCESS!");
    }
}

debugFullInsert();
