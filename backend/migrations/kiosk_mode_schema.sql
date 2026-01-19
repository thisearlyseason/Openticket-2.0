-- Kiosk Mode Database Schema
-- Run this in Supabase SQL Editor

-- Create kiosk_tokens table
CREATE TABLE IF NOT EXISTS kiosk_tokens (
    id BIGSERIAL PRIMARY KEY,
    token_id UUID UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'kiosk',
    event_id VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '["scan_ticket", "manual_checkin", "door_payment"]'::jsonb,
    payment_enabled BOOLEAN DEFAULT true,
    pin_code VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX idx_kiosk_tokens_event_id ON kiosk_tokens(event_id);
CREATE INDEX idx_kiosk_tokens_token_id ON kiosk_tokens(token_id);
CREATE INDEX idx_kiosk_tokens_revoked ON kiosk_tokens(revoked);

-- Create kiosk_logs table
CREATE TABLE IF NOT EXISTS kiosk_logs (
    id UUID PRIMARY KEY,
    token_id UUID NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_token FOREIGN KEY (token_id) REFERENCES kiosk_tokens(token_id) ON DELETE CASCADE,
    CONSTRAINT fk_event_log FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Create index for faster log queries
CREATE INDEX idx_kiosk_logs_event_id ON kiosk_logs(event_id);
CREATE INDEX idx_kiosk_logs_timestamp ON kiosk_logs(timestamp DESC);
CREATE INDEX idx_kiosk_logs_action ON kiosk_logs(action);

-- Add kiosk fields to events table (if they don't exist)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS kiosk_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS kiosk_token_id UUID;

-- Add kiosk fields to registrations table (if they don't exist)
ALTER TABLE registrations
ADD COLUMN IF NOT EXISTS checked_in_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS checked_in_device VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS kiosk_device_id VARCHAR(255);

-- Create view for active kiosk tokens (optional, for convenience)
CREATE OR REPLACE VIEW active_kiosk_tokens AS
SELECT 
    token_id,
    event_id,
    permissions,
    payment_enabled,
    expires_at,
    created_at,
    last_used_at
FROM kiosk_tokens
WHERE revoked = false 
AND expires_at > NOW();

COMMENT ON TABLE kiosk_tokens IS 'Stores event-scoped kiosk access tokens for door check-in and payments';
COMMENT ON TABLE kiosk_logs IS 'Audit log for all kiosk activities';
COMMENT ON VIEW active_kiosk_tokens IS 'View of non-revoked, non-expired kiosk tokens';
