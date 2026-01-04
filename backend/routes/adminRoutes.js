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

export default router;
