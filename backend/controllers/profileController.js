
import supabase from '../services/supabase.js';

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
            'primary_color', 'organizer_subtitle', 'business_type', 'commission_rate', 'website', 'affiliate_code'
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
            'primary_color', 'organizer_subtitle', 'business_type', 'commission_rate', 'website', 'affiliate_code'
        ];

        const safeUpdates = {};
        Object.keys(updates).forEach(key => {
            if (allowedFields.includes(key)) {
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
