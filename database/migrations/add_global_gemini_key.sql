-- Add global_gemini_key column to profiles table
-- This column stores the super admin's global Gemini API key
-- Users without their own key will fall back to this global key

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS global_gemini_key TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
ON profiles(is_admin) WHERE is_admin = true;

-- Add comment
COMMENT ON COLUMN profiles.global_gemini_key IS 'Global Gemini API key set by super admin for all users to use as fallback';
