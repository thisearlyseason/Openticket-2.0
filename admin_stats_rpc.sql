-- RPC: get_admin_financial_stats
-- Purpose: Efficiently calculate total financial stats for the admin dashboard without fetching all rows.
-- Usage: Called by adminController.js

CREATE OR REPLACE FUNCTION get_admin_financial_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_volume NUMERIC;
    v_platform_fees NUMERIC;
    v_organizer_net NUMERIC;
BEGIN
    -- Calculate aggregates directly in DB
    SELECT 
        COALESCE(SUM(gross_amount), 0),
        COALESCE(SUM(platform_fee), 0),
        COALESCE(SUM(organizer_net), 0)
    INTO 
        v_total_volume,
        v_platform_fees,
        v_organizer_net
    FROM financial_transactions;

    -- Return as JSON object matching the frontend expectation
    RETURN jsonb_build_object(
        'totalVolume', v_total_volume,
        'platformFees', v_platform_fees,
        'organizerNet', v_organizer_net
    );
END;
$$;
