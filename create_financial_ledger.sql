-- Create Financial Transactions Ledger
-- This table is the single source of truth for all money movement.

CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id TEXT REFERENCES public.registrations(id) ON DELETE SET NULL,
    event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT,
    stripe_session_id TEXT UNIQUE, -- Unique constraint aids idempotency
    
    gross_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Application fee
    stripe_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- Estimated or actual Stripe processing fee
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    organizer_net NUMERIC(10, 2) NOT NULL DEFAULT 0, -- What the organizer actually gets (Gross - Platform - Stripe - Tax)
    
    currency TEXT DEFAULT 'usd',
    status TEXT DEFAULT 'succeeded', -- succeeded, refunded, disputed
    payout_status TEXT DEFAULT 'pending', -- pending, paid_out
    transaction_type TEXT DEFAULT 'ticket_sale', -- ticket_sale, subscription_charge, refund
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Organizers view their own transactions" ON public.financial_transactions
    FOR SELECT USING (
        event_id IN (SELECT id FROM public.events WHERE owner_id = auth.uid()::text)
    );

CREATE POLICY "Superadmins view all transactions" ON public.financial_transactions
    FOR ALL USING (
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()::text) = true
    );


-- Create Financial Line Items
-- Detailed breakdown of what made up the transaction (Tickets, Addons, Fees)
CREATE TABLE IF NOT EXISTS public.financial_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE CASCADE,
    description TEXT,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT, -- ticket, addon, tax, service_fee, custom_fee
    quantity INTEGER DEFAULT 1
);

-- RLS for Line Items (Inherit from Transaction presumably, or similar logic)
ALTER TABLE public.financial_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers view own line items" ON public.financial_line_items
    FOR SELECT USING (
        transaction_id IN (
            SELECT id FROM public.financial_transactions WHERE event_id IN (
                SELECT id FROM public.events WHERE owner_id = auth.uid()::text
            )
        )
    );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
