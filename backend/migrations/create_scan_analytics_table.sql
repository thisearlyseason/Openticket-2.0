-- Scan Analytics Table for Mobile Scanner Performance Tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.scan_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Event & Ticket Info
    event_id TEXT NOT NULL,
    ticket_id TEXT,
    
    -- Scan Result
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- Performance Metrics
    duration INTEGER NOT NULL,  -- milliseconds
    timestamp BIGINT NOT NULL,  -- Unix timestamp
    
    -- Scan Method
    scan_method TEXT,  -- 'camera', 'upload', 'manual'
    
    -- Device Information
    user_agent TEXT,
    platform TEXT,
    online BOOLEAN DEFAULT true,
    
    -- User Info (optional)
    user_id TEXT,
    user_email TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_scan_analytics_event_id ON public.scan_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_created_at ON public.scan_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_success ON public.scan_analytics(success);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_timestamp ON public.scan_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scan_analytics_event_success ON public.scan_analytics(event_id, success);

-- Enable RLS
ALTER TABLE public.scan_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access to scan analytics" 
ON public.scan_analytics
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy: Event owners can view their analytics
CREATE POLICY "Event owners can view scan analytics" 
ON public.scan_analytics
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.events 
        WHERE events.id = scan_analytics.event_id 
        AND events.owner_id = auth.uid()::text
    )
);

-- Function to get scan analytics summary
CREATE OR REPLACE FUNCTION get_scan_analytics_summary(
    p_event_id TEXT,
    p_start_time BIGINT DEFAULT NULL,
    p_end_time BIGINT DEFAULT NULL
)
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
    manual_scans BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
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
        COUNT(*) FILTER (WHERE scan_method = 'manual')::BIGINT as manual_scans
    FROM public.scan_analytics
    WHERE 
        event_id = p_event_id
        AND (p_start_time IS NULL OR timestamp >= p_start_time)
        AND (p_end_time IS NULL OR timestamp <= p_end_time);
END;
$$;

-- Function to get error breakdown
CREATE OR REPLACE FUNCTION get_scan_error_breakdown(
    p_event_id TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    error_message TEXT,
    count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sa.error_message,
        COUNT(*)::BIGINT as count
    FROM public.scan_analytics sa
    WHERE 
        sa.event_id = p_event_id 
        AND sa.success = false
        AND sa.error_message IS NOT NULL
    GROUP BY sa.error_message
    ORDER BY count DESC
    LIMIT p_limit;
END;
$$;

-- Function to get scans per hour (for peak time detection)
CREATE OR REPLACE FUNCTION get_scans_by_hour(
    p_event_id TEXT
)
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
        EXTRACT(HOUR FROM to_timestamp(timestamp / 1000))::INTEGER as hour,
        COUNT(*)::BIGINT as scan_count
    FROM public.scan_analytics
    WHERE event_id = p_event_id
    GROUP BY hour
    ORDER BY scan_count DESC;
END;
$$;

-- Grant permissions
GRANT ALL ON public.scan_analytics TO service_role;
GRANT SELECT ON public.scan_analytics TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.scan_analytics IS 'Mobile scanner performance metrics and analytics tracking';

-- Notify schema change
NOTIFY pgrst, 'reload schema';
