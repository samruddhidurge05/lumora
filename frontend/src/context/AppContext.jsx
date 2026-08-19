import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { getProducts } from '../services/productService';
import rawProductsData from '../data/products.json';
import { getDashboardPath } from '../utils/roleRouter';
import { onPurchaseComplete } from '../services/ecosystemService';
import { useAuth } from './AuthContext';
import { getCartApi, addCartItemApi, removeCartItemApi, clearCartApi } from '../api/cartApi';
import { backendFetch } from '../utils/api';
import { getMyOrdersApi, createOrderApi } from '../api/ordersApi';
import { db } from '../firebase';
import { collection, onSnapshot, query, doc, where } from 'firebase/firestore';

// Canonical marketplace products are loaded directly from products.json and backend PostgreSQL DB
const PRODUCTS = [];

// ─── Enrichment helpers ───────────────────────────────────────────────
const CREATOR_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
];
const CREATOR_BANNERS = [
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1200&q=80',
];
const SAMPLE_COMMENTS = [
  'Absolutely premium quality. Worth every rupee!',
  'Clean, well-structured, and easy to customise.',
  'Saved me days of design work. Highly recommended.',
  'Best digital product I have purchased this year.',
  'Excellent documentation and beautiful design.',
  'Works exactly as advertised. Super clean code.',
  'The attention to detail is outstanding.',
  'Responsive and polished — my clients love it.',
];
const SAMPLE_USERS = ['Alex M.', 'Priya S.', 'Jordan K.', 'Sam T.', 'Chris R.', 'Maya L.', 'Rohan D.', 'Nina W.'];

// Backend origin for resolving relative /uploads/... image paths
// from product thumbnail/preview fields stored as local server paths.
const PROD_BACKEND_ORIGIN = 'https://lumora-backend-8mf6.onrender.com';

const _BACKEND_ORIGIN = (() => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return import.meta.env.VITE_BACKEND_ORIGIN || PROD_BACKEND_ORIGIN;
  }
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  if (base.startsWith('/')) {
    return import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:8000';
  }
  return base.replace(/\/api\/?$/, '');
})();

