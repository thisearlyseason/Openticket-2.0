-- Create Promo Codes Table
-- Run this in Supabase SQL Editor

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('subscription', 'ticket', 'all')),
    target_plans JSONB DEFAULT '[]',
    usage_limit INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON public.promo_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_codes_expires ON public.promo_codes(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role (backend) can do everything
CREATE POLICY "Service role full access to promo codes"
ON public.promo_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Authenticated users can read active promo codes
CREATE POLICY "Users can read active promo codes"
ON public.promo_codes
FOR SELECT
TO authenticated
USING (is_active = true);

-- Add comment
COMMENT ON TABLE public.promo_codes IS 'Promotional discount codes for subscriptions and tickets';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Promo codes table created successfully!'; 
END $$;
