import { initializeApp, getApps } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const requiredEnv = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
];

const missingEnv = requiredEnv.filter(key => !import.meta.env[key]);
if (missingEnv.length > 0) {
  throw new Error(
    `[Firebase Initialization Failure] Missing critical environment variables: ${missingEnv.join(", ")}. ` +
    `Please configure them in your frontend/.env file.`
  );
}

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Prevent duplicate app initialization on HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth    = getAuth(app);

// Enforce browserLocalPersistence globally so Firebase auth sessions persist in IndexedDB across browser restarts
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn('[Firebase] Initial setPersistence warning:', err?.message);
});

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const analytics = null; // initialized lazily where needed
export { app };
