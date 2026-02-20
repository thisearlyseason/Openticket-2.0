-- Migration: Add 'type' column to financial_transactions
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This enables financial categorization and reporting by transaction type

-- Step 1: Add 'type' column (idempotent - safe to run multiple times)
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS type TEXT;

-- Step 2: Backfill based on existing transaction_type values
UPDATE financial_transactions
SET type = CASE
    WHEN transaction_type IN ('ticket_sale', 'checkin_payment', 'at_door_payment') THEN 'event'
    WHEN transaction_type IN ('subscription', 'smm_subscription') THEN 'subscription'
    WHEN transaction_type = 'platform_fee' THEN 'platform_fee'
    WHEN transaction_type = 'refund' THEN 'refund'
    ELSE 'event'
END
WHERE type IS NULL;

-- Step 3: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);

-- Step 4: Also create platform_settings table for admin-managed configuration
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Enable RLS (service role bypasses this anyway)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Verification query - run this to confirm migration success
-- SELECT type, COUNT(*) FROM financial_transactions GROUP BY type ORDER BY COUNT(*) DESC;
