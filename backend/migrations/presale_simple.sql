-- SIMPLE PRESALE TABLES MIGRATION
-- Run this in Supabase SQL Editor

-- 1. Create presale_signups table
CREATE TABLE IF NOT EXISTS presale_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    UNIQUE(event_id, email)
);

-- 2. Create presale_codes table  
CREATE TABLE IF NOT EXISTS presale_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    code VARCHAR(50) NOT NULL,
    limit_type VARCHAR(20) NOT NULL DEFAULT 'single',
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    name VARCHAR(100),
    UNIQUE(event_id, code)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_presale_signups_event ON presale_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_presale_codes_event ON presale_codes(event_id);

-- 4. Add presale column to events if missing
ALTER TABLE events ADD COLUMN IF NOT EXISTS presale JSONB;

-- 5. Verify
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'presale%';
