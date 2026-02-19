import express from 'express';
import fs from 'fs';
import path from 'path';
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

/**
 * GET /api/platform-settings/stripe
 * Get current Stripe configuration (masked for security)
 */
router.get('/stripe', verifyToken, requireAdmin, (req, res) => {
    try {
        const stripePublishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
        const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
        const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

        // Mask keys for security (show only last 4 characters)
        const maskKey = (key) => {
            if (!key) return '';
            if (key.length <= 8) return '*'.repeat(key.length);
            return key.slice(0, 7) + '...' + key.slice(-4);
        };

        res.json({
            publishableKey: stripePublishableKey,
            publishableKeyMasked: maskKey(stripePublishableKey),
            secretKeyMasked: maskKey(stripeSecretKey),
            webhookSecretMasked: maskKey(stripeWebhookSecret),
            isConfigured: !!(stripePublishableKey && stripeSecretKey),
            environment: stripeSecretKey.startsWith('sk_live') ? 'live' : 'test'
        });
    } catch (error) {
        console.error('[Platform Settings] Error fetching Stripe config:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/platform-settings/stripe
 * Update Stripe configuration in .env file
 * IMPORTANT: Requires backend restart to take effect
 */
router.put('/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { publishableKey, secretKey, webhookSecret } = req.body;

        if (!publishableKey || !secretKey) {
            return res.status(400).json({ 
                error: 'Both publishable key and secret key are required' 
            });
        }

        // Validate key formats
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

        // Check if mixing test and live keys
        const isPublishableLive = publishableKey.startsWith('pk_live');
        const isSecretLive = secretKey.startsWith('sk_live');
        
        if (isPublishableLive !== isSecretLive) {
            return res.status(400).json({ 
                error: 'Cannot mix test and live keys. Both must be test or both must be live.' 
            });
        }

        // Read current .env file
        const envPath = path.join(process.cwd(), 'backend', '.env');
        let envContent = '';
        
        try {
            envContent = fs.readFileSync(envPath, 'utf8');
        } catch (error) {
            return res.status(500).json({ error: 'Could not read .env file' });
        }

        // Update or add the Stripe keys
        const lines = envContent.split('\n');
        let updatedLines = [];
        let foundPublishable = false;
        let foundSecret = false;
        let foundWebhook = false;

        for (const line of lines) {
            if (line.startsWith('VITE_STRIPE_PUBLISHABLE_KEY=')) {
                updatedLines.push(`VITE_STRIPE_PUBLISHABLE_KEY=${publishableKey}`);
                foundPublishable = true;
            } else if (line.startsWith('STRIPE_SECRET_KEY=')) {
                updatedLines.push(`STRIPE_SECRET_KEY=${secretKey}`);
                foundSecret = true;
            } else if (line.startsWith('STRIPE_WEBHOOK_SECRET=') && webhookSecret) {
                updatedLines.push(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
                foundWebhook = true;
            } else {
                updatedLines.push(line);
            }
        }

        // Add keys if they weren't found
        if (!foundPublishable) {
            updatedLines.push(`VITE_STRIPE_PUBLISHABLE_KEY=${publishableKey}`);
        }
        if (!foundSecret) {
            updatedLines.push(`STRIPE_SECRET_KEY=${secretKey}`);
        }
        if (webhookSecret && !foundWebhook) {
            updatedLines.push(`STRIPE_WEBHOOK_SECRET=${webhookSecret}`);
        }

        // Write back to .env file
        try {
            fs.writeFileSync(envPath, updatedLines.join('\n'));
        } catch (error) {
            console.error('[Platform Settings] Error writing .env:', error);
            return res.status(500).json({ error: 'Could not write to .env file' });
        }

        // Log the action
        const supabase = (await import('../services/supabase.js')).default;
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
            message: 'Stripe keys updated successfully in .env file',
            environment: isSecretLive ? 'live' : 'test',
            restartRequired: true,
            note: 'Backend restart required for changes to take effect. Changes will be applied automatically on next deployment.'
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
router.get('/all', verifyToken, requireAdmin, (req, res) => {
    try {
        const maskKey = (key) => {
            if (!key) return '';
            if (key.length <= 8) return '*'.repeat(key.length);
            return key.slice(0, 7) + '...' + key.slice(-4);
        };

        res.json({
            stripe: {
                publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
                publishableKeyMasked: maskKey(process.env.VITE_STRIPE_PUBLISHABLE_KEY),
                secretKeyMasked: maskKey(process.env.STRIPE_SECRET_KEY),
                webhookSecretMasked: maskKey(process.env.STRIPE_WEBHOOK_SECRET),
                isConfigured: !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY && process.env.STRIPE_SECRET_KEY),
                environment: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test'
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
