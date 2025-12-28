
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listRegs() {
    const { data: regs, error } = await supabase
        .from('registrations')
        .select('id, stripe_checkout_session_id, payment_status, total_amount')
        .order('id', { ascending: false })
        .limit(5);

    if (error) console.error(error);
    else console.log("Recent Registrations:", regs);
}

listRegs();
