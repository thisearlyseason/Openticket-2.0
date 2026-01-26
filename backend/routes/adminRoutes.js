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

// Request payout for event (owner only)
router.post('/events/:eventId/request-payout', verifyToken, async (req, res) => {
    try {
        const { eventId } = req.params;
        const supabase = (await import('../services/supabase.js')).default;

        // Verify event ownership
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, title, organizer_id, end_date')
            .eq('id', eventId)
            .single();

        if (eventError || !event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (event.organizer_id !== req.user.uid) {
            return res.status(403).json({ error: 'Access denied. You can only request payouts for your own events.' });
        }

        // Check if event has ended
        const eventEndDate = new Date(event.end_date);
        const now = new Date();
        if (eventEndDate > now) {
            return res.status(400).json({ 
                error: `Event must end before payout is available. Event ends on ${eventEndDate.toLocaleDateString()}.` 
            });
        }

        // Get financial transactions for this event
        const { data: transactions, error: txError } = await supabase
            .from('financial_transactions')
            .select('*')
            .eq('event_id', eventId)
            .eq('status', 'succeeded');

        if (txError) {
            console.error('Error fetching transactions:', txError);
            return res.status(500).json({ error: 'Failed to fetch financial data' });
        }

        // Calculate net earnings
        const netEarnings = (transactions || []).reduce((sum, tx) => {
            return sum + (Number(tx.organizer_net) || 0);
        }, 0);

        if (netEarnings <= 0) {
            return res.status(400).json({ error: 'No net earnings available for payout.' });
        }

        // Check if there are any pending transactions
        const { data: pendingTx } = await supabase
            .from('financial_transactions')
            .select('id')
            .eq('event_id', eventId)
            .eq('payout_status', 'pending');

        if (pendingTx && pendingTx.length > 0) {
            return res.status(400).json({ 
                error: 'Waiting for pending transactions to settle before payout is available.' 
            });
        }

        // Check if payout already requested
        const { data: existingPayout } = await supabase
            .from('organizer_payouts')
            .select('id, status')
            .eq('event_id', eventId)
            .eq('status', 'pending')
            .single();

        if (existingPayout) {
            return res.status(400).json({ error: 'Payout request already pending for this event.' });
        }

        // Create payout request
        const { data: payout, error: payoutError } = await supabase
            .from('organizer_payouts')
            .insert({
                event_id: eventId,
                organizer_id: req.user.uid,
                amount: netEarnings,
                status: 'pending',
                requested_at: new Date().toISOString(),
                transaction_count: transactions?.length || 0
            })
            .select()
            .single();

        if (payoutError) {
            console.error('Error creating payout request:', payoutError);
            return res.status(500).json({ error: 'Failed to create payout request' });
        }

        // Update transaction payout status
        await supabase
            .from('financial_transactions')
            .update({ payout_status: 'requested' })
            .eq('event_id', eventId)
            .eq('status', 'succeeded');

        // Log the action
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user.uid,
            actor_type: 'organizer',
            action: 'request_payout',
            target_type: 'event',
            target_id: eventId,
            details: { 
                amount: netEarnings, 
                transactionCount: transactions?.length || 0,
                eventTitle: event.title 
            }
        }).catch(e => console.warn('Audit log failed:', e));

        res.json({ 
            success: true, 
            message: 'Payout request submitted successfully',
            payout: {
                id: payout.id,
                amount: netEarnings,
                status: 'pending',
                requestedAt: payout.requested_at
            }
        });
    } catch (error) {
        console.error('Payout request error:', error);
        res.status(500).json({ error: error.message });
    }
});

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

