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
  const productsPath = path.resolve(__dirname, '../src/data/products.json');
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
  console.log(`Local products count: ${products.length}`);
  
  const uniqueIds = new Set(products.map(p => String(p.id)));
  console.log(`Unique IDs in JSON: ${uniqueIds.size}`);

  const querySnapshot = await getDocs(collection(db, "products"));
  console.log(`Firestore documents count: ${querySnapshot.docs.length}`);
  
  const firestoreIds = new Set(querySnapshot.docs.map(doc => doc.id));
  
  const missing = [];
  for (const id of uniqueIds) {
    if (!firestoreIds.has(id)) {
      missing.push(id);
    }
  }
  console.log(`Missing in Firestore: ${missing.length}`, missing);
};

run().catch(console.error);
