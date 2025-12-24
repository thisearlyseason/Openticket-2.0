import admin from 'firebase-admin';

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('CRITICAL: FIREBASE_PRIVATE_KEY is missing');
}

admin.initializeApp({
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

const rawKey = process.env.FIREBASE_PRIVATE_KEY;
if (rawKey) {
    console.log(`[DEBUG] Raw Key Length: ${rawKey.length}`);
    console.log(`[DEBUG] Raw Key Start: ${JSON.stringify(rawKey.substring(0, 50))}`);
    console.log(`[DEBUG] Raw Key End: ${JSON.stringify(rawKey.substring(rawKey.length - 50))}`);
} else {
    console.log('[DEBUG] FIREBASE_PRIVATE_KEY is undefined/empty');
}

const processedKey = rawKey
    ? rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
    : undefined;

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: processedKey,
    })
});
});

export default admin;
