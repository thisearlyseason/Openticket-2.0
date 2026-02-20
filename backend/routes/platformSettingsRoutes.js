import express from 'express';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
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

const maskKey = (key) => {
    if (!key) return '';
    if (key.length <= 8) return '*'.repeat(key.length);
    return key.slice(0, 7) + '...' + key.slice(-4);
};

/**
 * Ensure platform_settings table exists in Supabase
 * Returns true if table exists, false otherwise
 */
async function checkPlatformSettingsTable(supabase) {
    try {
        await supabase.from('platform_settings').select('key').limit(1);
        return true;
    } catch (err) {
        return false;
    }
}

/**
 * GET /api/platform-settings/stripe
 * Get current Stripe configuration (masked for security)
 * Priority: DB settings > env vars
 */
router.get('/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        await ensurePlatformSettingsTable(supabase);

        // Try to get from DB first
        const { data: dbSettings } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'stripe_config')
            .single();

        const dbConfig = dbSettings?.value || {};

        // Use DB values if set, otherwise fall back to env vars
        const publishableKey = dbConfig.publishableKey || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
        const secretKey = dbConfig.secretKey || process.env.STRIPE_SECRET_KEY || '';
        const webhookSecret = dbConfig.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
        const isFromDB = !!dbConfig.publishableKey;

        res.json({
            publishableKey,
            publishableKeyMasked: maskKey(publishableKey),
            secretKeyMasked: maskKey(secretKey),
            webhookSecretMasked: maskKey(webhookSecret),
            isConfigured: !!(publishableKey && secretKey),
            isFromDB,
            environment: secretKey.startsWith('sk_live') ? 'live' : 'test'
        });
    } catch (error) {
        console.error('[Platform Settings] Error fetching Stripe config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/platform-settings/stripe
 * Save Stripe keys to Supabase database (persists across deployments)
 */
router.put('/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { publishableKey, secretKey, webhookSecret } = req.body;

        if (!publishableKey || !secretKey) {
            return res.status(400).json({
                error: 'Both publishable key and secret key are required'
            });
        }

        if (!publishableKey.startsWith('pk_')) {
            return res.status(400).json({
                error: 'Invalid publishable key format. Must start with pk_test_ or pk_live_'
            });
        }

        if (!secretKey.startsWith('sk_')) {
            return res.status(400).json({
                error: 'Invalid secret key format. Must start with sk_test_ or sk_live_'
            });
        }

        const isPublishableLive = publishableKey.startsWith('pk_live');
        const isSecretLive = secretKey.startsWith('sk_live');

        if (isPublishableLive !== isSecretLive) {
            return res.status(400).json({
                error: 'Cannot mix test and live keys. Both must be test or both must be live.'
            });
        }

        const supabase = (await import('../services/supabase.js')).default;
        await ensurePlatformSettingsTable(supabase);

        const configValue = {
            publishableKey,
            secretKey,
            ...(webhookSecret ? { webhookSecret } : {}),
            environment: isSecretLive ? 'live' : 'test'
        };

        // Upsert into platform_settings table
        const { error: upsertError } = await supabase
            .from('platform_settings')
            .upsert({
                key: 'stripe_config',
                value: configValue,
                updated_at: new Date().toISOString(),
                updated_by: req.user?.uid
            }, { onConflict: 'key' });

        if (upsertError) {
            console.error('[Platform Settings] DB upsert error:', upsertError);
            throw new Error(`Failed to save settings: ${upsertError.message}`);
        }

        // Also update process.env in memory for immediate effect in current process
        process.env.STRIPE_SECRET_KEY = secretKey;
        process.env.VITE_STRIPE_PUBLISHABLE_KEY = publishableKey;
        if (webhookSecret) process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

        // Audit log
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user?.uid,
            actor_type: 'admin',
            action: 'update_stripe_keys',
            target_type: 'platform_settings',
            target_id: 'stripe',
            details: {
                environment: isSecretLive ? 'live' : 'test',
                updatedKeys: ['publishableKey', 'secretKey', webhookSecret ? 'webhookSecret' : null].filter(Boolean)
            }
        }).catch(e => console.warn('Audit log failed:', e));

        res.json({
            success: true,
            message: 'Stripe keys saved to database successfully. Changes are active immediately.',
            environment: isSecretLive ? 'live' : 'test',
            isFromDB: true
        });
    } catch (error) {
        console.error('[Platform Settings] Error updating Stripe config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/platform-settings/all
 * Get all platform configuration (masked for security)
 */
router.get('/all', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data: dbSettings } = await supabase
            .from('platform_settings')
            .select('key, value');

        const dbConfig = {};
        (dbSettings || []).forEach(row => {
            dbConfig[row.key] = row.value;
        });

        const stripeConfig = dbConfig.stripe_config || {};
        const publishableKey = stripeConfig.publishableKey || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
        const secretKey = stripeConfig.secretKey || process.env.STRIPE_SECRET_KEY || '';
        const webhookSecret = stripeConfig.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';

        res.json({
            stripe: {
                publishableKey,
                publishableKeyMasked: maskKey(publishableKey),
                secretKeyMasked: maskKey(secretKey),
                webhookSecretMasked: maskKey(webhookSecret),
                isConfigured: !!(publishableKey && secretKey),
                isFromDB: !!stripeConfig.publishableKey,
                environment: secretKey.startsWith('sk_live') ? 'live' : 'test'
            },
            resend: {
                isConfigured: !!process.env.RESEND_API_KEY,
                senderEmail: process.env.SENDER_EMAIL || '',
                apiKeyMasked: maskKey(process.env.RESEND_API_KEY)
            },
            frontend: {
                url: process.env.FRONTEND_URL || ''
            }
        });
    } catch (error) {
        console.error('[Platform Settings] Error fetching all config:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
