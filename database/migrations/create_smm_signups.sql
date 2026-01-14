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
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'active')),
    magic_link TEXT,
    magic_link_sent_date TIMESTAMP,
    subscription_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_smm_signups_user_id ON smm_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_smm_signups_status ON smm_signups(status);
CREATE INDEX IF NOT EXISTS idx_smm_signups_user_type ON smm_signups(user_type);
