-- =====================================================
-- FIX REGISTRATIONS TABLE - RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- How to run:
-- 1. Go to your Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Click "SQL Editor" in the left sidebar
-- 4. Copy and paste ALL of this code
-- 5. Click "Run" button (or press Ctrl+Enter / Cmd+Enter)
-- =====================================================

-- Add financial tracking columns
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_fees_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Add Stripe tracking columns  
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- Add promo code tracking
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS promo_code_used text;

-- Add affiliate tracking
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS affiliate_code text;

-- Add receipt URL
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS receipt_pdf_url text;

-- Ensure JSONB columns exist for tickets and add-ons
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS add_ons jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tickets jsonb DEFAULT '[]'::jsonb;

-- Ensure payment status column exists with default
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'registrations' AND column_name = 'payment_status') THEN
        ALTER TABLE registrations ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_registrations_stripe_checkout_session_id 
ON registrations(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_registrations_stripe_payment_intent_id 
ON registrations(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_registrations_payment_status 
ON registrations(payment_status);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT 'All columns added successfully!' as result;