// Live Revenue Dashboard - Recent sales, today's revenue, sales velocity
router.get('/organizer/live-sales', verifyToken, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const userId = req.user.uid;
        
        // Get organizer's events
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, title')
            .eq('created_by', userId);
        
        if (eventsError) throw eventsError;
        
        const eventIds = events?.map(e => e.id) || [];
        const eventMap = {};
        events?.forEach(e => { eventMap[e.id] = e.title; });
        
        if (eventIds.length === 0) {
            return res.json({
                recentSales: [],
                todayRevenue: 0,
                todayTickets: 0,
                salesVelocity: 0,
                lastHourSales: 0
            });
        }
        
        // Get today's start (UTC)
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);
        
        // Get last hour start
        const lastHourStart = new Date(now.getTime() - 60 * 60 * 1000);
        
        // Get recent registrations (last 24 hours, paid only)
        const { data: recentRegs, error: regsError } = await supabase
            .from('registrations')
            .select('id, event_id, attendee_name, total_amount, tickets, timestamp, payment_status')
            .in('event_id', eventIds)
            .in('payment_status', ['paid', 'completed'])
            .gte('timestamp', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .order('timestamp', { ascending: false })
            .limit(50);
        
        if (regsError) throw regsError;
        
        // Calculate metrics
        let todayRevenue = 0;
        let todayTickets = 0;
        let lastHourSales = 0;
        
        const recentSales = (recentRegs || []).map(reg => {
            const regTime = new Date(reg.timestamp);
            const ticketCount = reg.tickets?.reduce((sum, t) => sum + (t.quantity || 1), 0) || 1;
            
            // Today's stats
            if (regTime >= todayStart) {
                todayRevenue += reg.total_amount || 0;
                todayTickets += ticketCount;
            }
            
            // Last hour
            if (regTime >= lastHourStart) {
                lastHourSales++;
            }
            
            return {
                id: reg.id,
                eventTitle: eventMap[reg.event_id] || 'Unknown Event',
                attendeeName: reg.attendee_name || 'Guest',
                amount: reg.total_amount || 0,
                ticketCount,
                timestamp: reg.timestamp
            };
        });
        
        // Sales velocity (sales per hour, based on last hour)
        const salesVelocity = lastHourSales;
        
        res.json({
            recentSales: recentSales.slice(0, 10), // Top 10 most recent
            todayRevenue,
            todayTickets,
            salesVelocity,
            lastHourSales
        });
        
    } catch (error) {
        console.error('[LiveSales] Error:', error);
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
        
        // Get the current payout to check status change and get affiliate info
        const { data: currentPayout, error: fetchError } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .eq('id', id)
            .single();
        
        if (fetchError || !currentPayout) {
            return res.status(404).json({ error: 'Payout not found' });
        }
        
        // Update the payout status
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
        
        // If status changed to 'paid', update the affiliate's total_paid_out
        if (updates.status === 'paid' && currentPayout.status !== 'paid') {
            const { data: affiliate, error: affError } = await supabase
                .from('profiles')
                .select('total_paid_out')
                .eq('id', currentPayout.affiliate_id)
                .single();
            
            if (!affError && affiliate) {
                const newTotalPaidOut = (affiliate.total_paid_out || 0) + currentPayout.amount;
                await supabase
                    .from('profiles')
                    .update({ 
                        total_paid_out: newTotalPaidOut,
                        available_payout: 0 // Reset available payout after payment
                    })
                    .eq('id', currentPayout.affiliate_id);
                
                console.log(`[Affiliate Payout] Updated total_paid_out for ${currentPayout.affiliate_id}: $${newTotalPaidOut}`);
            }
        }
        
        res.json({ payout: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate-payouts/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateId, amount } = req.body;
        const supabase = (await import('../services/supabase.js')).default;
        
        // Get affiliate's Stripe Connect ID and current totals
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_connect_id, total_paid_out')
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
        
        // Update affiliate's total_paid_out and reset available_payout
        const newTotalPaidOut = (profile.total_paid_out || 0) + amount;
        await supabase
            .from('profiles')
            .update({ 
                total_paid_out: newTotalPaidOut,
                available_payout: 0 // Reset available payout after payment
            })
            .eq('id', affiliateId);
        
        console.log(`[Stripe Payout] Processed $${amount} for affiliate ${affiliateId}, new total: $${newTotalPaidOut}`);
        
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
            commissionRate: affiliate.commission_rate || 15,  // Default 15% for subscriptions
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

// === MIGRATIONS ===

/**
 * POST /api/admin/run-migration
 * Run database migrations (admin only)
 * Body: { migration: 'assign_plan_ids', dryRun: true/false }
 */
router.post('/run-migration', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { migration, dryRun = true } = req.body;
        
        if (!migration) {
            return res.status(400).json({ error: 'Migration name is required' });
        }
        
        console.log(`[Admin] Running migration: ${migration} (dryRun: ${dryRun})`);
        
        let results;
        
        switch (migration) {
            case 'assign_plan_ids':
                const { assignPlanIds } = await import('../migrations/assign_plan_ids.js');
                results = await assignPlanIds({ dryRun });
                break;
            case 'create_organizer_payouts_table':
                const { createOrganizerPayoutsTable } = await import('../migrations/create_organizer_payouts_table.js');
                results = await createOrganizerPayoutsTable({ dryRun });
                break;
            default:
                return res.status(400).json({ error: `Unknown migration: ${migration}` });
        }
        
        res.json({ 
            success: true,
            migration,
            dryRun,
            results
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get upcoming payouts for organizer (event-based)
router.get('/upcoming-payouts', verifyToken, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const userId = req.user.uid;

        // Get all events owned by user that haven't ended yet or have pending payouts
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, title, date, payment_config')
            .eq('owner_id', userId);

        if (eventsError) throw eventsError;

        const upcomingPayouts = [];
        const now = new Date();

        for (const event of events) {
            const eventDate = new Date(event.date);
            
            // Only include events that are upcoming or recently ended (within 30 days)
            const daysSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceEvent > 30) continue; // Skip old events
            
            // Calculate net earnings for this event
            const { data: registrations } = await supabase
                .from('registrations')
                .select('*')
                .eq('event_id', event.id)
                .eq('payment_status', 'paid');

            if (!registrations || registrations.length === 0) continue;

            let netEarnings = 0;
            registrations.forEach(reg => {
                const gross = (reg.tickets?.reduce((acc, t) => acc + ((t.price || t.pricePerTicket || 0) * 1), 0) || 0)
                    + (reg.donation_amount || 0)
                    + (reg.add_ons?.reduce((acc, a) => acc + ((a.price || 0) * (a.quantity || 1)), 0) || 0);
                
                const fees = (reg.service_fee || 0) + (reg.stripe_fee || (gross * 0.029 + 0.30));
                netEarnings += (gross - fees);
            });

            if (netEarnings <= 0) continue;

            // Release date is event date (funds available after event)
            upcomingPayouts.push({
                eventId: event.id,
                eventTitle: event.title,
                eventDate: event.date,
                releaseDate: eventDate, // Funds released on event date
                amount: netEarnings,
                status: eventDate <= now ? 'ready' : 'pending',
                daysUntil: Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            });
        }

        // Sort by release date (soonest first)
        upcomingPayouts.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());

        res.json({ payouts: upcomingPayouts });
    } catch (error) {
        console.error('[Upcoming Payouts] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Affiliate payout endpoints
router.get('/affiliate/earnings', verifyToken, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const userId = req.user.uid;

        // Get affiliate profile
        const { data: affiliate } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!affiliate) {
            return res.json({ total: 0, available: 0, pending: 0, paid: 0 });
        }

        // Calculate earnings from registrations
        const { data: registrations } = await supabase
            .from('registrations')
            .select('*')
            .eq('affiliate_code', affiliate.code)
            .eq('payment_status', 'paid');

        let totalEarnings = 0;
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        (registrations || []).forEach(reg => {
            const gross = (reg.tickets?.reduce((acc, t) => acc + ((t.price || t.pricePerTicket || 0) * 1), 0) || 0)
                + (reg.donation_amount || 0);
            const commission = gross * 0.05; // 5% commission rate
            totalEarnings += commission;
        });

        // Get paid out amount
        const { data: payouts } = await supabase
            .from('affiliate_payouts')
            .select('amount, status, created_at')
            .eq('affiliate_id', affiliate.id);

        let paidAmount = 0;
        let pendingAmount = 0;

        (payouts || []).forEach(payout => {
            if (payout.status === 'paid') {
                paidAmount += payout.amount;
            } else if (payout.status === 'pending' || payout.status === 'scheduled') {
                pendingAmount += payout.amount;
            }
        });

        // Available = total - paid - pending
        const availableAmount = Math.max(0, totalEarnings - paidAmount - pendingAmount);

        res.json({
            total: totalEarnings,
            available: availableAmount,
            pending: pendingAmount,
            paid: paidAmount
        });
    } catch (error) {
        console.error('[Affiliate Earnings] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/affiliate/payouts', verifyToken, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const userId = req.user.uid;

        // Get affiliate profile
        const { data: affiliate } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!affiliate) {
            return res.json({ payouts: [] });
        }

        // Get payout history
        const { data: payouts } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .eq('affiliate_id', affiliate.id)
            .order('created_at', { ascending: false });

        res.json({ payouts: payouts || [] });
    } catch (error) {
        console.error('[Affiliate Payouts] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate/request-payout', verifyToken, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const userId = req.user.uid;
        const { method } = req.body; // 'manual' or 'scheduled'

        // Get affiliate profile
        const { data: affiliate } = await supabase
            .from('affiliates')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!affiliate) {
            return res.status(404).json({ error: 'Affiliate profile not found' });
        }

        // Calculate available earnings
        const earningsRes = await fetch(`${req.protocol}://${req.get('host')}/api/admin/affiliate/earnings`, {
            headers: { 'Authorization': req.headers.authorization }
        });
        const earnings = await earningsRes.json();

        if (earnings.available <= 0) {
            return res.status(400).json({ error: 'No funds available for payout' });
        }

        // Check for existing pending/scheduled payout
        const { data: existingPayout } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .eq('affiliate_id', affiliate.id)
            .in('status', ['pending', 'scheduled'])
            .single();

        if (existingPayout) {
            return res.status(400).json({ error: 'You already have a pending payout request' });
        }

        // Calculate scheduled date if scheduled method
        let scheduledFor = null;
        if (method === 'scheduled') {
            const now = new Date();
            scheduledFor = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
        }

        // Create payout request
        const { data: payout, error: payoutError } = await supabase
            .from('affiliate_payouts')
            .insert({
                affiliate_id: affiliate.id,
                amount: earnings.available,
                status: method === 'scheduled' ? 'scheduled' : 'pending',
                method: method,
                scheduled_for: scheduledFor,
                requested_at: new Date().toISOString()
            })
            .select()
            .single();

        if (payoutError) throw payoutError;

        res.json({
            success: true,
            amount: earnings.available,
            method: method,
            scheduledFor: scheduledFor,
            payoutId: payout.id
        });
    } catch (error) {
        console.error('[Request Payout] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger for scheduled payout processing (for testing)
router.post('/process-scheduled-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        console.log('[Admin] Manually triggering scheduled payout processing...');
        
        const cronService = (await import('../services/cronService.js')).default;
        await cronService.triggerScheduledPayouts();
        
        res.json({ 
            success: true,
            message: 'Scheduled payout processing triggered successfully'
        });
    } catch (error) {
        console.error('[Admin] Error triggering scheduled payouts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get suspicious activities from security audit logs (Super Admin only)
router.get('/security-audit-logs/suspicious', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { severity } = req.query; // optional filter: 'info', 'warning', 'critical'

        let query = supabase
            .from('security_audit_logs')
            .select('*')
            .like('action', 'SUSPICIOUS%')
            .order('created_at', { ascending: false })
            .limit(100);

        if (severity && ['info', 'warning', 'critical'].includes(severity)) {
            query = query.eq('severity', severity);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Security Audit Logs] Error fetching suspicious activities:', error);
            throw error;
        }

        res.json({
            success: true,
            logs: data || [],
            count: data?.length || 0
        });
    } catch (error) {
        console.error('[Security Audit Logs] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get fraud statistics for a specific user (Super Admin only)
router.get('/fraud-stats/:userId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const fraudPreventionService = (await import('../services/fraudPreventionService.js')).default;
        
        const stats = await fraudPreventionService.getUserFraudStats(userId);
        const blockStatus = await fraudPreventionService.isUserBlocked(userId);
        
        res.json({
            success: true,
            userId,
            stats,
            blockStatus
        });
    } catch (error) {
        console.error('[Fraud Stats] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unblock a user (Super Admin only) - removes cooldown/temp ban
router.post('/fraud-unblock/:userId', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const supabase = (await import('../services/supabase.js')).default;
        
        // Log the unblock action
        await supabase.from('security_audit_logs').insert({
            action: 'FRAUD_UNBLOCK_ADMIN',
            entity_type: 'user',
            entity_id: userId,
            user_id: req.user.uid, // admin who unblocked
            details: {
                unblockedUserId: userId,
                reason: 'Admin override'
            },
            severity: 'info',
            created_at: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: 'User unblocked successfully. Previous fraud flags have been noted but cooldown removed.'
        });
    } catch (error) {
        console.error('[Fraud Unblock] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ADMIN ANALYTICS DASHBOARD ENDPOINTS
// ========================================

/**
 * GET /api/admin/analytics/overview
 * Get system-wide analytics overview
 */
router.get('/analytics/overview', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const supabase = (await import('../services/supabase.js')).default;

        // Calculate time filter
        let timeFilter = null;
        if (period !== 'all') {
            const days = parseInt(period);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            timeFilter = cutoff.getTime();
        }

        // Get all events with their analytics from materialized view
        const { data: mvData, error: mvError } = await supabase
            .from('mv_event_scan_summary')
            .select('*');

        if (mvError && mvError.code !== '42P01') {
            console.error('[Admin Analytics] Error fetching from materialized view:', mvError);
        }

        // Get events details
        const { data: events, error: eventsError } = await supabase
            .from('events')
            .select('id, title');

        if (eventsError) throw eventsError;

        // Merge data
        const eventAnalytics = (mvData || []).map(mv => {
            const event = events?.find(e => e.id === mv.event_id);
            return {
                eventId: mv.event_id,
                eventTitle: event?.title || 'Unknown Event',
                totalScans: parseInt(mv.total_scans),
                successfulScans: parseInt(mv.successful_scans),
                failedScans: parseInt(mv.failed_scans),
                successRate: parseFloat(mv.success_rate),
                avgDuration: parseInt(mv.avg_duration),
                lastScanAt: mv.last_scan_at
            };
        }).sort((a, b) => b.totalScans - a.totalScans);

        // Calculate global stats
        const globalStats = {
            totalEvents: eventAnalytics.length,
            totalScans: eventAnalytics.reduce((sum, e) => sum + e.totalScans, 0),
            avgSuccessRate: eventAnalytics.length > 0
                ? eventAnalytics.reduce((sum, e) => sum + e.successRate, 0) / eventAnalytics.length
                : 0,
            avgScanTime: eventAnalytics.length > 0
                ? Math.round(eventAnalytics.reduce((sum, e) => sum + e.avgDuration, 0) / eventAnalytics.length)
                : 0
        };

        res.json({
            success: true,
            events: eventAnalytics,
            globalStats
        });

    } catch (error) {
        console.error('[Admin Analytics] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/analytics/refresh-views
 * Refresh materialized views manually
 */
router.post('/analytics/refresh-views', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;

        const { error } = await supabase.rpc('refresh_scan_analytics_views');

        if (error) {
            console.error('[Admin Analytics] Refresh failed:', error);
            throw error;
        }

        res.json({
            success: true,
            message: 'Materialized views refreshed successfully'
        });

    } catch (error) {
        console.error('[Admin Analytics] Refresh error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/admin/analytics/export-all
 * Export all analytics to CSV
 */
router.get('/analytics/export-all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const scanAnalyticsService = (await import('../services/scanAnalyticsService.js')).default;
        const supabase = (await import('../services/supabase.js')).default;

        // Get all events
        const { data: events, error } = await supabase
            .from('events')
            .select('id, title');

        if (error) throw error;

        // Generate CSV for all events
        let combinedCsv = 'Event ID,Event Title,Timestamp,Date/Time,Success,Duration (ms),Ticket ID,Error Message,Scan Method,Platform,Online\n';

        for (const event of events || []) {
            const csv = await scanAnalyticsService.exportToCsv(event.id);
            if (csv) {
                const lines = csv.split('\n').slice(1); // Skip header
                lines.forEach(line => {
                    if (line.trim()) {
                        combinedCsv += `"${event.id}","${event.title}",${line}\n`;
                    }
                });
            }
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="all-analytics-${Date.now()}.csv"`);
        res.send(combinedCsv);

    } catch (error) {
        console.error('[Admin Analytics] Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
