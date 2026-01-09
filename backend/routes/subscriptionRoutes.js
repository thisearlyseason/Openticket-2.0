import express from 'express';
const router = express.Router();
import Stripe from 'stripe';
import supabase from '../services/supabase.js';
import { EmailService } from '../services/serverEmail.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan configurations
const PLAN_PRICES = {
    free: { monthly: 0, yearly: 0 },
    pro: { monthly: 29, yearly: 290 },
    premium: { monthly: 79, yearly: 790 }
};

/**
 * Create Stripe Checkout Session for subscription upgrade
 * POST /api/subscription/create-checkout
 */
router.post('/create-checkout', async (req, res) => {
    try {
        const { userId, userEmail, planName, cycle, amount, affiliateCode } = req.body;

        if (!userId || !planName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // For free plan, just update the user directly
        if (planName.toLowerCase() === 'free') {
            // Get user's email for welcome notification
            const { data: profile } = await supabase
                .from('profiles')
                .select('email, name')
                .eq('id', userId)
                .single();

            const { error } = await supabase
                .from('profiles')
                .update({
                    subscription: {
                        plan: 'free',
                        status: 'active',
                        cycle: null,
                        startDate: new Date().toISOString()
                    },
                    role: 'organizer'
                })
                .eq('id', userId);

            if (error) throw error;

            // Send welcome email for free plan
            if (profile?.email) {
                await EmailService.sendSubscriptionWelcome(
                    profile.email,
                    'free',
                    null,
                    profile.name
                ).catch(e => console.warn('Free plan welcome email failed:', e));
            }

            return res.json({ success: true, redirect: '/dashboard' });
        }

        // Validate affiliate code if provided
        let validAffiliateCode = null;
        if (affiliateCode) {
            const { data: affiliate } = await supabase
                .from('profiles')
                .select('id, affiliate_code')
                .eq('affiliate_code', affiliateCode)
                .neq('id', userId) // Can't refer yourself
                .single();
            
            if (affiliate) {
                validAffiliateCode = affiliateCode;
                console.log(`[Subscription] Valid affiliate code: ${affiliateCode}`);
            }
        }

        // Create Stripe Checkout Session for paid plans
        const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:3000';
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'subscription',
            customer_email: userEmail,
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `OpenTicket ${planName} Plan`,
                        description: `${cycle === 'yearly' ? 'Annual' : 'Monthly'} subscription`
                    },
                    unit_amount: Math.round(amount * 100), // Convert to cents
                    recurring: {
                        interval: cycle === 'yearly' ? 'year' : 'month'
                    }
                },
                quantity: 1
            }],
            metadata: {
                userId,
                planName: planName.toLowerCase(),
                cycle,
                affiliateCode: validAffiliateCode || ''
            },
            success_url: `${baseUrl}/#/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/#/pricing`
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Subscription checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify subscription checkout session and activate plan
 * POST /api/subscription/verify
 */
