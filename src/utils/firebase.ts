import {initializeApp} from 'firebase/app';
import {getAuth} from '@firebase/auth';
import {getFirestore} from 'firebase/firestore';
import {getFunctions} from 'firebase/functions';

// Firebase configuration - ensure these are set in your environment
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Validate required configuration values
const validateFirebaseConfig = () => {
  if (!firebaseConfig.apiKey) {
    throw new Error('FIREBASE_API_KEY is required but not provided');
  }
  if (!firebaseConfig.projectId) {
    throw new Error('FIREBASE_PROJECT_ID is required but not provided');
  }
  if (!firebaseConfig.authDomain) {
    throw new Error('FIREBASE_AUTH_DOMAIN is required but not provided');
  }
};

// Initialize Firebase
let app;
let auth;
let db;
let functions;

try {
  // Validate configuration before initialization
  validateFirebaseConfig();

  // Create Firebase app instance
  app = initializeApp(firebaseConfig);

  // Initialize Firebase services
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app, 'us-central1');

  console.log('✅ Firebase initialized successfully');

} catch (error) {
  console.error('🔴 Failed to initialize Firebase:', error);

  // Provide helpful setup instructions
  console.error(`
📝 To fix this issue:
1. Copy .env.example to .env
2. Fill in your actual Firebase configuration values from the Firebase Console
3. Ensure all required fields are set

Required configuration values:
- FIREBASE_API_KEY (get from Firebase Console > Project Settings > General)
- FIREBASE_AUTH_DOMAIN (usually: your-project-id.firebaseapp.com)
- FIREBASE_PROJECT_ID (your Firebase project ID)

Optional values:
- FIREBASE_STORAGE_BUCKET
- FIREBASE_MESSAGING_SENDER_ID
- FIREBASE_APP_ID
  `);

  throw error;
}

// Export Firebase services
export { auth, db, functions };
export default app;