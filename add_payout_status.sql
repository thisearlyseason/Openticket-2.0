
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';
