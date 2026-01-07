// Migration script to add missing profile columns via Supabase PostgreSQL connection
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '/app/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract connection info from Supabase URL for direct pg connection
// Supabase PostgreSQL connection format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
const projectRef = 'dcjdurvgkveblvtinoms';

async function runMigrationViaPg() {
    const connectionString = `postgresql://postgres.${projectRef}:${process.env.SUPABASE_DB_PASSWORD || supabaseKey}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;
    
    console.log('Attempting direct PostgreSQL connection...');
    
    // This likely won't work without the actual DB password, but let's try
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        const sql = `
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_email TEXT;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_business_name BOOLEAN DEFAULT false;
            ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_phone_publicly BOOLEAN DEFAULT false;
        `;
        
        await client.query(sql);
        console.log('✓ Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err.message);
        
        // Fall back: Just output the SQL for manual execution
        console.log('\n\nPlease run this SQL manually in Supabase Dashboard SQL Editor:\n');
        console.log(`
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS use_business_name BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_phone_publicly BOOLEAN DEFAULT false;
        `);
    } finally {
        await client.end();
    }
}

// Alternative: Use Supabase's internal SQL execution via their dashboard API
// But this requires auth token from dashboard, which we don't have programmatically

// Best approach: Check if we can update via the REST API indirectly
async function addColumnsViaUpdate() {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Try to update a profile with the new fields - Supabase might auto-create columns
    // (This won't work - Supabase doesn't auto-create columns)
    console.log('Note: Supabase does not auto-create columns on insert/update.');
    console.log('The columns MUST be added via SQL Editor in Supabase Dashboard.');
    
    // Verify which columns exist by checking response headers
    const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1);
    
    if (error) {
        console.error('Could not query profiles:', error.message);
    }
}

// Run
runMigrationViaPg().catch(() => addColumnsViaUpdate());
