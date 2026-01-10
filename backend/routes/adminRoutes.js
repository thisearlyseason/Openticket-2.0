import express from 'express';
import * as adminController from '../controllers/adminController.js';
import verifyToken from '../middlewares/authMiddleware.js';
import { AuditLogService } from '../services/auditLogService.js';

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data: user, error } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', req.user.uid)
            .single();

        if (error || !user) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        // Standardized admin check: only use is_admin boolean
        if (user.is_admin === true) {
            next();
        } else {
            return res.status(403).json({ error: 'Requires Admin privileges.' });
        }
    } catch (e) {
        console.error("Admin verification failed", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Admin-only routes
router.get('/users', verifyToken, requireAdmin, adminController.getAllUsers);
router.get('/events', verifyToken, requireAdmin, adminController.getAllEvents);
router.get('/registrations', verifyToken, requireAdmin, adminController.getAllRegistrations);
router.get('/financials', verifyToken, requireAdmin, adminController.getFinancialStats);

// Event financials (owner or admin)
router.get('/events/:eventId/financials', verifyToken, adminController.getEventFinancials);

// Audit Log Routes
router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0, transactionType, actorType, eventId } = req.query;
        const result = await AuditLogService.getAllLogs(
            parseInt(limit),
            parseInt(offset),
            { transactionType, actorType, eventId }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/audit-logs/overview', verifyToken, requireAdmin, async (req, res) => {
    try {
        const overview = await AuditLogService.getSuperadminOverview();
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Organizer audit logs (own logs only)
router.get('/organizer/audit-logs', verifyToken, async (req, res) => {
    try {
        const logs = await AuditLogService.getOrganizerLogs(req.user.uid);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/organizer/financial-summary', verifyToken, async (req, res) => {
    try {
        const summary = await AuditLogService.getOrganizerSummary(req.user.uid);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send Weekly Affiliate Summary Emails (Admin only)
router.post('/affiliate/send-weekly-summaries', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { EmailService } = await import('../services/serverEmail.js');

        // Get all affiliates
        const { data: affiliates, error: affError } = await supabase
            .from('profiles')
            .select('id, name, email, affiliate_code, affiliate_clicks, total_paid_out')
            .not('affiliate_code', 'is', null);

        if (affError) throw affError;

        // Calculate date range for this week
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        
        const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const weekEndStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let sent = 0;
        let failed = 0;

        for (const aff of affiliates || []) {
            if (!aff.email) continue;

            // Get this week's transactions for this affiliate
            const { data: transactions } = await supabase
                .from('financial_transactions')
                .select('affiliate_commission, gross_amount, event:events(title)')
                .eq('affiliate_code', aff.affiliate_code)
                .gte('created_at', weekStart.toISOString())
                .lte('created_at', now.toISOString());

            const weeklyEarnings = transactions?.reduce((sum, t) => sum + (Number(t.affiliate_commission) || 0), 0) || 0;
            const weeklyConversions = transactions?.length || 0;

            // Group by event for top performers
            const eventMap = {};
            transactions?.forEach(t => {
                const eventName = t.event?.title || 'Unknown Event';
                if (!eventMap[eventName]) {
                    eventMap[eventName] = { eventName, conversions: 0, earnings: 0 };
                }
                eventMap[eventName].conversions++;
                eventMap[eventName].earnings += Number(t.affiliate_commission) || 0;
            });
            const topEvents = Object.values(eventMap)
                .sort((a, b) => b.earnings - a.earnings)
                .slice(0, 3);

            // Get pending payout (recent earnings not yet paid)
            const { data: allTx } = await supabase
                .from('financial_transactions')
                .select('affiliate_commission')
                .eq('affiliate_code', aff.affiliate_code);

            const totalEarnings = allTx?.reduce((sum, t) => sum + (Number(t.affiliate_commission) || 0), 0) || 0;
            const pendingPayout = Math.max(0, totalEarnings - (aff.total_paid_out || 0));

            const weeklyStats = {
                totalEarnings: weeklyEarnings,
                totalClicks: aff.affiliate_clicks || 0,
                totalConversions: weeklyConversions,
                conversionRate: aff.affiliate_clicks > 0 ? (weeklyConversions / aff.affiliate_clicks) * 100 : 0,
                pendingPayout,
                topEvents,
                weekStart: weekStartStr,
                weekEnd: weekEndStr
            };

            const result = await EmailService.sendAffiliateWeeklySummary(
                aff.email,
                aff.name,
                weeklyStats
            );

            if (result.sent) sent++;
            else failed++;
        }

        res.json({ 
            success: true, 
            message: `Sent ${sent} weekly summaries, ${failed} failed`,
            sent,
            failed,
            totalAffiliates: affiliates?.length || 0
        });
    } catch (error) {
        console.error('Weekly summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Promo Code Management (Admin only)
router.get('/promo-codes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ promoCodes: data || [] });
    } catch (error) {
        // If table doesn't exist, return empty array
        if (error.message?.includes('does not exist')) {
            return res.json({ promoCodes: [] });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/promo-codes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const promoCode = req.body;
        
        const { data, error } = await supabase
            .from('promo_codes')
            .insert({
                id: promoCode.id,
                code: promoCode.code,
                type: promoCode.type,
                value: promoCode.value,
                target: promoCode.target,
                target_plans: promoCode.targetPlans,
                usage_limit: promoCode.usageLimit,
                usage_count: 0,
                expires_at: promoCode.expiresAt,
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ promoCode: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/promo-codes/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('promo_codes')
            .update({
                is_active: updates.isActive,
                usage_limit: updates.usageLimit,
                expires_at: updates.expiresAt
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ promoCode: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/promo-codes/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        
        const { error } = await supabase
            .from('promo_codes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Affiliate Payout Management
router.get('/affiliate-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            if (error.message?.includes('does not exist')) {
                return res.json({ payouts: [] });
            }
            throw error;
        }
        res.json({ payouts: data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const payout = req.body;
        
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .insert({
                id: payout.id,
                affiliate_id: payout.affiliateId,
                affiliate_name: payout.affiliateName,
                affiliate_code: payout.affiliateCode,
                amount: payout.amount,
                method: payout.method,
                status: payout.status,
                notes: payout.notes,
                created_at: payout.createdAt,
                paid_at: payout.paidAt
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Also log to audit_logs
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user.uid,
            actor_type: 'admin',
            action: 'affiliate_payout',
            target_type: 'affiliate',
            target_id: payout.affiliateId,
            details: {
                amount: payout.amount,
                method: payout.method,
                affiliateCode: payout.affiliateCode
            }
        });
        
        res.json({ payout: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/affiliate-payouts/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .update({
                status: updates.status,
                paid_at: updates.paidAt
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ payout: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate-payouts/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateId, amount } = req.body;
        const supabase = (await import('../services/supabase.js')).default;
        
        // Get affiliate's Stripe Connect ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_connect_id')
            .eq('id', affiliateId)
            .single();
        
        if (profileError || !profile?.stripe_connect_id) {
            return res.status(400).json({ error: 'Affiliate does not have Stripe connected' });
        }
        
        // Initialize Stripe and create transfer
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            destination: profile.stripe_connect_id,
            description: `Affiliate payout for ${affiliateId}`
        });
        
        res.json({ success: true, transferId: transfer.id });
    } catch (error) {
        console.error('Stripe payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// AFFILIATE CLICK TRACKING ENDPOINTS
// ============================================

/**
 * Track affiliate link click (public, no auth required)
 * POST /api/admin/affiliate/track-click
 */
router.post('/affiliate/track-click', async (req, res) => {
    try {
        const { affiliateCode, eventId, referrer, userAgent } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        if (!affiliateCode) {
            return res.status(400).json({ error: 'Affiliate code required' });
        }

        // Find the affiliate by code
        const { data: affiliate, error: affError } = await supabase
            .from('profiles')
            .select('id, affiliate_clicks')
            .eq('affiliate_code', affiliateCode)
            .single();

        if (affError || !affiliate) {
            console.warn(`[Affiliate] Click ignored - unknown code: ${affiliateCode}`);
            return res.status(200).json({ tracked: false, reason: 'Unknown affiliate code' });
        }

        // Increment affiliate_clicks on profile
        const newClickCount = (affiliate.affiliate_clicks || 0) + 1;
        await supabase
            .from('profiles')
            .update({ affiliate_clicks: newClickCount })
            .eq('id', affiliate.id);

        // Log to affiliate_clicks table for detailed tracking
        await supabase.from('affiliate_clicks').insert({
            affiliate_id: affiliate.id,
            affiliate_code: affiliateCode,
            event_id: eventId || null,
            referrer: referrer || null,
            user_agent: userAgent || null,
            ip_hash: req.ip ? Buffer.from(req.ip).toString('base64').slice(0, 16) : null,
            created_at: new Date().toISOString()
        }).catch(err => {
            // Table may not exist yet, that's ok
            console.warn('[Affiliate] Click logging table error:', err.message);
        });

        console.log(`[Affiliate] Click tracked for ${affiliateCode} (total: ${newClickCount})`);
        res.json({ tracked: true, clickCount: newClickCount });
    } catch (error) {
        console.error('Affiliate click tracking error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get affiliate analytics (admin only)
 * GET /api/admin/affiliate/analytics
 */
router.get('/affiliate/analytics', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;

        // Get all affiliates with their stats
        const { data: affiliates, error: affError } = await supabase
            .from('profiles')
            .select('id, name, email, affiliate_code, affiliate_clicks, commission_rate, stripe_connect_id, total_paid_out')
            .not('affiliate_code', 'is', null)
            .order('affiliate_clicks', { ascending: false });

        if (affError) throw affError;

        // Get financial transactions with affiliate attribution
        const { data: transactions, error: txError } = await supabase
            .from('financial_transactions')
            .select('id, gross_amount, affiliate_code, affiliate_commission, created_at, event_id')
            .not('affiliate_code', 'is', null);

        if (txError) throw txError;

        // Build analytics per affiliate
        const analytics = (affiliates || []).map(aff => {
            const affTxs = (transactions || []).filter(tx => tx.affiliate_code === aff.affiliate_code);
            const totalRevenue = affTxs.reduce((sum, tx) => sum + (Number(tx.gross_amount) || 0), 0);
            const totalCommission = affTxs.reduce((sum, tx) => sum + (Number(tx.affiliate_commission) || 0), 0);
            const conversions = affTxs.length;
            const clicks = aff.affiliate_clicks || 0;
            const conversionRate = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00';

            return {
                id: aff.id,
                name: aff.name || 'Unknown',
                email: aff.email,
                affiliateCode: aff.affiliate_code,
                stripeConnected: !!aff.stripe_connect_id,
                commissionRate: aff.commission_rate || 15,  // Default 15% for subscriptions
                discountPercent: aff.discount_percent || 0,
                clicks: clicks,
                conversions: conversions,
                conversionRate: parseFloat(conversionRate),
                totalRevenue: totalRevenue,
                totalCommission: totalCommission,
                pendingPayout: Math.max(0, totalCommission - (aff.total_paid_out || 0)),
                totalPaidOut: aff.total_paid_out || 0,
                transactions: affTxs.map(tx => ({
                    id: tx.id,
                    amount: tx.gross_amount,
                    commission: tx.affiliate_commission,
                    eventId: tx.event_id,
                    date: tx.created_at
                }))
            };
        });

        // Summary stats
        const summary = {
            totalAffiliates: analytics.length,
            totalClicks: analytics.reduce((sum, a) => sum + a.clicks, 0),
            totalConversions: analytics.reduce((sum, a) => sum + a.conversions, 0),
            totalRevenue: analytics.reduce((sum, a) => sum + a.totalRevenue, 0),
            totalCommissions: analytics.reduce((sum, a) => sum + a.totalCommission, 0),
            totalPaidOut: analytics.reduce((sum, a) => sum + a.totalPaidOut, 0),
            pendingPayouts: analytics.reduce((sum, a) => sum + a.pendingPayout, 0)
        };

        res.json({ affiliates: analytics, summary });
    } catch (error) {
        console.error('Affiliate analytics error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get affiliate detail by ID (admin only)
 * GET /api/admin/affiliate/:affiliateId
 */
router.get('/affiliate/:affiliateId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateId } = req.params;
        const supabase = (await import('../services/supabase.js')).default;

        // Get affiliate profile
        const { data: affiliate, error: affError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', affiliateId)
            .single();

        if (affError || !affiliate) {
            return res.status(404).json({ error: 'Affiliate not found' });
        }

        // Get all transactions for this affiliate
        const { data: transactions } = await supabase
            .from('financial_transactions')
            .select('*, event:events(title)')
            .eq('affiliate_code', affiliate.affiliate_code)
            .order('created_at', { ascending: false });

        // Get payout history
        const { data: payouts } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .eq('affiliate_id', affiliateId)
            .order('created_at', { ascending: false });

        const totalCommission = (transactions || []).reduce(
            (sum, tx) => sum + (Number(tx.affiliate_commission) || 0), 0
        );
        const totalPaidOut = affiliate.total_paid_out || 0;

        res.json({
            affiliate: {
                id: affiliate.id,
                name: affiliate.name,
                email: affiliate.email,
                affiliateCode: affiliate.affiliate_code,
                clicks: affiliate.affiliate_clicks || 0,
                commissionRate: affiliate.commission_rate || 15,  // Default 15% for subscriptions
                discountPercent: affiliate.discount_percent || 0,
                stripeConnectId: affiliate.stripe_connect_id,
                stripeOnboardingComplete: affiliate.stripe_onboarding_complete
            },
            stats: {
                totalRevenue: (transactions || []).reduce((sum, tx) => sum + (Number(tx.gross_amount) || 0), 0),
                totalCommission: totalCommission,
                pendingPayout: Math.max(0, totalCommission - totalPaidOut),
                totalPaidOut: totalPaidOut,
                conversions: (transactions || []).length
            },
            transactions: transactions || [],
            payouts: payouts || []
        });
    } catch (error) {
        console.error('Get affiliate detail error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update affiliate rates (commission and discount)
 * PUT /api/admin/affiliate/:affiliateId/rates
 */
router.put('/affiliate/:affiliateId/rates', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateId } = req.params;
        const { commissionRate, discountPercent } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        const updates = {};
        if (commissionRate !== undefined) {
            updates.commission_rate = Math.max(0, Math.min(100, Number(commissionRate)));
        }
        if (discountPercent !== undefined) {
            updates.discount_percent = Math.max(0, Math.min(100, Number(discountPercent)));
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', affiliateId);

        if (error) throw error;

        // Create audit log
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user?.uid || 'admin',
            actor_type: 'admin',
            action: 'update_affiliate_rates',
            target_type: 'profile',
            target_id: affiliateId,
            details: { updates }
        }).catch(e => console.warn('Audit log failed:', e));

        res.json({ success: true, updates });
    } catch (error) {
        console.error('Update affiliate rates error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get affiliate by code (public - for checkout discount lookup)
 * GET /api/admin/affiliate/by-code/:code
 */
router.get('/affiliate/by-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const supabase = (await import('../services/supabase.js')).default;

        const { data: affiliate, error } = await supabase
            .from('profiles')
            .select('id, commission_rate, discount_percent, affiliate_code')
            .eq('affiliate_code', code.toUpperCase())
            .single();

        if (error || !affiliate) {
            return res.status(404).json({ error: 'Affiliate not found' });
        }

        res.json({
            affiliateId: affiliate.id,
            affiliateCode: affiliate.affiliate_code,
            commissionRate: affiliate.commission_rate || 10,
            discountPercent: affiliate.discount_percent || 0
        });
    } catch (error) {
        console.error('Get affiliate by code error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PLATFORM PAYOUT ENDPOINTS
// ============================================

/**
 * Get platform payout history
 * GET /api/admin/platform-payouts
 */
router.get('/platform-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        
        const { data: payouts, error } = await supabase
            .from('platform_payouts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        res.json(payouts || []);
    } catch (error) {
        console.error('Get platform payouts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get pending payout summary (what's available to pay out)
 * GET /api/admin/platform-payouts/pending
 */
router.get('/platform-payouts/pending', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        
        // Get the last completed payout date for each type
        const { data: lastPayouts } = await supabase
            .from('platform_payouts')
            .select('payout_type, executed_at')
            .eq('status', 'completed')
            .order('executed_at', { ascending: false });

        const lastPlatformFeePayout = lastPayouts?.find(p => p.payout_type === 'platform_fees')?.executed_at;
        const lastSubscriptionPayout = lastPayouts?.find(p => p.payout_type === 'subscriptions')?.executed_at;

        // Calculate pending platform fees (from financial_transactions since last payout)
        let platformFeesQuery = supabase
            .from('financial_transactions')
            .select('platform_fee, created_at')
            .eq('status', 'succeeded')
            .gt('platform_fee', 0);
        
        if (lastPlatformFeePayout) {
            platformFeesQuery = platformFeesQuery.gt('created_at', lastPlatformFeePayout);
        }
        
        const { data: feeTransactions } = await platformFeesQuery;
        
        const pendingPlatformFees = (feeTransactions || []).reduce(
            (sum, tx) => sum + (Number(tx.platform_fee) || 0), 0
        );
        const platformFeeCount = feeTransactions?.length || 0;

        // For subscriptions, we'd need to track subscription payments separately
        // For now, return a placeholder - this would need integration with Stripe subscriptions
        const pendingSubscriptionRevenue = 0; // TODO: Calculate from actual subscription payments
        const subscriptionCount = 0;

        res.json({
            platformFees: {
                amount: pendingPlatformFees,
                transactionCount: platformFeeCount,
                periodStart: lastPlatformFeePayout || null,
                periodEnd: new Date().toISOString()
            },
            subscriptions: {
                amount: pendingSubscriptionRevenue,
                transactionCount: subscriptionCount,
                periodStart: lastSubscriptionPayout || null,
                periodEnd: new Date().toISOString()
            },
            total: pendingPlatformFees + pendingSubscriptionRevenue
        });
    } catch (error) {
        console.error('Get pending payouts error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Schedule a platform payout
 * POST /api/admin/platform-payouts/schedule
 */
router.post('/platform-payouts/schedule', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { payoutType, amount, scheduledFor, notes, breakdown } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        if (!payoutType || !amount) {
            return res.status(400).json({ error: 'payoutType and amount are required' });
        }

        const { data: payout, error } = await supabase
            .from('platform_payouts')
            .insert({
                payout_type: payoutType,
                amount: Number(amount),
                status: scheduledFor ? 'scheduled' : 'pending',
                scheduled_for: scheduledFor || null,
                notes: notes || null,
                breakdown: breakdown || null,
                period_start: breakdown?.periodStart || null,
                period_end: breakdown?.periodEnd || new Date().toISOString(),
                transaction_count: breakdown?.transactionCount || 0,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // Log the action
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user?.uid,
            actor_type: 'admin',
            action: 'schedule_platform_payout',
            target_type: 'platform_payout',
            target_id: payout.id,
            details: { payoutType, amount, scheduledFor }
        }).catch(e => console.warn('Audit log failed:', e));

        res.json({ success: true, payout });
    } catch (error) {
        console.error('Schedule platform payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Execute a platform payout (mark as completed)
 * POST /api/admin/platform-payouts/:id/execute
 */
router.post('/platform-payouts/:id/execute', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { stripePayoutId, destinationAccount } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        const { data: payout, error } = await supabase
            .from('platform_payouts')
            .update({
                status: 'completed',
                executed_at: new Date().toISOString(),
                executed_by: req.user?.uid,
                stripe_payout_id: stripePayoutId || null,
                destination_account: destinationAccount || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Log the action
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user?.uid,
            actor_type: 'admin',
            action: 'execute_platform_payout',
            target_type: 'platform_payout',
            target_id: id,
            details: { amount: payout.amount, payoutType: payout.payout_type }
        }).catch(e => console.warn('Audit log failed:', e));

        res.json({ success: true, payout });
    } catch (error) {
        console.error('Execute platform payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Cancel a scheduled payout
 * DELETE /api/admin/platform-payouts/:id
 */
router.delete('/platform-payouts/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = (await import('../services/supabase.js')).default;

        // Only allow canceling scheduled/pending payouts
        const { data: existing } = await supabase
            .from('platform_payouts')
            .select('status')
            .eq('id', id)
            .single();

        if (existing?.status === 'completed') {
            return res.status(400).json({ error: 'Cannot cancel a completed payout' });
        }

        const { error } = await supabase
            .from('platform_payouts')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Cancel platform payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update affiliate commission rate (individual)
 * PUT /api/admin/affiliates/:id/commission
 */
router.put('/affiliates/:id/commission', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { commissionRate, discountPercent } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        const updates = {};
        if (commissionRate !== undefined) {
            updates.commission_rate = commissionRate;
        }
        if (discountPercent !== undefined) {
            updates.discount_percent = discountPercent;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select('id, name, email, commission_rate, discount_percent')
            .single();

        if (error) throw error;

        // Audit log
        AuditLogService.createLog({
            timestamp: new Date().toISOString(),
            actor_id: req.user.uid,
            actor_type: 'admin',
            action: 'update_affiliate_rates',
            target_type: 'affiliate',
            target_id: id,
            details: updates
        });

        res.json({ success: true, affiliate: data });
    } catch (error) {
        console.error('Update affiliate commission error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Update all affiliates commission rate (global)
 * PUT /api/admin/affiliates/global-commission
 */
router.put('/affiliates/global-commission', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { commissionRate } = req.body;
        const supabase = (await import('../services/supabase.js')).default;

        if (commissionRate === undefined || commissionRate < 0 || commissionRate > 100) {
            return res.status(400).json({ error: 'Invalid commission rate (must be 0-100)' });
        }

        // Update all affiliates
        const { data, error } = await supabase
            .from('profiles')
            .update({ commission_rate: commissionRate })
            .eq('role', 'affiliate')
            .select('id');

        if (error) throw error;

        // Audit log
        AuditLogService.createLog({
            timestamp: new Date().toISOString(),
            actor_id: req.user.uid,
            actor_type: 'admin',
            action: 'update_global_commission_rate',
            target_type: 'system',
            target_id: 'global',
            details: { commissionRate, affiliatesUpdated: data?.length || 0 }
        });

        res.json({ 
            success: true, 
            message: `Updated ${data?.length || 0} affiliates to ${commissionRate}% commission rate`
        });
    } catch (error) {
        console.error('Update global commission error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all affiliates with their commission rates
 * GET /api/admin/affiliates
 */
router.get('/affiliates', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email, affiliate_code, commission_rate, discount_percent, affiliate_clicks, total_paid_out, created_at')
            .eq('role', 'affiliate')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ affiliates: data || [] });
    } catch (error) {
        console.error('Get affiliates error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
