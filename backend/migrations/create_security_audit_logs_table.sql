-- Security Audit Log Table for Ticket Transfers and Fraud Detection
-- CLEAN VERSION: Handles first-time creation properly
-- Run this in Supabase SQL Editor

-- Create the table (will skip if exists)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Action Information
    action TEXT NOT NULL,
    
    -- Entity Information
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    
    -- User Information
    user_id TEXT,
    user_email TEXT,
    
    -- Additional Details
    details JSONB DEFAULT '{}',
    
    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    severity TEXT DEFAULT 'info',
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('ticket', 'registration', 'event', 'user', 'transfer')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Create indexes (will skip if exist)
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON public.security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_entity_type ON public.security_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_entity_id ON public.security_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON public.security_audit_logs(severity);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (cleanup)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Service role can insert security audit logs" ON public.security_audit_logs;
    DROP POLICY IF EXISTS "Service role can select all security audit logs" ON public.security_audit_logs;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Policy: Service role can insert logs (for backend)
CREATE POLICY "Service role can insert security audit logs" 
ON public.security_audit_logs
FOR INSERT
WITH CHECK (true);

-- Policy: Service role can select all (for backend API queries)
CREATE POLICY "Service role can select all security audit logs" 
ON public.security_audit_logs
FOR SELECT
USING (true);

-- Create or replace function to get suspicious activity summary
CREATE OR REPLACE FUNCTION get_suspicious_activity_summary(
    p_limit INTEGER DEFAULT 100,
    p_severity TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    user_id TEXT,
    user_email TEXT,
    details JSONB,
    severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sal.id,
        sal.created_at,
        sal.action,
        sal.entity_type,
        sal.entity_id,
        sal.user_id,
        sal.user_email,
        sal.details,
        sal.severity
    FROM public.security_audit_logs sal
    WHERE 
        sal.action LIKE 'SUSPICIOUS%'
        AND (p_severity IS NULL OR sal.severity = p_severity)
    ORDER BY sal.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT ALL ON public.security_audit_logs TO service_role;
GRANT SELECT ON public.security_audit_logs TO authenticated;

-- Add comment
COMMENT ON TABLE public.security_audit_logs IS 'Security audit logs for fraud detection and ticket transfer monitoring';

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ Security audit logs table created successfully!'; 
END $$;
