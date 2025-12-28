-- RPC: process_checkout_success
-- Purpose: Atomically update registration status and insert financial record.
-- Usage: Called by stripeWebhookController.js on checkout.session.completed

CREATE OR REPLACE FUNCTION process_checkout_success(
    p_session_id TEXT,
    p_payment_intent_id TEXT,
    p_total_amount NUMERIC,
    p_platform_fee NUMERIC,
    p_stripe_fee NUMERIC,
    p_tax_amount NUMERIC,
    p_organizer_net NUMERIC,
    p_currency TEXT,
    p_event_id TEXT,
    p_transaction_type TEXT,
    p_tickets JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reg_id TEXT;
BEGIN
    -- 1. Check if Registration Exists (Locking row if needed, but simple select is fine for now)
    SELECT id INTO v_reg_id FROM registrations WHERE stripe_checkout_session_id = p_session_id;
    
    IF v_reg_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Registration not found');
    END IF;

    -- 2. Update Registration
    UPDATE registrations
    SET 
        payment_status = 'paid',
        stripe_payment_intent_id = p_payment_intent_id,
        approval_status = COALESCE(approval_status, 'approved'),
        tickets = p_tickets
    WHERE stripe_checkout_session_id = p_session_id;

    -- 3. Insert Financial Record
    INSERT INTO financial_transactions (
        event_id,
        stripe_session_id,
        gross_amount,
        platform_fee,
        stripe_fee,
        tax_amount,
        organizer_net,
        currency,
        status,
        payout_status,
        transaction_type,
        created_at
    ) VALUES (
        p_event_id,
        p_session_id,
        p_total_amount,
        p_platform_fee,
        p_stripe_fee,
        p_tax_amount,
        p_organizer_net,
        p_currency,
        'paid',
        'pending',
        p_transaction_type,
        NOW()
    );

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    -- Automatically rolls back
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
