
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'ticket_sale';
