
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectReg(id) {
    const { data: reg, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('id', id)
        .single();

    if (error) console.error(error);
    else {
        console.log(`\n=== REGISTRATION: ${id} ===`);
        console.log(`Status: ${reg.payment_status}`);
        console.log(`Session ID: ${reg.stripe_checkout_session_id}`);
        console.log(`Payment Intent: ${reg.stripe_payment_intent_id}`);
        console.log("TICKETS (JSON):");
        console.log(JSON.stringify(reg.tickets, null, 2));
    }
}

inspectReg('reg_LE4UTMLaW0');
