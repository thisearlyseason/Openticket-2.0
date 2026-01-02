import admin from '../services/firebase.js';

const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Auth] No token provided in request');
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Check if token looks valid (basic sanity check)
    if (!token || token === 'null' || token === 'undefined' || token.length < 100) {
        console.log('[Auth] Invalid token format:', token?.substring(0, 20) + '...');
        return res.status(401).json({ error: 'Invalid token format' });
    }
    
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('[Auth] Error verifying Firebase token:', error.code, error.message);
        res.status(403).json({ error: 'Unauthorized', code: error.code });
    }
};

export default verifyFirebaseToken;
