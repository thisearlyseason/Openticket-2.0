-- Presale System Migration (Fixed for text-type event IDs)
-- Creates the presale_codes table, presale_signups table, and adds columns to profiles/events

-- Create presale_codes table with TEXT type for event_id (matching events.id)
CREATE TABLE IF NOT EXISTS presale_codes (
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

-- Create presale_signups table for storing presale notification signups
CREATE TABLE IF NOT EXISTS presale_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMPTZ,
    UNIQUE(event_id, email)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_presale_codes_event_code ON presale_codes(event_id, code);
CREATE INDEX IF NOT EXISTS idx_presale_signups_event ON presale_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_presale_signups_email ON presale_signups(email);

-- Add presale_eligible column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS presale_eligible BOOLEAN DEFAULT FALSE;

-- Add presale column to events if it doesn't exist (JSONB for presale config)
ALTER TABLE events ADD COLUMN IF NOT EXISTS presale JSONB;

-- Grant permissions
GRANT ALL ON presale_codes TO authenticated;
GRANT ALL ON presale_codes TO service_role;
GRANT ALL ON presale_signups TO authenticated;
GRANT ALL ON presale_signups TO service_role;
