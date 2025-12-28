-- Add Stripe tracking columns to registrations table
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'; -- pending, paid, failed, refunded

-- Create index for faster lookups by Stripe Session/Intent
CREATE INDEX IF NOT EXISTS idx_registrations_stripe_checkout_session_id ON public.registrations(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_registrations_stripe_payment_intent_id ON public.registrations(stripe_payment_intent_id);
