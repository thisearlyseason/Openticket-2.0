-- Create ticket_transfers table for tracking all ticket transfers
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ticket_transfers (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL,
    ticket_key TEXT NOT NULL,
    event_id TEXT NOT NULL,
    
    -- Sender info
    sender_user_id TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    
    -- Recipient info
    recipient_email TEXT NOT NULL,
    recipient_user_id TEXT,
    recipient_name TEXT,
    recipient_registration_id TEXT,
    
    -- Transfer status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    undo_expires_at TIMESTAMPTZ NOT NULL,
    undone_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    
    -- Fraud tracking
    fraud_flag BOOLEAN DEFAULT FALSE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_registration ON ticket_transfers(registration_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_key ON ticket_transfers(ticket_key);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_event ON ticket_transfers(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_sender ON ticket_transfers(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_recipient ON ticket_transfers(recipient_email);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_status ON ticket_transfers(status);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_created ON ticket_transfers(created_at DESC);

-- Enable RLS
ALTER TABLE ticket_transfers ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
CREATE POLICY "Service role full access" ON ticket_transfers
    FOR ALL
    USING (true)
    WITH CHECK (true);
