-- Add period_end column to platform_payouts table
-- This column is required for tracking payout periods
ALTER TABLE platform_payouts 
ADD COLUMN IF NOT EXISTS period_end TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_platform_payouts_period_end 
ON platform_payouts(period_end);
