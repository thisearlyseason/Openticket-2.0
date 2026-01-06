/**
 * Push Notification Routes
 */

import express from 'express';
import * as pushController from '../controllers/pushController.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route - get VAPID public key
router.get('/vapid-key', pushController.getVapidKey);

// Protected routes - require authentication
router.post('/subscribe', verifyToken, pushController.subscribe);
router.post('/unsubscribe', verifyToken, pushController.unsubscribe);
router.post('/test', verifyToken, pushController.sendTestNotification);
router.get('/status', verifyToken, pushController.getStatus);

// Organizer routes
router.post('/send-reminder', verifyToken, pushController.sendEventReminder);

export default router;
