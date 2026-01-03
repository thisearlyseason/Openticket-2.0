-- =====================================================
-- COMPLETE FINANCIAL SYSTEM FIX - RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- How to run:
-- 1. Go to your Supabase dashboard: https://supabase.com/dashboard
-- 2. Select your project → Click "SQL Editor"
-- 3. Copy and paste ALL of this code
-- 4. Click "Run" button
-- =====================================================

-- =====================================================
-- 1. FIX REGISTRATIONS TABLE
-- =====================================================
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_fees_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS promo_code_used text,
ADD COLUMN IF NOT EXISTS affiliate_code text,
ADD COLUMN IF NOT EXISTS receipt_pdf_url text,
ADD COLUMN IF NOT EXISTS add_ons jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tickets jsonb DEFAULT '[]'::jsonb;

-- Ensure payment_status column exists
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
CREATE INDEX IF NOT EXISTS idx_registrations_event_id 
ON registrations(event_id);

-- =====================================================
-- 2. FIX EVENTS TABLE - Add registered_count if missing
-- =====================================================
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registered_count INTEGER DEFAULT 0;

-- =====================================================
-- 3. CREATE FINANCIAL TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT,
    event_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_session_id TEXT,
    
    gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stripe_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    organizer_net NUMERIC(10, 2) NOT NULL DEFAULT 0,
    affiliate_code TEXT,
    affiliate_commission NUMERIC(10, 2) DEFAULT 0,
    
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'succeeded',
    payout_status TEXT DEFAULT 'pending',
    transaction_type TEXT DEFAULT 'ticket_sale',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on financial_transactions
CREATE INDEX IF NOT EXISTS idx_financial_transactions_event_id 
ON financial_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_registration_id 
ON financial_transactions(registration_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_stripe_session_id 
ON financial_transactions(stripe_session_id);

-- =====================================================
-- 4. CREATE AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_id TEXT,
    actor_type TEXT,
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON audit_logs(target_id);

-- =====================================================
-- 5. CREATE INCREMENT REGISTERED COUNT FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION increment_registered_count(p_event_id TEXT, p_count INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE events 
    SET registered_count = COALESCE(registered_count, 0) + p_count,
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

-- =====================================================
-- 6. CREATE PROCESS CHECKOUT SUCCESS RPC
-- =====================================================
CREATE OR REPLACE FUNCTION process_checkout_success_v2(
    p_session_id TEXT,
    p_payment_intent_id TEXT,
    p_gross_amount NUMERIC,
    p_platform_fee NUMERIC,
    p_stripe_fee NUMERIC,
    p_tax_amount NUMERIC,
    p_organizer_net NUMERIC,
    p_event_id TEXT,
    p_registration_id TEXT,
    p_tickets JSONB,
    p_currency TEXT DEFAULT 'usd',
    p_transaction_type TEXT DEFAULT 'ticket_sale',
    p_discount_amount NUMERIC DEFAULT 0,
    p_affiliate_code TEXT DEFAULT NULL,
    p_affiliate_commission NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_count INTEGER;
BEGIN
    -- Get ticket count
    SELECT jsonb_array_length(p_tickets) INTO v_ticket_count;
    
    -- Update registration
    UPDATE registrations
    SET payment_status = 'paid',
        stripe_payment_intent_id = p_payment_intent_id,
        tickets = p_tickets,
        total_amount = p_gross_amount,
        service_fee = p_platform_fee,
        tax_amount = p_tax_amount,
        discount_amount = p_discount_amount
    WHERE stripe_checkout_session_id = p_session_id
      AND payment_status != 'paid';
    
    -- Insert financial transaction (skip if already exists)
    INSERT INTO financial_transactions (
        registration_id,
        event_id,
        stripe_session_id,
        stripe_payment_intent_id,
        gross_amount,
        platform_fee,
        stripe_fee,
        tax_amount,
        organizer_net,
        currency,
        status,
        payout_status,
        transaction_type,
        discount_amount,
        affiliate_code,
        affiliate_commission
    )
    SELECT 
        p_registration_id,
        p_event_id,
        p_session_id,
        p_payment_intent_id,
        p_gross_amount,
        p_platform_fee,
        p_stripe_fee,
        p_tax_amount,
        p_organizer_net,
        p_currency,
        'succeeded',
        'pending',
        p_transaction_type,
        p_discount_amount,
        p_affiliate_code,
        p_affiliate_commission
    WHERE NOT EXISTS (
        SELECT 1 FROM financial_transactions WHERE stripe_session_id = p_session_id
    );
    
    -- Update event registered count
    UPDATE events 
    SET registered_count = COALESCE(registered_count, 0) + v_ticket_count,
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

-- =====================================================
-- 7. DISABLE RLS FOR BACKEND ACCESS (Service Role)
-- =====================================================
-- These tables need to be accessible by the backend service role
ALTER TABLE financial_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON financial_transactions TO authenticated;
GRANT ALL ON financial_transactions TO service_role;
GRANT ALL ON audit_logs TO authenticated;
GRANT ALL ON audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION increment_registered_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_registered_count TO service_role;
GRANT EXECUTE ON FUNCTION process_checkout_success_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION process_checkout_success_v2 TO service_role;

-- =====================================================
-- 9. REFRESH SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';

-- Success message
SELECT 'All tables, columns, and functions created successfully!' as result;
