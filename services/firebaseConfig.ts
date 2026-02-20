
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// @ts-ignore
import { getStorage } from 'firebase/storage';

// ------------------------------------------------------------------
// Firebase Configuration - Uses Environment Variables for Deployment
// ------------------------------------------------------------------
// Set these in your deployment platform (Vercel, etc.) or in .env file:
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDtnbTx4gTAC5ufD173Lt9IaiQfpZOQFyA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "openticket-4f5bc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "openticket-4f5bc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "openticket-4f5bc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "926069496604",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:926069496604:web:d898aa1f91b31db38e78d9",
  // measurementId intentionally omitted — auto-initializes Analytics which
  // triggers addEventListener on DOM before React mounts
};

let app: any = null;
let authInstance: any = null;
let googleProviderInstance: any = null;
let storageInstance: any = null;

try {
  app = initializeApp(firebaseConfig);
  // Use getAuth (idempotent) instead of initializeAuth to ensure session is
  // properly restored from localStorage on page load
  authInstance = getAuth(app);
  storageInstance = getStorage(app);
  googleProviderInstance = new GoogleAuthProvider();
  console.log("Firebase App Initialized (Auth & Storage Only)");
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

// Export instances
// export const db = dbInstance; // DEPRECATED: Use Supabase
export const auth = authInstance;
export const storage = storageInstance;
export const googleProvider = googleProviderInstance;

export const getAuthToken = async () => {
  if (!authInstance?.currentUser) return null;
  try {
    // Force refresh the token to ensure it's valid
    return await authInstance.currentUser.getIdToken(true);
  } catch (e) {
    console.error("Error getting auth token:", e);
    return null;
  }
};
