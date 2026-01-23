-- Migration: Add missing columns to align production schema with codebase
-- Created: January 22, 2026
-- Purpose: Add columns that the codebase expects but may be missing in production
-- 
-- WARNING: Run this migration on your Supabase database after reviewing
-- To run: Copy and paste into Supabase SQL Editor
--
-- Columns added:
-- 1. events.currency - Default currency for event pricing
-- 2. events.email_settings - JSONB for email configuration
-- 3. events.organizer_absorbed_fee - Boolean for fee absorption setting
-- 4. registrations.charged_currency - Actual currency user was charged in
-- 5. registrations.charged_amount - Actual amount charged (in charged currency)

-- ============================================
-- EVENTS TABLE COLUMNS
-- ============================================

-- Add currency column to events (default 'USD')
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'currency'
    ) THEN
        ALTER TABLE events ADD COLUMN currency VARCHAR(3) DEFAULT 'USD';
        COMMENT ON COLUMN events.currency IS 'Default currency for event pricing (ISO 4217 code)';
        RAISE NOTICE 'Added events.currency column';
    ELSE
        RAISE NOTICE 'events.currency already exists';
    END IF;
END $$;

-- Add email_settings JSONB column to events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'email_settings'
    ) THEN
        ALTER TABLE events ADD COLUMN email_settings JSONB DEFAULT '{"enabled": true, "reminders": true}'::jsonb;
        COMMENT ON COLUMN events.email_settings IS 'Email configuration: enabled, reminder settings, custom messages';
        RAISE NOTICE 'Added events.email_settings column';
    ELSE
        RAISE NOTICE 'events.email_settings already exists';
    END IF;
END $$;

-- Add organizer_absorbed_fee column to events
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'organizer_absorbed_fee'
    ) THEN
        ALTER TABLE events ADD COLUMN organizer_absorbed_fee BOOLEAN DEFAULT false;
        COMMENT ON COLUMN events.organizer_absorbed_fee IS 'Whether organizer absorbs platform fees (true) or passes to attendee (false)';
        RAISE NOTICE 'Added events.organizer_absorbed_fee column';
    ELSE
        RAISE NOTICE 'events.organizer_absorbed_fee already exists';
    END IF;
END $$;

-- ============================================
-- REGISTRATIONS TABLE COLUMNS
-- ============================================

-- Add charged_currency column to registrations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'charged_currency'
    ) THEN
        ALTER TABLE registrations ADD COLUMN charged_currency VARCHAR(3);
        COMMENT ON COLUMN registrations.charged_currency IS 'Actual currency user was charged in (from Stripe)';
        RAISE NOTICE 'Added registrations.charged_currency column';
    ELSE
        RAISE NOTICE 'registrations.charged_currency already exists';
    END IF;
END $$;

-- Add charged_amount column to registrations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'registrations' AND column_name = 'charged_amount'
    ) THEN
        ALTER TABLE registrations ADD COLUMN charged_amount DECIMAL(10, 2);
        COMMENT ON COLUMN registrations.charged_amount IS 'Actual amount charged to user (in charged_currency)';
        RAISE NOTICE 'Added registrations.charged_amount column';
    ELSE
        RAISE NOTICE 'registrations.charged_amount already exists';
    END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index on events.currency for filtering
CREATE INDEX IF NOT EXISTS idx_events_currency ON events(currency);

-- Index on registrations.charged_currency for analytics
CREATE INDEX IF NOT EXISTS idx_registrations_charged_currency ON registrations(charged_currency);

-- ============================================
-- MIGRATE EXISTING DATA FROM answers._metadata
-- ============================================

-- Migrate charged_currency from answers._metadata to dedicated column
UPDATE registrations 
SET charged_currency = (answers->'_metadata'->>'charged_currency')::VARCHAR(3)
WHERE charged_currency IS NULL 
  AND answers->'_metadata'->>'charged_currency' IS NOT NULL;

-- Migrate charged_amount from answers._metadata to dedicated column  
UPDATE registrations
SET charged_amount = (answers->'_metadata'->>'charged_amount')::DECIMAL(10,2)
WHERE charged_amount IS NULL
  AND answers->'_metadata'->>'charged_amount' IS NOT NULL;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Run this after migration to verify:
-- SELECT 
--     'events' as table_name,
--     column_name,
--     data_type,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'events' 
--   AND column_name IN ('currency', 'email_settings', 'organizer_absorbed_fee')
-- UNION ALL
-- SELECT 
--     'registrations' as table_name,
--     column_name,
--     data_type,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'registrations' 
--   AND column_name IN ('charged_currency', 'charged_amount');

-- ============================================
-- PROFILES TABLE COLUMNS (for SuperAdmin settings)
-- ============================================

-- Add global_gemini_key column to profiles for SuperAdmin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'global_gemini_key'
    ) THEN
        ALTER TABLE profiles ADD COLUMN global_gemini_key TEXT;
        COMMENT ON COLUMN profiles.global_gemini_key IS 'Global Gemini API key set by SuperAdmin for all users';
        RAISE NOTICE 'Added profiles.global_gemini_key column';
    ELSE
        RAISE NOTICE 'profiles.global_gemini_key already exists';
    END IF;
END $$;
