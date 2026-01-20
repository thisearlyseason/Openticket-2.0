import { createClient } from '@supabase/supabase-js';

// Use environment variables that are already loaded by the server
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables are present
if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] CRITICAL: Missing environment variables!');
    console.error('[Supabase] SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.error('[Supabase] SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING');
    throw new Error('Supabase client not initialized: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
}

let supabase;

try {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    }
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase Service Initialized');
} catch (error) {
    console.error('CRITICAL: Supabase initialization failed:', error.message);
    // Create a mock or proxy that throws on use to avoid total module failure
    supabase = new Proxy({}, {
        get: (target, prop) => {
            throw new Error(`Supabase client not initialized: ${error.message}`);
        }
    });
}

export default supabase;
