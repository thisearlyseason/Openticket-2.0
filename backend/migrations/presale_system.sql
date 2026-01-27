-- Presale System Migration
-- Creates the presale_codes table and adds presale_eligible column to profiles

-- Create presale_codes table
CREATE TABLE IF NOT EXISTS presale_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    limit_type VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (limit_type IN ('single', 'multi', 'unlimited')),
    max_uses INTEGER,
    current_uses INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    name VARCHAR(100),
    UNIQUE(event_id, code)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_presale_codes_event_code ON presale_codes(event_id, code);

-- Add presale_eligible column to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS presale_eligible BOOLEAN DEFAULT FALSE;

-- Add presale column to events if it doesn't exist (JSONB for presale config)
ALTER TABLE events ADD COLUMN IF NOT EXISTS presale JSONB;

-- Grant permissions
GRANT ALL ON presale_codes TO authenticated;
GRANT ALL ON presale_codes TO service_role;