router.post('/verify', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID required' });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        const { userId, planName, cycle, affiliateCode } = session.metadata;
        const subscriptionAmount = session.amount_total / 100;

        // Get user's current profile for email
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, name, referred_by_affiliate')
            .eq('id', userId)
            .single();

        // Calculate affiliate commission (15% of subscription) ONLY for Pro and Premium plans
        // Free plan does NOT qualify for affiliate commission
        let affiliateCommission = 0;
        let affiliateId = null;
        const paidPlans = ['pro', 'premium']; // Only these plans qualify for affiliate commission
        
        if (paidPlans.includes(planName.toLowerCase()) && affiliateCode && !profile?.referred_by_affiliate) {
            // Only attribute to affiliate if this is the first PAID subscription (not already referred)
            const { data: affiliate } = await supabase
                .from('profiles')
                .select('id, name, email, commission_rate')
                .eq('affiliate_code', affiliateCode)
                .single();
            
            if (affiliate) {
                // Use affiliate's individual rate if set, otherwise use default 15%
                const commissionRate = affiliate.commission_rate || 15;
                affiliateCommission = Number((subscriptionAmount * (commissionRate / 100)).toFixed(2));
                affiliateId = affiliate.id;
                
                console.log(`[Subscription] Affiliate commission: ${commissionRate}% of $${subscriptionAmount} = $${affiliateCommission} for ${affiliateCode} (${planName} plan)`);
                
                // Update user profile with affiliate attribution
                await supabase
                    .from('profiles')
                    .update({ referred_by_affiliate: affiliateCode })
                    .eq('id', userId);
                
                // Update affiliate's available payout
                await supabase.rpc('increment_available_payout', {
                    p_user_id: affiliate.id,
                    p_amount: affiliateCommission
                });
                
                // Send affiliate commission notification email
                if (affiliate.email) {
                    try {
                        await EmailService.sendAffiliateSubscriptionCommission(
                            affiliate.email,
                            affiliate.name,
                            profile?.name || 'A new user',
                            planName,
                            subscriptionAmount.toFixed(2),
                            affiliateCommission
                        );
                    } catch (emailErr) {
                        console.warn('[Subscription] Affiliate email failed:', emailErr);
                    }
                }
            }
        } else if (paidPlans.includes(planName.toLowerCase()) && profile?.referred_by_affiliate) {
            // User was already referred - pay recurring commission to original affiliate (only for paid plans)
            const { data: affiliate } = await supabase
                .from('profiles')
                .select('id, name, email, commission_rate')
                .eq('affiliate_code', profile.referred_by_affiliate)
                .single();
            
            if (affiliate) {
                // Use affiliate's individual rate if set, otherwise use default 15%
                const commissionRate = affiliate.commission_rate || 15;
                affiliateCommission = Number((subscriptionAmount * (commissionRate / 100)).toFixed(2));
                affiliateId = affiliate.id;
                
                console.log(`[Subscription] Recurring affiliate commission: ${commissionRate}% of $${subscriptionAmount} = $${affiliateCommission} for ${profile.referred_by_affiliate}`);
                
                // Update affiliate's available payout
                await supabase.rpc('increment_available_payout', {
                    p_user_id: affiliate.id,
                    p_amount: affiliateCommission
                });
                
                // Send recurring commission email
                if (affiliate.email) {
                    try {
                        await EmailService.sendAffiliateSubscriptionCommission(
                            affiliate.email,
                            affiliate.name,
                            profile?.name || 'A referred user',
                            planName,
                            subscriptionAmount.toFixed(2),
                            affiliateCommission
                        );
                    } catch (emailErr) {
                        console.warn('[Subscription] Recurring affiliate email failed:', emailErr);
                    }
                }
            }
        }

        // Update user's subscription
        const { error } = await supabase
            .from('profiles')
            .update({
                subscription: {
                    plan: planName,
                    status: 'active',
                    cycle: cycle,
                    startDate: new Date().toISOString(),
                    stripeSubscriptionId: session.subscription,
                    stripeCustomerId: session.customer
                },
                role: 'organizer'
            })
            .eq('id', userId);

        if (error) throw error;

        // Create invoice record with affiliate commission
        await supabase.from('invoices').insert({
            user_id: userId,
            type: 'subscription',
            amount: subscriptionAmount,
            status: 'paid',
            description: `${planName} Plan - ${cycle} subscription`,
            stripe_session_id: sessionId,
            affiliate_code: affiliateCode || null,
            affiliate_commission: affiliateCommission,
            created_at: new Date().toISOString()
        }).catch(e => console.warn('Invoice creation failed:', e));

        // Record affiliate commission transaction if applicable
        if (affiliateCommission > 0 && affiliateId) {
            await supabase.from('affiliate_commissions').insert({
                affiliate_id: affiliateId,
                user_id: userId,
                type: 'subscription',
                plan_name: planName,
                gross_amount: subscriptionAmount,
                commission_amount: affiliateCommission,
                commission_rate: 15,
                stripe_session_id: sessionId,
                status: 'pending',
                created_at: new Date().toISOString()
            }).catch(e => console.warn('Affiliate commission record failed:', e));
        }

        // Send subscription welcome email
        if (profile?.email) {
            const emailResult = await EmailService.sendSubscriptionWelcome(
                profile.email,
                planName,
                cycle,
                profile.name
            );
            console.log(`[Subscription] Welcome email result:`, emailResult);
        }

        res.json({ success: true, plan: planName });
    } catch (error) {
        console.error('Subscription verify error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get current subscription status
 * GET /api/subscription/status/:userId
 */
router.get('/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription, is_admin')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // Super admins always have premium
        if (profile?.is_admin) {
            return res.json({
                plan: 'premium',
                status: 'active',
                isAdmin: true
            });
        }

        res.json(profile?.subscription || { plan: 'free', status: 'active' });
    } catch (error) {
        console.error('Subscription status error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
