-- PRESALE SYSTEM MIGRATION - Run in Supabase SQL Editor
-- This script safely creates tables if they don't exist

-- Step 1: Check if tables exist
DO $$
BEGIN
    -- Check presale_codes
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presale_codes') THEN
        RAISE NOTICE 'Creating presale_codes table...';
        CREATE TABLE presale_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            code VARCHAR(50) NOT NULL,
            limit_type VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (limit_type IN ('single', 'multi', 'unlimited')),
            max_uses INTEGER,
            current_uses INTEGER NOT NULL DEFAULT 0,
            created_by TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            name VARCHAR(100),
            UNIQUE(event_id, code)
        );
        RAISE NOTICE 'presale_codes table created!';
    ELSE
        RAISE NOTICE 'presale_codes table already exists';
    END IF;

    -- Check presale_signups
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'presale_signups') THEN
        RAISE NOTICE 'Creating presale_signups table...';
        CREATE TABLE presale_signups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            name VARCHAR(255),
            email VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            notified BOOLEAN DEFAULT FALSE,
            notified_at TIMESTAMPTZ,
            UNIQUE(event_id, email)
        );
        RAISE NOTICE 'presale_signups table created!';
    ELSE
        RAISE NOTICE 'presale_signups table already exists';
    END IF;
END $$;

-- Step 2: Create indexes (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_presale_codes_event_code ON presale_codes(event_id, code);
CREATE INDEX IF NOT EXISTS idx_presale_signups_event ON presale_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_presale_signups_email ON presale_signups(email);

-- Step 3: Add columns to existing tables (IF NOT EXISTS handles duplicates)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS presale_eligible BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS presale JSONB;

-- Step 4: Grant permissions
GRANT ALL ON presale_codes TO authenticated;
GRANT ALL ON presale_codes TO service_role;
GRANT ALL ON presale_signups TO authenticated;
GRANT ALL ON presale_signups TO service_role;

-- Step 5: Verify tables were created
SELECT 'Tables created:' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('presale_codes', 'presale_signups');
