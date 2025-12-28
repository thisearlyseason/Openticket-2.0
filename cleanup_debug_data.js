
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanupDebugData() {
    console.log("Cleaning up debug data...");

    // Delete 'Debug Full' (The one with bad add_ons)
    const { error: err1, count: count1 } = await supabase
        .from('registrations')
        .delete({ count: 'exact' })
        .eq('attendee_name', 'Debug Full');

    if (err1) console.error("Error deleting Debug Full:", err1);
    else console.log(`Deleted ${count1} 'Debug Full' records.`);

    // Delete 'Debug Test' (The simple text ID one, just in case)
    const { error: err2, count: count2 } = await supabase
        .from('registrations')
        .delete({ count: 'exact' })
        .eq('attendee_name', 'Debug Test');

    if (err2) console.error("Error deleting Debug Test:", err2);
    else console.log(`Deleted ${count2} 'Debug Test' records.`);
}

cleanupDebugData();
