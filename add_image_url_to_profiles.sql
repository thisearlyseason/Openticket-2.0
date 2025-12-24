-- Migration: Add image_url to profiles table
-- Reason: Frontend sends image_url during profile sync, causing schema mismatch errors.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Verify
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'image_url';
