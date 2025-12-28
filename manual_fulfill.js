
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SESSION_ID = 'cs_test_b1jvROjBEzYD0wdgCWfSmgUMWONFOPJblwCwZIAjsVEwVeVvmTnlfvb9a7';

async function simulate() {
    console.log("Simulating Webhook for:", SESSION_ID);

    try {
        const { data: reg, error } = await supabase.from('registrations').select('*').eq('stripe_checkout_session_id', SESSION_ID).single();

        if (!reg) {
            console.warn("Registration not found! Creating one...");
            const newRegData = {
                id: 'reg_' + Date.now(),
                event_id: 'evt-1766591216974', // Inferred from URL
                attendee_name: 'Tyler Ans',
                attendee_email: 'tyler@viralsparkmedia.com',
                payment_status: 'paid',
                approval_status: 'approved',
                stripe_checkout_session_id: SESSION_ID,
                total_amount: 27.71,
                tickets: [
                    {
                        id: 'tkt_' + Date.now(),
                        tierId: 'general',
                        name: 'General Admission',
                        pricePerTicket: 1.00,
                        quantity: 1,
                        status: 'valid',
                        purchasedAt: new Date().toISOString()
                    }
                ],
                add_ons: [
                    {
                        id: 'addon_shirt',
                        name: 'T-SHIRT',
                        price: 25.00,
                        quantity: 1
                    }
                ],
                service_fee: 1.71,
                tax_amount: 0
            };

            const { error: insertError } = await supabase.from('registrations').insert([newRegData]);
            if (insertError) {
                console.error("Insert Failed:", insertError);
                return;
            }
            console.log("Created simulated registration! Please refresh dashboard.");
        } else {
            // If found, ensure it is paid
            console.log("Found reg, updating to paid...");
            await supabase.from('registrations').update({ payment_status: 'paid' }).eq('id', reg.id);
            console.log("Updated.");
        }

    } catch (e) {
        console.error("Simulation Failed:", e);
    }
}

simulate();
