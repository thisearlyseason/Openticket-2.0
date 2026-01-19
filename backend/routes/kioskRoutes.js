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
    getCurrentToken,
    getKioskStatus
} from '../controllers/kioskController.js';
import supabase from '../services/supabase.js';
import admin from '../services/firebase.js';

// Inline auth middleware with Supabase support  
const verifyToken = async (req, res, next) => {
    console.log('[KioskAuth] Middleware called');
    const authHeader = req.headers.authorization;
    console.log('[KioskAuth] Auth header:', authHeader ? 'present' : 'missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[KioskAuth] Invalid auth header format');
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[KioskAuth] Token length:', token.length);
    
    if (!token || token === 'null' || token === 'undefined') {
        return res.status(401).json({ error: 'Token is missing' });
    }

    // Try Supabase authentication first
    try {
        console.log('[KioskAuth] Trying Supabase authentication...');
        const { data: { user }, error } = await supabase.auth.getUser(token);
        console.log('[KioskAuth] Supabase result - user:', user ? user.id : 'null', 'error:', error ? error.message : 'none');
        
        if (user && !error) {
            console.log('[KioskAuth] ✅ Supabase auth successful for:', user.email);
            req.user = {
                uid: user.id,
                email: user.email,
                email_verified: user.email_confirmed_at != null
            };
            return next();
        }
    } catch (supabaseError) {
        console.log('[KioskAuth] Supabase exception:', supabaseError.message);
    }

    // Fallback to Firebase
    console.log('[KioskAuth] Trying Firebase authentication...');
    if (token.length > 100) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            console.log('[KioskAuth] ✅ Firebase auth successful');
            req.user = decodedToken;
            return next();
        } catch (firebaseError) {
            console.log('[KioskAuth] Firebase failed:', firebaseError.message);
        }
    }

    console.log('[KioskAuth] ❌ Both auth methods failed');
    return res.status(401).json({ error: 'Token verification failed' });
};

const router = express.Router();

// Organizer routes (require authentication)
router.post('/generate', verifyToken, generateKioskToken);
router.post('/revoke', verifyToken, revokeKioskToken);
router.get('/logs/:eventId', verifyToken, getKioskLogs);
router.get('/token/:eventId', verifyToken, getCurrentToken);
router.get('/status/:eventId', verifyToken, getKioskStatus);

// Kiosk routes (token-based, no user auth required)
router.post('/validate', validateKioskToken);
router.post('/scan', scanTicket);
router.get('/guest-search', searchGuest);
router.post('/checkin', checkInGuest);
router.post('/payment', processPayment);

export default router;
