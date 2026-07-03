import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Manually parse .env file
const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
  console.error(`[Error] Env file not found at: ${envPath}`);
  process.exit(1);
}

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

// 2. Initialize Firebase
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log(`[Info] Initializing Firebase for Project ID: ${firebaseConfig.projectId}...`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Load products.json
const productsPath = path.resolve(__dirname, '../src/data/products.json');
if (!fs.existsSync(productsPath)) {
  console.error(`[Error] Products JSON file not found at: ${productsPath}`);
  process.exit(1);
}

const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
console.log(`[Info] Loaded ${products.length} products from JSON.`);

// 4. Seeder runner
const seedDatabase = async () => {
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`[Info] Starting Firestore Upload...`);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const percentage = Math.round(((i + 1) / products.length) * 100);

    if (product.id === undefined || product.id === null) {
      console.warn(`[Skip] Product at index ${i} lacks a valid ID.`);
      skipped++;
      continue;
    }

    const docId = String(product.id);

    try {
      const docRef = doc(db, 'products', docId);

      const creatorName = product.seller || 'Sophia Vance';
      const creatorId = product.vendor_id || creatorName.toLowerCase().replace(/\s+/g, '-');

      // Map and structure document to satisfy frontend UI rendering while keeping all original data
      const firestoreDoc = {
        ...product,
        id: docId,
        preview: product.preview || product.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        features: product.features || [
          "Premium high-fidelity design source files",
          "Fully customizable layers and component variants",
          "Lifetime access license with free future revisions",
          "Comprehensive documentation and setup instructions"
        ],
        compatibility: product.compatibility || (
          product.category === 'UI Kits' ? ["Figma", "Sketch"] :
          product.category === 'React Templates' ? ["React", "Tailwind CSS", "Vite"] :
          product.category === 'Next.js Templates' ? ["Next.js", "React", "Tailwind CSS"] :
          product.category === 'Canva Templates' ? ["Canva"] :
          product.category === 'Notion Templates' ? ["Notion"] :
          ["Web", "Figma"]
        ),
        fileSize: product.fileSize || '38.4 MB',
        reviews: Number(product.reviews) || Math.floor((Number(product.downloads) || 120) * 0.08) || 12,
        badge: product.badge || (product.rating >= 4.8 ? 'Best Seller' : product.featured ? 'Featured' : ''),
        version: product.version || 'v1.0.0',
        lastUpdated: product.lastUpdated || 'June 2026',
        creator: {
          id: creatorId,
          name: creatorName,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${creatorId}`,
          bio: `Elite creator producing top-tier assets in ${product.category || 'Digital Assets'}.`,
          banner: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
          sales: product.downloads ? `${Math.round(product.downloads * 1.25)}+` : '450+',
          rating: `${product.rating || 4.8} ★`
        },
        createdAt: product.createdAt || new Date().toISOString()
      };

      await setDoc(docRef, firestoreDoc);
      console.log(`[Success] [${percentage}%] Seeded "${product.title}" (${docId})`);
      uploaded++;
    } catch (error) {
      console.error(`[Error] Failed uploading "${product.title}": ${error.message}`);
      failed++;
    }
  }

  console.log(`\n[Summary] Seeding process complete.`);
  console.log(`- Seeded: ${uploaded}`);
  console.log(`- Skipped (Duplicates/Invalid): ${skipped}`);
  console.log(`- Failed: ${failed}`);
  process.exit(0);
};

seedDatabase().catch(err => {
  console.error('[Fatal Error] Seeder failed:', err);
  process.exit(1);
});
