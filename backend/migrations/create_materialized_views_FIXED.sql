-- Materialized Views for Scan Analytics - FIXED VERSION
-- This version includes proper unique indexes for CONCURRENTLY refresh
-- Run this in Supabase SQL Editor

-- ========================================
-- DROP EXISTING VIEWS (if any)
-- ========================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_event_scan_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_scans_by_hour CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_scan_errors CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_daily_scan_trends CASCADE;

-- ========================================
-- MATERIALIZED VIEW 1: Event Scan Summary
-- ========================================
CREATE MATERIALIZED VIEW public.mv_event_scan_summary AS
SELECT 
    event_id,
    COUNT(*)::BIGINT as total_scans,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_scans,
    COUNT(*) FILTER (WHERE success = false)::BIGINT as failed_scans,
    ROUND(
        (COUNT(*) FILTER (WHERE success = true)::NUMERIC / 
        NULLIF(COUNT(*), 0)::NUMERIC) * 100, 
        2
    ) as success_rate,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_duration,
    MIN(duration) as min_duration,
    MAX(duration) as max_duration,
    COUNT(*) FILTER (WHERE scan_method = 'camera')::BIGINT as camera_scans,
    COUNT(*) FILTER (WHERE scan_method = 'upload')::BIGINT as upload_scans,
    COUNT(*) FILTER (WHERE scan_method = 'manual')::BIGINT as manual_scans,
    MIN(created_at) as first_scan_at,
    MAX(created_at) as last_scan_at,
    NOW() as refreshed_at
FROM public.scan_analytics
GROUP BY event_id;

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_event_scan_summary_event 
ON public.mv_event_scan_summary(event_id);

-- ========================================
-- MATERIALIZED VIEW 2: Scans by Hour
-- ========================================
CREATE MATERIALIZED VIEW public.mv_scans_by_hour AS
SELECT 
    event_id,
    EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))::INTEGER as hour,
    COUNT(*)::BIGINT as scan_count,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_count,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_duration
FROM public.scan_analytics
GROUP BY event_id, hour;

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_scans_by_hour_unique 
ON public.mv_scans_by_hour(event_id, hour);

-- Additional index for sorting
CREATE INDEX idx_mv_scans_by_hour_count 
ON public.mv_scans_by_hour(scan_count DESC);

-- ========================================
-- MATERIALIZED VIEW 3: Scan Errors
-- ========================================
CREATE MATERIALIZED VIEW public.mv_scan_errors AS
SELECT 
    event_id,
    error_message,
    COUNT(*)::BIGINT as error_count,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_error_duration,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM public.scan_analytics
WHERE success = false AND error_message IS NOT NULL
GROUP BY event_id, error_message;

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_scan_errors_unique 
ON public.mv_scan_errors(event_id, error_message);

-- Additional index for sorting
CREATE INDEX idx_mv_scan_errors_count 
ON public.mv_scan_errors(error_count DESC);

-- ========================================
-- MATERIALIZED VIEW 4: Daily Scan Trends
-- ========================================
CREATE MATERIALIZED VIEW public.mv_daily_scan_trends AS
SELECT 
    event_id,
    DATE(created_at) as scan_date,
    COUNT(*)::BIGINT as total_scans,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_scans,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_duration,
    MIN(duration) as min_duration,
    MAX(duration) as max_duration
FROM public.scan_analytics
GROUP BY event_id, scan_date;

-- UNIQUE index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_mv_daily_scan_trends_unique 
ON public.mv_daily_scan_trends(event_id, scan_date);

-- ========================================
-- REFRESH FUNCTION
-- ========================================
CREATE OR REPLACE FUNCTION refresh_scan_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Use CONCURRENTLY to avoid locking (safe for production)
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_scan_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_scans_by_hour;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_scan_errors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_scan_trends;
    
    RAISE NOTICE '✅ All materialized views refreshed successfully';
END;
$$;

-- ========================================
-- OPTIMIZED QUERY FUNCTIONS
-- ========================================

