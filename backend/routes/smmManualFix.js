import express from 'express';
import supabase from '../services/supabase.js';
import verifyFirebaseToken from '../middlewares/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * ADMIN UTILITY: Manually create SMM financial transaction
 * For cases where payment succeeded but webhook/verify didn't fire
 * POST /api/smm/admin/manual-revenue-fix
 */
router.post('/admin/manual-revenue-fix', verifyFirebaseToken, async (req, res) => {
    try {
        const { uid } = req.user;

        // Verify user is super admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', uid)
            .single();

        if (!profile?.is_admin) {
            return res.status(403).json({ error: 'Unauthorized: Admin access required' });
        }

        const { userEmail } = req.body;

        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail is required' });
        }

        // Find the SMM signup for this user
        const { data: smmSignup, error: signupError } = await supabase
            .from('smm_signups')
            .select('*')
            .eq('user_email', userEmail)
            .single();

        if (signupError || !smmSignup) {
            return res.status(404).json({ error: 'SMM signup not found for this email' });
        }

        // Check if financial transaction already exists
        const { data: existingTx } = await supabase
            .from('financial_transactions')
            .select('id')
            .eq('user_id', smmSignup.user_id)
            .eq('transaction_type', 'smm_subscription')
            .single();

        if (existingTx) {
            return res.json({
                message: 'Financial transaction already exists',
                transaction_id: existingTx.id
            });
        }

        // Create the missing financial transaction
        const smmAmount = 49.00;
        const platformFee = Number((smmAmount * 0.10).toFixed(2));
        const organizerNet = Number((smmAmount - platformFee).toFixed(2));

        const { data: newTx, error: txError } = await supabase
            .from('financial_transactions')
            .insert({
                id: uuidv4(),
                user_id: smmSignup.user_id,
                event_id: null,
                transaction_type: 'smm_subscription',
                description: `Social Media Management Subscription - Monthly (Manual Fix)`,
                gross_amount: smmAmount,
                platform_fee: platformFee,
                organizer_net: organizerNet,
                status: 'succeeded',
                stripe_session_id: smmSignup.stripe_session_id || null,
                stripe_subscription_id: smmSignup.subscription_id || null,
                payout_status: 'pending',
                created_at: smmSignup.signup_date || new Date().toISOString()
            })
            .select()
            .single();

        if (txError) {
            throw txError;
        }

        console.log(`[SMM Admin] Manually created financial transaction for ${userEmail}: $${smmAmount}`);

        res.json({
            success: true,
            message: `SMM financial transaction created for ${userEmail}`,
            transaction: {
                id: newTx.id,
                amount: smmAmount,
                platform_fee: platformFee,
                organizer_net: organizerNet,
                user_id: smmSignup.user_id
            }
        });
    } catch (error) {
        console.error('[SMM Admin] Manual revenue fix error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
