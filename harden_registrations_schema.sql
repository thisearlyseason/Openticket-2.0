
-- Add columns for financial integrity / receipt generation
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_fees_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS receipt_pdf_url text;

-- Ensure JSONB columns exist
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS add_ons jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tickets jsonb DEFAULT '[]'::jsonb;

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
