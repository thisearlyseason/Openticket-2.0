
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUser() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', '9iQqNVY6RdesJeBxhnqTjsfMche2');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('User found:', data);
    }
}

checkUser();