function _resolveProductImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  // Reject base64 data URIs — they are test/temp uploads and should never be used as display images
  if (url.startsWith('data:')) return null;
  // Strip localhost origins so the Vite proxy forwards /uploads/... to the backend.
  // Stored temp URLs like "http://localhost:8000/uploads/..." become "/uploads/..."
  // which the Vite proxy maps to the backend. This prevents 404s on the customer side.
  const localhostPattern = /^https?:\/\/localhost:\d+/;
  if (localhostPattern.test(url)) {
    url = url.replace(localhostPattern, '');
  }
  if (url.startsWith('http')) return url; // external CDN — pass through unchanged
  // Relative path like /uploads/vendors/1/products/5/images/uuid.png
  return `${_BACKEND_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

const DUMMY_TITLE_KEYWORDS = ['test product', 'self ref', 'quota failure', 'restart persistence', 'demo', 'placeholder', 'debug product', 'temp product'];

function isDummyProductRecord(p) {
  if (!p) return false;
  const t = (p.title || p.name || '').toLowerCase();
  return DUMMY_TITLE_KEYWORDS.some(kw => t.includes(kw));
}

// Pick the best image URL from a Firestore product document.
function _bestFirestoreImage(fd) {
  const candidates = [
    fd.thumbnail,
    fd.preview,
    ...(Array.isArray(fd.image_urls) ? fd.image_urls : []),
    ...(Array.isArray(fd.preview_images) ? fd.preview_images : []),
  ];
  for (const url of candidates) {
    if (!url) continue;
    if (url.startsWith('data:')) continue;              // skip base64 blobs
    if (url.includes('localhost')) continue;             // skip dev-only paths
    const resolved = _resolveProductImageUrl(url);
    if (resolved) return resolved;
  }
  return null;
}

function enrichRawProducts(raw) {
  if (!Array.isArray(raw)) return [];
  const cleanRaw = raw.filter(p => p && !isDummyProductRecord(p));
  return cleanRaw.map((p, idx) => {
    const creatorSeed = idx % CREATOR_AVATARS.length;
    // Support both camelCase (Firestore vendor docs) and snake_case (backend API)
    const sellerName = (typeof p.seller === 'object' ? p.seller?.name : p.seller) || p.vendor_id || 'Lumora Creator';
    const sellerId = String(sellerName).toLowerCase().replace(/\s+/g, '-');
    const isBackend = !isNaN(parseInt(p.id, 10));

    const numReviews = isBackend ? 0 : Math.max(2, Math.min(4, Math.round((p.rating || 4.5) * 0.8)));
    const reviewsList = p.reviewsList || (isBackend ? [] : Array.from({ length: numReviews }, (_, i) => ({
      user: SAMPLE_USERS[(idx + i) % SAMPLE_USERS.length],
      rating: Math.min(5, Math.max(3.5, (p.rating || 4.5) - (i * 0.2))),
      date: i === 0 ? '2 days ago' : i === 1 ? '1 week ago' : '3 weeks ago',
      comment: SAMPLE_COMMENTS[(idx + i) % SAMPLE_COMMENTS.length],
    })));

    return {
      ...p,
      id: String(p.id),
      title: p.title || p.name || 'Untitled Product',
      price: typeof p.price === 'string' ? parseFloat(p.price) || 0 : (p.price || 0),
      preview: (() => {
        const candidates = [p.preview, p.thumbnail, ...(Array.isArray(p.image_urls) ? p.image_urls : []), ...(Array.isArray(p.preview_images) ? p.preview_images : [])];
        for (const u of candidates) {
          if (!u) continue;
          const r = _resolveProductImageUrl(u);
          if (r) return r;
        }
        return null;
      })(),
      thumbnail: (() => {
        const candidates = [p.thumbnail, p.preview, ...(Array.isArray(p.image_urls) ? p.image_urls : []), ...(Array.isArray(p.preview_images) ? p.preview_images : [])];
        for (const u of candidates) {
          if (!u) continue;
          const r = _resolveProductImageUrl(u);
          if (r) return r;
        }
        return null;
      })(),
      // Filter gallery arrays: strip base64 blobs, localhost paths, resolve remaining URLs
      image_urls: Array.isArray(p.image_urls)
        ? p.image_urls.map(_resolveProductImageUrl).filter(Boolean)
        : [],
      preview_images: Array.isArray(p.preview_images)
        ? p.preview_images.map(_resolveProductImageUrl).filter(Boolean)
        : [],
      badge: p.badge || (p.trending ? 'Trending' : (p.newArrival || p.new_arrival) ? 'New' : p.featured ? 'Featured' : null),
      compatibility: p.compatibility || p.tags || [],
      // ── Feature fields — support both snake_case (backend) and camelCase (Firestore) ──
      features: Array.isArray(p.features) && p.features.length > 0
        ? p.features
        : Array.isArray(p.highlights) && p.highlights.length > 0
          ? p.highlights
          : (isBackend ? [] : [
              'Fully customizable layers & styles',
              'Commercial usage license included',
              'Lifetime updates & version revisions',
              'High-fidelity responsive components',
            ]),
      highlights: Array.isArray(p.highlights) ? p.highlights : [],
      // what_you_get — stored as snake_case from backend, camelCase from Firestore
      what_you_get: Array.isArray(p.what_you_get) ? p.what_you_get
                  : Array.isArray(p.whatYouGet)   ? p.whatYouGet
                  : [],
      whatYouGet:   Array.isArray(p.whatYouGet)   ? p.whatYouGet
                  : Array.isArray(p.what_you_get) ? p.what_you_get
                  : [],
      // system_requirements
      system_requirements: Array.isArray(p.system_requirements) ? p.system_requirements
                         : Array.isArray(p.systemRequirements)  ? p.systemRequirements
                         : [],
      systemRequirements:  Array.isArray(p.systemRequirements)  ? p.systemRequirements
                         : Array.isArray(p.system_requirements) ? p.system_requirements
                         : [],
      // Short description — prefer short_desc, fall back to first 150 chars of description
      short_desc: p.short_desc || p.shortDesc || (p.description ? p.description.substring(0, 150) : ''),
      shortDesc:  p.shortDesc  || p.short_desc || (p.description ? p.description.substring(0, 150) : ''),
      // Installation guide
      installation_guide: p.installation_guide || p.installationGuide || '',
      installationGuide:  p.installationGuide  || p.installation_guide || '',
      version: p.version || 'v1.0.0',
      fileSize: p.fileSize || p.file_size || '48 MB',
      // Normalize creation timestamp to camelCase for consistent sorting.
      // Legacy catalog items (IDs 1-100) get fixed historical dates in June 2026 so newly
      // created/uploaded products (IDs > 100 with July 2026+ timestamps) always rank first.
      createdAt: (() => {
        const rawTs = p.createdAt || p.created_at;
        const numId = parseInt(p.id, 10);
        if (!isNaN(numId) && numId <= 100) {
          const baseMs = new Date('2026-06-01T00:00:00Z').getTime();
          return new Date(baseMs + numId * 3600 * 1000).toISOString();
        }
        return rawTs || null;
      })(),
      lastUpdated: p.lastUpdated || p.last_updated || (p.createdAt || p.created_at ? new Date(p.createdAt || p.created_at).toLocaleDateString() : 'Recently'),
      reviews: isBackend ? (p.reviews || 0) : (p.reviews || Math.floor((p.downloads || 100) * 0.08)),
      downloads: p.downloads || 0,
      reviewsList,
      seller: typeof p.seller === 'object' ? p.seller : { name: sellerName },
      gradient: p.gradient || `linear-gradient(135deg, var(--color-lavender) 0%, var(--color-rose) 100%)`,
      creator: p.creator || {
        id: sellerId,
        name: sellerName,
        avatar: CREATOR_AVATARS[creatorSeed],
        banner: CREATOR_BANNERS[idx % CREATOR_BANNERS.length],
        bio: `Expert creator specialising in premium ${p.category || 'digital'} assets.`,
        sales: `${Math.floor((p.downloads || 500) / 10)}+`,
        rating: `${(p.rating || 4.5).toFixed(1)} ★`,
      },
    };
  });
}

// Enrich the JSON products once at module load
const ENRICHED_JSON_PRODUCTS = enrichRawProducts(rawProductsData);

const AppContext = createContext();

// Helper: deduplicate an array of products by id and normalized title, keeping single occurrence only
function dedupeById(arr) {
  if (!Array.isArray(arr)) return [];
  const seenIds = new Set();
  const seenTitles = new Set();
  return arr.filter(p => {
    if (!p) return false;
    const idKey = String(p.id);
    const titleKey = (p.title || p.name || '').toLowerCase().trim();
    if (seenIds.has(idKey)) return false;
    if (titleKey && seenTitles.has(titleKey)) return false;
    seenIds.add(idKey);
    if (titleKey) seenTitles.add(titleKey);
    return true;
  });
}

// Helper: sort pinned products to front (disabled)
function pinnedFirst(arr) {
  return arr;
}

// Helper: sort products by created_at / createdAt timestamp descending (newest first)
function sortByCreationDateDesc(list) {
  if (!Array.isArray(list)) return [];
  const cleanList = list.filter(p => p && p.id != null);
  return cleanList.sort((a, b) => {
    const tsA = a.createdAt || a.created_at;
    const tsB = b.createdAt || b.created_at;
    const ta = tsA ? new Date(tsA).getTime() : 0;
    const tb = tsB ? new Date(tsB).getTime() : 0;
    if (ta !== tb) return tb - ta;
    const numA = Number(a.id) || 0;
    const numB = Number(b.id) || 0;
    return numB - numA;
  });
}

export function AppContextProvider({ children }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Canonical products catalog: JSON products serve as base local catalog
  const [products, setProducts] = useState(pinnedFirst(dedupeById(sortByCreationDateDesc(ENRICHED_JSON_PRODUCTS))));

  // Track which product IDs came from the FastAPI backend (the authoritative source).
  const backendProductIdsRef = useRef(new Set());

  /**
   * refetchProducts — force a fresh load from the FastAPI backend.
   * Call this after a vendor successfully uploads a product so it appears
   * in the marketplace immediately without waiting for the Firestore listener.
   */
  const refetchProducts = () => {
    getProducts()
      .then(fetched => {
        if (fetched && Array.isArray(fetched)) {
          const cleanFetched = fetched.filter(p => p && p.id != null);
          // Update the authoritative backend ID set
          backendProductIdsRef.current = new Set(cleanFetched.map(p => String(p.id)));
          const backendIds = backendProductIdsRef.current;
          const jsonOnly = ENRICHED_JSON_PRODUCTS.filter(p => p && p.id != null && !backendIds.has(String(p.id)));
          const enrichedFetched = enrichRawProducts(cleanFetched);
          setProducts(pinnedFirst(dedupeById(sortByCreationDateDesc([...enrichedFetched, ...jsonOnly]))));
        }
      })
      .catch(err => console.warn('[Backend] Product refresh failed:', err.message));
  };

  // Load products: backend first (authoritative), Firestore real-time augmentation
  useEffect(() => {
    // ── Step 1: One-time fetch from FastAPI backend (Source of Truth) ──
    getProducts()
      .then(fetched => {
        if (fetched && fetched.length > 0) {
          const cleanFetched = fetched.filter(p => p && p.id != null);
          // Record which IDs came from the backend
          backendProductIdsRef.current = new Set(cleanFetched.map(p => String(p.id)));
          const backendIds = backendProductIdsRef.current;
          const jsonOnly = ENRICHED_JSON_PRODUCTS.filter(p => p && p.id != null && !backendIds.has(String(p.id)));
          const enrichedFetched = enrichRawProducts(cleanFetched);
          setProducts(pinnedFirst(dedupeById(sortByCreationDateDesc([...enrichedFetched, ...jsonOnly]))));
        }
      })
      .catch(err => console.warn('[Backend] Product fetch failed (non-fatal):', err.message));

    // ── Step 2: Firestore real-time listener ───────────────────────────────────
    // Firestore SUPPLEMENTS the backend — it never replaces backend products.
    // BUG FIX: Previously, onSnapshot overwrote all products with Firestore docs,
    // dropping any product that hadn't synced to Firestore (e.g., when Firebase
    // is offline). Now backend products are always preserved.
    let unsubscribe;
    try {
      const q = query(collection(db, 'products'), where('status', '==', 'published'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) return;
        const firestoreDocs = snapshot.docs.map(d => {
          const data = d.data();
          const enriched = enrichRawProducts([{ ...data, id: d.id }]);
          return enriched && enriched.length > 0 ? enriched[0] : null;
        }).filter(p => p && p.id != null);

        if (firestoreDocs.length > 0) {
          setProducts(prev => {
            const currentBackendIds = backendProductIdsRef.current;
            const rawBackendProducts = prev.filter(p => p && p.id != null && currentBackendIds.has(String(p.id)));

            // Build a fast lookup of Firestore docs by id
            const firestoreById = {};
            firestoreDocs.forEach(fd => {
              if (fd && fd.id != null) {
                firestoreById[String(fd.id)] = fd;
              }
            });

            // Helper: merge image fields from a Firestore doc into a product
            const _mergeFirestoreImages = (base, fd) => {
              if (!base || !fd) return base;
              const fsImg = _bestFirestoreImage(fd);
              const fsImageUrls = (fd.image_urls || []).filter(
                u => u && !u.startsWith('data:') && !u.includes('unsplash.com') && !u.includes('localhost')
              ).map(_resolveProductImageUrl).filter(Boolean);
              
              // Only override image fields when base doesn't already have a valid signed URL
              const shouldOverrideImage = fsImg && (!base.preview || (!base.preview.includes('Authorization=') && !base.preview.includes('/uploads/')));

              return {
                ...base,
                // Only override image fields when Firestore has a real URL and base needs it
                ...(shouldOverrideImage ? { preview: fsImg, thumbnail: fsImg } : {}),
                ...(fsImageUrls.length && (!base.image_urls || !base.image_urls.length) ? { image_urls: fsImageUrls, preview_images: fsImageUrls } : {}),
              };
            };

            // Map over ALL previous products (whether from SQLite backend or local JSON/mock)
            // If the product exists in Firestore, merge its images/pcloud links on top of it.
            // This prevents Firestore documents with null image fields from blanking out valid local pCloud URLs.
            const mergedProducts = prev.filter(p => p && p.id != null).map(p => {
              const fd = firestoreById[String(p.id)];
              if (fd) {
                return _mergeFirestoreImages(p, fd);
              }
              return p;
            });

            // Also include any completely new products from Firestore that did not exist in prev
            const prevIds = new Set(prev.filter(p => p && p.id != null).map(p => String(p.id)));
            const newFirestoreProducts = firestoreDocs.filter(fd => fd && fd.id != null && !prevIds.has(String(fd.id)));

            return pinnedFirst(dedupeById(sortByCreationDateDesc([...mergedProducts, ...newFirestoreProducts])));
          });
        }
      }, (err) => {
        // Firestore offline / rules issue — silent, we already have backend data
        console.warn('[Firestore] onSnapshot error (non-fatal):', err.message);
      });
    } catch (err) {
      console.warn('[Firestore] Listener setup failed (non-fatal):', err.message);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ── Listen for product creation/update events from the Admin portal ───────
  // When ProductsManagement creates or publishes a product it dispatches
  // 'lumora:product:created'. We immediately re-fetch from the backend so
  // the customer sees the new product without waiting for Firestore onSnapshot
  // or a full page reload.  This also covers the case where Firebase is offline.
  useEffect(() => {
    const handleProductCreated = () => { refetchProducts(); };
    window.addEventListener('lumora:product:created', handleProductCreated);

    // Background safety net: re-fetch published products every 60 s.
    // Covers edge cases where the custom event was missed (e.g. different tab).
    const backgroundInterval = setInterval(refetchProducts, 60000);

    return () => {
      window.removeEventListener('lumora:product:created', handleProductCreated);
      clearInterval(backgroundInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add a review to a product (local state, survives re-render session)
  const addReview = (productId, review) => {
    setProducts(prev => prev.map(p => {
      if (String(p.id) !== String(productId)) return p;
      const updatedList = [review, ...(p.reviewsList || [])];
      const avg = updatedList.reduce((s, r) => s + r.rating, 0) / updatedList.length;
      return { ...p, reviewsList: updatedList, reviews: updatedList.length, rating: Math.round(avg * 10) / 10 };
    }));
  };

  // Auth role selection (passed between selection → login/register pages)
  const [selectedAuthRole, setSelectedAuthRole] = useState('');

  // Shared category filter state
  const [activeCategory, setActiveCategory] = useState('All');

  // ── Global referral code capture ──────────────────────────────────────────
  // Reads ?ref=CODE from ANY URL on first mount and persists it so it survives
  // navigation to login, register, checkout, and payment pages.
  // This handles the common share pattern: https://lumora.in?ref=AFF0005
  // which the /ref/:code route does NOT handle (different URL format).
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      if (refCode && refCode.trim()) {
        const code = refCode.trim().toUpperCase();
        // Only write if not already set — don't overwrite a more specific session
        if (!sessionStorage.getItem('lumora_aff_ref')) {
          sessionStorage.setItem('lumora_aff_ref', code);
        }
        if (!localStorage.getItem('lumora_aff_ref')) {
          localStorage.setItem('lumora_aff_ref', code);
        }
        // Also write to lumora_pending_referral if not already set
        if (!localStorage.getItem('lumora_pending_referral')) {
          const hashParams = window.location.hash.includes('?')
            ? new URLSearchParams(window.location.hash.split('?')[1])
            : null;
          const productIdRaw = urlParams.get('product_id') || urlParams.get('p')
            || (hashParams && hashParams.get('product_id'))
            || null;
          const productId = productIdRaw ? parseInt(productIdRaw, 10) : null;
          localStorage.setItem('lumora_pending_referral', JSON.stringify({
            referral_code: code,
            product_id: isNaN(productId) ? null : productId,
            session_id: null,
            timestamp: Date.now(),
          }));
        }
        console.log('[AppContext] Referral code captured from URL:', code);
      }
    } catch (_) {}
  }, []);

  // Navigation & Route states
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    if (path === '/login-selection') return 'login-selection';
    if (path === '/register-selection') return 'register-selection';
    if (path === '/login') return 'login';
    if (path === '/register') return 'register';
    if (path === '/forgot-password') return 'forgot-password';
    if (path === '/verify-email') return 'verify-email';
    if (path === '/dashboard') return 'dashboard';
    if (path === '/orders') return 'dashboard';
    if (path === '/downloads') return 'dashboard';
    if (path === '/account') return 'dashboard';

    const hash = window.location.hash;
    if (hash.startsWith('#dashboard')) return 'dashboard';
    if (hash.startsWith('#affiliate')) return 'affiliate';
    if (hash.startsWith('#marketplace')) return 'marketplace';
    if (hash.startsWith('#product/')) return 'product-detail';
    if (hash === '#checkout/success') return 'checkout/success';
    if (hash.startsWith('#checkout')) return 'checkout';
    if (hash.startsWith('#payment')) return 'payment';
    if (hash.startsWith('#creator/')) return 'creator-profile';
    if (hash.startsWith('#cart')) return 'cart';
    return 'landing';
  });

  const [activeProductId, setActiveProductId] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#product/')) {
      const seg = hash.split('/')[1] || '';
      return seg.split('?')[0];
    }
    return '';
  });

  const [activeCreatorId, setActiveCreatorId] = useState(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#creator/')) {
      const seg = hash.split('/')[1] || '';
      return seg.split('?')[0];
    }
    return '';
  });

  const [dashboardTab, setDashboardTab] = useState(() => {
    const path = window.location.pathname;
    if (path === '/orders') return 'Orders';
    if (path === '/downloads') return 'Downloads';
    if (path === '/account') return 'Settings';
    return 'Dashboard';
  });

  // E-commerce items state with localStorage user-session persistence
  const [cart, setCart] = useState(() => {
    try {
      const activeUid = typeof window !== 'undefined' ? localStorage.getItem('lumora_backend_uid') : null;
      const key = activeUid ? `lumora_cart_user_${activeUid}` : 'lumora_cart';
      const saved = localStorage.getItem(key) || localStorage.getItem('lumora_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });
  const [wishlist, setWishlist] = useState(() => {
    try {
      const activeUid = typeof window !== 'undefined' ? localStorage.getItem('lumora_backend_uid') : null;
      const key = activeUid ? `lumora_wishlist_user_${activeUid}` : 'lumora_wishlist';
      const saved = localStorage.getItem(key) || localStorage.getItem('lumora_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });
  const [ownedProducts, setOwnedProducts] = useState(() => {
    try {
      const activeUid = typeof window !== 'undefined' ? localStorage.getItem('lumora_backend_uid') : null;
      const key = activeUid ? `lumora_owned_user_${activeUid}` : 'lumora_owned';
      const saved = localStorage.getItem(key) || localStorage.getItem('lumora_owned');
      return saved ? JSON.parse(saved) : [];
    } catch (_) { return []; }
  });

  // Buy Now specific states
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [lastPurchasedItems, setLastPurchasedItems] = useState([]);
    // Visual customizer themes
  const [accentTheme, setAccentTheme] = useState(() => {
    return localStorage.getItem('lumora_theme') || 'Lavender';
  });
  const [platformStatus, setPlatformStatus] = useState({
    isPlatformPaused: false,
    pauseMessage: 'Platform maintenance is currently active.',
  });

  useEffect(() => {
    const docRef = doc(db, 'platformSettings', 'global');
    let hasFailed = false;
    const unsub = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPlatformStatus({
          isPlatformPaused: !!data.isPlatformPaused,
          pauseMessage: data.pauseMessage || 'Platform maintenance is currently active.',
        });
      }
    }, (err) => {
      unsub();
      if (hasFailed) return;
      hasFailed = true;
      console.warn('[AppContext] Firestore platform settings subscription error, falling back to REST:', err.message);
      
      const fetchStatus = async () => {
        try {
          const res = await fetch(`${_BACKEND_ORIGIN}/api/public/platform/status`);
          if (res.ok) {
            const data = await res.json();
            setPlatformStatus({
              isPlatformPaused: !!data.isPlatformPaused,
              pauseMessage: data.maintenanceMessage || 'Platform maintenance is currently active.',
            });
          }
        } catch (fetchErr) {
          console.error('[AppContext] Failed to fetch public platform settings via REST:', fetchErr);
        }
      };
      fetchStatus();
    });
    return () => unsub();
  }, []);

  const [glassMode, setGlassMode] = useState(() => {
    const saved = localStorage.getItem('lumora_glass');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [borderGlow, setBorderGlow] = useState(() => {
    const saved = localStorage.getItem('lumora_glow');
    return saved !== null ? Number(saved) : 70;
  });

  // ── Global Referral Link Capture ─────────────────────────────────────────
  // Inspects URL search params and hash on mount/navigation for ?ref= or ?r=
  useEffect(() => {
    try {
      const searchStr = window.location.search;
      const hashStr   = window.location.hash;
      const urlParams = new URLSearchParams(searchStr);
      let refCode = urlParams.get('ref') || urlParams.get('r');

      if (!refCode && hashStr && hashStr.includes('?')) {
        const queryInHash = hashStr.split('?')[1];
        const hashParams  = new URLSearchParams(queryInHash);
        refCode = hashParams.get('ref') || hashParams.get('r');
      }

      if (refCode) {
        const cleanCode = refCode.trim().toUpperCase();
        if (cleanCode) {
          sessionStorage.setItem('lumora_aff_ref', cleanCode);
          localStorage.setItem('lumora_aff_ref', cleanCode);

          const pendingPayload = {
            referral_code: cleanCode,
            timestamp: Date.now()
          };
          localStorage.setItem('lumora_pending_referral', JSON.stringify(pendingPayload));

          // Track click on backend (non-blocking)
          const trackedKey = `lumora_tracked_click_${cleanCode}`;
          if (!sessionStorage.getItem(trackedKey)) {
            sessionStorage.setItem(trackedKey, 'true');
            backendFetch(`/affiliate/track-click/${cleanCode}`, { method: 'POST' }).catch((err) => {
              if (err?.status === 404 || err?.message?.includes('404')) {
                try {
                  localStorage.removeItem('lumora_pending_referral');
                  localStorage.removeItem('lumora_aff_ref');
                  sessionStorage.removeItem('lumora_aff_ref');
                } catch (_) {}
              }
            });
          }
        }
      }
    } catch (_) {}
  }, []);

  // Notifications — loaded from backend, start empty
  const [notifications, setNotifications] = useState([]);

  // Cart Drawer Visibility
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Applied Promo Code
  const [appliedPromo, setAppliedPromo] = useState(null);

  // Global Checkout Form state for multi-step checkout
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'India',
    state: '',
    city: '',
  });

  // Persist cart, wishlist, and owned products to user-scoped localStorage so data never disappears on refresh
  useEffect(() => {
    try {
      const activeUid = localStorage.getItem('lumora_backend_uid');
      const key = activeUid ? `lumora_cart_user_${activeUid}` : 'lumora_cart';
      if (cart.length > 0) {
        localStorage.setItem(key, JSON.stringify(cart));
        localStorage.setItem('lumora_cart', JSON.stringify(cart));
      }
    } catch (_) {}
  }, [cart]);

  useEffect(() => {
    try {
      const activeUid = localStorage.getItem('lumora_backend_uid');
      const key = activeUid ? `lumora_wishlist_user_${activeUid}` : 'lumora_wishlist';
      if (wishlist.length > 0) {
        localStorage.setItem(key, JSON.stringify(wishlist));
        localStorage.setItem('lumora_wishlist', JSON.stringify(wishlist));
      }
    } catch (_) {}
  }, [wishlist]);

  useEffect(() => {
    try {
      const activeUid = localStorage.getItem('lumora_backend_uid');
      const key = activeUid ? `lumora_owned_user_${activeUid}` : 'lumora_owned';
      if (ownedProducts.length > 0) {
        localStorage.setItem(key, JSON.stringify(ownedProducts));
        localStorage.setItem('lumora_owned', JSON.stringify(ownedProducts));
      }
    } catch (_) {}
  }, [ownedProducts]);

  // State is managed in React memory context and fetched directly from the backend SQLite DB

  const lastUserUidRef = useRef(null);
  const lastSyncedKeyRef = useRef('');
  
  useEffect(() => {
    const currentUid = user?.uid || null;
    if (lastUserUidRef.current !== currentUid) {
      setCart([]);
      setWishlist([]);
      setOwnedProducts([]);
      setNotifications([]);
      setAppliedPromo(null);
      setBuyNowProduct(null);
      setLastPurchasedItems([]);
      lastUserUidRef.current = currentUid;
      lastSyncedKeyRef.current = ''; // Reset the sync key so next sync for new/reloaded user can run
    }
  }, [user]);

  // ── Backend sync: load cart, wishlist, and owned product IDs when user logs in ──
  //
  // syncBackend is defined at this scope so it can be called both on login
  // and from the 'lumora_refresh_user_data' global event listener below.
  const syncBackend = useRef(null);

  useEffect(() => {
    // Build the sync function with access to the current products list
    syncBackend.current = async () => {
      const hasToken = () => !!localStorage.getItem('lumora_backend_token');
      if (!hasToken()) return;

      // 1. Sync cart directly from backend SQLite DB (Source of Truth)
      try {
        const serverCartIds = await getCartApi();
        if (Array.isArray(serverCartIds)) {
          setCart(prev => {
            const mappedProducts = serverCartIds
              .map(id => {
                const found = products.find(p => p && String(p.id) === String(id));
                if (found) return { ...found, quantity: 1 };
                return prev.find(i => i && String(i.id) === String(id)) || null;
              })
              .filter(Boolean);
            return mappedProducts;
          });
        }
      } catch (err) {
        console.warn('[AppContext] Cart sync failed (backend may be offline):', err.message);
      }

      // 2. Sync wishlist directly from backend SQLite DB (Source of Truth)
      try {
        const serverWishIds = await backendFetch('/wishlist/me');
        if (Array.isArray(serverWishIds)) {
          setWishlist(prev => {
            const mappedProducts = serverWishIds
              .map(id => {
                const found = products.find(p => p && String(p.id) === String(id));
                if (found) return found;
                return prev.find(i => i && String(i.id) === String(id)) || null;
              })
              .filter(Boolean);
            return mappedProducts;
          });
        }
      } catch (err) {
        console.warn('[AppContext] Wishlist sync failed (backend may be offline):', err.message);
      }

      // 3. Sync owned products — ALWAYS OVERWRITE from SQLite (source of truth)
      //    Never merge with stale in-memory state: what the backend says IS the complete list.
      try {
        const orders = await getMyOrdersApi();
        if (Array.isArray(orders)) {
          // Only count products from completed/paid orders to ensure user actually owns them
          const purchasedIds = orders
            .filter(o => o.status === 'completed' || o.status === 'paid')
            .flatMap(o => (o.items || []).map(item => String(item.product_id)))
            .filter(id => id && !isNaN(parseInt(id, 10))); // Ensure valid product IDs
          
          // CRITICAL: Always overwrite so stale/mock IDs from previous sessions are cleared
          // This ensures the UI reflects exactly what's in the SQLite database
          setOwnedProducts([...new Set(purchasedIds)]); // Remove duplicates
        } else {
          // If no orders returned, user owns no products
          setOwnedProducts([]);
        }
      } catch (err) {
        console.warn('[AppContext] Owned products sync failed (backend may be offline):', err.message);
        // Don't clear owned products on network error to avoid data loss during temporary outages
      }
    };
  }, [products]); // rebuild whenever the product catalogue updates

  useEffect(() => {
    if (!user) return;
    const hasToken = () => !!localStorage.getItem('lumora_backend_token');

    // Check sync status using a composite key: uid + products length
    // This ensures we re-sync if products list updates (e.g. finishes loading from SQLite)
    const currentSyncKey = `${user.uid}_${products.length}`;
    if (lastSyncedKeyRef.current === currentSyncKey) return;

    const runSync = async () => {
      if (!hasToken()) {
        await new Promise((resolve) => {
          const onReady = () => { window.removeEventListener('lumora_backend_ready', onReady); resolve(); };
          window.addEventListener('lumora_backend_ready', onReady);
          setTimeout(() => { window.removeEventListener('lumora_backend_ready', onReady); resolve(); }, 5000);
        });
      }
      if (!hasToken()) {
        console.warn('[AppContext] Backend token unavailable after 5s — skipping sync');
        return;
      }

      // Re-verify the key after wait, in case products or user changed during wait
      const freshSyncKey = `${user?.uid || ''}_${products.length}`;
      if (lastSyncedKeyRef.current === freshSyncKey) return;
      lastSyncedKeyRef.current = freshSyncKey;

      if (syncBackend.current) await syncBackend.current();
    };

    runSync();
  }, [user, products]);

  // ── Global refresh listener ────────────────────────────────────────────────
  // Any module (purchase, download, etc.) can dispatch 'lumora_refresh_user_data'
  // to immediately re-sync all backend-driven state without a full page reload.
  useEffect(() => {
    const handleRefresh = () => {
      if (!user || !syncBackend.current) return;
      syncBackend.current();
    };
    window.addEventListener('lumora_refresh_user_data', handleRefresh);
    return () => window.removeEventListener('lumora_refresh_user_data', handleRefresh);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('lumora_theme', accentTheme);
    localStorage.setItem('lumora_glass', JSON.stringify(glassMode));
    localStorage.setItem('lumora_glow', String(borderGlow));
  }, [accentTheme, glassMode, borderGlow]);

  // Clean up invalid/deleted products from cart, wishlist, and buyNowProduct
  useEffect(() => {
    if (products && products.length > 0) {
      const validProductIds = new Set(products.map(p => String(p.id)));

      if (cart && cart.length > 0) {
        const filteredCart = cart.filter(item => validProductIds.has(String(item.id)));
        if (filteredCart.length !== cart.length) {
          setCart(filteredCart);
          // Sync deletion to backend
          const invalidItems = cart.filter(item => !validProductIds.has(String(item.id)));
          invalidItems.forEach(item => {
            const numericId = parseInt(item.id, 10);
            if (!isNaN(numericId)) {
              removeCartItemApi(numericId).catch(() => {});
            }
          });
        }
      }

      if (wishlist && wishlist.length > 0) {
        const filteredWishlist = wishlist.filter(item => validProductIds.has(String(item.id)));
        if (filteredWishlist.length !== wishlist.length) {
          setWishlist(filteredWishlist);
        }
      }

      if (buyNowProduct && !validProductIds.has(String(buyNowProduct.id))) {
        setBuyNowProduct(null);
      }
    }
  }, [products, cart, wishlist, buyNowProduct]);


  // Handle navigation changes globally (popstate and hashchange)
  useEffect(() => {
    const handleNavigation = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;

      if (path === '/login-selection' || path === '/auth/login-selection') {
        setSelectedAuthRole('customer');
        navigate('/auth/login?role=customer', { replace: true });
        setCurrentView('login');
      } else if (path === '/register-selection' || path === '/auth/register-selection') {
        setSelectedAuthRole('customer');
        navigate('/auth/register?role=customer', { replace: true });
        setCurrentView('register');
      } else if (path === '/login' || path === '/auth/login') {
        setCurrentView('login');
      } else if (path === '/register' || path === '/auth/register') {
        setCurrentView('register');
      } else if (path === '/forgot-password' || path === '/auth/forgot-password') {
        setCurrentView('forgot-password');
      } else if (path === '/verify-email' || path === '/auth/verify-email') {
        setCurrentView('verify-email');
      } else if (path === '/dashboard' || path === '/customer/dashboard' || path === '/vendor/dashboard') {
        setCurrentView('dashboard');
      } else if (path === '/orders') {
        setCurrentView('dashboard');
        setDashboardTab('Orders');
      } else if (path === '/downloads') {
        setCurrentView('dashboard');
        setDashboardTab('Downloads');
      } else if (path === '/account') {
        setCurrentView('dashboard');
        setDashboardTab('Settings');
      } else if (hash.startsWith('#dashboard')) {
        setCurrentView('dashboard');
      } else if (hash.startsWith('#affiliate') || path === '/affiliate/dashboard') {
        setCurrentView('affiliate');
      } else if (hash.startsWith('#marketplace')) {
        setCurrentView('marketplace');
      } else if (hash.startsWith('#product/')) {
        const id = hash.split('/')[1] || '';
        const cleanId = id.split('?')[0];
        setActiveProductId(cleanId);
        setCurrentView('product-detail');
      } else if (hash.startsWith('#checkout')) {
        setCurrentView('checkout');
      } else if (hash.startsWith('#payment')) {
        setCurrentView('payment');
      } else if (hash.startsWith('#creator/')) {
        const id = hash.split('/')[1] || '';
        const cleanId = id.split('?')[0];
        setActiveCreatorId(cleanId);
        setCurrentView('creator-profile');
      } else if (hash.startsWith('#cart')) {
        setCurrentView('cart');
      } else {
        setCurrentView('landing');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('hashchange', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    return () => {
      window.removeEventListener('hashchange', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
  }, []);

  // Update theme classes on body
  useEffect(() => {
    const colors = {
      'Lavender': { accent: '#D8C8F0', glow: 'rgba(216,200,240,0.25)' },
      'Peach': { accent: '#B99DD8', glow: 'rgba(185,157,216,0.22)' },
      'Powder Blue': { accent: '#9370C0', glow: 'rgba(147,112,192,0.20)' },
      'Sage Mint': { accent: '#7040A8', glow: 'rgba(112,64,168,0.18)' }
    };

    const currentThemeInfo = colors[accentTheme] || colors['Lavender'];
    document.documentElement.style.setProperty('--color-lavender', currentThemeInfo.accent);
    document.documentElement.style.setProperty('--glow-lavender', currentThemeInfo.glow);
    document.documentElement.style.setProperty('--glow-border-opacity', String(borderGlow / 100));

    if (glassMode) {
      document.documentElement.style.setProperty('--glass-blur', '20px');
      document.documentElement.style.setProperty('--glass-bg-opacity', '0.45');
    } else {
      document.documentElement.style.setProperty('--glass-blur', '0px');
      document.documentElement.style.setProperty('--glass-bg-opacity', '0.96');
    }
  }, [accentTheme, glassMode, borderGlow]);

  // Cart operations
  const addToCart = (product) => {
    if (!user) {
      alert("Please sign in or create an account to purchase products or add items to your cart.");
      const prodId = product?.id || activeProductId;
      const targetRedirect = prodId ? `/#product/${prodId}` : '/#products';
      const refCode = sessionStorage.getItem('lumora_aff_ref') || '';
      const refParam = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';
      navigate(`/auth/login?role=customer&redirect=${encodeURIComponent(targetRedirect)}${refParam}`);
      return;
    }
    setCart((prev) => {
      const exists = prev.find(item => item && String(item.id) === String(product.id));
      if (exists) {
        return prev.map(item => item && String(item.id) === String(product.id) ? { ...item, quantity: (item.quantity || 1) + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    // Persist to backend database (non-blocking, fire-and-forget)
    const numericId = parseInt(product.id, 10);
    if (isNaN(numericId)) {
      console.error('[AppContext] Invalid non-integer product ID passed to addToCart:', product.id);
      return;
    }
    addCartItemApi(numericId).catch(err =>
      console.warn('[AppContext] Backend cart add failed (non-fatal):', err.message)
    );
    // Trigger visual notification drawer
    setIsCartOpen(true);
    confetti({
      particleCount: 40,
      spread: 45,
      colors: ['#D8BFE3', '#B886D0', '#7B3FA0'],
      origin: { y: 0.8 }
    });
  };

  const buyNow = (product) => {
    const prodId = product?.id || (typeof product === 'string' || typeof product === 'number' ? product : activeProductId);
    if (prodId) {
      navigateTo('product-detail', prodId);
    } else {
      navigateTo('marketplace');
    }
  };

  const removeFromCart = (id) => {
    const targetIdStr = String(id);
    const numericId = parseInt(id, 10);
    setCart((prev) => prev.filter(item => item && String(item.id) !== targetIdStr));
    // Persist to backend database
    if (!isNaN(numericId)) {
      removeCartItemApi(numericId).catch(err =>
        console.warn('[AppContext] Backend cart remove failed (non-fatal):', err.message)
      );
    }
  };

  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    const targetIdStr = String(id);
    setCart((prev) => prev.map(item => item && String(item.id) === targetIdStr ? { ...item, quantity } : item));
  };

  const clearCart = () => {
    setCart([]);
    // Clear backend cart too (non-blocking)
    clearCartApi().catch(err =>
      console.warn('[AppContext] Backend cart clear failed (non-fatal):', err.message)
    );
  };

  // Wishlist operations
  const toggleWishlist = (product) => {
    if (!product || product.id == null) return;
    const prodIdStr = String(product.id);
    const numericId = parseInt(product.id, 10);
    if (isNaN(numericId)) {
      console.error('[AppContext] Invalid non-integer product ID passed to toggleWishlist:', product.id);
      return;
    }

    setWishlist((prev) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const exists = prevArr.some(item => item && String(item.id) === prodIdStr);
      if (exists) {
        // Persist removal to backend database
        backendFetch(`/wishlist/${numericId}`, { method: 'DELETE' }).catch(err =>
          console.warn('[AppContext] Backend wishlist remove failed (non-fatal):', err.message)
        );
        return prevArr.filter(item => item && String(item.id) !== prodIdStr);
      }
      // Persist addition to backend database
      backendFetch(`/wishlist/?product_id=${numericId}`, { method: 'POST' }).catch(err =>
        console.warn('[AppContext] Backend wishlist add failed (non-fatal):', err.message)
      );
      return [...prevArr, product];
    });
  };

  // Complete checkout purchase
  const completePurchase = (paymentMethod = 'upi', paymentId = null, promoCode = null, discountAmount = 0) => {
    const items = buyNowProduct ? [buyNowProduct] : cart;

    // Show download popup immediately with purchased items
    const fetchTokensAndDispatch = async () => {
      const itemsWithTokens = await Promise.all(
        items.map(async (item) => {
          try {
            const response = await backendFetch(`/products/${item.id}/download`);
            return { 
              ...item, 
              download_url: response?.download_url || null,
              redirect_url: response?.redirect_url || null,
              type: response?.type || null
            };
          } catch {
            return { ...item, download_url: null };
          }
        })
      );
      window.dispatchEvent(new CustomEvent('lumora_purchase_complete', {
        detail: {
          orderDetails: {
            id: paymentId || Date.now(),
            order_id: paymentId || Date.now(),
            total_amount: Math.round(items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0)),
            payment_method: paymentMethod,
            payment_id: paymentId,
          },
          purchasedItems: itemsWithTokens,
        }
      }));
    };
    fetchTokensAndDispatch();

    // Show in-app notification
    setNotifications(prev => [
      ...items.map((item, idx) => ({
        id: Date.now() + idx,
        title: "Purchase Confirmed ✦",
        text: `'${item.title}' is now in your Downloads vault.`,
        date: "Just now",
        read: false,
      })),
      ...prev,
    ]);
    setLastPurchasedItems(items);

    // Clear cart / buy-now
    if (buyNowProduct) {
      setBuyNowProduct(null);
    } else {
      setCart([]);
      clearCartApi().catch(() => {});
    }
    setAppliedPromo(null);

    // Clear session payment data
    sessionStorage.removeItem('lumora_idempotency_key');
    sessionStorage.removeItem('lumora_pending_payment_ref');
    sessionStorage.removeItem('lumora_upi_session');

    // ── CRITICAL: sync owned products from SQLite immediately ─────────────────
    // Payment was already confirmed server-side before completePurchase is called.
    // We fire two syncs: one immediate (catches fast backends) and one after 2s.
    const doSync = () => window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
    doSync();                              // immediate
    setTimeout(doSync, 2000);             // retry in case backend needs a moment

    // Disable back-navigation to checkout/payment
    window.history.pushState(null, '', window.location.href);
    const preventBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', preventBack);
    setTimeout(() => window.removeEventListener('popstate', preventBack), 30000);

    // Navigate to dashboard Downloads tab
    navigateTo('downloads');
  };

  const navigateTo = (view, payload = '') => {
    if (view === 'login-selection') {
      setSelectedAuthRole('customer');
      navigate('/auth/login?role=customer');
      setCurrentView('login');
    } else if (view === 'register-selection') {
      setSelectedAuthRole('customer');
      navigate('/auth/register?role=customer');
      setCurrentView('register');
    } else if (view === 'login') {
      if (payload) setSelectedAuthRole(payload);
      navigate(payload ? `/auth/login?role=${payload}` : '/auth/login');
      setCurrentView('login');
    } else if (view === 'register') {
      if (payload) setSelectedAuthRole(payload);
      navigate(payload ? `/auth/register?role=${payload}` : '/auth/register');
      setCurrentView('register');
    } else if (view === 'forgot-password') {
      navigate('/auth/forgot-password');
      setCurrentView('forgot-password');
    } else if (view === 'verify-email') {
      navigate('/auth/verify-email');
      setCurrentView('verify-email');
    } else if (view === 'dashboard') {
      setDashboardTab(payload || 'Dashboard');
      getDashboardPath().then(path => navigate(path));
      setCurrentView('dashboard');
    } else if (view === 'orders') {
      setDashboardTab('Orders');
      getDashboardPath().then(path => navigate(path));
      setCurrentView('dashboard');
    } else if (view === 'downloads') {
      setDashboardTab('Downloads');
      getDashboardPath().then(path => navigate(path));
      setCurrentView('dashboard');
    } else if (view === 'account') {
      setDashboardTab('Settings');
      getDashboardPath().then(path => navigate(path));
      setCurrentView('dashboard');
    } else if (view === 'landing') {
      navigate('/');
      setCurrentView('landing');
    } else if (view === 'marketplace') {
      if (payload) setActiveCategory(payload);
      navigate('/#marketplace');
      setCurrentView('marketplace');
    } else if (view === 'product-detail') {
      setActiveProductId(payload);
      navigate(`/#product/${payload}`);
      setCurrentView('product-detail');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (view === 'creator-profile') {
      setActiveCreatorId(payload);
      navigate(`/#creator/${payload}`);
      setCurrentView('creator-profile');
    } else if (view === 'checkout') {
      navigate('/#checkout');
      setCurrentView('checkout');
    } else if (view === 'payment') {
      navigate('/#payment');
      setCurrentView('payment');
    } else if (view === 'cart') {
      navigate('/#cart');
      setCurrentView('cart');
    } else if (view.startsWith('affiliate')) {
      const sub = view.replace('affiliate-', '').replace('affiliate', 'dashboard');
      navigate(`/affiliate/dashboard#affiliate/${sub}`);
      // Dispatch the tab-change event directly because React Router's navigate()
      // uses pushState — which does NOT trigger the native 'hashchange' event.
      // AffiliateDashboard.jsx listens for this custom event to switch tabs.
      window.dispatchEvent(new CustomEvent('affiliate-tab-change', { detail: sub }));
      setCurrentView('affiliate');
    } else if (view === 'partnerships' || view === 'partnership') {
      navigate('/partnerships');
      setCurrentView('partnerships');
    } else if (view === 'partnerships-affiliate') {
      navigate('/partnerships/affiliate');
      setCurrentView('partnerships-affiliate');
    } else if (view === 'partnerships-vendor') {
      navigate('/partnerships/vendor');
      setCurrentView('partnerships-vendor');
    } else {
      navigate(`/#${view}`);
      setCurrentView(view);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getActiveProduct = () => {
    if (!activeProductId) return products[0];
    return products.find(p => String(p.id) === String(activeProductId)) || null;
  };

  const getActiveCreator = () => {
    // Search products for creator info
    const prod = products.find(p => p.creator && p.creator.id === activeCreatorId);
    return prod ? prod.creator : (products[0] && products[0].creator) || {};
  };

  const getCreatorProducts = (creatorId) => {
    return products.filter(p => p.creator.id === creatorId);
  };

  const formatPrice = (priceINR) => {
    if (typeof priceINR !== 'number') {
      const parsed = parseFloat(String(priceINR).replace(/[^0-9.]/g, ''));
      if (isNaN(parsed)) return priceINR;
      priceINR = parsed;
    }
    // Prices are stored and entered in INR (₹) by vendors — do NOT convert.
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Math.round(priceINR));
  };

  return (
    <AppContext.Provider value={{
      products: products,
      currentView,
      activeProductId,
      activeCreatorId,
      dashboardTab,
      setDashboardTab,
      cart,
      wishlist,
      setWishlist,
      ownedProducts,
      buyNowProduct,
      setBuyNowProduct,
      platformStatus,
      setPlatformStatus,
      lastPurchasedItems,
      setLastPurchasedItems,
      accentTheme,
      setAccentTheme,
      glassMode,
      setGlassMode,
      borderGlow,
      setBorderGlow,
      notifications,
      setNotifications,
      isCartOpen,
      setIsCartOpen,
      appliedPromo,
      setAppliedPromo,
      checkoutForm,
      setCheckoutForm,
      addToCart,
      buyNow,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      activeCategory,
      setActiveCategory,
      completePurchase,
      selectedAuthRole,
      setSelectedAuthRole,
      navigateTo,
      getActiveProduct,
      getActiveCreator,
      getCreatorProducts,
      formatPrice,
      addReview,
      refetchProducts,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used inside AppContextProvider');
  }
  return context;
}

export default AppContextProvider;
