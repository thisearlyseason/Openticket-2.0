-- Add tickets column to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS tickets JSONB;
