
import supabase from '../services/supabase.js';

// Special endpoint to set up the first super admin
// This should only be used once during initial setup
export const setupSuperAdmin = async (req, res) => {
    try {
        const { email, setupKey } = req.body;
        
        // Require a setup key for security (use env var or hardcoded for initial setup)
        const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'openticket-admin-setup-2026';
        
        if (setupKey !== SETUP_KEY) {
            return res.status(403).json({ error: 'Invalid setup key' });
        }
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Find the user by email
        const { data: profile, error: findError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .single();
        
        if (findError || !profile) {
            return res.status(404).json({ error: 'User not found. Please sign up first.' });
        }
        
        // Update to super admin
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                is_admin: true, 
                role: 'organizer',
                updated_at: new Date() 
            })
            .eq('email', email)
            .select();
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            message: `User ${email} is now a super admin`,
            profile: data[0]
        });
    } catch (error) {
        console.error('Setup Super Admin Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const syncProfile = async (req, res) => {
    try {
        const { uid } = req.user;
        const updates = req.body;

        // SECURITY FIX: Whitelist allowed fields to prevent Privilege Escalation
        const allowedFields = [
            'email', 'name', 'role', 'business_name', 'image_url', 'bio', 'socials', 'location',
            'onboarding_step', 'payment_methods', 'payout_settings',
            'stripe_connect_id', 'stripe_onboarding_complete', 'stripe_publishable_key', 'stripe_secret_key',
            'favorite_organizers', 'gemini_api_key', 'default_tax_rate', 'default_custom_fees', 'address',
            'notifications', 'email_templates', 'default_confirmation_template', 'default_waiver',
            'default_refund_policy', 'default_refund_policy_enabled', 'logo_url', 'header_image_url',
            'primary_color', 'organizer_subtitle', 'business_type', 'commission_rate', 'website', 'affiliate_code',
            'default_currency'
        ];

        const safeUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        });

        const profileData = {
            id: uid,
            ...safeUpdates,
            updated_at: new Date()
        };

        const { data, error } = await supabase
            .from('profiles')
            .upsert([profileData])
            .select();

        if (error) {
            throw error;
        }

        res.json({ profile: data[0] });
    } catch (error) {
        console.error('Profile Sync Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { uid } = req.user;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (error) throw error;

        // AUTO-ASSIGN PREMIUM FOR SUPER ADMINS
        if (data && data.is_admin) {
            const premiumSubscription = {
                plan: 'premium',
                status: 'active',
                cycle: null,
                startDate: data.created_at || new Date().toISOString(),
                isAdminGrant: true
            };

            // Only update DB if subscription isn't already premium
            const currentPlan = data.subscription?.plan;
            if (currentPlan !== 'premium') {
                await supabase
                    .from('profiles')
                    .update({ subscription: premiumSubscription })
                    .eq('id', uid);
            }

            // Always return premium for admins in response
            data.subscription = premiumSubscription;
        }

        res.json({ profile: data });
    } catch (error) {
        res.status(404).json({ error: 'Profile not found' });
    }
};

// Explicit Update separate from Sync/Upsert
export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { uid } = req.user;
        const updates = req.body;

        // SECURITY FIX: Whitelist allowed fields
        const allowedFields = [
            'name', 'business_name', 'image_url', 'bio', 'socials', 'location',
            'onboarding_step', 'payment_methods', 'payout_settings',
            'stripe_connect_id', 'stripe_onboarding_complete', 'stripe_publishable_key', 'stripe_secret_key',
            'favorite_organizers', 'gemini_api_key', 'default_tax_rate', 'default_custom_fees', 'address',
            'notifications', 'email_templates', 'default_confirmation_template', 'default_waiver',
            'default_refund_policy', 'default_refund_policy_enabled', 'logo_url', 'header_image_url',
            'primary_color', 'organizer_subtitle', 'business_type', 'commission_rate', 'website', 'affiliate_code',
            'role', // Allow role changes (for affiliate signup)
            'default_currency'
        ];

        const safeUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
                // Security: Only allow specific role values, not 'admin' or 'superadmin'
                if (key === 'role') {
                    const allowedRoles = ['attendee', 'organizer', 'affiliate'];
                    if (!allowedRoles.includes(updates[key])) {
                        return; // Skip disallowed role values
                    }
                }
                safeUpdates[key] = updates[key];
            }
        });

        // Security Check: Ensure user can only update their own profile (unless admin, but for now strict)
        if (id !== uid) {
            return res.status(403).json({ error: 'Unauthorized profile update' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                ...safeUpdates,
                updated_at: new Date()
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (data.length === 0) {
            return res.status(404).json({ error: 'Profile not found to update' });
        }

        res.json({ profile: data[0] });
    } catch (error) {
        console.error('Profile Update Error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const getProfileById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            // Handle 'No rows returned' as a 404
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Profile not found' });
            }
            throw error;
        }

        // AUTO-ASSIGN PREMIUM FOR SUPER ADMINS
        // If user is admin, ensure they always have premium subscription
        if (data && data.is_admin) {
            const premiumSubscription = {
                plan: 'premium',
                status: 'active',
                cycle: null,
                startDate: data.created_at || new Date().toISOString(),
                isAdminGrant: true
            };

            // Only update DB if subscription isn't already premium
            const currentPlan = data.subscription?.plan;
            if (currentPlan !== 'premium') {
                await supabase
                    .from('profiles')
                    .update({ subscription: premiumSubscription })
                    .eq('id', id);
            }

            // Always return premium for admins in response
            data.subscription = premiumSubscription;
        }

        res.json({ profile: data });
    } catch (error) {
        console.error('getProfileById error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message,
            code: error.code || 'UNKNOWN'
        });
    }
};
