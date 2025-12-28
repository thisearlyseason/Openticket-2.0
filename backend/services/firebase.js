import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('CRITICAL: FIREBASE_PRIVATE_KEY is missing');
}

// Debug log removed after verification
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!admin.apps.length) {
    try {
        if (!rawKey || !projectId || !clientEmail) {
            throw new Error('Missing Firebase configuration (PRIVATE_KEY, PROJECT_ID, or CLIENT_EMAIL)');
        }

        const processedKey = rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: processedKey,
            })
        });
        console.log('Firebase Admin Initialized Successfully');
    } catch (error) {
        console.error('FIREBASE INIT ERROR:', error.message);
    }
}

export default admin;
