-- =====================================================
-- CREATE PROMO CODES TABLE - RUN IN SUPABASE SQL EDITOR
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

-- Create index for code lookup
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes(is_active);

-- Disable RLS for admin access
ALTER TABLE promo_codes DISABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON promo_codes TO authenticated;
GRANT ALL ON promo_codes TO service_role;
GRANT ALL ON promo_codes TO anon;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Promo codes table created successfully!' as result;
