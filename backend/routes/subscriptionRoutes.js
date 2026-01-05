import express from 'express';
const router = express.Router();
import Stripe from 'stripe';
import supabase from '../services/supabase.js';

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
        const { userId, userEmail, planName, cycle, amount } = req.body;

        if (!userId || !planName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // For free plan, just update the user directly
        if (planName.toLowerCase() === 'free') {
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
            return res.json({ success: true, redirect: '/dashboard' });
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
                cycle
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

        const { userId, planName, cycle } = session.metadata;

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

        // Create invoice record
        await supabase.from('invoices').insert({
            user_id: userId,
            type: 'subscription',
            amount: session.amount_total / 100,
            status: 'paid',
            description: `${planName} Plan - ${cycle} subscription`,
            stripe_session_id: sessionId,
            created_at: new Date().toISOString()
        }).catch(e => console.warn('Invoice creation failed:', e));

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
