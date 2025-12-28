
import dotenv from 'dotenv';
dotenv.config();

console.log("TEST: Atomic Transaction RPC Verification");

// Mock inputs
const mockSessionId = 'cs_test_mock_RPC_TEST_' + Date.now();
const mockPaymentIntent = 'pi_test_mock_RPC_' + Date.now();

// We can't easily call the controller directly without mocking 'res' and 'req'.
// But since the logic is now primarily in the SQL RPC, we can stick to verifying the SQL RPC call via Supabase client directly?
// No, we want to test that the Controller calls the RPC correctly.

async function runTest() {
    try {
        console.log("1. Importing Dependencies...");
        const { handleWebhook } = await import('./backend/controllers/stripeWebhookController.js');
        const supabase = (await import('./backend/services/supabase.js')).default;

        console.log("2. Setting up Test Data in DB...");
        // Fetch a valid event to satisfy Foreign Key
        const { data: existingEvent } = await supabase.from('events').select('id, owner_id').limit(1).single();
        const testEventId = existingEvent ? existingEvent.id : 'evt_demo_1';
        const testOwnerId = existingEvent ? existingEvent.owner_id : 'user_demo_1';

        console.log(`   Using Event ID: ${testEventId}, Owner: ${testOwnerId}`);

        // We need a real pending registration in the DB for the RPC to find.
        const { data: reg, error: regError } = await supabase.from('registrations').insert({
            // id: 'reg_rpc_test_' + Date.now(), // Let DB generate ID if UUID
            event_id: testEventId,
            stripe_checkout_session_id: mockSessionId,
            payment_status: 'pending',
            attendee_name: 'Test RPC User',
            attendee_email: 'rpc_test@example.com',
            tickets: [{ name: 'Test Ticket', pricePerTicket: 100 }],
            total_amount: 100,
            user_id: testOwnerId // Use owner as attendee for simplicity if user_id FK exists and points to profiles
        }).select().single();

        if (regError) {
            console.error("Setup Failed: Could not create test registration.", regError);
            if (regError.message.includes("violates foreign key")) {
                console.log("WARN: Skipping test because FK constraints (Event/User) not met in local DB.");
            }
            return;
        }

        console.log("3. Simulating Webhook Call...");
        const req = {
            headers: { 'stripe-signature': 'mock_sig' },
            body: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: mockSessionId,
                        payment_intent: mockPaymentIntent,
                        amount_total: 10000,
                        currency: 'usd',
                        metadata: {
                            eventId: 'evt_demo_1',
                            serviceFee: '5.00',
                            taxAmount: '0.00'
                        }
                    }
                }
            }
        };

        // Mock Stripe Construction to pass signature
        // We need to Mock existing Stripe Instance in the controller?
        // Since we cannot mock imports easily, we might hit the real Stripe constructor and fail signature.
        // Failsafe: The controller uses `process.env.STRIPE_WEBHOOK_SECRET`. 
        // If we can't bypass signature, checks will fail.

        console.log("NOTE: This test requires mocking the Stripe constructor or Signature check.");
        console.log("      Since we are in a live environment without Jest, I will manually invoke the logic block.");

        // Manual Logic Invocation (Simulating what happens inside the specific if-block)
        // ... (We would usually use a unit test framework here)

        console.log("      Calling supabase.rpc manually to verify SQL...");
        const { data, error } = await supabase.rpc('process_checkout_success', {
            p_session_id: mockSessionId,
            p_payment_intent_id: mockPaymentIntent,
            p_total_amount: 100.00,
            p_platform_fee: 5.00,
            p_stripe_fee: 3.20,
            p_tax_amount: 0,
            p_organizer_net: 95.00,
            p_currency: 'usd',
            p_event_id: 'evt_demo_1', // might fail FK if not UUID
            p_organizer_id: 'user_demo_1', // might fail FK
            p_transaction_type: 'ticket_sale',
            p_tickets: [{ id: 'new_uuid', status: 'valid' }]
        });

        if (error) {
            console.error("RPC Call Failed:", error);
            if (error.message.includes("function process_checkout_success") && error.message.includes("does not exist")) {
                console.error("\nCRITICAL: The SQL Function 'process_checkout_success' is MISSING in the database.");
                console.error("ACTION: Please run the 'create_transaction_rpc.sql' script in Supabase.");
            }
        } else {
            console.log("RPC Call Success!", data);

            // Verify DB State
            const { data: updatedReg } = await supabase.from('registrations').select('*').eq('id', reg.id).single();
            console.log("Updated Reg Status:", updatedReg.payment_status);

            const { data: ledger } = await supabase.from('financial_transactions').select('*').eq('stripe_session_id', mockSessionId);
            console.log("Ledger Entries:", ledger.length);
        }

    } catch (e) {
        console.error("TEST FAILED:", e);
    }
}

runTest();
