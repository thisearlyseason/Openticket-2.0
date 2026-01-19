import admin from '../services/firebase.js';
import supabase from '../services/supabase.js';

// Module reload timestamp: 2026-01-19T19:55:00Z
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    // Check if Authorization header exists
    if (!authHeader) {
        console.log('[Auth] Missing Authorization header');
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    
    // Check if it's Bearer format
    if (!authHeader.startsWith('Bearer ')) {
        console.log('[Auth] Invalid Bearer format');
        return res.status(401).json({ error: 'Invalid Bearer format - expected "Bearer <token>"' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Check if token exists
    if (!token || token === 'null' || token === 'undefined') {
        console.log('[Auth] Token is null or undefined');
        return res.status(401).json({ error: 'Token is missing or invalid' });
    }
    
    // Try Supabase authentication first (shorter tokens, JWT format)
    try {
        console.log('[Auth] Attempting Supabase verification, token length:', token.length);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error) {
            console.log('[Auth] Supabase error:', error.message);
        }
        
        if (user && !error) {
            console.log('[Auth] ✅ Supabase token verified for user:', user.id, user.email);
            // Format user object to match Firebase structure
            req.user = {
                uid: user.id,
                email: user.email,
                email_verified: user.email_confirmed_at != null,
                ...user.user_metadata
            };
            return next();
        }
    } catch (supabaseError) {
        console.log('[Auth] Supabase verification exception:', supabaseError.message);
    }
    
    // Fallback to Firebase authentication (longer tokens)
    if (token.length > 100) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            console.log('[Auth] Firebase token verified for user:', decodedToken.uid);
            req.user = decodedToken;
            return next();
        } catch (firebaseError) {
            console.error('[Auth] Firebase token verification failed:', firebaseError.code, firebaseError.message);
        }
    }
    
    // Both authentication methods failed
    return res.status(401).json({ 
        error: 'Token verification failed', 
        message: 'Invalid or expired authentication token'
    });
};

export default verifyToken;
