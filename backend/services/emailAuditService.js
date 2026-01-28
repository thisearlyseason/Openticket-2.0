/**
 * EMAIL AUDIT SERVICE
 * Logs all email sends for debugging and preventing duplicates
 */

import supabase from './supabase.js';

// In-memory cache for recent sends (fallback if DB unavailable)
const recentSends = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Log an email send attempt
 */
export const logEmailSend = async ({
    triggerType,
    emailType,
    recipient,
    registrationId,
    eventId,
    success,
    messageId,
    error,
    metadata = {}
}) => {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
        trigger_type: triggerType,
        email_type: emailType,
        recipient,
        registration_id: registrationId,
        event_id: eventId,
        success,
        message_id: messageId,
        error: error || null,
        metadata,
        created_at: timestamp
    };

    console.log(`[EmailAudit] ${success ? '✅' : '❌'} ${emailType} to ${recipient} (trigger: ${triggerType})`);

    try {
        // Try to log to database
        const { error: dbError } = await supabase
            .from('email_audit_log')
            .insert([logEntry]);
        
        if (dbError) {
            // Table might not exist, just log to console
            console.warn('[EmailAudit] DB log failed (table may not exist):', dbError.message);
        }
    } catch (e) {
        console.warn('[EmailAudit] DB log exception:', e.message);
    }

    return logEntry;
};

/**
 * Check if an email was already sent for this trigger
 * Prevents duplicate sends
 */
export const wasEmailSent = async (triggerType, emailType, registrationId) => {
    const cacheKey = `${triggerType}:${emailType}:${registrationId}`;
    
    // Check in-memory cache first
    if (recentSends.has(cacheKey)) {
        const cached = recentSends.get(cacheKey);
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            console.log(`[EmailAudit] Duplicate prevented (cache): ${cacheKey}`);
            return true;
        }
    }

    try {
        // Check database
        const { data, error } = await supabase
            .from('email_audit_log')
            .select('id')
            .eq('trigger_type', triggerType)
            .eq('email_type', emailType)
            .eq('registration_id', registrationId)
            .eq('success', true)
            .limit(1);
        
        if (!error && data && data.length > 0) {
            console.log(`[EmailAudit] Duplicate prevented (db): ${cacheKey}`);
            return true;
        }
    } catch (e) {
        // If DB check fails, rely on cache only
        console.warn('[EmailAudit] DB check failed:', e.message);
    }

    return false;
};

/**
 * Mark an email as sent (add to cache)
 */
export const markEmailSent = (triggerType, emailType, registrationId) => {
    const cacheKey = `${triggerType}:${emailType}:${registrationId}`;
    recentSends.set(cacheKey, { timestamp: Date.now() });
    
    // Clean old entries periodically
    if (recentSends.size > 1000) {
        const cutoff = Date.now() - CACHE_TTL;
        for (const [key, value] of recentSends.entries()) {
            if (value.timestamp < cutoff) {
                recentSends.delete(key);
            }
        }
    }
};

/**
 * Valid trigger types
 */
export const TRIGGER_TYPES = {
    STRIPE_PAYMENT_SUCCEEDED: 'payment_intent.succeeded',
    STRIPE_REFUND_SUCCEEDED: 'refund.succeeded',
    STRIPE_CHECKOUT_COMPLETED: 'checkout.session.completed',
    CRON_ABANDONED_CART: 'cron.abandoned_cart',
    CRON_REMINDER_PRIMARY: 'cron.reminder.primary',
    CRON_REMINDER_SECONDARY: 'cron.reminder.secondary',
    CRON_POST_EVENT: 'cron.post_event',
    CRON_PRESALE_NOTIFY: 'cron.presale_notify',
    BACKEND_APPROVAL: 'backend.approval',
    BACKEND_MANUAL: 'backend.manual',
    BACKEND_PRESALE_SIGNUP: 'backend.presale_signup',
};

/**
 * Valid email types
 */
export const EMAIL_TYPES = {
    PURCHASE_CONFIRMATION: 'purchase_confirmation',
    REFUND_CONFIRMATION: 'refund_confirmation',
    ABANDONED_CART: 'abandoned_cart',
    EVENT_REMINDER_PRIMARY: 'event_reminder_primary',
    EVENT_REMINDER_SECONDARY: 'event_reminder_secondary',
    POST_EVENT_THANK_YOU: 'post_event_thank_you',
    APPROVAL_CONFIRMATION: 'approval_confirmation',
    PRESALE_SIGNUP_CONFIRMATION: 'presale_signup_confirmation',
    PRESALE_NOW_OPEN: 'presale_now_open',
};

export default {
    logEmailSend,
    wasEmailSent,
    markEmailSent,
    TRIGGER_TYPES,
    EMAIL_TYPES,
};
