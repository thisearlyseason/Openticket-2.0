import express from 'express';
import * as adminController from '../controllers/adminController.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

// Middleware to ensure user is admin
const requireAdmin = async (req, res, next) => {
    // verifyToken middleware attaches req.user (which contains uid/email from Firebase token)
    // We need to check the DB to see if this user has 'admin' or 'superadmin' role.
    // However, verifyToken usually just validates JWT.

    // NOTE: req.user from verifyToken might just be the decoded token.
    // If the token has custom claims, great. If not, we query the profile.

    // For safety, let's query the profile here.
    try {
        const { data: user, error } = await import('../services/supabase.js').then(m => m.default.from('profiles').select('role, isAdmin').eq('id', req.user.uid).single());

        if (error || !user) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        if (user.role === 'superadmin' || user.role === 'admin' || user.isAdmin) {
            next();
        } else {
            return res.status(403).json({ error: 'Requires Admin privileges.' });
        }
    } catch (e) {
        console.error("Admin verification failed", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

router.get('/users', verifyToken, requireAdmin, adminController.getAllUsers);
router.get('/events', verifyToken, requireAdmin, adminController.getAllEvents);
router.get('/registrations', verifyToken, requireAdmin, adminController.getAllRegistrations);
router.get('/financials', verifyToken, requireAdmin, adminController.getFinancialStats);

export default router;
