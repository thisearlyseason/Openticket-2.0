-- ============================================
-- COMPLETE SCHEMA FIX MIGRATION
-- ============================================
-- 
-- This migration adds all missing columns required for:
-- 1. Check-in functionality (Mobile Scanner, Kiosk Mode)
-- 2. Event ticket design
-- 
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- EVENTS TABLE - Add ticket_design column
-- ============================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_design JSONB;
COMMENT ON COLUMN events.ticket_design IS 'JSON object containing visual design settings for tickets';

-- ============================================
-- REGISTRATIONS TABLE - Add check-in columns
-- ============================================

-- Add check_in_statuses JSONB column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'check_in_statuses'
    ) THEN
        ALTER TABLE registrations ADD COLUMN check_in_statuses JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN registrations.check_in_statuses IS 'Per-ticket check-in status tracking';
        RAISE NOTICE 'Added registrations.check_in_statuses column';
    ELSE
        RAISE NOTICE 'registrations.check_in_statuses already exists';
    END IF;
END $$;

-- Add checked_in boolean column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'checked_in'
    ) THEN
        ALTER TABLE registrations ADD COLUMN checked_in BOOLEAN DEFAULT false;
        COMMENT ON COLUMN registrations.checked_in IS 'Whether any ticket in this registration has been checked in';
        RAISE NOTICE 'Added registrations.checked_in column';
    ELSE
        RAISE NOTICE 'registrations.checked_in already exists';
    END IF;
END $$;

-- Add checked_in_at timestamp column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'checked_in_at'
    ) THEN
        ALTER TABLE registrations ADD COLUMN checked_in_at TIMESTAMPTZ;
        COMMENT ON COLUMN registrations.checked_in_at IS 'Timestamp of first check-in for this registration';
        RAISE NOTICE 'Added registrations.checked_in_at column';
    ELSE
        RAISE NOTICE 'registrations.checked_in_at already exists';
    END IF;
END $$;

-- ============================================
-- INDEXES FOR CHECK-IN PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_registrations_checked_in ON registrations(checked_in);
CREATE INDEX IF NOT EXISTS idx_registrations_event_checked_in ON registrations(event_id, checked_in);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- After running, verify with:
-- 
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE (table_name = 'events' AND column_name = 'ticket_design')
--    OR (table_name = 'registrations' AND column_name IN ('check_in_statuses', 'checked_in', 'checked_in_at'));
