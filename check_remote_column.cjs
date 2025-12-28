
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumn() {
    console.log("Checking remote:", process.env.SUPABASE_URL);
    const { data, error } = await supabase
        .from('registrations')
        .select('add_ons')
        .limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

checkColumn();
