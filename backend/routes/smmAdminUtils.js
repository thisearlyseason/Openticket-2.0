import express from 'express';
import supabase from '../services/supabase.js';
import verifyFirebaseToken from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * ADMIN UTILITY: Fix SMM subscription status
 * This route updates SMM signups that have a Stripe subscription but aren't marked as active
 * POST /api/smm/admin/fix-subscription-status
 */
router.post('/admin/fix-subscription-status', verifyFirebaseToken, async (req, res) => {
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

        // Find all SMM signups that have a subscription_id but aren't marked as active
        const { data: signupsToFix } = await supabase
            .from('smm_signups')
            .select('*')
            .not('subscription_id', 'is', null)
            .neq('subscription_status', 'active');

        if (!signupsToFix || signupsToFix.length === 0) {
            return res.json({ 
                message: 'No signups need fixing',
                fixed: 0
            });
        }

        // Update all of them to active
        const { error: updateError } = await supabase
            .from('smm_signups')
            .update({ 
                subscription_status: 'active',
                updated_at: new Date().toISOString()
            })
            .not('subscription_id', 'is', null)
            .neq('subscription_status', 'active');

        if (updateError) {
            throw updateError;
        }

        console.log(`[SMM Admin] Fixed ${signupsToFix.length} signup(s) with subscription_id`);

        res.json({
            success: true,
            message: `Fixed ${signupsToFix.length} SMM signup(s) with active subscriptions`,
            fixed: signupsToFix.length,
            signups: signupsToFix.map(s => ({
                user_id: s.user_id,
                user_email: s.user_email,
                subscription_id: s.subscription_id
            }))
        });
    } catch (error) {
        console.error('[SMM Admin] Fix subscription status error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
