
import supabase from './services/supabase.js';

console.log("Verifying registrations schema...");

async function run() {
    try {
        // Attempt to select the tickets column
        const { data, error } = await supabase
            .from('registrations')
            .select('tickets')
            .limit(1);

        if (error) {
            console.error("Verification failed:", JSON.stringify(error, null, 2));
            if (error.message && (error.message.includes("does not exist") || error.code === '42703')) {
                console.log("Status: TICKETS_COLUMN_MISSING");
            } else {
                console.log("Status: UNKNOWN_ERROR");
            }
        } else {
            console.log("Status: TICKETS_COLUMN_PRESENT");
        }
    } catch (err) {
        console.error("Script error:", err);
    }
}

run();
