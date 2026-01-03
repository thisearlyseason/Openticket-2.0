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

export default router;
