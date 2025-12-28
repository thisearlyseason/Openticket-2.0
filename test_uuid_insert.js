
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testInsert() {
    console.log("Testing Insert with String User ID...");

    const { data, error } = await supabase.from('registrations').insert([{
        event_id: 'evt-1766591216974',
        attendee_name: 'Debug Test',
        attendee_email: 'debug@test.com',
        user_id: 'firebase_string_id_12345', // THIS SHOULD FAIL if column is UUID
        stripe_checkout_session_id: 'debug_' + Date.now()
    }]);

    if (error) {
        console.error("Insert Failed via Supabase Client:", error);
    } else {
        console.log("Insert Succeeded!");
    }
}

testInsert();
