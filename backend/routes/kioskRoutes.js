import express from 'express';
import {
    generateKioskToken,
    validateKioskToken,
    revokeKioskToken,
    scanTicket,
    searchGuest,
    checkInGuest,
    processPayment,
    getKioskLogs,
    getCurrentToken
} from '../controllers/kioskController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Organizer routes (require authentication)
router.post('/generate', protect, generateKioskToken);
router.post('/revoke', protect, revokeKioskToken);
router.get('/logs/:eventId', protect, getKioskLogs);
router.get('/token/:eventId', protect, getCurrentToken);

// Kiosk routes (token-based, no user auth required)
router.post('/validate', validateKioskToken);
router.post('/scan', scanTicket);
router.get('/guest-search', searchGuest);
router.post('/checkin', checkInGuest);
router.post('/payment', processPayment);

export default router;
