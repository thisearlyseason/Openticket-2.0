
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';
// @ts-ignore
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// @ts-ignore
import { getStorage } from 'firebase/storage';

// ------------------------------------------------------------------
// IMPORTANT: REPLACE THIS CONFIGURATION WITH YOUR FIREBASE PROJECT SETTINGS
// ------------------------------------------------------------------
// The current configuration uses a placeholder or specific project ID.
// If you see "auth/configuration-not-found", it means Google Auth is not enabled in the Firebase Console
// for the project ID listed below. You must use your OWN Firebase project where you have enabled Authentication.
const firebaseConfig = {
  apiKey: "AIzaSyDtnbTx4gTAC5ufD173Lt9IaiQfpZOQFyA",
  authDomain: "openticket-4f5bc.firebaseapp.com",
  projectId: "openticket-4f5bc",
  storageBucket: "openticket-4f5bc.firebasestorage.app",
  messagingSenderId: "926069496604",
  appId: "1:926069496604:web:d898aa1f91b31db38e78d9",
  measurementId: "G-S25BFPR85R"
};

// Explicitly initialize with null to avoid "Missing initializer" const errors if variable type changes
let app: any = null;
let dbInstance: any = null;
let authInstance: any = null;
let googleProviderInstance: any = null;
let storageInstance: any = null;

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
  storageInstance = getStorage(app);
  googleProviderInstance = new GoogleAuthProvider();
  console.log("Firebase App Initialized");
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

// Export instances
export const db = dbInstance;
export const auth = authInstance;
export const storage = storageInstance;
export const googleProvider = googleProviderInstance;
