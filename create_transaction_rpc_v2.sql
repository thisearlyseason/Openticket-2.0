-- RPC: process_checkout_success_v2
-- Purpose: Atomically update registration status and insert financial record.
-- IMPROVED VERSION with full financial tracking

CREATE OR REPLACE FUNCTION process_checkout_success_v2(
    p_session_id TEXT,
    p_payment_intent_id TEXT,
    p_gross_amount NUMERIC,
    p_platform_fee NUMERIC,
    p_stripe_fee NUMERIC,
    p_tax_amount NUMERIC,
    p_discount_amount NUMERIC DEFAULT 0,
    p_organizer_net NUMERIC,
    p_currency TEXT DEFAULT 'usd',
    p_event_id TEXT,
    p_registration_id TEXT,
    p_transaction_type TEXT DEFAULT 'ticket_sale',
    p_tickets JSONB,
    p_affiliate_code TEXT DEFAULT NULL,
    p_affiliate_commission NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_tx UUID;
BEGIN
    -- 1. Check for idempotency (transaction already exists)
    SELECT id INTO v_existing_tx 
    FROM financial_transactions 
    WHERE stripe_session_id = p_session_id;
    
    IF v_existing_tx IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already processed');
    END IF;

    -- 2. Update Registration
    UPDATE registrations
    SET 
        payment_status = 'paid',
        stripe_payment_intent_id = p_payment_intent_id,
        approval_status = COALESCE(approval_status, 'approved'),
        tickets = p_tickets
    WHERE stripe_checkout_session_id = p_session_id
       OR id = p_registration_id;

    -- 3. Insert Financial Record
    INSERT INTO financial_transactions (
        registration_id,
        event_id,
        stripe_session_id,
        stripe_payment_intent_id,
        gross_amount,
        platform_fee,
        stripe_fee,
        tax_amount,
        organizer_net,
        currency,
        status,
        payout_status,
        transaction_type,
        affiliate_code,
        affiliate_commission,
        created_at
    ) VALUES (
        p_registration_id,
        p_event_id,
        p_session_id,
        p_payment_intent_id,
        p_gross_amount,
        p_platform_fee,
        p_stripe_fee,
        p_tax_amount,
        p_organizer_net,
        p_currency,
        'succeeded',
        'pending',
        p_transaction_type,
        p_affiliate_code,
        p_affiliate_commission,
        NOW()
    );

    -- 4. Update event registered_count
    UPDATE events
    SET registered_count = COALESCE(registered_count, 0) + (
        SELECT COALESCE(jsonb_array_length(p_tickets), 1)
    )
    WHERE id = p_event_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    -- Automatically rolls back
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Add missing columns to financial_transactions if needed
ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS registration_id TEXT;

ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0;

ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS affiliate_code TEXT;

ALTER TABLE public.financial_transactions 
ADD COLUMN IF NOT EXISTS affiliate_commission NUMERIC(10, 2) DEFAULT 0;

-- Create admin financial stats RPC
CREATE OR REPLACE FUNCTION get_admin_financial_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_volume NUMERIC;
    v_platform_fees NUMERIC;
    v_organizer_net NUMERIC;
    v_refund_total NUMERIC;
BEGIN
    -- Calculate totals from financial_transactions
    SELECT 
        COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN gross_amount > 0 THEN platform_fee ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN gross_amount > 0 THEN organizer_net ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN gross_amount < 0 THEN ABS(gross_amount) ELSE 0 END), 0)
    INTO v_total_volume, v_platform_fees, v_organizer_net, v_refund_total
    FROM financial_transactions;

    RETURN jsonb_build_object(
        'totalVolume', v_total_volume,
        'platformFees', v_platform_fees,
        'organizerNet', v_organizer_net,
        'refundTotal', v_refund_total
    );
END;
$$;

-- Create organizer financial stats RPC (for EventFinance)
CREATE OR REPLACE FUNCTION get_organizer_event_financials(p_event_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'grossSales', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN gross_amount ELSE 0 END), 0),
        'platformFees', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN platform_fee ELSE 0 END), 0),
        'stripeFees', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN stripe_fee ELSE 0 END), 0),
        'taxCollected', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN tax_amount ELSE 0 END), 0),
        'netEarnings', COALESCE(SUM(CASE WHEN gross_amount > 0 THEN organizer_net ELSE 0 END), 0),
        'refundedAmount', COALESCE(SUM(CASE WHEN gross_amount < 0 THEN ABS(gross_amount) ELSE 0 END), 0),
        'transactionCount', COUNT(CASE WHEN gross_amount > 0 THEN 1 END),
        'refundCount', COUNT(CASE WHEN gross_amount < 0 THEN 1 END)
    )
    INTO v_result
    FROM financial_transactions
    WHERE event_id = p_event_id;

    RETURN v_result;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
