import admin from '../services/firebase.js';

const verifyFirebaseToken = async (req, res, next) => {
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
    
    // Check if token exists and has reasonable length (Firebase tokens are typically 900+ chars)
    if (!token || token === 'null' || token === 'undefined') {
        console.log('[Auth] Token is null or undefined');
        return res.status(401).json({ error: 'Token is missing or invalid' });
    }
    
    if (token.length < 100) {
        console.log('[Auth] Token too short, likely invalid');
        return res.status(401).json({ error: 'Token verification failed - token too short' });
    }
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('[Auth] Token verification failed:', error.code, error.message);
        return res.status(401).json({ 
            error: 'Token verification failed', 
            code: error.code,
            message: error.message 
        });
    }
};

export default verifyFirebaseToken;
