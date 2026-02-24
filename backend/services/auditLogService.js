import supabase from './supabase.js';

/**
 * Audit Log Service
 * Logs all financial events for organizers, guests, and superadmin
 */

export const AuditLogService = {
    /**
     * Log a ticket purchase
     */
    logTicketPurchase: async ({
        actorId,
        actorType,
        actorEmail,
        eventId,
        registrationId,
        grossAmount,
        stripeFee,
        platformFee,
        netAmount,
        currency = 'usd',
        stripePaymentIntentId,
        stripeSessionId,
        ticketCount = 1,
        metadata = {}
    }) => {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                actor_id: actorId,
                actor_type: actorType,
                actor_email: actorEmail,
                event_id: eventId,
                registration_id: registrationId,
                transaction_type: 'ticket_purchase',
                description: `Purchased ${ticketCount} ticket(s)`,
                gross_amount: grossAmount,
                stripe_fee: stripeFee,
                platform_fee: platformFee,
                net_amount: netAmount,
                currency,
                stripe_payment_intent_id: stripePaymentIntentId,
                stripe_session_id: stripeSessionId,
                status: 'completed',
                metadata: { ...metadata, ticketCount }
            });

            if (error) {
                console.error('[AuditLog] Failed to log ticket purchase:', error);
            } else {
                console.log(`[AuditLog] Ticket purchase logged: $${grossAmount} for event ${eventId}`);
            }
        } catch (e) {
            console.error('[AuditLog] Error logging ticket purchase:', e);
        }
    },

    /**
     * Log a refund
     */
    logRefund: async ({
        actorId,
        actorType,
        actorEmail,
        eventId,
        registrationId,
        refundAmount,
        stripeFeeRefund = 0,
        platformFeeRefund = 0,
        netRefund,
        currency = 'usd',
        stripePaymentIntentId,
        stripeRefundId,
        reason,
        metadata = {}
    }) => {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                actor_id: actorId,
                actor_type: actorType,
                actor_email: actorEmail,
                event_id: eventId,
                registration_id: registrationId,
                transaction_type: 'refund',
                description: reason || 'Refund processed',
                gross_amount: -Math.abs(refundAmount),
                stripe_fee: -Math.abs(stripeFeeRefund),
                platform_fee: -Math.abs(platformFeeRefund),
                net_amount: -Math.abs(netRefund),
                currency,
                stripe_payment_intent_id: stripePaymentIntentId,
                stripe_refund_id: stripeRefundId,
                status: 'completed',
                metadata
            });

            if (error) {
                console.error('[AuditLog] Failed to log refund:', error);
            } else {
                console.log(`[AuditLog] Refund logged: $${refundAmount} for registration ${registrationId}`);
            }
        } catch (e) {
            console.error('[AuditLog] Error logging refund:', e);
        }
    },

    /**
     * Log Stripe Connect onboarding
     */
    logStripeConnect: async ({
        actorId,
        actorEmail,
        stripeAccountId,
        status,
        metadata = {}
    }) => {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                actor_id: actorId,
                actor_type: 'organizer',
                actor_email: actorEmail,
                transaction_type: 'stripe_connect',
                description: `Stripe Connect ${status}`,
                stripe_account_id: stripeAccountId,
                status: status === 'completed' ? 'completed' : 'pending',
                metadata
            });

            if (error) {
                console.error('[AuditLog] Failed to log Stripe Connect:', error);
            } else {
                console.log(`[AuditLog] Stripe Connect logged for ${actorId}: ${status}`);
            }
        } catch (e) {
            console.error('[AuditLog] Error logging Stripe Connect:', e);
        }
    },

    /**
     * Log subscription payment
     */
    logSubscription: async ({
        actorId,
        actorEmail,
        plan,
        amount,
        stripeSubscriptionId,
        stripePaymentIntentId,
        metadata = {}
    }) => {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                actor_id: actorId,
                actor_type: 'organizer',
                actor_email: actorEmail,
                transaction_type: 'subscription',
                description: `${plan} plan subscription`,
                gross_amount: amount,
                platform_fee: amount, // Subscription revenue goes to platform
                net_amount: 0,
                stripe_subscription_id: stripeSubscriptionId,
                stripe_payment_intent_id: stripePaymentIntentId,
                status: 'completed',
                metadata: { ...metadata, plan }
            });

            if (error) {
                console.error('[AuditLog] Failed to log subscription:', error);
            } else {
                console.log(`[AuditLog] Subscription logged: $${amount} for ${plan} plan`);
            }
        } catch (e) {
            console.error('[AuditLog] Error logging subscription:', e);
        }
    },

    /**
     * Log payout to organizer
     */
    logPayout: async ({
        actorId,
        actorEmail,
        amount,
        stripeAccountId,
        payoutMethod,
        metadata = {}
    }) => {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                actor_id: actorId,
                actor_type: 'organizer',
                actor_email: actorEmail,
                transaction_type: 'payout',
                description: `Payout via ${payoutMethod}`,
                gross_amount: amount,
                net_amount: amount,
                stripe_account_id: stripeAccountId,
                status: 'completed',
                metadata: { ...metadata, payoutMethod }
            });

            if (error) {
                console.error('[AuditLog] Failed to log payout:', error);
            } else {
                console.log(`[AuditLog] Payout logged: $${amount} to ${actorId}`);
            }
        } catch (e) {
            console.error('[AuditLog] Error logging payout:', e);
        }
    },

    /**
     * Get audit logs for an organizer
     */
    getOrganizerLogs: async (organizerId, limit = 50) => {
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .or(`actor_id.eq.${organizerId},event_id.in.(select id from events where owner_id='${organizerId}')`)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[AuditLog] Error fetching organizer logs:', e);
            return [];
        }
    },

    /**
     * Get all audit logs (for superadmin)
     */
    getAllLogs: async (limit = 100, offset = 0, filters = {}) => {
        try {
            let query = supabase
                .from('audit_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (filters.transactionType) {
                query = query.eq('transaction_type', filters.transactionType);
            }
            if (filters.actorType) {
                query = query.eq('actor_type', filters.actorType);
            }
            if (filters.eventId) {
                query = query.eq('event_id', filters.eventId);
            }

            const { data, error, count } = await query;

            if (error) throw error;
            return { logs: data, total: count };
        } catch (e) {
            console.error('[AuditLog] Error fetching all logs:', e);
            return { logs: [], total: 0 };
        }
    },

    /**
     * Get financial summary for organizer
     */
    getOrganizerSummary: async (organizerId, { eventId = null, dateFrom = null, dateTo = null } = {}) => {
        try {
            // First get events owned by this organizer
            const eventsQuery = supabase
                .from('events')
                .select('id, title')
                .eq('owner_id', organizerId);

            const { data: events, error: eventsError } = await eventsQuery;

            if (eventsError) throw eventsError;
            
            if (!events || events.length === 0) {
                return { grossRevenue: 0, stripeFees: 0, platformFees: 0, organizerNet: 0, transactionCount: 0, events: [] };
            }

            // If filtering by eventId, validate it belongs to this organizer
            let eventIds = events.map(e => e.id);
            if (eventId && eventIds.includes(eventId)) {
                eventIds = [eventId];
            }

            // Get registrations with optional date filter (always use as primary source)
            let regQuery = supabase
                .from('registrations')
                .select('total_amount, service_fee, stripe_fee, payment_status, created_at')
                .in('event_id', eventIds)
                .in('payment_status', ['paid', 'completed']);

            if (dateFrom) regQuery = regQuery.gte('created_at', new Date(dateFrom).toISOString());
            if (dateTo)   regQuery = regQuery.lte('created_at', new Date(dateTo).toISOString());

            const { data: registrations, error: regError } = await regQuery;
            if (regError) throw regError;

            const grossRevenue = (registrations || []).reduce((sum, r) => sum + (r.total_amount || 0), 0);
            const platformFees = (registrations || []).reduce((sum, r) => sum + (r.service_fee || 0), 0);
            const stripeFees = (registrations || []).reduce((sum, r) => {
                const sf = Number(r.stripe_fee || 0);
                // Only use stored stripe_fee if it was actually captured (> 0).
                // Legacy rows get DEFAULT 0 from the migration — fall back to estimate for those.
                if (sf > 0) return sum + sf;
                const amount = Number(r.total_amount || 0);
                return sum + (amount > 0 ? Number((amount * 0.029 + 0.30).toFixed(2)) : 0);
            }, 0);

            return {
                grossRevenue: Number(grossRevenue.toFixed(2)),
                stripeFees: Number(stripeFees.toFixed(2)),
                platformFees: Number(platformFees.toFixed(2)),
                organizerNet: Number((grossRevenue - stripeFees - platformFees).toFixed(2)),
                transactionCount: (registrations || []).length,
                events: events.map(e => ({ id: e.id, title: e.title }))
            };
        } catch (e) {
            console.error('[AuditLog] Error fetching organizer summary:', e);
            return { grossRevenue: 0, stripeFees: 0, platformFees: 0, organizerNet: 0, transactionCount: 0, events: [] };
        }
    },

    /**
     * Get superadmin financial overview
     */
    getSuperadminOverview: async () => {
        try {
            const { data, error } = await supabase.rpc('get_superadmin_financial_overview');

            if (error) throw error;
            return data;
        } catch (e) {
            console.error('[AuditLog] Error fetching superadmin overview:', e);
            return null;
        }
    }
};

export default AuditLogService;
