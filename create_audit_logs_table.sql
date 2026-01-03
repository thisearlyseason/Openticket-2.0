-- Audit Log Table for Financial Events
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Actor Information
    actor_id TEXT,                          -- User ID of the actor
    actor_type TEXT NOT NULL,               -- 'organizer', 'guest', 'system', 'superadmin'
    actor_email TEXT,
    
    -- Event Context
    event_id TEXT,                          -- Related event (if applicable)
    registration_id TEXT,                   -- Related registration (if applicable)
    
    -- Transaction Details
    transaction_type TEXT NOT NULL,         -- 'ticket_purchase', 'refund', 'payout', 'subscription', 'stripe_connect', 'fee_collection'
    description TEXT,
    
    -- Financial Data
    gross_amount NUMERIC(10, 2) DEFAULT 0,
    stripe_fee NUMERIC(10, 2) DEFAULT 0,
    platform_fee NUMERIC(10, 2) DEFAULT 0,
    net_amount NUMERIC(10, 2) DEFAULT 0,
    currency TEXT DEFAULT 'usd',
    
    -- Stripe References
    stripe_payment_intent_id TEXT,
    stripe_charge_id TEXT,
    stripe_subscription_id TEXT,
    stripe_session_id TEXT,
    stripe_refund_id TEXT,
    stripe_account_id TEXT,
    
    -- Status & Metadata
    status TEXT DEFAULT 'completed',        -- 'pending', 'completed', 'failed'
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for efficient querying
    CONSTRAINT valid_actor_type CHECK (actor_type IN ('organizer', 'guest', 'system', 'superadmin'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_id ON public.audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction_type ON public.audit_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_stripe_payment_intent ON public.audit_logs(stripe_payment_intent_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Superadmins can see all logs
CREATE POLICY "Superadmins can view all audit logs" ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'superadmin' OR is_admin = true)
        )
    );

-- Policy: Organizers can see their own logs
CREATE POLICY "Organizers can view their audit logs" ON public.audit_logs
    FOR SELECT
    USING (actor_id = auth.uid()::text);

-- Policy: System can insert logs
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs
    FOR INSERT
    WITH CHECK (true);

-- RPC: Get organizer financial summary
CREATE OR REPLACE FUNCTION get_organizer_financial_summary(p_organizer_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalGrossSales', COALESCE(SUM(CASE WHEN transaction_type = 'ticket_purchase' THEN gross_amount ELSE 0 END), 0),
        'totalStripeFees', COALESCE(SUM(CASE WHEN transaction_type = 'ticket_purchase' THEN stripe_fee ELSE 0 END), 0),
        'totalPlatformFees', COALESCE(SUM(CASE WHEN transaction_type = 'ticket_purchase' THEN platform_fee ELSE 0 END), 0),
        'totalNetEarnings', COALESCE(SUM(CASE WHEN transaction_type = 'ticket_purchase' THEN net_amount ELSE 0 END), 0),
        'totalRefunds', COALESCE(SUM(CASE WHEN transaction_type = 'refund' THEN ABS(gross_amount) ELSE 0 END), 0),
        'ticketsSold', COUNT(CASE WHEN transaction_type = 'ticket_purchase' THEN 1 END),
        'refundCount', COUNT(CASE WHEN transaction_type = 'refund' THEN 1 END)
    )
    INTO v_result
    FROM audit_logs
    WHERE actor_id = p_organizer_id OR event_id IN (
        SELECT id FROM events WHERE owner_id = p_organizer_id
    );

    RETURN v_result;
END;
$$;

-- RPC: Get superadmin financial overview
CREATE OR REPLACE FUNCTION get_superadmin_financial_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalPlatformVolume', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE 0 END), 0),
        'totalPlatformFees', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN platform_fee ELSE 0 END), 0),
        'totalStripeFees', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN stripe_fee ELSE 0 END), 0),
        'totalOrganizerPayouts', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN net_amount ELSE 0 END), 0),
        'totalRefunds', COALESCE(SUM(CASE WHEN transaction_type = 'refund' THEN ABS(gross_amount) ELSE 0 END), 0),
        'subscriptionRevenue', COALESCE(SUM(CASE WHEN transaction_type = 'subscription' THEN gross_amount ELSE 0 END), 0),
        'totalTransactions', COUNT(*),
        'ticketPurchases', COUNT(CASE WHEN transaction_type = 'ticket_purchase' THEN 1 END),
        'refundCount', COUNT(CASE WHEN transaction_type = 'refund' THEN 1 END)
    )
    INTO v_result
    FROM audit_logs;

    RETURN v_result;
END;
$$;

-- Notify schema change
NOTIFY pgrst, 'reload schema';
