/**
 * Subscription Validation Middleware
 * Enforces plan limits and subscription status for monetized features
 */
import supabase from '../services/supabase.js';

// Plan Limits Configuration (matches storageService.ts PLAN_VERSIONS)
const PLAN_LIMITS = {
    free: {
        ticketLimit: 100,           // Per event
        eventLimit: 999999,         // Unlimited events (but monthly ticket limit applies)
        monthlyTicketLimit: 400,    // Max tickets per month
        teamMemberLimit: 1,
        requiresDonation: true
    },
    pro: {
        ticketLimit: 1000,
        eventLimit: 999999,
        monthlyTicketLimit: 4000,
        teamMemberLimit: 3,
        requiresDonation: false
    },
    premium: {
        ticketLimit: 3000,
        eventLimit: 999999,
        monthlyTicketLimit: 10000,
        teamMemberLimit: 5,
        requiresDonation: false
    },
    enterprise: {
        ticketLimit: 999999,
        eventLimit: 999999,
        monthlyTicketLimit: 999999,
        teamMemberLimit: 999,
        requiresDonation: false
    }
};

/**
 * Middleware: Verify subscription status is active
 * Blocks expired/cancelled subscriptions from accessing paid features
 */
export const requireActiveSubscription = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        
        // Fetch user profile with subscription
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('[SubscriptionMiddleware] Error fetching profile:', error);
            return res.status(500).json({ error: 'Failed to verify subscription' });
        }
        
        const planType = profile?.subscription?.plan || profile?.plan || 'free';
        const subscriptionStatus = profile?.subscription?.status;
        
        // Free plan users don't need active subscription
        if (planType === 'free') {
            req.userPlan = 'free';
            req.planLimits = PLAN_LIMITS.free;
            return next();
        }
        
        // Paid plans MUST have active subscription
        if (subscriptionStatus !== 'active') {
            console.warn('[SubscriptionMiddleware] Subscription not active', {
                userId,
                planType,
                status: subscriptionStatus
            });
            
            return res.status(403).json({
                error: 'Subscription required',
                code: 'SUBSCRIPTION_INACTIVE',
                message: 'Your subscription is not active. Please update your payment method or downgrade to Free plan.',
                planType,
                subscriptionStatus
            });
        }
        
        // Attach plan info to request for downstream use
        req.userPlan = planType;
        req.planLimits = PLAN_LIMITS[planType] || PLAN_LIMITS.free;
        req.subscriptionStatus = subscriptionStatus;
        
        next();
    } catch (error) {
        console.error('[SubscriptionMiddleware] Error:', error);
        res.status(500).json({ error: 'Subscription verification failed' });
    }
};

/**
 * Middleware: Enforce event creation limits
 * Validates ticket capacity and monthly limits before allowing event creation
 */
export const enforceEventLimits = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const eventCapacity = req.body.capacity || 0;
        
        // Fetch user profile with subscription
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('subscription')
            .eq('id', userId)
            .single();
        
        if (profileError) {
            console.error('[EventLimits] Error fetching profile:', profileError);
            return res.status(500).json({ error: 'Failed to verify plan limits' });
        }
        
        const planType = profile?.subscription?.plan || profile?.plan || 'free';
        const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.free;
        
        // Check 1: Per-Event Ticket Limit
        if (eventCapacity > limits.ticketLimit) {
            console.warn('[EventLimits] Event capacity exceeds plan limit', {
                userId,
                planType,
                requested: eventCapacity,
                limit: limits.ticketLimit
            });
            
            return res.status(403).json({
                error: 'Ticket limit exceeded',
                code: 'TICKET_LIMIT_EXCEEDED',
                message: `Your ${planType.toUpperCase()} plan allows up to ${limits.ticketLimit} tickets per event. This event has ${eventCapacity} tickets.`,
                limit: limits.ticketLimit,
                requested: eventCapacity,
                planType,
                upgradeRequired: planType === 'free' ? 'pro' : planType === 'pro' ? 'premium' : null
            });
        }
        
        // Check 2: Monthly Ticket Limit
        // Calculate tickets sold this month
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('tickets_count, event:events!inner(owner_id)')
            .eq('event.owner_id', userId)
            .eq('payment_status', 'paid')
            .gte('created_at', monthStart.toISOString());
        
        if (regError) {
            console.error('[EventLimits] Error fetching registrations:', regError);
            // Don't block on error, but log it
        } else {
            const ticketsSoldThisMonth = registrations.reduce((sum, reg) => sum + (reg.tickets_count || 1), 0);
            
            // Adding this event's capacity could exceed monthly limit
            const projectedTotal = ticketsSoldThisMonth + eventCapacity;
            
            if (projectedTotal > limits.monthlyTicketLimit) {
                console.warn('[EventLimits] Monthly ticket limit would be exceeded', {
                    userId,
                    planType,
                    currentMonth: ticketsSoldThisMonth,
                    newEvent: eventCapacity,
                    limit: limits.monthlyTicketLimit
                });
                
                return res.status(403).json({
                    error: 'Monthly ticket limit exceeded',
                    code: 'MONTHLY_LIMIT_EXCEEDED',
                    message: `Your ${planType.toUpperCase()} plan allows ${limits.monthlyTicketLimit} tickets per month. You've sold ${ticketsSoldThisMonth} tickets this month. Adding ${eventCapacity} more would exceed your limit.`,
                    monthlySold: ticketsSoldThisMonth,
                    monthlyLimit: limits.monthlyTicketLimit,
                    eventCapacity,
                    planType,
                    upgradeRequired: planType === 'free' ? 'pro' : planType === 'pro' ? 'premium' : null
                });
            }
        }
        
        // Attach plan info for logging
        req.userPlan = planType;
        req.planLimits = limits;
        
        next();
    } catch (error) {
        console.error('[EventLimits] Error:', error);
        res.status(500).json({ error: 'Plan limit validation failed' });
    }
};

/**
 * Middleware: Check if user can access premium features
 * Generic middleware for gating premium-only features
 */
export const requirePremiumPlan = (requiredPlan = 'pro') => {
    return async (req, res, next) => {
        try {
            const userId = req.user.uid;
            
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('subscription')
                .eq('id', userId)
                .single();
            
            if (error) {
                return res.status(500).json({ error: 'Failed to verify plan' });
            }
            
            const userPlan = profile?.subscription?.plan || profile?.plan || 'free';
            
            // Plan hierarchy: free < pro < premium < enterprise
            const planHierarchy = { free: 0, pro: 1, premium: 2, enterprise: 3 };
            
            if (planHierarchy[userPlan] < planHierarchy[requiredPlan]) {
                return res.status(403).json({
                    error: 'Premium feature',
                    code: 'PLAN_UPGRADE_REQUIRED',
                    message: `This feature requires ${requiredPlan.toUpperCase()} plan or higher. You are on ${userPlan.toUpperCase()} plan.`,
                    currentPlan: userPlan,
                    requiredPlan,
                    upgradeUrl: '/pricing'
                });
            }
            
            req.userPlan = userPlan;
            next();
        } catch (error) {
            console.error('[PremiumCheck] Error:', error);
            res.status(500).json({ error: 'Plan verification failed' });
        }
    };
};

export default {
    requireActiveSubscription,
    enforceEventLimits,
    requirePremiumPlan
};
