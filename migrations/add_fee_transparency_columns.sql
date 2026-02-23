-- Migration: Add fee transparency columns to registrations table
-- Purpose: Store subtotal, stripe_fee, and custom_fees_amount as direct columns
--          so that all fee components can be read without parsing answers JSONB.
--          Enables: total_amount = subtotal + service_fee + stripe_fee + custom_fees_amount + tax_amount
--
-- Run this in your Supabase SQL Editor before deploying the updated backend.

-- 1. Ticket/addon subtotal after discount (before any fees)
ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;

-- 2. Stripe processing fee (2.9% + $0.30) passed through to attendee
ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC(10,2) DEFAULT 0;

-- 3. Organizer-defined additional/custom fees (facility fee, booking fee, etc.)
ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS custom_fees_amount NUMERIC(10,2) DEFAULT 0;

-- 4. Backfill existing rows from answers._metadata where possible
UPDATE registrations
    SET custom_fees_amount = COALESCE(
        (answers->'_metadata'->>'custom_fees_amount')::NUMERIC,
        0
    )
WHERE custom_fees_amount = 0
  AND answers->'_metadata'->>'custom_fees_amount' IS NOT NULL;

-- Note: stripe_fee for historical rows will remain 0 because it was not stored
-- before this migration. The actual stripe fee can be found in financial_transactions
-- for historical orders if needed.

-- Verification query (run after migration to confirm columns exist):
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'registrations'
--   AND column_name IN ('subtotal', 'stripe_fee', 'custom_fees_amount');
