-- Migration: Add missing columns to events table
-- This adds all the columns that the OpenTicket frontend/backend expects but are missing from the database

-- Event details
ALTER TABLE events
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS duration INTEGER; -- duration in minutes

-- Recurring events
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurring_dates JSONB,
ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '24h';

-- Location & Media
ALTER TABLE events
ADD COLUMN IF NOT EXISTS online_url TEXT,
ADD COLUMN IF NOT EXISTS cover_image_position VARCHAR(20) DEFAULT 'center',
ADD COLUMN IF NOT EXISTS gallery JSONB,
ADD COLUMN IF NOT EXISTS timeline JSONB;

-- Ticketing
ALTER TABLE events
ADD COLUMN IF NOT EXISTS ticket_name TEXT DEFAULT 'General Admission',
ADD COLUMN IF NOT EXISTS promo_codes JSONB,
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0;

-- Event settings
ALTER TABLE events
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS confirmation_message TEXT,
ADD COLUMN IF NOT EXISTS refund_policy TEXT,
ADD COLUMN IF NOT EXISTS schedule_config JSONB;

-- Marketing & SEO
ALTER TABLE events
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS tracking_pixels JSONB,
ADD COLUMN IF NOT EXISTS remarketing JSONB,
ADD COLUMN IF NOT EXISTS seo JSONB;

-- Notifications
ALTER TABLE events
ADD COLUMN IF NOT EXISTS notifications JSONB,
ADD COLUMN IF NOT EXISTS reminders JSONB,
ADD COLUMN IF NOT EXISTS broadcasts JSONB;

-- Organizer info
ALTER TABLE events
ADD COLUMN IF NOT EXISTS organizer TEXT,
ADD COLUMN IF NOT EXISTS organizer_email TEXT,
ADD COLUMN IF NOT EXISTS organizer_phone TEXT,
ADD COLUMN IF NOT EXISTS organizer_website TEXT;

-- Waitlist
ALTER TABLE events
ADD COLUMN IF NOT EXISTS waitlist_config JSONB;

-- Create indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);

-- Add comments for documentation
COMMENT ON COLUMN events.status IS 'Event status: draft, published, cancelled, completed';
COMMENT ON COLUMN events.duration IS 'Event duration in minutes';
COMMENT ON COLUMN events.time_format IS 'Time display format: 12h or 24h';
COMMENT ON COLUMN events.cover_image_position IS 'CSS background-position for cover image';
