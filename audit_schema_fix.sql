
-- 1. Add Total Amount (Critical for Financials)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0;

-- 2. Add Add-ons (Critical for Product Delivery)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]'::jsonb;

-- 3. Add Fees & Tax (Critical for Reconciliation)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS service_fee numeric DEFAULT 0;

ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0;

-- 5. Add User ID (Critical for "My Tickets")
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 6. Add Created At (Critical for Sorting)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 7. Force Schema Cache Reload (Critical for API to see new columns)
NOTIFY pgrst, 'reload config';
