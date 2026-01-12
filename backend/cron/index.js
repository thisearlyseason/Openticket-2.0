import cron from 'node-cron';
import { processScheduledPayouts } from './processScheduledPayouts.js';

/**
 * Initialize all cron jobs
 * Called from server startup
 */
export function initializeCronJobs() {
    console.log('[Cron] Initializing scheduled jobs...');

    // Run scheduled payout processing daily at midnight (00:00)
    // Cron format: second minute hour day month weekday
    // '0 0 * * *' = At 00:00 (midnight) every day
    const payoutJob = cron.schedule('0 0 * * *', async () => {
        console.log('[Cron] Running scheduled payout processing job');
        try {
            const result = await processScheduledPayouts();
            console.log('[Cron] Job completed:', result);
        } catch (error) {
            console.error('[Cron] Job failed:', error);
        }
    }, {
        scheduled: true,
        timezone: "America/New_York" // Adjust to your timezone
    });

    console.log('[Cron] ✅ Scheduled payout processing job registered (runs daily at midnight)');

    // Optional: Run at server startup for immediate testing
    // Uncomment the next line to test immediately on server start
    // processScheduledPayouts();

    return {
        payoutJob
    };
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs() {
    console.log('[Cron] Stopping all cron jobs...');
    cron.getTasks().forEach(task => task.stop());
    console.log('[Cron] All cron jobs stopped');
}
