import { createClient } from '@supabase/supabase-js';

// Environment variables are loaded by server.js before this module is imported
// Do NOT call dotenv.config() here - it causes initialization timing issues
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
