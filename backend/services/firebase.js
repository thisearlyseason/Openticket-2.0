import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('CRITICAL: FIREBASE_PRIVATE_KEY is missing');
}

// Debug log removed after verification
const rawKey = process.env.FIREBASE_PRIVATE_KEY;

const processedKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
    : undefined;

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: processedKey,
        })
    });
    console.log('Firebase Admin Initialized Successfully');
} catch (error) {
    console.error('FIREBASE INIT ERROR:', error);
}

export default admin;
