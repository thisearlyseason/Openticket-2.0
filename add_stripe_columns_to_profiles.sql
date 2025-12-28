-- Add Stripe Connect columns to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT;
