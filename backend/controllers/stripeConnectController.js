import supabase from '../services/supabase.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

/**
 * STRIPE CONNECT CONTROLLER
 * Handles Stripe Connect Express account creation and management
 */

// Lazy load Stripe
const getStripe = () => {
    const Stripe = require('stripe');
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
};

/**
 * Create a Stripe Connect Express account and return onboarding link
 * POST /api/stripe/connect/create-account
 */
export const createConnectAccount = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        // Get user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, name, stripe_connect_id')
            .eq('id', userId)
            .single();

        if (profileError) throw new Error('Failed to fetch user profile');

        // Check if already connected with a valid account
        if (profile.stripe_connect_id && !profile.stripe_connect_id.startsWith('mock_')) {
            try {
                // Verify the account still exists in Stripe
                const existingAccount = await stripe.accounts.retrieve(profile.stripe_connect_id);
                if (existingAccount) {
                    // Return existing account link for re-onboarding if needed
                    const accountLink = await stripe.accountLinks.create({
                        account: profile.stripe_connect_id,
                        refresh_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_refresh=true`,
                        return_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_success=true`,
                        type: 'account_onboarding',
                    });
                    return res.json({ url: accountLink.url, accountId: profile.stripe_connect_id });
                }
            } catch (e) {
                // Account doesn't exist in Stripe anymore, clear it
                console.log('Existing account not found in Stripe, creating new one');
            }
        }

        // Create new Express account with pre-filled test data
        const accountParams = {
            type: 'express',
            country: 'US',
            email: profile.email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            business_type: 'individual',
            metadata: {
                openticket_user_id: userId,
            },
        };

        // In test mode, pre-fill some data to make onboarding easier
        if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
            accountParams.business_profile = {
                mcc: '7922', // Theatrical Producers and Ticket Agencies
                url: 'https://example.com',
            };
        }

        const account = await stripe.accounts.create(accountParams);

        console.log(`[Stripe Connect] Created account: ${account.id}`);

        // Save account ID to profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                stripe_connect_id: account.id,
                stripe_onboarding_complete: false,
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to save Stripe Connect ID:', updateError);
            // Try to delete the created account to avoid orphan accounts
            try {
                await stripe.accounts.del(account.id);
            } catch (e) {
                console.error('Failed to cleanup orphan account:', e);
            }
            throw new Error('Failed to save account to database');
        }

        // Create account onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: account.id,
            refresh_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_refresh=true`,
            return_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_success=true`,
            type: 'account_onboarding',
            collect: 'eventually_due', // Only collect what's needed now
        });

        console.log(`[Stripe Connect] Onboarding URL created for: ${account.id}`);

        res.json({
            url: accountLink.url,
            accountId: account.id,
        });
    } catch (error) {
        console.error('Create Connect Account Error:', error);
        res.status(500).json({ error: error.message });
    }
};
        });
    } catch (error) {
        console.error('Create Connect Account Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get Stripe Connect account status
 * GET /api/stripe/connect/status
 */
export const getConnectStatus = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('stripe_connect_id, stripe_onboarding_complete')
            .eq('id', userId)
            .single();

        if (error) throw new Error('Failed to fetch profile');

        if (!profile.stripe_connect_id || profile.stripe_connect_id.startsWith('mock_')) {
            return res.json({
                connected: false,
                accountId: null,
                chargesEnabled: false,
                payoutsEnabled: false,
                detailsSubmitted: false,
            });
        }

        // Fetch account details from Stripe
        const account = await stripe.accounts.retrieve(profile.stripe_connect_id);

        // Update onboarding status if changed
        const isComplete = account.charges_enabled && account.payouts_enabled;
        if (isComplete !== profile.stripe_onboarding_complete) {
            await supabase
                .from('profiles')
                .update({ stripe_onboarding_complete: isComplete })
                .eq('id', userId);
        }

        res.json({
            connected: true,
            accountId: account.id,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
            email: account.email,
            businessProfile: account.business_profile,
        });
    } catch (error) {
        console.error('Get Connect Status Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create a new onboarding/update link for existing account
 * POST /api/stripe/connect/create-link
 */
export const createAccountLink = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('stripe_connect_id')
            .eq('id', userId)
            .single();

        if (error || !profile.stripe_connect_id) {
            return res.status(400).json({ error: 'No Stripe account found. Create one first.' });
        }

        if (profile.stripe_connect_id.startsWith('mock_')) {
            return res.status(400).json({ error: 'Mock account detected. Create a real account.' });
        }

        const accountLink = await stripe.accountLinks.create({
            account: profile.stripe_connect_id,
            refresh_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_refresh=true`,
            return_url: `${process.env.FRONTEND_URL || req.headers.origin}/#/billing?stripe_success=true`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });
    } catch (error) {
        console.error('Create Account Link Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create Stripe Dashboard login link for connected account
 * POST /api/stripe/connect/dashboard-link
 */
export const createDashboardLink = async (req, res) => {
    try {
        const stripe = getStripe();
        const userId = req.user.uid;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('stripe_connect_id')
            .eq('id', userId)
            .single();

        if (error || !profile.stripe_connect_id || profile.stripe_connect_id.startsWith('mock_')) {
            return res.status(400).json({ error: 'No valid Stripe account found.' });
        }

        const loginLink = await stripe.accounts.createLoginLink(profile.stripe_connect_id);

        res.json({ url: loginLink.url });
    } catch (error) {
        console.error('Create Dashboard Link Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Disconnect Stripe Connect account
 * POST /api/stripe/connect/disconnect
 */
export const disconnectAccount = async (req, res) => {
    try {
        const userId = req.user.uid;

        // Just remove from our DB - don't delete the Stripe account
        // The organizer can re-connect or manage via Stripe Dashboard
        const { error } = await supabase
            .from('profiles')
            .update({
                stripe_connect_id: null,
                stripe_onboarding_complete: false,
            })
            .eq('id', userId);

        if (error) throw new Error('Failed to disconnect account');

        res.json({ success: true });
    } catch (error) {
        console.error('Disconnect Account Error:', error);
        res.status(500).json({ error: error.message });
    }
};
