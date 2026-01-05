-- =====================================================
-- MASTER MIGRATION SCRIPT FOR OPENTICKET
-- Run this ONCE in Supabase SQL Editor
-- This script is IDEMPOTENT (safe to run multiple times)
-- Last Updated: January 5, 2026
-- =====================================================

-- =====================================================
-- 1. REGISTRATIONS TABLE ENHANCEMENTS
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
ADD COLUMN IF NOT EXISTS tickets jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS platform_donation_amount numeric DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'registrations' AND column_name = 'payment_status') THEN
        ALTER TABLE registrations ADD COLUMN payment_status TEXT DEFAULT 'pending';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_registrations_stripe_checkout_session_id ON registrations(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_stripe_payment_intent_id ON registrations(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_registrations_payment_status ON registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);

-- =====================================================
-- 2. EVENTS TABLE ENHANCEMENTS
-- =====================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS registered_count INTEGER DEFAULT 0;

-- =====================================================
-- 3. PROFILES TABLE ENHANCEMENTS (for affiliates)
-- =====================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS affiliate_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS affiliate_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid_out NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- =====================================================
-- 4. FINANCIAL TRANSACTIONS TABLE
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

-- Add columns if they don't exist (for existing tables)
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS affiliate_code TEXT,
ADD COLUMN IF NOT EXISTS affiliate_commission NUMERIC(10, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_event_id ON financial_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_registration_id ON financial_transactions(registration_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_stripe_session_id ON financial_transactions(stripe_session_id);

-- =====================================================
-- 5. AUDIT LOGS TABLE
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
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- =====================================================
-- 6. PROMO CODES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' or 'fixed'
    value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    target TEXT NOT NULL DEFAULT 'all', -- 'subscription', 'ticket', 'all'
    target_plans TEXT[], -- Array of plan names if target is 'subscription'
    usage_limit INTEGER DEFAULT NULL,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active);

-- =====================================================
-- 7. AFFILIATE PAYOUTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    affiliate_name TEXT,
    affiliate_code TEXT,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'offline', -- 'stripe' or 'offline'
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed'
    notes TEXT,
    stripe_transfer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_created_at ON affiliate_payouts(created_at);

-- =====================================================
-- 8. PLATFORM PAYOUTS TABLE (Admin payouts to company)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.platform_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_type TEXT NOT NULL, -- 'platform_fees', 'subscriptions', 'combined'
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'processing', 'completed', 'failed'
    stripe_payout_id TEXT,
    destination_account TEXT,
    notes TEXT,
    transaction_count INTEGER DEFAULT 0,
    breakdown JSONB, -- Details of what's included
    scheduled_for TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    executed_by TEXT, -- Admin user ID who executed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_payouts_status ON platform_payouts(status);
CREATE INDEX IF NOT EXISTS idx_platform_payouts_type ON platform_payouts(payout_type);
CREATE INDEX IF NOT EXISTS idx_platform_payouts_created_at ON platform_payouts(created_at);

-- =====================================================
-- 9. DROP OLD FUNCTIONS (for clean recreation)
-- =====================================================
DROP FUNCTION IF EXISTS increment_registered_count(TEXT, INTEGER);
DROP FUNCTION IF EXISTS process_checkout_success_v2(TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC, TEXT, NUMERIC);

-- =====================================================
-- 9. CREATE/REPLACE FUNCTIONS
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
    SELECT jsonb_array_length(p_tickets) INTO v_ticket_count;
    
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
    
    INSERT INTO financial_transactions (
        registration_id, event_id, stripe_session_id, stripe_payment_intent_id,
        gross_amount, platform_fee, stripe_fee, tax_amount, organizer_net,
        currency, status, payout_status, transaction_type,
        discount_amount, affiliate_code, affiliate_commission
    )
    SELECT 
        p_registration_id, p_event_id, p_session_id, p_payment_intent_id,
        p_gross_amount, p_platform_fee, p_stripe_fee, p_tax_amount, p_organizer_net,
        p_currency, 'succeeded', 'pending', p_transaction_type,
        p_discount_amount, p_affiliate_code, p_affiliate_commission
    WHERE NOT EXISTS (
        SELECT 1 FROM financial_transactions WHERE stripe_session_id = p_session_id
    );
    
    UPDATE events 
    SET registered_count = COALESCE(registered_count, 0) + v_ticket_count,
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

-- =====================================================
-- 10. AFFILIATE CLICKS TABLE (Detailed Click Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id TEXT NOT NULL,
    affiliate_code TEXT NOT NULL,
    event_id TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_code ON affiliate_clicks(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_created_at ON affiliate_clicks(created_at);

-- Add payment_method column to financial_transactions for at-door payments
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'stripe';

-- =====================================================
-- 11. DISABLE RLS FOR ADMIN ACCESS
-- =====================================================
ALTER TABLE financial_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts DISABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 12. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON financial_transactions TO authenticated, service_role, anon;
GRANT ALL ON audit_logs TO authenticated, service_role, anon;
GRANT ALL ON promo_codes TO authenticated, service_role, anon;
GRANT ALL ON affiliate_payouts TO authenticated, service_role, anon;
GRANT ALL ON affiliate_clicks TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION increment_registered_count TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION process_checkout_success_v2 TO authenticated, service_role, anon;

-- =====================================================
-- 13. REFRESH SCHEMA CACHE
-- =====================================================
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'SUCCESS! Master migration completed.' as result;
SELECT 'Tables created: financial_transactions, audit_logs, promo_codes, affiliate_payouts, affiliate_clicks' as tables_created;
SELECT 'Functions created: increment_registered_count, process_checkout_success_v2' as functions_created;
