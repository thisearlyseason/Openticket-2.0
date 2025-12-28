
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyLatest() {
    const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    console.log("=== Last 5 Registrations ===");
    data.forEach(r => {
        console.log(`[${r.created_at}] ID: ${r.id} | Email: ${r.attendee_email} | Status: ${r.payment_status} | Total: ${r.total_amount}`);
    });
}

verifyLatest();
