-- Create event_analytics table for tracking page views and user interactions
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS event_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'page_view',
    device_type TEXT,
    browser TEXT,
    os TEXT,
    country TEXT,
    city TEXT,
    referrer TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_event_analytics_event_id ON event_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_event_analytics_created_at ON event_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_event_analytics_type ON event_analytics(type);

-- Enable Row Level Security
ALTER TABLE event_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow inserts from anyone (for tracking)
CREATE POLICY "Allow anonymous inserts" ON event_analytics
    FOR INSERT
    WITH CHECK (true);

-- Policy: Allow reads for authenticated users (organizers viewing their stats)
CREATE POLICY "Allow authenticated reads" ON event_analytics
    FOR SELECT
    USING (true);
