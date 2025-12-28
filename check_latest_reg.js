
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLatest() {
    console.log("Checking latest registrations...");
    const { data: regs, error } = await supabase
        .from('registrations')
        .select('id, payment_status, total_amount, stripe_checkout_session_id, user_id, attendee_email, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(JSON.stringify(regs, null, 2));
    }
}

checkLatest();
