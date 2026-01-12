-- Migration: Create affiliate_payouts table
-- Description: Track affiliate commission payouts with manual and scheduled options

CREATE TABLE IF NOT EXISTS affiliate_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'paid', 'failed', 'cancelled')),
    method VARCHAR(20) DEFAULT 'manual' CHECK (method IN ('manual', 'scheduled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    stripe_payout_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_scheduled_for ON affiliate_payouts(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_method ON affiliate_payouts(method);

-- Row Level Security (RLS)
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- Policy: Affiliates can view their own payouts
CREATE POLICY "Affiliates can view their own payouts"
    ON affiliate_payouts
    FOR SELECT
    USING (
        affiliate_id IN (
            SELECT id FROM affiliates WHERE user_id = auth.uid()
        )
    );

-- Policy: Only admins can insert payouts (via service role)
-- This is handled by service key in backend

-- Policy: Admins can view all payouts
CREATE POLICY "Admins can view all payouts"
    ON affiliate_payouts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_affiliate_payouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER affiliate_payouts_updated_at
    BEFORE UPDATE ON affiliate_payouts
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_payouts_updated_at();

-- Comments for documentation
COMMENT ON TABLE affiliate_payouts IS 'Tracks affiliate commission payouts with manual and scheduled options';
COMMENT ON COLUMN affiliate_payouts.method IS 'manual: immediate request for approval, scheduled: automatic on last day of month';
COMMENT ON COLUMN affiliate_payouts.scheduled_for IS 'Date when scheduled payout should be processed (last day of month)';
