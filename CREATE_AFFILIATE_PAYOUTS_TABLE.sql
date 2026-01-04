-- =====================================================
-- CREATE AFFILIATE PAYOUTS TABLE - RUN IN SUPABASE SQL EDITOR
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_created_at ON affiliate_payouts(created_at);

-- Add tracking columns to profiles for affiliates
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS affiliate_clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_paid_out NUMERIC(10, 2) DEFAULT 0;

-- Disable RLS for admin access
ALTER TABLE affiliate_payouts DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON affiliate_payouts TO authenticated;
GRANT ALL ON affiliate_payouts TO service_role;
GRANT ALL ON affiliate_payouts TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Affiliate payouts table created successfully!' as result;
