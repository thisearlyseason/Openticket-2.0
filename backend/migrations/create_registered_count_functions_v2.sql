-- Step 1: Find and drop ALL versions of increment_registered_count
-- Run this FIRST to see what functions exist:

SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN ('increment_registered_count', 'decrement_registered_count')
AND pg_function_is_visible(oid);

-- Step 2: Drop ALL versions (run these one by one based on what you see above)
-- Common signature variations:

-- Try these DROP statements (they will fail if the signature doesn't exist, which is fine):
DROP FUNCTION IF EXISTS increment_registered_count(text, integer);
DROP FUNCTION IF EXISTS increment_registered_count(uuid, integer);
DROP FUNCTION IF EXISTS increment_registered_count(text, int);
DROP FUNCTION IF EXISTS increment_registered_count(uuid, int);

DROP FUNCTION IF EXISTS decrement_registered_count(text, integer);
DROP FUNCTION IF EXISTS decrement_registered_count(uuid, integer);
DROP FUNCTION IF EXISTS decrement_registered_count(text, int);
DROP FUNCTION IF EXISTS decrement_registered_count(uuid, int);

-- Step 3: Now create the functions with the correct signature
CREATE OR REPLACE FUNCTION increment_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = COALESCE(registered_count, 0) + p_count
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_registered_count(p_event_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE events
    SET registered_count = GREATEST(0, COALESCE(registered_count, 0) - p_count)
    WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_registered_count(UUID, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION decrement_registered_count(UUID, INTEGER) TO anon;

-- Step 5: Add comments
COMMENT ON FUNCTION increment_registered_count(UUID, INTEGER) IS 'Safely increments event registered count when payment succeeds';
COMMENT ON FUNCTION decrement_registered_count(UUID, INTEGER) IS 'Safely decrements event registered count when refund/cancellation occurs. Never goes below 0.';
