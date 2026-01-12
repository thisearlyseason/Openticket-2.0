/**
 * Fraud Prevention Service
 * Centralized fraud detection and blocking logic for ticket transfers
 */

import supabase from './supabase.js';

class FraudPreventionService {
    constructor() {
        // Fraud thresholds
        this.RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
        this.RATE_LIMIT_MAX_TRANSFERS = 5;
        this.CIRCULAR_TRANSFER_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
        this.FRAUD_COOLDOWN_PERIOD = 60 * 60 * 1000; // 1 hour cooldown after fraud detection
        this.MAX_FRAUD_STRIKES = 3; // 3 strikes = temporary ban
        this.TEMP_BAN_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Check if user is currently blocked from transfers
     */
    async isUserBlocked(userId) {
        try {
            const { data: fraudRecords } = await supabase
                .from('security_audit_logs')
                .select('*')
                .eq('user_id', userId)
                .in('action', ['FRAUD_BLOCKED_TEMP', 'SUSPICIOUS_TRANSFER_RATE', 'SUSPICIOUS_CIRCULAR_TRANSFER'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (!fraudRecords || fraudRecords.length === 0) {
                return { blocked: false };
            }

            // Check for active temporary ban
            const recentBan = fraudRecords.find(r => r.action === 'FRAUD_BLOCKED_TEMP');
            if (recentBan) {
                const banExpires = new Date(recentBan.created_at).getTime() + this.TEMP_BAN_DURATION;
                if (Date.now() < banExpires) {
                    return {
                        blocked: true,
                        reason: 'temporary_ban',
                        expiresAt: new Date(banExpires),
                        message: 'Your account is temporarily blocked due to suspicious activity'
                    };
                }
            }

            // Check recent fraud strikes (within last 24 hours)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const recentStrikes = fraudRecords.filter(r => 
                r.created_at >= oneDayAgo &&
                ['SUSPICIOUS_TRANSFER_RATE', 'SUSPICIOUS_CIRCULAR_TRANSFER'].includes(r.action)
            );

            if (recentStrikes.length >= this.MAX_FRAUD_STRIKES) {
                // Auto-ban: 3 strikes in 24 hours
                await this.applyTempBan(userId, recentStrikes[0].user_email, recentStrikes.length);
                
                return {
                    blocked: true,
                    reason: 'auto_ban',
                    strikes: recentStrikes.length,
                    message: `Too many suspicious activities detected (${recentStrikes.length} strikes). Account temporarily blocked for 24 hours.`
                };
            }

            // Check if user is in cooldown period after recent fraud
            const mostRecentFraud = fraudRecords[0];
            const fraudTime = new Date(mostRecentFraud.created_at).getTime();
            const cooldownExpires = fraudTime + this.FRAUD_COOLDOWN_PERIOD;
            
            if (Date.now() < cooldownExpires) {
                return {
                    blocked: true,
                    reason: 'cooldown',
                    expiresAt: new Date(cooldownExpires),
                    strikes: recentStrikes.length,
                    message: 'Please wait before attempting another transfer due to recent suspicious activity'
                };
            }

            return { blocked: false, strikes: recentStrikes.length };

        } catch (error) {
            console.error('[FraudPrevention] Error checking user block status:', error);
            // Fail open - don't block on error
            return { blocked: false };
        }
    }

    /**
     * Apply temporary ban to user
     */
    async applyTempBan(userId, userEmail, strikes) {
        try {
            await supabase.from('security_audit_logs').insert({
                action: 'FRAUD_BLOCKED_TEMP',
                entity_type: 'user',
                entity_id: userId,
                user_id: userId,
                user_email: userEmail,
                details: {
                    strikes,
                    duration: '24h',
                    reason: 'Multiple suspicious activities detected'
                },
                severity: 'critical',
                created_at: new Date().toISOString()
            });

            console.log(`[FraudPrevention] ⚠️ Temporary ban applied to user ${userId} (${strikes} strikes)`);
        } catch (error) {
            console.error('[FraudPrevention] Error applying temp ban:', error);
        }
    }

    /**
     * Check rate limiting for ticket transfers
     */
    async checkRateLimit(ticketKey, userId, userEmail) {
        try {
            const oneHourAgo = new Date(Date.now() - this.RATE_LIMIT_WINDOW).toISOString();
            const { data: recentTransfers } = await supabase
                .from('ticket_transfers')
                .select('id, created_at')
                .eq('ticket_key', ticketKey)
                .gte('created_at', oneHourAgo);

            if (recentTransfers && recentTransfers.length >= this.RATE_LIMIT_MAX_TRANSFERS) {
                // Log suspicious activity
                await supabase.from('security_audit_logs').insert({
                    action: 'SUSPICIOUS_TRANSFER_RATE',
                    entity_type: 'ticket',
                    entity_id: ticketKey,
                    user_id: userId,
                    user_email: userEmail,
                    details: { 
                        attempts: recentTransfers.length,
                        timeWindow: '1 hour',
                        limit: this.RATE_LIMIT_MAX_TRANSFERS
                    },
                    severity: 'warning',
                    created_at: new Date().toISOString()
                });

                return {
                    blocked: true,
                    reason: 'rate_limit',
                    attempts: recentTransfers.length,
                    message: 'Too many transfer attempts. Please try again in an hour.'
                };
            }

            return { blocked: false, attempts: recentTransfers?.length || 0 };

        } catch (error) {
            console.error('[FraudPrevention] Error checking rate limit:', error);
            return { blocked: false };
        }
    }

    /**
     * Check for circular transfers (A → B → A pattern)
     */
    async checkCircularTransfer(ticketKey, currentOwnerEmail, recipientEmail, userId) {
        try {
            const oneDayAgo = new Date(Date.now() - this.CIRCULAR_TRANSFER_WINDOW).toISOString();
            
            // Check if recipient previously owned this ticket
            const { data: previousTransfers } = await supabase
                .from('ticket_transfers')
                .select('*')
                .eq('ticket_key', ticketKey)
                .eq('recipient_email', currentOwnerEmail.toLowerCase())
                .gte('created_at', oneDayAgo)
                .order('created_at', { ascending: false });

            if (previousTransfers && previousTransfers.length > 0) {
                // Check if trying to send back to someone who sent it to current owner
                const circularPattern = previousTransfers.find(t => 
                    t.sender_email.toLowerCase() === recipientEmail.toLowerCase()
                );

                if (circularPattern) {
                    await supabase.from('security_audit_logs').insert({
                        action: 'SUSPICIOUS_CIRCULAR_TRANSFER',
                        entity_type: 'ticket',
                        entity_id: ticketKey,
                        user_id: userId,
                        user_email: currentOwnerEmail,
                        details: {
                            recipientEmail,
                            originalTransfer: {
                                from: circularPattern.sender_email,
                                to: circularPattern.recipient_email,
                                date: circularPattern.created_at
                            },
                            pattern: 'A→B→A detected'
                        },
                        severity: 'warning',
                        created_at: new Date().toISOString()
                    });

                    return {
                        blocked: true,
                        reason: 'circular_transfer',
                        message: 'Circular transfers are not allowed within 24 hours to prevent fraud'
                    };
                }
            }

            return { blocked: false };

        } catch (error) {
            console.error('[FraudPrevention] Error checking circular transfer:', error);
            return { blocked: false };
        }
    }

    /**
     * Check for rapid consecutive transfers by same user
     */
    async checkUserTransferVelocity(userId) {
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            
            const { data: recentUserTransfers } = await supabase
                .from('ticket_transfers')
                .select('id')
                .eq('sender_user_id', userId)
                .gte('created_at', tenMinutesAgo);

            // Max 3 transfers in 10 minutes per user
            if (recentUserTransfers && recentUserTransfers.length >= 3) {
                return {
                    blocked: true,
                    reason: 'velocity_limit',
                    message: 'You are transferring tickets too quickly. Please slow down.'
                };
            }

            return { blocked: false };

        } catch (error) {
            console.error('[FraudPrevention] Error checking user velocity:', error);
            return { blocked: false };
        }
    }

    /**
     * Comprehensive fraud check - runs all checks
     */
    async performFraudChecks(params) {
        const { ticketKey, userId, userEmail, recipientEmail } = params;

        // 1. Check if user is blocked
        const blockCheck = await this.isUserBlocked(userId);
        if (blockCheck.blocked) {
            return blockCheck;
        }

        // 2. Check user transfer velocity
        const velocityCheck = await this.checkUserTransferVelocity(userId);
        if (velocityCheck.blocked) {
            return velocityCheck;
        }

        // 3. Check rate limiting
        const rateLimitCheck = await this.checkRateLimit(ticketKey, userId, userEmail);
        if (rateLimitCheck.blocked) {
            return rateLimitCheck;
        }

        // 4. Check circular transfers
        const circularCheck = await this.checkCircularTransfer(
            ticketKey,
            userEmail,
            recipientEmail,
            userId
        );
        if (circularCheck.blocked) {
            return circularCheck;
        }

        return { 
            blocked: false, 
            message: 'All fraud checks passed',
            strikes: blockCheck.strikes || 0
        };
    }

    /**
     * Get user's fraud statistics
     */
    async getUserFraudStats(userId) {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            
            const { data: fraudLogs } = await supabase
                .from('security_audit_logs')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', thirtyDaysAgo)
                .order('created_at', { ascending: false });

            const stats = {
                totalFraudEvents: fraudLogs?.length || 0,
                rateLimitViolations: 0,
                circularTransferAttempts: 0,
                tempBans: 0,
                lastIncident: null,
                currentStrikes: 0
            };

            if (fraudLogs && fraudLogs.length > 0) {
                stats.rateLimitViolations = fraudLogs.filter(l => l.action === 'SUSPICIOUS_TRANSFER_RATE').length;
                stats.circularTransferAttempts = fraudLogs.filter(l => l.action === 'SUSPICIOUS_CIRCULAR_TRANSFER').length;
                stats.tempBans = fraudLogs.filter(l => l.action === 'FRAUD_BLOCKED_TEMP').length;
                stats.lastIncident = fraudLogs[0].created_at;

                // Current strikes (last 24 hours)
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                stats.currentStrikes = fraudLogs.filter(l => 
                    l.created_at >= oneDayAgo &&
                    ['SUSPICIOUS_TRANSFER_RATE', 'SUSPICIOUS_CIRCULAR_TRANSFER'].includes(l.action)
                ).length;
            }

            return stats;

        } catch (error) {
            console.error('[FraudPrevention] Error getting fraud stats:', error);
            return null;
        }
    }
}

// Export singleton
const fraudPreventionService = new FraudPreventionService();
export default fraudPreventionService;
