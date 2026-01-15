-- Add missing columns to smm_signups table
-- Run this migration to add subscription tracking fields

-- Add subscription tracking columns
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS subscription_id TEXT;
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'pending';
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP;
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP;
ALTER TABLE smm_signups ADD COLUMN IF NOT EXISTS monthly_amount DECIMAL(10, 2) DEFAULT 49.00;

-- Add constraint for subscription_status if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'smm_signups_subscription_status_check'
    ) THEN
        ALTER TABLE smm_signups 
        ADD CONSTRAINT smm_signups_subscription_status_check 
        CHECK (subscription_status IN ('pending_payment', 'active', 'cancelled', 'past_due', 'free'));
    END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_smm_signups_subscription_id ON smm_signups(subscription_id);
CREATE INDEX IF NOT EXISTS idx_smm_signups_subscription_status ON smm_signups(subscription_status);

-- Update existing records to have default values
UPDATE smm_signups 
SET subscription_status = CASE 
    WHEN user_type = 'affiliate' THEN 'free'
    WHEN user_type = 'organizer' THEN 'pending_payment'
    ELSE 'pending'
END
WHERE subscription_status IS NULL;
