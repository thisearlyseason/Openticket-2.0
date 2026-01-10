
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
        console.log('[ProfileSync] Sync request received for user:', req.user?.uid);
        const { uid } = req.user;
        const updates = req.body;
        console.log('[ProfileSync] Updates received:', Object.keys(updates));

        // Fields that exist as columns in the profiles table (verified in DB schema)
        const dbColumnFields = [
            'email', 'name', 'role', 'business_name',
            'image_url', 'socials', 'address',
            'onboarding_step', 'payment_methods', 'payout_settings',
            'stripe_connect_id', 'stripe_onboarding_complete', 'stripe_publishable_key', 'stripe_secret_key',
            'favorite_organizers', 'commission_rate', 'affiliate_code',
            // Nonprofit fields
            'nonprofit_status', 'nonprofit_name', 'nonprofit_ein', 'nonprofit_doc_url',
            'onboarding_completed', 'onboarding_completed_at'
        ];

        // Extended settings stored in the 'subscription.settings' JSONB field
        // NOTE: bio, phone, business_email, etc. are stored here because these columns
        // don't exist in the profiles table - they are organizer profile extensions
        const extendedSettingsFields = [
            'default_currency', 'default_tax_rate', 'default_custom_fees', 'default_waiver',
            'default_refund_policy', 'default_refund_policy_enabled', 'default_confirmation_template',
            'logo_url', 'header_image_url', 'primary_color', 'organizer_subtitle', 'business_type',
            'notifications', 'email_templates', 'gemini_api_key', 'gmail_config',
            // Organizer profile fields (stored in subscription.settings JSONB)
            'bio', 'phone', 'business_email', 'business_phone', 
            'use_business_name', 'show_phone_publicly', 'event_types'
        ];

        const safeUpdates = {};
        const extendedSettings = {};
        
        Object.keys(updates).forEach(key => {
            if (dbColumnFields.includes(key)) {
                safeUpdates[key] = updates[key];
            } else if (extendedSettingsFields.includes(key)) {
                extendedSettings[key] = updates[key];
            }
        });

        console.log('[ProfileSync] Safe updates:', Object.keys(safeUpdates));
        console.log('[ProfileSync] Extended settings:', Object.keys(extendedSettings));

        // If there are extended settings, merge them into the subscription field
        if (Object.keys(extendedSettings).length > 0) {
            console.log('[ProfileSync] Fetching current profile to merge settings');
            // First fetch current subscription to merge
            const { data: currentProfile, error: fetchError } = await supabase
                .from('profiles')
                .select('subscription')
                .eq('id', uid)
                .single();
            
            const currentSubscription = currentProfile?.subscription || {};
            const mergedSubscription = {
                ...currentSubscription,
                settings: {
                    ...(currentSubscription.settings || {}),
                    ...extendedSettings
                }
            };
            safeUpdates.subscription = mergedSubscription;
        }

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
            const currentSettings = data.subscription?.settings || {};
            const premiumSubscription = {
                plan: 'premium',
                status: 'active',
                cycle: null,
                startDate: data.created_at || new Date().toISOString(),
                isAdminGrant: true,
                settings: currentSettings
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

        // Extract extended settings from subscription.settings and merge into profile response
        const extendedSettings = data.subscription?.settings || {};
        const responseProfile = {
            ...data,
            // Map extended settings to top-level for frontend compatibility
            default_currency: extendedSettings.default_currency,
            default_tax_rate: extendedSettings.default_tax_rate,
            default_custom_fees: extendedSettings.default_custom_fees,
            default_waiver: extendedSettings.default_waiver,
            default_refund_policy: extendedSettings.default_refund_policy,
            default_refund_policy_enabled: extendedSettings.default_refund_policy_enabled,
            default_confirmation_template: extendedSettings.default_confirmation_template,
            logo_url: extendedSettings.logo_url || data.image_url,
            header_image_url: extendedSettings.header_image_url,
            primary_color: extendedSettings.primary_color,
            organizer_subtitle: extendedSettings.organizer_subtitle,
            business_type: extendedSettings.business_type,
            notifications: extendedSettings.notifications,
            email_templates: extendedSettings.email_templates,
            gemini_api_key: extendedSettings.gemini_api_key,
            gmail_config: extendedSettings.gmail_config,
            // Organizer profile fields (stored in subscription.settings JSONB)
            bio: extendedSettings.bio,
            phone: extendedSettings.phone,
            business_email: extendedSettings.business_email,
            business_phone: extendedSettings.business_phone,
            use_business_name: extendedSettings.use_business_name,
            show_phone_publicly: extendedSettings.show_phone_publicly,
            // DB column fields
            socials: data.socials
        };

        res.json({ profile: responseProfile });
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

        // Fields that exist as columns in the profiles table (verified in DB schema)
        const dbColumnFields = [
            'name', 'business_name',
            'image_url', 'socials', 'address',
            'stripe_connect_id', 'stripe_onboarding_complete', 'stripe_publishable_key', 'stripe_secret_key',
            'favorite_organizers', 'commission_rate', 'affiliate_code',
            'role' // Allow role changes (for affiliate signup)
        ];

        // Extended settings stored in the 'subscription.settings' JSONB field
        // NOTE: bio, phone, business_email, etc. are stored here because these columns
        // don't exist in the profiles table - they are organizer profile extensions
        const extendedSettingsFields = [
            'default_currency', 'default_tax_rate', 'default_custom_fees', 'default_waiver',
            'default_refund_policy', 'default_refund_policy_enabled', 'default_confirmation_template',
            'logo_url', 'header_image_url', 'primary_color', 'organizer_subtitle', 'business_type',
            'notifications', 'email_templates', 'gemini_api_key', 'gmail_config',
            // Organizer profile fields (stored in subscription.settings JSONB)
            'bio', 'phone', 'business_email', 'business_phone', 
            'use_business_name', 'show_phone_publicly'
        ];

        const safeUpdates = {};
        const extendedSettings = {};
        
        Object.keys(updates).forEach(key => {
            if (dbColumnFields.includes(key)) {
                // Security: Only allow specific role values
                if (key === 'role') {
                    const allowedRoles = ['attendee', 'organizer', 'affiliate'];
                    if (!allowedRoles.includes(updates[key])) {
                        return;
                    }
                }
                safeUpdates[key] = updates[key];
            } else if (extendedSettingsFields.includes(key)) {
                extendedSettings[key] = updates[key];
            }
        });

        // Security Check: User can only update their own profile
        if (id !== uid) {
            return res.status(403).json({ error: 'Unauthorized profile update' });
        }

        // If there are extended settings, merge them into the subscription field
        if (Object.keys(extendedSettings).length > 0) {
            // First fetch current subscription to merge
            const { data: currentProfile } = await supabase
                .from('profiles')
                .select('subscription')
                .eq('id', id)
                .single();
            
            const currentSubscription = currentProfile?.subscription || {};
            const mergedSubscription = {
                ...currentSubscription,
                settings: {
                    ...(currentSubscription.settings || {}),
                    ...extendedSettings
                }
            };
            safeUpdates.subscription = mergedSubscription;
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
            const currentSettings = data.subscription?.settings || {};
            const premiumSubscription = {
                plan: 'premium',
                status: 'active',
                cycle: null,
                startDate: data.created_at || new Date().toISOString(),
                isAdminGrant: true,
                settings: currentSettings
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

        // Extract extended settings from subscription.settings and merge into profile response
        const extendedSettings = data.subscription?.settings || {};
        const responseProfile = {
            ...data,
            // Map extended settings to top-level for frontend compatibility
            default_currency: extendedSettings.default_currency,
            default_tax_rate: extendedSettings.default_tax_rate,
            default_custom_fees: extendedSettings.default_custom_fees,
            default_waiver: extendedSettings.default_waiver,
            default_refund_policy: extendedSettings.default_refund_policy,
            default_refund_policy_enabled: extendedSettings.default_refund_policy_enabled,
            default_confirmation_template: extendedSettings.default_confirmation_template,
            logo_url: extendedSettings.logo_url || data.image_url,
            header_image_url: extendedSettings.header_image_url,
            primary_color: extendedSettings.primary_color,
            organizer_subtitle: extendedSettings.organizer_subtitle,
            business_type: extendedSettings.business_type,
            notifications: extendedSettings.notifications,
            email_templates: extendedSettings.email_templates,
            gemini_api_key: extendedSettings.gemini_api_key,
            gmail_config: extendedSettings.gmail_config,
            // Organizer profile fields (stored in subscription.settings JSONB)
            bio: extendedSettings.bio,
            phone: extendedSettings.phone,
            business_email: extendedSettings.business_email,
            business_phone: extendedSettings.business_phone,
            use_business_name: extendedSettings.use_business_name,
            show_phone_publicly: extendedSettings.show_phone_publicly,
            // DB column fields
            socials: data.socials
        };

        res.json({ profile: responseProfile });
    } catch (error) {
        console.error('getProfileById error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error.message,
            code: error.code || 'UNKNOWN'
        });
    }
};
