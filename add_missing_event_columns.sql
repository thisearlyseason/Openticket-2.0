-- Add missing columns to events table to match frontend StorageService payload

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS ticket_tiers JSONB DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS custom_fees JSONB DEFAULT '[]';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS absorb_fees BOOLEAN DEFAULT FALSE;

-- Optional: Ticket Tiers is also a separate table, but frontend saves it as JSON too.
-- This ensures the 'Save' operation doesn't fail.
