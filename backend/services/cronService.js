import cron from 'node-cron';
import supabase from './supabase.js';
import { EmailService } from './serverEmail.js';

/**
 * Cron Service - Handles scheduled tasks for OpenTicket
 */

// Track if cron jobs are already initialized
let cronInitialized = false;

/**
 * Send weekly affiliate summary emails
 * Runs every Monday at 9:00 AM UTC
 */
const sendWeeklyAffiliateSummaries = async () => {
    console.log('[CRON] Starting weekly affiliate summary job...');
    
    try {
        // Get all affiliates
        const { data: affiliates, error: affError } = await supabase
            .from('profiles')
            .select('id, name, email, affiliate_code, affiliate_clicks, total_paid_out')
            .not('affiliate_code', 'is', null);

        if (affError) {
            console.error('[CRON] Error fetching affiliates:', affError);
            return;
        }

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

            try {
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
            } catch (e) {
                console.error(`[CRON] Error processing affiliate ${aff.email}:`, e);
                failed++;
            }
        }

        console.log(`[CRON] Weekly affiliate summary complete: ${sent} sent, ${failed} failed, ${affiliates?.length || 0} total affiliates`);
    } catch (error) {
        console.error('[CRON] Weekly affiliate summary job failed:', error);
    }
};

/**
 * Initialize all cron jobs
 */
export const initCronJobs = () => {
    if (cronInitialized) {
        console.log('[CRON] Jobs already initialized, skipping...');
        return;
    }

    console.log('[CRON] Initializing scheduled jobs...');

    // Weekly affiliate summary - Every Monday at 9:00 AM UTC
    // Cron format: minute hour day-of-month month day-of-week
    cron.schedule('0 9 * * 1', async () => {
        console.log('[CRON] Triggered: Weekly Affiliate Summary');
        await sendWeeklyAffiliateSummaries();
    }, {
        timezone: 'UTC'
    });

    console.log('[CRON] ✅ Weekly Affiliate Summary scheduled for Mondays at 9:00 AM UTC');

    cronInitialized = true;
};

/**
 * Manually trigger weekly summary (for testing or admin use)
 */
export const triggerWeeklySummary = async () => {
    return await sendWeeklyAffiliateSummaries();
};

export default { initCronJobs, triggerWeeklySummary };
