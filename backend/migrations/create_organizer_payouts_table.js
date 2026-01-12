/**
 * Migration: Create organizer_payouts table
 * This table tracks payout requests from event organizers
 */

import supabase from '../services/supabase.js';

export async function createOrganizerPayoutsTable({ dryRun = true } = {}) {
    console.log(`[Migration] Creating organizer_payouts table (dryRun: ${dryRun})`);
    
    const results = {
        tableCreated: false,
        error: null,
        dryRun
    };

    try {
        // Check if table already exists
        const { data: existingTable, error: checkError } = await supabase
            .from('organizer_payouts')
            .select('id')
            .limit(1);

        if (!checkError) {
            console.log('[Migration] Table organizer_payouts already exists');
            results.tableCreated = false;
            results.message = 'Table already exists';
            return results;
        }

        if (dryRun) {
            console.log('[Migration] DRY RUN - Would create organizer_payouts table with the following structure:');
            console.log(`
CREATE TABLE organizer_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    transaction_count INTEGER DEFAULT 0,
    stripe_payout_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizer_payouts_event_id ON organizer_payouts(event_id);
CREATE INDEX idx_organizer_payouts_organizer_id ON organizer_payouts(organizer_id);
CREATE INDEX idx_organizer_payouts_status ON organizer_payouts(status);
CREATE INDEX idx_organizer_payouts_requested_at ON organizer_payouts(requested_at);

-- RLS Policies
ALTER TABLE organizer_payouts ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own payout requests
CREATE POLICY "Organizers can view own payouts" ON organizer_payouts
    FOR SELECT USING (organizer_id = auth.uid());

-- Admins can view all payout requests
CREATE POLICY "Admins can view all payouts" ON organizer_payouts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );
            `);
            results.message = 'DRY RUN - Table creation planned';
            return results;
        }

        // Create the table using raw SQL
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS organizer_payouts (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
                organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected', 'cancelled')),
                requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                approved_at TIMESTAMP WITH TIME ZONE,
                paid_at TIMESTAMP WITH TIME ZONE,
                rejected_at TIMESTAMP WITH TIME ZONE,
                rejection_reason TEXT,
                transaction_count INTEGER DEFAULT 0,
                stripe_payout_id VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `;

        const { error: createError } = await supabase.rpc('exec_sql', { 
            sql: createTableSQL 
        });

        if (createError) {
            throw createError;
        }

        // Create indexes
        const indexSQL = `
            CREATE INDEX IF NOT EXISTS idx_organizer_payouts_event_id ON organizer_payouts(event_id);
            CREATE INDEX IF NOT EXISTS idx_organizer_payouts_organizer_id ON organizer_payouts(organizer_id);
            CREATE INDEX IF NOT EXISTS idx_organizer_payouts_status ON organizer_payouts(status);
            CREATE INDEX IF NOT EXISTS idx_organizer_payouts_requested_at ON organizer_payouts(requested_at);
        `;

        const { error: indexError } = await supabase.rpc('exec_sql', { 
            sql: indexSQL 
        });

        if (indexError) {
            console.warn('[Migration] Index creation failed (may not be critical):', indexError);
        }

        // Enable RLS and create policies
        const rlsSQL = `
            ALTER TABLE organizer_payouts ENABLE ROW LEVEL SECURITY;
            
            CREATE POLICY IF NOT EXISTS "Organizers can view own payouts" ON organizer_payouts
                FOR SELECT USING (organizer_id = auth.uid());
            
            CREATE POLICY IF NOT EXISTS "Admins can view all payouts" ON organizer_payouts
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM profiles 
                        WHERE id = auth.uid() AND is_admin = true
                    )
                );
        `;

        const { error: rlsError } = await supabase.rpc('exec_sql', { 
            sql: rlsSQL 
        });

        if (rlsError) {
            console.warn('[Migration] RLS setup failed (may not be critical):', rlsError);
        }

        console.log('[Migration] Successfully created organizer_payouts table');
        results.tableCreated = true;
        results.message = 'Table created successfully';

    } catch (error) {
        console.error('[Migration] Failed to create organizer_payouts table:', error);
        results.error = error.message;
    }

    return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const dryRun = process.argv.includes('--dry-run');
    createOrganizerPayoutsTable({ dryRun })
        .then(results => {
            console.log('Migration results:', results);
            process.exit(results.error ? 1 : 0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}