import {initializeApp} from 'firebase/app';
import {getAuth, connectAuthEmulator} from '@firebase/auth';
import {getFirestore, connectFirestoreEmulator} from 'firebase/firestore';
import {getFunctions, connectFunctionsEmulator} from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore
export const db = getFirestore(app);

// Initialize Cloud Functions
export const functions = getFunctions(app, 'us-central1');

// Connect to emulators in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Uncomment these lines to use Firebase emulators
  // connectAuthEmulator(auth, 'http://localhost:9099');
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectFunctionsEmulator(functions, 'localhost', 5001);
}

export default app;