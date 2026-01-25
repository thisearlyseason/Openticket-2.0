-- Migration: Add ticket_design column to events table
-- Required for: Event visual customization and themed emails
-- Run this migration against your Supabase database

-- Add the ticket_design column if it doesn't exist
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_design JSONB;

-- Add a comment for documentation
COMMENT ON COLUMN events.ticket_design IS 'JSON object containing visual design settings for tickets (logo, colors, fonts, etc.)';