-- Fast event summary
CREATE OR REPLACE FUNCTION get_fast_scan_summary(p_event_id TEXT)
RETURNS TABLE (
    total_scans BIGINT,
    successful_scans BIGINT,
    failed_scans BIGINT,
    success_rate NUMERIC,
    avg_duration NUMERIC,
    min_duration INTEGER,
    max_duration INTEGER,
    camera_scans BIGINT,
    upload_scans BIGINT,
    manual_scans BIGINT,
    first_scan_at TIMESTAMPTZ,
    last_scan_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.total_scans,
        mv.successful_scans,
        mv.failed_scans,
        mv.success_rate,
        mv.avg_duration,
        mv.min_duration,
        mv.max_duration,
        mv.camera_scans,
        mv.upload_scans,
        mv.manual_scans,
        mv.first_scan_at,
        mv.last_scan_at
    FROM public.mv_event_scan_summary mv
    WHERE mv.event_id = p_event_id;
END;
$$;

-- Fast peak hour detection
CREATE OR REPLACE FUNCTION get_fast_peak_hour(p_event_id TEXT)
RETURNS TABLE (
    hour INTEGER,
    scan_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.hour,
        mv.scan_count
    FROM public.mv_scans_by_hour mv
    WHERE mv.event_id = p_event_id
    ORDER BY mv.scan_count DESC
    LIMIT 1;
END;
$$;

-- Fast error breakdown
CREATE OR REPLACE FUNCTION get_fast_error_breakdown(
    p_event_id TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    error_message TEXT,
    error_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mv.error_message,
        mv.error_count
    FROM public.mv_scan_errors mv
    WHERE mv.event_id = p_event_id
    ORDER BY mv.error_count DESC
    LIMIT p_limit;
END;
$$;

-- ========================================
-- AUTO-REFRESH TRIGGER (Optional)
-- ========================================

CREATE OR REPLACE FUNCTION trigger_refresh_analytics_views()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Notify to trigger async refresh
    PERFORM pg_notify('refresh_analytics_views', NEW.event_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_scan_insert_refresh ON public.scan_analytics;
CREATE TRIGGER after_scan_insert_refresh
AFTER INSERT ON public.scan_analytics
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_analytics_views();

-- ========================================
-- PERMISSIONS
-- ========================================

GRANT SELECT ON public.mv_event_scan_summary TO authenticated;
GRANT SELECT ON public.mv_scans_by_hour TO authenticated;
GRANT SELECT ON public.mv_scan_errors TO authenticated;
GRANT SELECT ON public.mv_daily_scan_trends TO authenticated;

GRANT ALL ON public.mv_event_scan_summary TO service_role;
GRANT ALL ON public.mv_scans_by_hour TO service_role;
GRANT ALL ON public.mv_scan_errors TO service_role;
GRANT ALL ON public.mv_daily_scan_trends TO service_role;

-- ========================================
-- INITIAL REFRESH
-- ========================================

SELECT refresh_scan_analytics_views();

-- ========================================
-- VERIFICATION
-- ========================================

DO $$ 
DECLARE
    v_count INTEGER;
BEGIN 
    SELECT COUNT(*) INTO v_count FROM public.mv_event_scan_summary;
    RAISE NOTICE '✅ Materialized views created successfully!';
    RAISE NOTICE '📊 Found % events with analytics', v_count;
    RAISE NOTICE '';
    RAISE NOTICE '📋 Available views:';
    RAISE NOTICE '   - mv_event_scan_summary (%  events)', v_count;
    RAISE NOTICE '   - mv_scans_by_hour';
    RAISE NOTICE '   - mv_scan_errors';
    RAISE NOTICE '   - mv_daily_scan_trends';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Available functions:';
    RAISE NOTICE '   - get_fast_scan_summary(event_id)';
    RAISE NOTICE '   - get_fast_peak_hour(event_id)';
    RAISE NOTICE '   - get_fast_error_breakdown(event_id)';
    RAISE NOTICE '   - refresh_scan_analytics_views()';
END $$;
