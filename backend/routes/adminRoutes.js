import express from 'express';
import * as adminController from '../controllers/adminController.js';
import verifyToken from '../middlewares/authMiddleware.js';

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

export default router;
