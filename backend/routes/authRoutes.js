import express from 'express';
const router = express.Router();
import * as profileController from '../controllers/profileController.js';
import * as authController from '../controllers/authController.js';
import verifyToken from '../middlewares/authMiddleware.js';
import admin from 'firebase-admin';

// Authentication routes
router.post('/login', authController.login);
router.post('/signup', authController.signup);

// Special setup route (no auth required, but needs setup key)
router.post('/setup-admin', profileController.setupSuperAdmin);

router.post('/sync', verifyToken, profileController.syncProfile);
router.get('/me', verifyToken, profileController.getProfile);
router.put('/profiles/:id', verifyToken, profileController.updateProfile);
router.get('/profiles/:id', profileController.getProfileById);

/**
 * POST /api/auth/change-password
 * Change user password (requires current password verification via Firebase)
 */
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user?.uid;

        if (!userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }

        // Validate new password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' 
            });
        }

        // Get the user's email to verify current password
        const userRecord = await admin.auth().getUser(userId);
        const userEmail = userRecord.email;

        if (!userEmail) {
            return res.status(400).json({ error: 'User email not found' });
        }

        // Note: Firebase Admin SDK doesn't support password verification directly
        // The frontend handles current password verification by re-authenticating
        // Here we just update the password after frontend verification

        // Update password in Firebase
        await admin.auth().updateUser(userId, {
            password: newPassword
        });

        console.log(`[Auth] Password changed for user: ${userId}`);

        res.json({ 
            success: true, 
            message: 'Password updated successfully' 
        });
    } catch (error) {
        console.error('[Auth] Password change failed:', error);
        
        if (error.code === 'auth/weak-password') {
            return res.status(400).json({ error: 'Password is too weak' });
        }
        if (error.code === 'auth/user-not-found') {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.status(500).json({ error: error.message || 'Failed to change password' });
    }
});

export default router;
