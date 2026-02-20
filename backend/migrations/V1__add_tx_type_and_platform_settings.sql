-- ============================================
-- Migration V1: Add transaction type & platform settings table
-- Created: February 2026
-- Purpose: Fix financial data integrity and enable DB-backed Stripe configuration
-- 
-- WARNING: This migration is REQUIRED for the app to function properly
-- To run: Copy and paste into Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Add 'type' column to financial_transactions
-- ============================================

-- Add the type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'financial_transactions' AND column_name = 'type'
    ) THEN
        ALTER TABLE financial_transactions ADD COLUMN type TEXT;
        COMMENT ON COLUMN financial_transactions.type IS 'Transaction category: event, subscription, platform_fee, refund';
        RAISE NOTICE 'Added financial_transactions.type column';
    ELSE
        RAISE NOTICE 'financial_transactions.type already exists';
    END IF;
END $$;

-- Backfill the type column based on transaction_type
UPDATE financial_transactions 
SET type = CASE
    WHEN transaction_type IN ('ticket_sale', 'checkin_payment', 'at_door_payment') THEN 'event'
    WHEN transaction_type IN ('subscription', 'smm_subscription') THEN 'subscription'
    WHEN transaction_type = 'platform_fee' THEN 'platform_fee'
    WHEN transaction_type = 'refund' THEN 'refund'
    ELSE 'event'
END 
WHERE type IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON financial_transactions(type);

-- ============================================
-- PART 2: Create platform_settings table
-- ============================================

-- Create the platform_settings table for storing app-wide configuration
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Add comment
COMMENT ON TABLE platform_settings IS 'Platform-wide configuration settings (Stripe keys, etc.)';

-- Enable Row Level Security
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can read/write platform settings
CREATE POLICY "Only admins can manage platform settings" 
ON platform_settings
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid()::text 
        AND profiles.is_admin = true
    )
);

-- ============================================
-- VERIFICATION QUERIES (Run these to confirm)
-- ============================================

-- Verify type column was added and populated
-- SELECT 
--     type, 
--     COUNT(*) as count,
--     SUM(amount) as total_amount
-- FROM financial_transactions 
-- GROUP BY type;

-- Verify platform_settings table was created
-- SELECT * FROM platform_settings;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- After running this migration, go back to the app and:
-- 1. Visit Super Admin Dashboard
-- 2. Click "Run Backfill" button to ensure all transaction types are set
-- 3. Save your Stripe credentials in the Platform Settings section
-- ============================================
