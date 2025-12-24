-- Replace 'your_email@example.com' with the email address of the user you want to be Superadmin
-- This user must already have signed up / exist in the profiles table.

UPDATE public.profiles
SET 
    role = 'admin',
    is_admin = TRUE
WHERE 
    email = 'your_email@example.com';
