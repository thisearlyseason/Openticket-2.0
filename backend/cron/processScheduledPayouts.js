import supabase from '../services/supabase.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { 
    apiVersion: '2023-10-16' 
});

/**
 * Process Scheduled Affiliate Payouts
 * Runs daily to check for scheduled payouts that are due
 * Transfers funds via Stripe and updates status
 */
export async function processScheduledPayouts() {
    const startTime = new Date();
    console.log(`[Cron] Starting scheduled payout processing at ${startTime.toISOString()}`);

    try {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today

        // Get all scheduled payouts due today or earlier
        const { data: payouts, error: fetchError } = await supabase
            .from('affiliate_payouts')
            .select(`
                *,
                affiliates:affiliate_id (
                    id,
                    code,
                    user_id,
                    stripe_account_id,
                    profiles:user_id (
                        email,
                        display_name
                    )
                )
            `)
            .eq('status', 'scheduled')
            .lte('scheduled_for', today.toISOString());

        if (fetchError) {
            console.error('[Cron] Error fetching scheduled payouts:', fetchError);
            return {
                success: false,
                error: fetchError.message,
                processed: 0
            };
        }

        if (!payouts || payouts.length === 0) {
            console.log('[Cron] No scheduled payouts due today');
            return {
                success: true,
                processed: 0,
                message: 'No payouts to process'
            };
        }

        console.log(`[Cron] Found ${payouts.length} scheduled payout(s) to process`);

        let processedCount = 0;
        let failedCount = 0;
        const results = [];

        // Process each payout
        for (const payout of payouts) {
            try {
                console.log(`[Cron] Processing payout ${payout.id} for affiliate ${payout.affiliates.code}`);

                // Verify affiliate has Stripe account
                if (!payout.affiliates.stripe_account_id) {
                    console.error(`[Cron] Affiliate ${payout.affiliates.code} has no Stripe account`);
                    
                    // Update status to failed
                    await supabase
                        .from('affiliate_payouts')
                        .update({
                            status: 'failed',
                            notes: 'No Stripe account connected'
                        })
                        .eq('id', payout.id);
                    
                    failedCount++;
                    results.push({
                        payoutId: payout.id,
                        status: 'failed',
                        reason: 'No Stripe account'
                    });
                    continue;
                }

                // Convert amount to cents (Stripe expects cents)
                const amountInCents = Math.round(payout.amount * 100);

                // Create Stripe transfer to affiliate's connected account
                const transfer = await stripe.transfers.create({
                    amount: amountInCents,
                    currency: 'usd',
                    destination: payout.affiliates.stripe_account_id,
                    description: `Affiliate commission payout for ${payout.affiliates.code}`,
                    metadata: {
                        payout_id: payout.id,
                        affiliate_id: payout.affiliate_id,
                        affiliate_code: payout.affiliates.code,
                        payout_method: 'scheduled'
                    }
                });

                console.log(`[Cron] Stripe transfer created: ${transfer.id}`);

                // Update payout record to paid
                const { error: updateError } = await supabase
                    .from('affiliate_payouts')
                    .update({
                        status: 'paid',
                        paid_at: new Date().toISOString(),
                        stripe_payout_id: transfer.id,
                        notes: `Automatically processed on ${new Date().toLocaleDateString()}`
                    })
                    .eq('id', payout.id);

                if (updateError) {
                    console.error(`[Cron] Error updating payout ${payout.id}:`, updateError);
                    // Note: Money was transferred but status update failed - needs manual review
                    failedCount++;
                    results.push({
                        payoutId: payout.id,
                        status: 'partial',
                        stripeTransferId: transfer.id,
                        reason: 'Transferred but status update failed'
                    });
                } else {
                    processedCount++;
                    results.push({
                        payoutId: payout.id,
                        status: 'success',
                        amount: payout.amount,
                        stripeTransferId: transfer.id,
                        affiliateCode: payout.affiliates.code
                    });

                    // Optional: Send email notification to affiliate
                    try {
                        await sendPayoutNotification(
                            payout.affiliates.profiles.email,
                            payout.affiliates.profiles.display_name || 'Affiliate',
                            payout.amount,
                            transfer.id
                        );
                    } catch (emailError) {
                        console.error('[Cron] Failed to send email notification:', emailError);
                        // Don't fail the payout if email fails
                    }
                }

            } catch (stripeError) {
                console.error(`[Cron] Stripe error for payout ${payout.id}:`, stripeError);
                
                // Update status to failed
                await supabase
                    .from('affiliate_payouts')
                    .update({
                        status: 'failed',
                        notes: `Stripe error: ${stripeError.message}`
                    })
                    .eq('id', payout.id);
                
                failedCount++;
                results.push({
                    payoutId: payout.id,
                    status: 'failed',
                    reason: stripeError.message
                });
            }
        }

        const endTime = new Date();
        const duration = (endTime.getTime() - startTime.getTime()) / 1000;

        console.log(`[Cron] Scheduled payout processing completed in ${duration}s`);
        console.log(`[Cron] Success: ${processedCount}, Failed: ${failedCount}`);

        return {
            success: true,
            processed: processedCount,
            failed: failedCount,
            total: payouts.length,
            duration: duration,
            results: results
        };

    } catch (error) {
        console.error('[Cron] Unexpected error in processScheduledPayouts:', error);
        return {
            success: false,
            error: error.message,
            processed: 0
        };
    }
}

/**
 * Send email notification to affiliate about successful payout
 */
async function sendPayoutNotification(email, name, amount, transferId) {
    // TODO: Implement email notification
    // You can use your existing email service (Resend, etc.)
    console.log(`[Cron] Would send email to ${email} about $${amount} payout (${transferId})`);
    
    // Example with Resend:
    /*
    const { EmailService } = await import('../services/serverEmail.js');
    await EmailService.send({
        to: email,
        subject: '💰 Your affiliate commission has been paid!',
        html: `
            <h2>Payment Processed!</h2>
            <p>Hi ${name},</p>
            <p>Great news! Your affiliate commission of <strong>$${amount.toFixed(2)}</strong> has been successfully transferred to your account.</p>
            <p><small>Transfer ID: ${transferId}</small></p>
        `
    });
    */
}

/**
 * Manual trigger endpoint (for testing or admin use)
 */
export async function triggerPayoutProcessing(req, res) {
    console.log('[Cron] Manual trigger requested');
    
    const result = await processScheduledPayouts();
    
    res.json({
        message: 'Scheduled payout processing completed',
        ...result
    });
}
