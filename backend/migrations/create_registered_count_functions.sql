-- Migration: Create RPC functions for managing registered_count
-- Purpose: Safely increment/decrement event registered_count with concurrency safety
-- Date: 2025-01-17

-- Drop existing functions if they exist (with specific signatures)
DROP FUNCTION IF EXISTS increment_registered_count(UUID, INTEGER);
DROP FUNCTION IF EXISTS decrement_registered_count(UUID, INTEGER);

-- Function to increment registered count (used when payment succeeds)
CREATE OR REPLACE FUNCTION increment_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = COALESCE(registered_count, 0) + p_count
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement registered count (used when refund occurs)
CREATE OR REPLACE FUNCTION decrement_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = GREATEST(0, COALESCE(registered_count, 0) - p_count)
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO authenticated;

-- Also grant to anon role for public access if needed
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION increment_registered_count IS 'Safely increments event registered count when payment succeeds';
COMMENT ON FUNCTION decrement_registered_count IS 'Safely decrements event registered count when refund/cancellation occurs. Never goes below 0.';
