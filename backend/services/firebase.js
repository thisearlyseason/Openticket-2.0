import admin from 'firebase-admin';

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('CRITICAL: FIREBASE_PRIVATE_KEY is missing');
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle Vercel's handling of newlines in env vars
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
});

export default admin;
