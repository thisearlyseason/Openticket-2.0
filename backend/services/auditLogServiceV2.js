/**
 * Enhanced Audit Logging Service - Phase 2
 * Comprehensive security tracking for sensitive actions
 */

import supabase from './supabase.js';

export const AUDIT_EVENTS = {
    // Authentication
    USER_SIGNUP: 'user_signup',
    USER_LOGIN: 'user_login',
    PASSWORD_CHANGE: 'password_change',
    
    // Payments (Critical)
    PAYMENT_CREATED: 'payment_created',
    PAYMENT_SUCCESS: 'payment_success',
    REFUND_INITIATED: 'refund_initiated',
    PRICE_CHANGE: 'price_change',
    
    // Security Events (Critical)
    PRICE_MANIPULATION_ATTEMPT: 'price_manipulation_attempt',
    IDOR_ATTEMPT: 'idor_attempt',
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    SESSION_EXPIRED: 'session_expired',
    
    // Admin Actions
    EVENT_DELETE: 'event_delete',
    MANUAL_REFUND: 'manual_refund'
};

export const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical'
};

export const logAuditEvent = async ({
    eventType,
    severity = SEVERITY.INFO,
    userId = null,
    details = {},
    ipAddress = null
}) => {
    try {
        console[severity === SEVERITY.CRITICAL ? 'error' : 'log'](
            `[Audit] ${severity.toUpperCase()} - ${eventType}`,
            { userId, details }
        );

        await supabase.from('audit_log').insert([{
            event_type: eventType,
            severity,
            user_id: userId,
            details,
            ip_address: ipAddress,
            created_at: new Date().toISOString()
        }]);

        return { success: true };
    } catch (error) {
        console.error('[Audit] Logging failed:', error);
        return { success: false };
    }
};

export default { logAuditEvent, AUDIT_EVENTS, SEVERITY };
