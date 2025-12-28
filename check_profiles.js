
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkProfiles() {
    console.log("Checking Profiles...");
    const { data, error } = await supabase.from('profiles').select('*').limit(5);

    if (error) {
        console.error("Error fetching profiles:", error);
    } else {
        console.log("Found Profiles:", data.length);
        console.log(JSON.stringify(data, null, 2));
    }
}

checkProfiles();
