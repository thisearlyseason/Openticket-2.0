
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function simulateWebhook() {
    const targetId = 'reg_LE4UTMLaW0'; // IDs from previous step

    const { data, error } = await supabase
        .from('registrations')
        .update({
            payment_status: 'paid',
            stripe_payment_intent_id: 'pi_simulated_123_audit',
            tickets: [
                {
                    tierId: 'general',
                    name: 'General Admission',
                    pricePerTicket: 1.00,
                    quantity: 1,
                    attendeeName: 'Test Fix',
                    attendeeEmail: 'thisearlyseason@gmail.com'
                }
            ],
            // Ensure numeric fields are set for clean Dashboard testing
            service_fee: 1.02,
            tax_amount: 0,
            custom_fees_amount: 0,
            custom_fees_amount: 0,
            total_amount: 2.02
        })
        .eq('id', targetId)
        .select();

    if (error) {
        console.error("Simulation Failed:", error);
    } else {
        console.log("Simulation Success! Record marked as PAID.", data);
    }
}

simulateWebhook();
