import express from 'express';
import * as adminController from '../controllers/adminController.js';
import verifyToken from '../middlewares/authMiddleware.js';
import { AuditLogService } from '../services/auditLogService.js';

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data: user, error } = await supabase
            .from('profiles')
            .select('role, is_admin')
            .eq('id', req.user.uid)
            .single();

        if (error || !user) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        if (user.role === 'superadmin' || user.role === 'admin' || user.is_admin) {
            next();
        } else {
            return res.status(403).json({ error: 'Requires Admin privileges.' });
        }
    } catch (e) {
        console.error("Admin verification failed", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Admin-only routes
router.get('/users', verifyToken, requireAdmin, adminController.getAllUsers);
router.get('/events', verifyToken, requireAdmin, adminController.getAllEvents);
router.get('/registrations', verifyToken, requireAdmin, adminController.getAllRegistrations);
router.get('/financials', verifyToken, requireAdmin, adminController.getFinancialStats);

// Event financials (owner or admin)
router.get('/events/:eventId/financials', verifyToken, adminController.getEventFinancials);

// Audit Log Routes
router.get('/audit-logs', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { limit = 100, offset = 0, transactionType, actorType, eventId } = req.query;
        const result = await AuditLogService.getAllLogs(
            parseInt(limit),
            parseInt(offset),
            { transactionType, actorType, eventId }
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/audit-logs/overview', verifyToken, requireAdmin, async (req, res) => {
    try {
        const overview = await AuditLogService.getSuperadminOverview();
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Organizer audit logs (own logs only)
router.get('/organizer/audit-logs', verifyToken, async (req, res) => {
    try {
        const logs = await AuditLogService.getOrganizerLogs(req.user.uid);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/organizer/financial-summary', verifyToken, async (req, res) => {
    try {
        const summary = await AuditLogService.getOrganizerSummary(req.user.uid);
        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Promo Code Management (Admin only)
router.get('/promo-codes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data, error } = await supabase
            .from('promo_codes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json({ promoCodes: data || [] });
    } catch (error) {
        // If table doesn't exist, return empty array
        if (error.message?.includes('does not exist')) {
            return res.json({ promoCodes: [] });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/promo-codes', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const promoCode = req.body;
        
        const { data, error } = await supabase
            .from('promo_codes')
            .insert({
                id: promoCode.id,
                code: promoCode.code,
                type: promoCode.type,
                value: promoCode.value,
                target: promoCode.target,
                target_plans: promoCode.targetPlans,
                usage_limit: promoCode.usageLimit,
                usage_count: 0,
                expires_at: promoCode.expiresAt,
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) throw error;
        res.json({ promoCode: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/promo-codes/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('promo_codes')
            .update({
                is_active: updates.isActive,
                usage_limit: updates.usageLimit,
                expires_at: updates.expiresAt
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ promoCode: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/promo-codes/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        
        const { error } = await supabase
            .from('promo_codes')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Affiliate Payout Management
router.get('/affiliate-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            if (error.message?.includes('does not exist')) {
                return res.json({ payouts: [] });
            }
            throw error;
        }
        res.json({ payouts: data || [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate-payouts', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const payout = req.body;
        
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .insert({
                id: payout.id,
                affiliate_id: payout.affiliateId,
                affiliate_name: payout.affiliateName,
                affiliate_code: payout.affiliateCode,
                amount: payout.amount,
                method: payout.method,
                status: payout.status,
                notes: payout.notes,
                created_at: payout.createdAt,
                paid_at: payout.paidAt
            })
            .select()
            .single();
        
        if (error) throw error;
        
        // Also log to audit_logs
        await supabase.from('audit_logs').insert({
            timestamp: new Date().toISOString(),
            actor_id: req.user.uid,
            actor_type: 'admin',
            action: 'affiliate_payout',
            target_type: 'affiliate',
            target_id: payout.affiliateId,
            details: {
                amount: payout.amount,
                method: payout.method,
                affiliateCode: payout.affiliateCode
            }
        });
        
        res.json({ payout: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/affiliate-payouts/:id', verifyToken, requireAdmin, async (req, res) => {
    try {
        const supabase = (await import('../services/supabase.js')).default;
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('affiliate_payouts')
            .update({
                status: updates.status,
                paid_at: updates.paidAt
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ payout: data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/affiliate-payouts/stripe', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { affiliateId, amount } = req.body;
        const supabase = (await import('../services/supabase.js')).default;
        
        // Get affiliate's Stripe Connect ID
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('stripe_connect_id')
            .eq('id', affiliateId)
            .single();
        
        if (profileError || !profile?.stripe_connect_id) {
            return res.status(400).json({ error: 'Affiliate does not have Stripe connected' });
        }
        
        // Initialize Stripe and create transfer
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: 'usd',
            destination: profile.stripe_connect_id,
            description: `Affiliate payout for ${affiliateId}`
        });
        
        res.json({ success: true, transferId: transfer.id });
    } catch (error) {
        console.error('Stripe payout error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
