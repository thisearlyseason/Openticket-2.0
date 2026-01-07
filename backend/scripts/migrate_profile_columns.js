// Script to add missing columns to profiles table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/app/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Check existing columns
async function checkAndReportColumns() {
    console.log('Checking existing columns in profiles table...');
    
    const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)
        .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching profile:', fetchError);
        return;
    }
    
    const existingColumns = existingProfile ? Object.keys(existingProfile) : [];
    console.log('\nExisting columns:', existingColumns.sort());
    
    const requiredColumns = [
        'bio', 'phone', 'business_email', 'business_phone', 
        'use_business_name', 'show_phone_publicly'
    ];
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length === 0) {
        console.log('\n✓ All required columns already exist!');
        return true;
    }
    
    console.log('\n⚠️  Missing columns:', missingColumns);
    console.log('\nTo add these columns, run the following SQL in Supabase Dashboard SQL Editor:');
    console.log('\n--- SQL TO RUN ---\n');
    
    const sqlStatements = missingColumns.map(col => {
        if (col === 'use_business_name' || col === 'show_phone_publicly') {
            return `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${col} BOOLEAN DEFAULT false;`;
        } else {
            return `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${col} TEXT;`;
        }
    });
    
    console.log(sqlStatements.join('\n'));
    console.log('\n--- END SQL ---\n');
    
    return false;
}

checkAndReportColumns();
