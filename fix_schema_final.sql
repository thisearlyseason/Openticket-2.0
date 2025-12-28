-- Add the column if it doesn't exist
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS add_ons JSONB DEFAULT '[]';

-- Verify it exists (will show in output if possible, or just ensure no error)
SELECT column_name FROM information_schema.columns WHERE table_name = 'registrations' AND column_name = 'add_ons';

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
