
-- 1. Fix User ID Column Type (UUID -> TEXT)
-- We must drop the old column because you can't cast UUID to TEXT easily in some versions without data loss logic, and it's simpler since it's empty/null mostly.
ALTER TABLE registrations DROP COLUMN IF EXISTS user_id;

-- 2. Re-Add as TEXT to support Firebase IDs
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.profiles(id);

-- 3. Ensure Created At exists
ALTER TABLE registrations 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Reload Schema
NOTIFY pgrst, 'reload config';
