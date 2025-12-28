
-- 1. Drop the Foreign Key Constraint on user_id
-- This unblocks payments for users who have a Firebase ID but are missing a Postgres Profile (Sync Issue)
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_user_id_fkey;

-- 2. Verify Column Type is still TEXT (Safety check)
ALTER TABLE registrations ALTER COLUMN user_id TYPE TEXT;

-- 3. Add Custom Fees Amount (Missing column causing 500 Error)
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS custom_fees_amount NUMERIC DEFAULT 0;

-- 4. Reload Schema
NOTIFY pgrst, 'reload config';
