import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.trim();
  if (!cleanLine || cleanLine.startsWith('#')) return;
  const eqIdx = cleanLine.indexOf('=');
  if (eqIdx > 0) {
    const key = cleanLine.substring(0, eqIdx).trim();
    const val = cleanLine.substring(eqIdx + 1).trim();
    env[key] = val;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const run = async () => {
  const querySnapshot = await getDocs(collection(db, "products"));
  const docs = querySnapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
  // Sort docs by numeric ID
  docs.sort((a, b) => Number(a.id) - Number(b.id));
  console.log(`Total Firestore documents found: ${docs.length}`);
  console.log("Documents in Firestore:");
  docs.forEach(d => {
    console.log(`- ID: ${d.id}, Title: ${d.title}`);
  });
};

run().catch(console.error);
