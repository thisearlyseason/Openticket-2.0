-- Add abandoned_email_sent column to registrations table
-- This column tracks if an abandoned cart reminder email has been sent
-- Run this in Supabase SQL Editor

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'registrations' 
        AND column_name = 'abandoned_email_sent'
    ) THEN
        ALTER TABLE public.registrations 
        ADD COLUMN abandoned_email_sent TIMESTAMPTZ DEFAULT NULL;
        
        RAISE NOTICE '✅ Column abandoned_email_sent added to registrations table';
    ELSE
        RAISE NOTICE 'ℹ️  Column abandoned_email_sent already exists';
    END IF;
END $$;

-- Create index for abandoned cart query optimization
CREATE INDEX IF NOT EXISTS idx_registrations_abandoned_cart 
ON public.registrations(payment_status, created_at, abandoned_email_sent)
WHERE abandoned_email_sent IS NULL;

-- Add comment
COMMENT ON COLUMN public.registrations.abandoned_email_sent IS 'Timestamp when abandoned cart reminder email was sent';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Abandoned cart email column migration complete!'; 
END $$;
