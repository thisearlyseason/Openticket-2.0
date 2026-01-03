-- =====================================================
-- FIX PENDING REGISTRATIONS - RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================
-- This updates registrations that have a stripe_checkout_session_id 
-- but still show "pending" status (they were actually paid)
-- =====================================================

-- Update registrations with stripe_checkout_session_id to 'paid'
UPDATE registrations
SET payment_status = 'paid'
WHERE stripe_checkout_session_id IS NOT NULL 
  AND stripe_checkout_session_id != ''
  AND payment_status = 'pending';

-- Show how many were updated
SELECT 
  'Updated registrations:' as message,
  COUNT(*) as count 
FROM registrations 
WHERE payment_status = 'paid';
