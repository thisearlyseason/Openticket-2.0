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
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

// Organizer routes (require authentication)
router.post('/generate', verifyToken, generateKioskToken);
router.post('/revoke', verifyToken, revokeKioskToken);
router.get('/logs/:eventId', verifyToken, getKioskLogs);
router.get('/token/:eventId', verifyToken, getCurrentToken);

// Kiosk routes (token-based, no user auth required)
router.post('/validate', validateKioskToken);
router.post('/scan', scanTicket);
router.get('/guest-search', searchGuest);
router.post('/checkin', checkInGuest);
router.post('/payment', processPayment);

export default router;
