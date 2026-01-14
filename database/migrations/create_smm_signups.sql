-- Social Media Management (SMM) Signups Table
-- Tracks affiliate and organizer SMM program signups

CREATE TABLE IF NOT EXISTS smm_signups (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('affiliate', 'organizer')),
    affiliate_code TEXT,
    signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'active', 'cancelled')),
    magic_link TEXT,
    magic_link_sent_date TIMESTAMP,
    
    -- Subscription tracking for organizers
    subscription_id TEXT,
    stripe_session_id TEXT,
    stripe_customer_id TEXT,
    subscription_status TEXT DEFAULT 'pending' CHECK (subscription_status IN ('pending_payment', 'active', 'cancelled', 'past_due', 'free')),
    last_payment_date TIMESTAMP,
    next_billing_date TIMESTAMP,
    monthly_amount DECIMAL(10, 2) DEFAULT 49.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_smm_signups_user_id ON smm_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_smm_signups_status ON smm_signups(status);
CREATE INDEX IF NOT EXISTS idx_smm_signups_user_type ON smm_signups(user_type);
CREATE INDEX IF NOT EXISTS idx_smm_signups_subscription_id ON smm_signups(subscription_id);
CREATE INDEX IF NOT EXISTS idx_smm_signups_subscription_status ON smm_signups(subscription_status);
