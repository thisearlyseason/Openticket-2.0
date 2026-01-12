-- Security Audit Log Table for Ticket Transfers and Fraud Detection
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Action Information
    action TEXT NOT NULL,                   -- 'TRANSFER_INITIATED', 'TRANSFER_COMPLETED', 'SUSPICIOUS_TRANSFER_RATE', 'SUSPICIOUS_CIRCULAR_TRANSFER', etc.
    
    -- Entity Information
    entity_type TEXT NOT NULL,              -- 'ticket', 'registration', 'event', 'user'
    entity_id TEXT NOT NULL,                -- ID of the entity (ticket_key, registration_id, etc.)
    
    -- User Information
    user_id TEXT,                           -- User who performed the action
    user_email TEXT,
    
    -- Additional Details
    details JSONB DEFAULT '{}',             -- Flexible JSON field for action-specific data
    
    -- Metadata
    ip_address TEXT,                        -- IP address of the user (if available)
    user_agent TEXT,                        -- Browser/client user agent
    severity TEXT DEFAULT 'info',           -- 'info', 'warning', 'critical'
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('ticket', 'registration', 'event', 'user', 'transfer')),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_action ON public.security_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_entity_type ON public.security_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_entity_id ON public.security_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON public.security_audit_logs(severity);

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Superadmins can see all logs
CREATE POLICY "Superadmins can view all security audit logs" ON public.security_audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'superadmin' OR is_admin = true)
        )
    );

-- Policy: Users can see their own logs
CREATE POLICY "Users can view their security audit logs" ON public.security_audit_logs
    FOR SELECT
    USING (user_id = auth.uid()::text);

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert security audit logs" ON public.security_audit_logs
    FOR INSERT
    WITH CHECK (true);

-- Create function to get suspicious activity summary for Super Admin
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

-- Notify schema change
NOTIFY pgrst, 'reload schema';
