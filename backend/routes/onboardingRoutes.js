import express from 'express';
import supabase from '../services/supabase.js';
import verifyToken from '../middlewares/authMiddleware.js';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../services/serverEmail.js';

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const { data: user, error } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', req.user.uid)
            .single();

        if (error || !user || user.is_admin !== true) {
            return res.status(403).json({ error: 'Requires Admin privileges.' });
        }
        next();
    } catch (e) {
        console.error("Admin verification failed", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

/**
 * Save onboarding responses for a user
 * POST /api/onboarding/save
 */
router.post('/save', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { responses, organizationType, completedAt } = req.body;

        if (!responses) {
            return res.status(400).json({ error: 'Onboarding responses are required' });
        }

        // Check if onboarding record exists
        const { data: existing } = await supabase
            .from('onboarding_responses')
            .select('id')
            .eq('user_id', userId)
            .single();

        const onboardingData = {
            user_id: userId,
            responses: responses,
            organization_type: organizationType || 'individual',
            completed_at: completedAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            // Update existing record
            const { data, error } = await supabase
                .from('onboarding_responses')
                .update(onboardingData)
                .eq('user_id', userId)
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        } else {
            // Create new record
            const { data, error } = await supabase
                .from('onboarding_responses')
                .insert({
                    id: uuidv4(),
                    ...onboardingData,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            result = data;
        }

        // Update user profile with onboarding completion
        await supabase
            .from('profiles')
            .update({
                onboarding_completed: true,
                onboarding_completed_at: new Date().toISOString()
            })
            .eq('id', userId);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('[Onboarding] Save error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get onboarding responses for current user
 * GET /api/onboarding/me
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const { data, error } = await supabase
            .from('onboarding_responses')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json({ data: data || null });
    } catch (error) {
        console.error('[Onboarding] Get error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Submit non-profit application
 * POST /api/onboarding/nonprofit/apply
 */
router.post('/nonprofit/apply', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { 
            organizationName, 
            ein, 
            documentUrl, 
            description,
            onboardingResponses 
        } = req.body;

        if (!organizationName || !documentUrl) {
            return res.status(400).json({ 
                error: 'Organization name and verification document are required' 
            });
        }

        // Create non-profit application record
        const applicationId = uuidv4();
        const { data: application, error: appError } = await supabase
            .from('nonprofit_applications')
            .insert({
                id: applicationId,
                user_id: userId,
                organization_name: organizationName,
                ein: ein || null,
                document_url: documentUrl,
                description: description || null,
                status: 'pending',
                submitted_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (appError) throw appError;

        // Update user profile with non-profit status
        await supabase
            .from('profiles')
            .update({
                nonprofit_status: 'pending',
                nonprofit_name: organizationName,
                nonprofit_ein: ein || null,
                nonprofit_doc_url: documentUrl,
                subscription: {
                    plan: 'free',
                    status: 'active',
                    startDate: new Date().toISOString()
                },
                role: 'organizer'
            })
            .eq('id', userId);

        // Save onboarding responses if provided
        if (onboardingResponses) {
            const { data: existingOnboarding } = await supabase
                .from('onboarding_responses')
                .select('id')
                .eq('user_id', userId)
                .single();

            const onboardingData = {
                user_id: userId,
                responses: onboardingResponses,
                organization_type: 'nonprofit',
                nonprofit_application_id: applicationId,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (existingOnboarding) {
                await supabase
                    .from('onboarding_responses')
                    .update(onboardingData)
                    .eq('user_id', userId);
            } else {
                await supabase
                    .from('onboarding_responses')
                    .insert({
                        id: uuidv4(),
                        ...onboardingData,
                        created_at: new Date().toISOString()
                    });
            }
        }

        res.json({ 
            success: true, 
            applicationId,
            message: 'Non-profit application submitted successfully'
        });
    } catch (error) {
        console.error('[Onboarding] Non-profit apply error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get non-profit application status for current user
 * GET /api/onboarding/nonprofit/status
 */
router.get('/nonprofit/status', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;

        const { data, error } = await supabase
            .from('nonprofit_applications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json({ data: data || null });
    } catch (error) {
        console.error('[Onboarding] Non-profit status error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Re-submit rejected non-profit application
 * POST /api/onboarding/nonprofit/resubmit
 */
router.post('/nonprofit/resubmit', verifyToken, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { 
            organizationName, 
            ein, 
            documentUrl, 
            description 
        } = req.body;

        if (!organizationName || !documentUrl) {
            return res.status(400).json({ 
                error: 'Organization name and verification document are required' 
            });
        }

        // Check if user has a rejected application
        const { data: existingApp } = await supabase
            .from('nonprofit_applications')
            .select('id, status')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!existingApp) {
            return res.status(400).json({ error: 'No previous application found' });
        }

        if (existingApp.status !== 'rejected') {
            return res.status(400).json({ 
                error: 'Only rejected applications can be resubmitted' 
            });
        }

        // Create new application (keep history of previous one)
        const applicationId = uuidv4();
        const { data: application, error: appError } = await supabase
            .from('nonprofit_applications')
            .insert({
                id: applicationId,
                user_id: userId,
                organization_name: organizationName,
                ein: ein || null,
                document_url: documentUrl,
                description: description || null,
                status: 'pending',
                submitted_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (appError) throw appError;

        // Update user profile status back to pending
        await supabase
            .from('profiles')
            .update({
                nonprofit_status: 'pending',
                nonprofit_name: organizationName,
                nonprofit_ein: ein || null,
                nonprofit_doc_url: documentUrl
            })
            .eq('id', userId);

        // Update onboarding record if exists
        await supabase
            .from('onboarding_responses')
            .update({
                nonprofit_application_id: applicationId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        res.json({ 
            success: true, 
            applicationId,
            message: 'Non-profit application resubmitted successfully'
        });
    } catch (error) {
        console.error('[Onboarding] Non-profit resubmit error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ROUTES ============

/**
 * Get all onboarding responses (Admin only)
 * GET /api/onboarding/admin/all
 */
router.get('/admin/all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('onboarding_responses')
            .select(`
                *,
                user:profiles!onboarding_responses_user_id_fkey (
                    id,
                    name,
                    email,
                    role,
                    nonprofit_status,
                    created_at
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ data: data || [] });
    } catch (error) {
        console.error('[Onboarding] Admin get all error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all pending non-profit applications (Admin only)
 * GET /api/onboarding/admin/nonprofit/pending
 */
router.get('/admin/nonprofit/pending', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('nonprofit_applications')
            .select(`
                *,
                user:profiles!nonprofit_applications_user_id_fkey (
                    id,
                    name,
                    email,
                    nonprofit_name,
                    nonprofit_ein,
                    created_at
                ),
                onboarding:onboarding_responses!onboarding_responses_nonprofit_application_id_fkey (
                    responses,
                    organization_type,
                    completed_at
                )
            `)
            .eq('status', 'pending')
            .order('submitted_at', { ascending: true });

        if (error) throw error;

        res.json({ data: data || [] });
    } catch (error) {
        console.error('[Onboarding] Admin get pending nonprofits error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all non-profit applications (Admin only)
 * GET /api/onboarding/admin/nonprofit/all
 */
router.get('/admin/nonprofit/all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('nonprofit_applications')
            .select(`
                *,
                user:profiles!nonprofit_applications_user_id_fkey (
                    id,
                    name,
                    email,
                    nonprofit_name,
                    nonprofit_ein,
                    nonprofit_status,
                    created_at
                )
            `)
            .order('submitted_at', { ascending: false });

        if (error) throw error;

        res.json({ data: data || [] });
    } catch (error) {
        console.error('[Onboarding] Admin get all nonprofits error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Approve non-profit application (Admin only)
 * POST /api/onboarding/admin/nonprofit/approve
 */
router.post('/admin/nonprofit/approve', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { applicationId, userId } = req.body;

        if (!applicationId || !userId) {
            return res.status(400).json({ error: 'Application ID and User ID are required' });
        }

        // Generate unique discount code (20% off)
        const discountCode = `NP${uuidv4().substring(0, 8).toUpperCase()}`;
        const magicLinkToken = uuidv4();

        // Update application status
        const { error: appError } = await supabase
            .from('nonprofit_applications')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: req.user.uid,
                discount_code: discountCode,
                magic_link_token: magicLinkToken
            })
            .eq('id', applicationId);

        if (appError) throw appError;

        // Update user profile
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                nonprofit_status: 'approved',
                nonprofit_approved_at: new Date().toISOString(),
                nonprofit_discount_code: discountCode
            })
            .eq('id', userId);

        if (profileError) throw profileError;

        // Create the promo code in the system
        await supabase
            .from('promo_codes')
            .insert({
                id: uuidv4(),
                code: discountCode,
                type: 'percentage',
                value: 20,
                target: 'subscription',
                target_plans: ['pro', 'premium'],
                usage_limit: 1,
                usage_count: 0,
                is_active: true,
                created_at: new Date().toISOString(),
                created_by: req.user.uid,
                nonprofit_application_id: applicationId,
                description: `Non-profit discount for application ${applicationId}`
            });

        // Get user details for email
        const { data: user } = await supabase
            .from('profiles')
            .select('name, email, nonprofit_name')
            .eq('id', userId)
            .single();

        // Send approval email with magic link
        if (user?.email) {
            const frontendUrl = process.env.FRONTEND_URL || 'https://openticket.events';
            const magicLink = `${frontendUrl}/#/nonprofit-upgrade?token=${magicLinkToken}&code=${discountCode}`;

            await EmailService.sendNonprofitApprovalEmail(
                user.email,
                user.name || 'Organizer',
                user.nonprofit_name || 'Your Organization',
                discountCode,
                magicLink
            );
        }

        res.json({ 
            success: true, 
            discountCode,
            message: 'Non-profit application approved successfully'
        });
    } catch (error) {
        console.error('[Onboarding] Admin approve nonprofit error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Reject non-profit application (Admin only)
 * POST /api/onboarding/admin/nonprofit/reject
 */
router.post('/admin/nonprofit/reject', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { applicationId, userId, reason } = req.body;

        if (!applicationId || !userId) {
            return res.status(400).json({ error: 'Application ID and User ID are required' });
        }

        // Update application status
        const { error: appError } = await supabase
            .from('nonprofit_applications')
            .update({
                status: 'rejected',
                rejected_at: new Date().toISOString(),
                rejected_by: req.user.uid,
                rejection_reason: reason || null
            })
            .eq('id', applicationId);

        if (appError) throw appError;

        // Update user profile
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                nonprofit_status: 'rejected'
            })
            .eq('id', userId);

        if (profileError) throw profileError;

        // Get user details for email
        const { data: user } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', userId)
            .single();

        // Send rejection email
        if (user?.email) {
            await EmailService.sendNonprofitRejectionEmail(
                user.email,
                user.name || 'Organizer',
                reason || 'Your application did not meet our verification requirements.'
            );
        }

        res.json({ 
            success: true, 
            message: 'Non-profit application rejected'
        });
    } catch (error) {
        console.error('[Onboarding] Admin reject nonprofit error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify magic link token for non-profit upgrade
 * GET /api/onboarding/nonprofit/verify-magic-link
 */
router.get('/nonprofit/verify-magic-link', async (req, res) => {
    try {
        const { token, code } = req.query;

        if (!token || !code) {
            return res.status(400).json({ error: 'Token and code are required' });
        }

        // Find application with this magic link token
        const { data: application, error } = await supabase
            .from('nonprofit_applications')
            .select(`
                *,
                user:profiles!nonprofit_applications_user_id_fkey (
                    id,
                    name,
                    email
                )
            `)
            .eq('magic_link_token', token)
            .eq('discount_code', code)
            .eq('status', 'approved')
            .single();

        if (error || !application) {
            return res.status(404).json({ 
                error: 'Invalid or expired magic link',
                valid: false
            });
        }

        res.json({ 
            valid: true,
            userId: application.user_id,
            discountCode: application.discount_code,
            organizationName: application.organization_name,
            user: application.user
        });
    } catch (error) {
        console.error('[Onboarding] Verify magic link error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
