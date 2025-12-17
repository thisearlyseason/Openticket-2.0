
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// IMPORTANT: REPLACE THIS CONFIGURATION WITH YOUR FIREBASE PROJECT SETTINGS
// ------------------------------------------------------------------
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

try {
  // Initialize Firebase
  app = initializeApp(firebaseConfig);
  dbInstance = getFirestore(app);
  console.log("Firebase App Initialized");
} catch (e) {
  console.error("Firebase Initialization Failed:", e);
}

// Export firestore instance
export const db = dbInstance;
