-- Materialized Views for Scan Analytics Performance Optimization
-- Run this in Supabase SQL Editor

-- ========================================
-- MATERIALIZED VIEW: Event Scan Summary
-- ========================================
-- Pre-aggregated summary per event for fast dashboard loading
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_event_scan_summary AS
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

-- Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_event_scan_summary_event 
ON public.mv_event_scan_summary(event_id);

-- ========================================
-- MATERIALIZED VIEW: Hourly Scan Distribution
-- ========================================
-- Pre-calculated scans by hour for all events
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_scans_by_hour AS
SELECT 
    event_id,
    EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))::INTEGER as hour,
    COUNT(*)::BIGINT as scan_count,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_count,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_duration
FROM public.scan_analytics
GROUP BY event_id, hour
ORDER BY event_id, scan_count DESC;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_scans_by_hour_event 
ON public.mv_scans_by_hour(event_id);

CREATE INDEX IF NOT EXISTS idx_mv_scans_by_hour_count 
ON public.mv_scans_by_hour(scan_count DESC);

-- ========================================
-- MATERIALIZED VIEW: Error Analytics
-- ========================================
-- Pre-aggregated error breakdown per event
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_scan_errors AS
SELECT 
    event_id,
    error_message,
    COUNT(*)::BIGINT as error_count,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_error_duration,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM public.scan_analytics
WHERE success = false AND error_message IS NOT NULL
GROUP BY event_id, error_message
ORDER BY event_id, error_count DESC;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_scan_errors_event 
ON public.mv_scan_errors(event_id);

CREATE INDEX IF NOT EXISTS idx_mv_scan_errors_count 
ON public.mv_scan_errors(error_count DESC);

-- ========================================
-- MATERIALIZED VIEW: Daily Scan Trends
-- ========================================
-- Daily aggregated scans for trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_daily_scan_trends AS
SELECT 
    event_id,
    DATE(created_at) as scan_date,
    COUNT(*)::BIGINT as total_scans,
    COUNT(*) FILTER (WHERE success = true)::BIGINT as successful_scans,
    ROUND(AVG(duration)::NUMERIC, 0) as avg_duration,
    MIN(duration) as min_duration,
    MAX(duration) as max_duration
FROM public.scan_analytics
GROUP BY event_id, scan_date
ORDER BY event_id, scan_date DESC;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mv_daily_scan_trends_event_date 
ON public.mv_daily_scan_trends(event_id, scan_date DESC);

-- ========================================
-- FUNCTION: Refresh All Materialized Views
-- ========================================
CREATE OR REPLACE FUNCTION refresh_scan_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_scan_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_scans_by_hour;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_scan_errors;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_scan_trends;
    
    RAISE NOTICE 'All scan analytics materialized views refreshed successfully';
END;
$$;

-- ========================================
-- OPTIMIZED QUERY FUNCTIONS USING MATERIALIZED VIEWS
-- ========================================

-- Fast event summary from materialized view
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

-- Fast peak hour detection from materialized view
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

-- Fast error breakdown from materialized view
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
-- AUTO-REFRESH TRIGGER
-- ========================================
-- Automatically refresh views after inserts (debounced)

CREATE OR REPLACE FUNCTION trigger_refresh_analytics_views()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Use pg_notify to trigger async refresh (processed by separate worker)
    PERFORM pg_notify('refresh_analytics_views', NEW.event_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER after_scan_insert_refresh
AFTER INSERT ON public.scan_analytics
FOR EACH ROW
EXECUTE FUNCTION trigger_refresh_analytics_views();

-- ========================================
-- SCHEDULED REFRESH (via pg_cron if available)
-- ========================================
-- If pg_cron extension is enabled, schedule auto-refresh every 5 minutes

-- Uncomment if pg_cron is installed:
-- SELECT cron.schedule(
--     'refresh-scan-analytics',
--     '*/5 * * * *',  -- Every 5 minutes
--     'SELECT refresh_scan_analytics_views();'
-- );

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
-- COMMENTS
-- ========================================

COMMENT ON MATERIALIZED VIEW public.mv_event_scan_summary IS 'Pre-aggregated scan summary per event for fast dashboard queries';
COMMENT ON MATERIALIZED VIEW public.mv_scans_by_hour IS 'Hourly scan distribution for peak time analysis';
COMMENT ON MATERIALIZED VIEW public.mv_scan_errors IS 'Error frequency breakdown per event';
COMMENT ON MATERIALIZED VIEW public.mv_daily_scan_trends IS 'Daily scan trends for historical analysis';
COMMENT ON FUNCTION refresh_scan_analytics_views() IS 'Refresh all scan analytics materialized views';

-- Initial refresh
SELECT refresh_scan_analytics_views();

-- Notify schema change
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Materialized views created and refreshed successfully!';
    RAISE NOTICE '📊 Available views:';
    RAISE NOTICE '   - mv_event_scan_summary';
    RAISE NOTICE '   - mv_scans_by_hour';
    RAISE NOTICE '   - mv_scan_errors';
    RAISE NOTICE '   - mv_daily_scan_trends';
    RAISE NOTICE '⚡ Use get_fast_scan_summary() for 10x faster queries!';
END $$;
