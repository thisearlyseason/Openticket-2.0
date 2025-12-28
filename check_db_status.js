
import dotenv from 'dotenv';
import supabase from './backend/services/supabase.js';

dotenv.config();

const sessionId = 'cs_test_b1auluRl19pYPBUMnzmhbMS6iaJStJt6c3iykxLN7g8VRB2k3YE3SrcY6m';

async function check() {
    console.log(`Checking status for: ${sessionId}`);
    const { data: reg, error } = await supabase
        .from('registrations')
        .select('id, payment_status, event_id, attendee_email')
        .eq('stripe_checkout_session_id', sessionId)
        .single();

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Registration:', reg);
    }
}

check();
