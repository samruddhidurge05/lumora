import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, FilterBar, TableContainer } from './components/AdminComponents';
import { Sparkles, Compass, Users, LayoutDashboard, HelpCircle, ArrowUpRight } from 'lucide-react';
import { productService, mapDocToProduct } from '../../services/productService'; // API service — create/update/delete persist to PostgreSQL
import { backendFetch } from '../../utils/api';
import { uploadProductFile, uploadThumbnail, uploadGalleryImage } from '../../services/storageService.js';
import { getOrders } from '../../services/orderService';
import { db } from '../../firebase.js';
import { collection, onSnapshot } from 'firebase/firestore';
import { ProductQrButton } from '../../components/product/ProductQrCode';

// --- ROBUST SELF-CONTAINED LUXURY UI VECTOR SYSTEM ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    Search: <path d="M19 11a8 8 0 11-16 0 8 8 0 0116 0zM21 21l-4.35-4.35" />,
    Plus: <path d="M12 5v14M5 12h14" />,
    Grid: <g><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></g>,
    List: <g><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></g>,
    TrendingUp: <g><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></g>,
    Layers: <g><polygon points="12 2 2 7 12 12 22 7 12 2" /><polygon points="2 17 12 22 22 17" /><polygon points="2 12 12 17 22 12" /></g>,
    Download: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
    DollarSign: <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></g>,
    Award: <g><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></g>,
    Tag: <g><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></g>,
    Folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    Trash2: <g><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></g>,
    Edit2: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
    Check: <polyline points="20 6 9 17 4 12" />,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    Eye: <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    Globe: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
    Copy: <g><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
    ArrowUpRight: <g><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></g>,
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Sliders: <g><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></g>,
    Compass: <g><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></g>,
    Play: <polygon points="5 3 19 12 5 21 5 3" />,
    Pause: <g><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></g>,
    Star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    ChevronLeft: <polyline points="15 18 9 12 15 6" />,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></g>,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {svgs[name] || null}
    </svg>
  );
};

// --- SYSTEM AUDIO ENGINE (Procedural Luxury UI Sound System) ---
class AudioController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTap() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }
  playSwoosh() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
  playSuccess() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.03, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(523.25, now, 0.15); // C5
    playNote(659.25, now + 0.08, 0.25); // E5
  }
}

const sysSound = new AudioController();

// --- MOCK PRODUCT SEEDS (Premium, cinematic, world-class design assets) ---
const INITIAL_PRODUCTS = [];

// ─────────────────────────────────────────────────────────────────────────────
// resolveImageUrl
// Converts relative /uploads/... backend paths OR localhost:8000 absolute URLs
// to paths that load correctly through the Vite proxy (/uploads → localhost:8000).
// Absolute localhost:PORT URLs are stripped to their path so the Vite proxy
// forwards them to the backend — prevents 404s when the stored URL origin
// doesn't match the dev server origin (localhost:5173 vs localhost:8000).
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api')
  .replace(/\/api\/?$/, '');

function resolveImageUrl(url) {
  if (!url) return null;
  // Strip localhost origins so the path flows through the Vite dev proxy.
  // e.g. "http://localhost:8000/uploads/..." → "/uploads/..."
  // This prevents the browser requesting localhost:5173/uploads/... (404).
  // In production VITE_API_BASE_URL will be an external host, so this branch
  // only triggers for local dev (localhost:xxxx patterns).
  const localhostPattern = /^https?:\/\/localhost:\d+/;
  if (localhostPattern.test(url)) {
    url = url.replace(localhostPattern, '');
  }
  if (url.startsWith('http://') || url.startsWith('https://')) return url; // external CDN
  if (url.startsWith('/')) return `${BACKEND_ORIGIN}${url}`; // relative path → full backend URL
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// mapAdminProductToApi
// ─────────────────────────────────────────────────────────────────────────────
// Translates the Admin UI form model into the FastAPI ProductCreate / ProductUpdate
// schema. This is the ONLY place where Admin UI field names are converted to
// backend field names. The UI state variables are never renamed.
//
// UI field           → API field
// ──────────────────────────────────────────────────────────────────────────
// name               → title          (required str — root cause of HTTP 422)
// shortDesc          → description    (fallback when description is blank)
// creatorName        → seller
// isFeatured         → featured
// downloadUrl        → file_url
// fileSize (bytes)   → file_size (human-readable string e.g. "2.4 MB")
// status "Published" → "published"    (lowercase normalisation)
// status "Draft"     → "draft"
// tagsInput (str)    → tags (string[])
//
// UI-only fields stripped (never sent to the backend):
//   tagsInput, galleryInput, gallery, zipName, seoTitle, seoKeywords,
//   slug, videoUrl, discountPrice, creatorAvatar, storagePath, fileName
// ─────────────────────────────────────────────────────────────────────────────
function mapAdminProductToApi(uiForm) {
  // ── Normalise status ─────────────────────────────────────────────────────
  const statusRaw = (uiForm.status || 'Draft').toLowerCase();
  const statusMap = {
    published: 'published',
    live:      'published',
    draft:     'draft',
    paused:    'draft',
    archived:  'draft',
  };
  const status = statusMap[statusRaw] ?? 'draft';

  // ── Normalise file_size ──────────────────────────────────────────────────
  // fileSize may be stored as bytes (number) or already a human-readable string
  let file_size = null;
  if (uiForm.fileSize) {
    if (typeof uiForm.fileSize === 'number') {
      const bytes = uiForm.fileSize;
      if (bytes >= 1024 * 1024) {
        file_size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      } else if (bytes >= 1024) {
        file_size = `${Math.round(bytes / 1024)} KB`;
      } else {
        file_size = `${bytes} B`;
      }
    } else {
      file_size = String(uiForm.fileSize); // e.g. "48 MB" — pass through as-is
    }
  }

  // ── Resolve tags ─────────────────────────────────────────────────────────
  // tags may already be an array (edit path) or come from tagsInput string (create path)
  let tags = [];
  if (Array.isArray(uiForm.tags) && uiForm.tags.length > 0) {
    tags = uiForm.tags;
  } else if (typeof uiForm.tagsInput === 'string' && uiForm.tagsInput.trim()) {
    tags = uiForm.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  }

  // ── Build the ProductCreate / ProductUpdate payload ───────────────────────
  const apiPayload = {
    // Required field
    title:             (uiForm.name || '').trim(),

    // Text content
    description:       uiForm.description || uiForm.shortDesc || null,
    category:          uiForm.category    || null,

    // Pricing
    price:             (uiForm.price !== '' && uiForm.price !== null && uiForm.price !== undefined)
                         ? parseFloat(uiForm.price)
                         : 0,

    // Media
    // Media
    thumbnail:         uiForm.thumbnail || null,
    preview:           uiForm.thumbnail || null,

    // File delivery
    file_url:          uiForm.downloadUrl || uiForm.file_url || null,  // downloadUrl → file_url

    // Creator / vendor identity
    seller:            uiForm.creatorName || uiForm.seller || null,   // creatorName → seller

    // Discovery flags
    featured:          Boolean(uiForm.isFeatured || uiForm.featured || false),
    trending:          Boolean(uiForm.trending   || false),
    new_arrival:       Boolean(uiForm.new_arrival || false),
    badge:             uiForm.badge       || null,

    // Publishing
    status,

    // Metadata
    tags,
    highlights:        Array.isArray(uiForm.keyFeatures)
                         ? uiForm.keyFeatures.map(f => (typeof f === 'string' ? f.trim() : f)).filter(Boolean)
                         : (Array.isArray(uiForm.highlights) ? uiForm.highlights : null),
    version:           uiForm.version     || 'v1.0.0',
    file_size,
    license:           uiForm.license     || null,

    // Affiliate settings
    affiliate_enabled: Boolean(uiForm.affiliate_enabled || false),
    commission_type:   uiForm.commission_type  || 'percentage',
    commission_value:  Number(uiForm.commission_value) || 0.0,

    // ── Features & Specs (Section 5) ──────────────────────────────────────
    // keyFeatures comes from a textarea (one per line) — filter empty lines
    features:             Array.isArray(uiForm.keyFeatures)
                            ? uiForm.keyFeatures.map(f => (typeof f === 'string' ? f.trim() : f)).filter(Boolean)
                            : [],
    what_you_get:         Array.isArray(uiForm.whatsIncluded)       ? uiForm.whatsIncluded       : [],
    system_requirements:  Array.isArray(uiForm.systemRequirements)  ? uiForm.systemRequirements  : [],
    installation_guide:   typeof uiForm.installationGuide === 'string' ? uiForm.installationGuide : '',

    image_urls:           Array.isArray(uiForm.image_urls)
                            ? uiForm.image_urls.filter(Boolean)
                            : [],

    // Also populate preview_images with the same gallery URLs for backward compat
    preview_images:       Array.isArray(uiForm.image_urls)
                            ? uiForm.image_urls.filter(Boolean)
                            : [],
  };

  return apiPayload;
}

export default function App() {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'list'

  // --- API INTEGRATION: Load real products from PostgreSQL via FastAPI ---
  // WHY here? The products state already drives all filtering, sorting, and rendering.
  // Replacing INITIAL_PRODUCTS with real API data at mount gives us live data
  // without changing any existing filter/sort/CRUD logic below.
  // We map API fields → the shape this component already expects so zero UI changes needed.
  const [productsLoading, setProductsLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const apiLoading = productsLoading || ordersLoading;
  const [apiError, setApiError]     = useState(null);   // Store error message if fetch fails

  useEffect(() => {
    // Load products from the FastAPI backend (SQLite source of truth for admin).
    // Fall back to Firestore onSnapshot only if the backend is unreachable.
    let mounted = true;
    let unsubFirestore = null;

    const loadFromBackend = () => {
      backendFetch('/products/?limit=1000')
        .then(items => {
          if (!mounted) return;
          if (Array.isArray(items) && items.length > 0) {
            // Normalise backend ProductResponse → UI shape expected by this component
            const uiItems = items.map(p => ({
              id:          p.id,
              name:        p.title || '',
              title:       p.title || '',
              creatorName: p.seller || p.vendor_id || 'Creator',
              creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
              category:    p.category || 'Uncategorized',
              shortDesc:   p.short_desc || p.description || '',
              description: p.description || '',
              price:       parseFloat(p.price) || 0,
              // Convert backend lowercase status → display-capitalised status
              status:      p.status === 'published' ? 'Published'
                         : p.status === 'archived'  ? 'Archived'
                         : p.status === 'pending_review' ? 'Pending Review'
                         : 'Draft',
              isFeatured:  Boolean(p.featured),
              featured:    Boolean(p.featured),
              // Resolve relative image URLs to full backend URLs.
              // Use preview as primary when both exist — on some products the
              // thumbnail path may have been lost while preview is still on disk.
              thumbnail:   resolveImageUrl(p.preview || p.thumbnail),
              preview:     resolveImageUrl(p.preview || p.thumbnail),
              image_urls:  Array.isArray(p.image_urls) ? p.image_urls.map(resolveImageUrl) : [],
              gallery:     Array.isArray(p.preview_images) && p.preview_images.length > 0
                ? p.preview_images.map(resolveImageUrl)
                : (Array.isArray(p.image_urls) ? p.image_urls.map(resolveImageUrl) : []),
              downloadUrl: p.file_url || null,
              file_url:    p.file_url || null,

              tags:        Array.isArray(p.tags) ? p.tags : [],
              downloads:   p.downloads || 0,
              revenue:     0,
              dateAdded:   p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              // ── Issue 3 fix: carry Features & Specs fields so Edit form loads correctly ──
              features:             Array.isArray(p.features)            ? p.features            : [],
              whatYouGet:           Array.isArray(p.what_you_get)        ? p.what_you_get        : [],
              systemRequirements:   Array.isArray(p.system_requirements) ? p.system_requirements : [],
              installation_guide:   p.installation_guide || '',
            }));
            setProducts(uiItems);
          }
          setProductsLoading(false);
        })
        .catch(err => {
          if (!mounted) return;
          console.warn('[ProductsManagement] Backend fetch failed, falling back to Firestore:', err.message);
          // Firestore fallback
          unsubFirestore = onSnapshot(collection(db, 'products'), (snapshot) => {
            if (!mounted) return;
            const items = snapshot.docs.map(docSnap => {
              const mapped = mapDocToProduct(docSnap);
              // Resolve relative image URLs from Firestore docs too
              return {
                ...mapped,
                thumbnail: resolveImageUrl(mapped.thumbnail),
                preview: resolveImageUrl(mapped.preview),
                image_urls: Array.isArray(mapped.image_urls) ? mapped.image_urls.map(resolveImageUrl) : [],
                gallery: Array.isArray(mapped.gallery) ? mapped.gallery.map(resolveImageUrl) : [],
                price: typeof mapped.price === 'number' ? mapped.price : parseFloat(mapped.price) || 0,
              };
            });
            setProducts(items);
            setProductsLoading(false);
          }, (fsErr) => {
            if (!mounted) return;
            console.error('Firestore fallback also failed:', fsErr);
            setApiError(fsErr.message);
            setProductsLoading(false);
          });
        });
    };

    loadFromBackend();

    // 2. Fetch orders from secure backend
    getOrders()
      .then(items => {
        if (mounted) {
          setOrders(items);
          setOrdersLoading(false);
        }
      })
      .catch(err => {
        console.error('ProductsManagement backend orders load failed:', err);
        if (mounted) {
          setOrdersLoading(false);
        }
      });

    return () => {
      mounted = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, []); // Empty deps: fetch once on mount
  
  // --- FILTERING AND SORTING STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'price-asc' | 'price-desc' | 'revenue' | 'downloads'
  const [maxPrice, setMaxPrice] = useState(300);
  const [creatorFilter, setCreatorFilter] = useState('All');

  // --- AUDIO MUTED STATE ---
  const [audioMuted, setAudioMuted] = useState(true);

  // Pagination state (M6)
  const [prodPage, setProdPage] = useState(1);
  const PROD_PAGE_SIZE = 50;

  // --- M4-M7: Pending Review state ---
  const [pendingProducts, setPendingProducts] = useState([]);
  const [rejectModal, setRejectModal] = useState(null); // { productId, reason }

  // --- UI STATES ---
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProductPreview, setSelectedProductPreview] = useState(null);
  const [notification, setNotification] = useState(null);
  const [selectedVisualMode, setSelectedVisualMode] = useState('luminescent'); // 'luminescent' | 'ambient'
  const [activeTooltip, setActiveTooltip] = useState(null);

  // --- REFS ---
  const visualModeRef = useRef(selectedVisualMode);

  useEffect(() => {
    visualModeRef.current = selectedVisualMode;
  }, [selectedVisualMode]);

  // Sync mute state to audio controller
  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);

  // --- M4-M7: Fetch pending products when "Pending Review" tab is active ---
  useEffect(() => {
    if (selectedStatus === 'Pending Review') {
      backendFetch('/admin/products/pending')
        .then(data => setPendingProducts(data.products || []))
        .catch(err => console.error('Pending products load failed:', err));
    }
  }, [selectedStatus]);


  const handleMouseMove = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.25}px, 0)`;
  };

  const handleMouseLeave = (e) => {
    const btn = e.currentTarget;
    btn.style.transform = 'translate3d(0px, 0px, 0)';
  };

  // --- NOTIFICATION UTILITY ---
  const triggerNotification = (text, type = 'success') => {
    setNotification({ text, type });
    if (type === 'success') {
      sysSound.playSuccess();
    } else {
      sysSound.playTap();
    }
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };



  // --- DYNAMIC COMPUTED ANALYTICS ---
  const analytics = useMemo(() => {
    const total = products.length;
    const published = products.filter(p => p.status === 'Published' || p.status === 'published').length;
    const draft = products.filter(p => p.status === 'Draft' || p.status === 'draft').length;

    // Filter paid/completed orders
    const paidOrders = orders.filter(o => 
      (o.paymentStatus === 'Paid' || o.paymentStatus === 'paid' || o.status === 'Completed' || o.status === 'completed' || o.status === 'paid' || o.status === 'Paid') &&
      o.status !== 'Refunded' && o.status !== 'refunded'
    );

    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || o.price || 0), 0);
    const totalDownloads = paidOrders.reduce((sum, o) => sum + (o.items ? o.items.length : 1), 0);

    // Dynamic MoM growth comparisons (last 30 days vs 30-60 days ago)
    const nowMs = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

    const recentOrders = paidOrders.filter(o => {
      const oTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return nowMs - oTime <= thirtyDaysMs;
    });

    const previousOrders = paidOrders.filter(o => {
      const oTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      const diff = nowMs - oTime;
      return diff > thirtyDaysMs && diff <= sixtyDaysMs;
    });

    const recentRev = recentOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || o.price || 0), 0);
    const prevRev = previousOrders.reduce((sum, o) => sum + (o.total || o.totalAmount || o.price || 0), 0);
    const revenueGrowthPercent = prevRev > 0 ? parseFloat(((recentRev - prevRev) / prevRev * 100).toFixed(1)) : (recentRev > 0 ? 100.0 : 0.0);

    const recentDls = recentOrders.reduce((sum, o) => sum + (o.items ? o.items.length : 1), 0);
    const prevDls = previousOrders.reduce((sum, o) => sum + (o.items ? o.items.length : 1), 0);
    const downloadsGrowthPercent = prevDls > 0 ? parseFloat(((recentDls - prevDls) / prevDls * 100).toFixed(1)) : (recentDls > 0 ? 100.0 : 0.0);

    // Determine Market Leader based on sales count, downloads, and revenue inside orders collection
    const productStats = {};
    products.forEach(p => {
      productStats[p.id] = {
        title: p.title || p.name,
        downloads: 0,
        revenue: 0,
        salesCount: 0
      };
    });

    paidOrders.forEach(o => {
      const items = o.items || (o.productId ? [{ productId: o.productId, snapshot: o.productSnapshot || {} }] : []);
      items.forEach(item => {
        const pid = item.productId;
        if (!pid) return;

        if (!productStats[pid]) {
          productStats[pid] = {
            title: item.snapshot?.title || item.snapshot?.name || o.productSnapshot?.title || 'Unknown Product',
            downloads: 0,
            revenue: 0,
            salesCount: 0
          };
        }

        const stats = productStats[pid];
        stats.salesCount += 1;
        stats.revenue += item.snapshot?.price || o.price || o.total || 0;
        if (o.downloadGranted === true || o.status === 'Completed' || o.status === 'completed') {
          stats.downloads += 1;
        }
      });
    });

    const sortedProducts = Object.values(productStats).sort((a, b) => {
      if (b.downloads !== a.downloads) return b.downloads - a.downloads;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.salesCount - a.salesCount;
    });

    const bestSellerName = sortedProducts.length > 0 && (sortedProducts[0].downloads > 0 || sortedProducts[0].salesCount > 0) ? sortedProducts[0].title : "None";

    return {
      total,
      published,
      draft,
      revenue: totalRevenue,
      downloads: totalDownloads,
      bestSeller: bestSellerName,
      revenueGrowth: revenueGrowthPercent,
      downloadsGrowth: downloadsGrowthPercent
    };
  }, [products, orders]);

  // --- DYNAMIC CHART DATA & CREATOR PERFORMANCE DATA ---
  const chartData = useMemo(() => {
    const months = [];
    const monthlyMap = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ label, key });
      monthlyMap[key] = 0;
    }

    const paidOrders = orders.filter(o => 
      (o.paymentStatus === 'Paid' || o.paymentStatus === 'paid' || o.status === 'Completed' || o.status === 'completed' || o.status === 'paid' || o.status === 'Paid') &&
      o.status !== 'Refunded' && o.status !== 'refunded'
    );

    paidOrders.forEach(o => {
      if (!o.createdAt) return;
      const orderDate = new Date(o.createdAt);
      const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap[key] !== undefined) {
        monthlyMap[key] += o.total || o.totalAmount || o.price || 0;
      }
    });

    return months.map(m => ({
      label: m.label,
      value: Math.round(monthlyMap[m.key])
    }));
  }, [orders]);

  const creatorData = useMemo(() => {
    const data = {};

    const paidOrders = orders.filter(o => 
      (o.paymentStatus === 'Paid' || o.paymentStatus === 'paid' || o.status === 'Completed' || o.status === 'completed' || o.status === 'paid' || o.status === 'Paid') &&
      o.status !== 'Refunded' && o.status !== 'refunded'
    );

    paidOrders.forEach(o => {
      const items = o.items || (o.productId ? [{ productId: o.productId, snapshot: o.productSnapshot || {} }] : []);
      items.forEach(item => {
        const pid = item.productId;
        const matchingProduct = products.find(p => p.id === pid);
        const name = matchingProduct?.creatorName || item.snapshot?.creatorName || o.vendorId || "Lumora Creator";
        const avatar = matchingProduct?.creatorAvatar || item.snapshot?.creatorAvatar || null;

        if (!data[name]) {
          data[name] = { revenue: 0, downloads: 0, avatar };
        }

        data[name].revenue += item.snapshot?.price || o.price || o.total || 0;
        if (o.downloadGranted === true || o.status === 'Completed' || o.status === 'completed') {
          data[name].downloads += 1;
        }
      });
    });

    const list = Object.entries(data).map(([name, stats]) => ({
      name,
      revenue: Math.round(stats.revenue),
      downloads: stats.downloads,
      avatar: stats.avatar
    }));

    if (list.length === 0) {
      // No order data yet — return empty state, no fake placeholder names
      return [];
    }

    return list.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, products]);

  // --- LIST OF DISTINCT CATEGORIES AND CREATORS FOR FILTER DROPDOWNS ---
  const categoriesList = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ['All', ...Array.from(list)];
  }, [products]);

  const creatorsList = useMemo(() => {
    const list = new Set(products.map(p => p.creatorName));
    return ['All', ...Array.from(list)];
  }, [products]);

  // --- FILTER & SORT LOGIC ---
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query match (Fuzzy searching matching name, creator, shortDesc, tags)
    if (searchQuery.trim() !== '') {
      const normalizedQuery = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.creatorName.toLowerCase().includes(normalizedQuery) ||
        p.shortDesc.toLowerCase().includes(normalizedQuery) ||
        p.tags.some(t => t.toLowerCase().includes(normalizedQuery))
      );
    }

    // Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Status Filter
    if (selectedStatus !== 'All') {
      result = result.filter(p => p.status === selectedStatus);
    }

    // Creator Filter
    if (creatorFilter !== 'All') {
      result = result.filter(p => p.creatorName === creatorFilter);
    }

    // Pricing Limit Filter
    result = result.filter(p => {
      const effectivePrice = p.discountPrice || p.price;
      return effectivePrice <= maxPrice;
    });

    // Sort operations
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
    } else if (sortBy === 'revenue') {
      result.sort((a, b) => b.revenue - a.revenue);
    } else if (sortBy === 'downloads') {
      result.sort((a, b) => b.downloads - a.downloads);
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedStatus, creatorFilter, maxPrice, sortBy]);

  // Pagination slice (M6)
  const prodTotalPages = Math.max(1, Math.ceil(filteredProducts.length / PROD_PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((prodPage - 1) * PROD_PAGE_SIZE, prodPage * PROD_PAGE_SIZE);

  // --- PRODUCT MANAGEMENT ACTION CONTROLLERS ---
  // WHY call the API before updating state?
  //   Optimistic updates (state first) risk showing data that failed to save.
  //   We call the API first, then use the server's response to update state.
  //   This guarantees state always reflects what PostgreSQL actually stored.

  const handleCreateProduct = async (newProductData) => {
    try {
      // newProductData is already mapped to the API schema by mapAdminProductToApi.
      // POST /api/products/ → returns ProductResponse (uses API field names: title, featured, file_url, …)
      const saved = await productService.create(newProductData);

      // Normalise the API response back to the UI field names used by the products[] list
      // so cards and list rows render correctly without waiting for the Firestore onSnapshot.
      const uiProduct = {
        id:          saved.id,
        name:        saved.title       || newProductData.title  || '',
        title:       saved.title       || '',
        creatorName: saved.seller      || saved.vendor_id || newProductData.seller || '',
        category:    saved.category    || 'Uncategorized',
        shortDesc:   saved.short_desc  || saved.description || '',
        description: saved.description || '',
        price:       saved.price != null ? parseFloat(saved.price) : 0,
        status:      saved.status === 'published' ? 'Published'
                   : saved.status === 'pending_review' ? 'Pending Review'
                   : 'Draft',
        isFeatured:  saved.featured    || false,
        featured:    saved.featured    || false,
        thumbnail:   resolveImageUrl(saved.thumbnail || saved.preview || (Array.isArray(saved.image_urls) && saved.image_urls[0]) || null),
        preview:     resolveImageUrl(saved.preview || saved.thumbnail || (Array.isArray(saved.image_urls) && saved.image_urls[0]) || null),
        image_urls:  Array.isArray(saved.image_urls) ? saved.image_urls.map(resolveImageUrl) : [],
        previewImages: Array.isArray(saved.preview_images) ? saved.preview_images.map(resolveImageUrl) : [],
        downloadUrl: saved.file_url    || null,
        file_url:    saved.file_url    || null,

        tags:        saved.tags        || [],
        downloads:   saved.downloads   || 0,
        dateAdded:   saved.created_at  ? saved.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        // Features & specs
        features:           Array.isArray(saved.features)            ? saved.features            : [],
        highlights:         Array.isArray(saved.highlights)          ? saved.highlights          : [],
        whatYouGet:         Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
        what_you_get:       Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
        systemRequirements: Array.isArray(saved.system_requirements) ? saved.system_requirements : [],
        system_requirements:Array.isArray(saved.system_requirements) ? saved.system_requirements : [],
        installation_guide: saved.installation_guide || '',
        installationGuide:  saved.installation_guide || '',
        // Form aliases used by edit modal
        keyFeatures:        Array.isArray(saved.features)            ? saved.features            : [],
        whatsIncluded:      Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
        version:            saved.version     || 'v1.0.0',
        license:            saved.license     || null,
        subcategory:        saved.subcategory || '',
        discount:           saved.discount    || 0,
        visibility:         saved.visibility  || 'public',
      };

      setProducts([uiProduct, ...products]);
      setIsNewProductOpen(false);
      triggerNotification(`Created product "${uiProduct.name}" successfully!`);
      // Signal customer AppContext to re-fetch products from the backend immediately.
      window.dispatchEvent(new CustomEvent('lumora:product:created'));
    } catch (err) {
      console.error('Create product failed:', err);
      triggerNotification(`Failed to create product: ${err.message}`, 'error');
    }
  };

  const handleUpdateProduct = async (updatedProductData) => {
    const targetId = updatedProductData.id;

    try {
      if (targetId) {
        // PATCH — updatedProductData is already mapped to API schema by mapAdminProductToApi
        const saved = await productService.update(targetId, updatedProductData);

        // Rebuild local UI state from the API response.
        // Backend ProductResponse uses API field names (title, description, featured, file_url, etc.)
        // so we translate back to UI field names for the local products[] state.
        const mapped = {
          ...updatedProductData,                             // preserve any extra UI-only fields
          id:           saved.id,
          name:         saved.title  || updatedProductData.title  || '',
          title:        saved.title  || '',
          creatorName:  saved.seller || saved.vendor_id || updatedProductData.seller || '',
          category:     saved.category    || 'Uncategorized',
          shortDesc:    saved.short_desc  || saved.description || '',
          description:  saved.description || '',
          price:        saved.price != null ? parseFloat(saved.price) : 0,
          status:       saved.status === 'published'       ? 'Published'
                      : saved.status === 'archived'        ? 'Archived'
                      : saved.status === 'pending_review'  ? 'Pending Review'
                      : 'Draft',
          isFeatured:   saved.featured     || false,
          featured:     saved.featured     || false,
          thumbnail:    resolveImageUrl(saved.thumbnail || saved.preview || (Array.isArray(saved.image_urls) && saved.image_urls[0]) || updatedProductData.thumbnail || null),
          preview:      resolveImageUrl(saved.preview || saved.thumbnail || (Array.isArray(saved.image_urls) && saved.image_urls[0]) || null),
          image_urls:   Array.isArray(saved.image_urls) ? saved.image_urls.map(resolveImageUrl) : [],
          previewImages: Array.isArray(saved.preview_images) ? saved.preview_images.map(resolveImageUrl) : [],
          downloadUrl:  saved.file_url     || updatedProductData.file_url  || null,
          file_url:     saved.file_url     || null,

          fileSize:     saved.file_size    || updatedProductData.file_size  || null,
          dateAdded:    saved.updated_at   ? saved.updated_at.split('T')[0] : updatedProductData.dateAdded,
          // Features & specs
          features:           Array.isArray(saved.features)            ? saved.features            : [],
          highlights:         Array.isArray(saved.highlights)          ? saved.highlights          : [],
          whatYouGet:         Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
          what_you_get:       Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
          systemRequirements: Array.isArray(saved.system_requirements) ? saved.system_requirements : [],
          system_requirements:Array.isArray(saved.system_requirements) ? saved.system_requirements : [],
          installation_guide: saved.installation_guide || '',
          installationGuide:  saved.installation_guide || '',
          keyFeatures:        Array.isArray(saved.features)            ? saved.features            : [],
          whatsIncluded:      Array.isArray(saved.what_you_get)        ? saved.what_you_get        : [],
          version:            saved.version     || updatedProductData.version || 'v1.0.0',
          license:            saved.license     || null,
          tags:               saved.tags        || [],
          subcategory:        saved.subcategory || '',
          discount:           saved.discount    || 0,
          visibility:         saved.visibility  || 'public',
        };
        setProducts(products.map(p => p.id === targetId ? mapped : p));
      }
      setEditingProduct(null);
      // updatedProductData.title comes from the mapper; fall back to name for display
      const displayName = updatedProductData.title || updatedProductData.name || 'product';
      triggerNotification(`Updated product details for "${displayName}"`);
      // Always notify customer AppContext to re-fetch after any product update,
      // so image changes, feature edits, and metadata updates appear immediately.
      window.dispatchEvent(new CustomEvent('lumora:product:created'));
    } catch (err) {
      console.error('Update product failed:', err);
      triggerNotification(`Failed to update product: ${err.message}`, 'error');
    }
  };

  const handleDeleteProduct = async (productId) => {
    const targetProduct = products.find(p => p.id === productId);

    try {
      if (productId) {
        // DELETE via backend API (which also removes from Firestore via admin_firestore.py)
        await productService.remove(productId);
      }
      // Remove from local admin state
      setProducts(products.filter(p => p.id !== productId));
      triggerNotification(`Removed "${targetProduct?.name || 'product'}" from Lumora`, 'info');
      // Notify customer AppContext to re-fetch immediately so deleted product
      // disappears from the marketplace without waiting for the 60s background poll.
      window.dispatchEvent(new CustomEvent('lumora:product:created'));
    } catch (err) {
      console.error('Delete product failed:', err);
      triggerNotification(`Failed to delete product: ${err.message}`, 'error');
    }
  };

  const handleTogglePublish = async (productId) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;
    // UI label (capitalised) for display; API value (lowercase) for the PATCH
    const nextStatusUI  = target.status === 'Published' ? 'Draft' : 'Published';
    const nextStatusApi = nextStatusUI.toLowerCase(); // "published" or "draft"

    try {
      if (productId) {
        // PATCH — send lowercase status matching the API schema
        await productService.update(productId, { status: nextStatusApi });
      }
      setProducts(products.map(p => {
        if (p.id === productId) {
          triggerNotification(`"${p.name}" is now ${nextStatusUI}`);
          return { ...p, status: nextStatusUI }; // keep UI label in local state
        }
        return p;
      }));
      // When a product is published, notify customer AppContext to re-fetch immediately.
      if (nextStatusUI === 'Published') {
        window.dispatchEvent(new CustomEvent('lumora:product:created'));
      }
    } catch (err) {
      console.error('Toggle publish failed:', err);
      triggerNotification(`Failed to update status: ${err.message}`, 'error');
    }
  };

  const handleDuplicateProduct = async (productId) => {
    const source = products.find(p => p.id === productId);
    if (!source) return;

    // Build UI form shape then run through the mapper so the API always receives
    // correctly named fields (title, seller, featured, file_url, etc.)
    const uiFormForDuplicate = {
      name:        `${source.name} (Copy)`,
      creatorName: source.creatorName || 'Lumora Creator',
      category:    source.category   || 'Uncategorized',
      shortDesc:   source.shortDesc  || '',
      description: source.description || '',
      price:       source.price      || 0,
      status:      'Draft',
      tags:        source.tags       || [],
      tagsInput:   (source.tags || []).join(', '),
      isFeatured:  false,
      featured:    false,
      thumbnail:   source.thumbnail  || null,
      downloadUrl: source.downloadUrl || source.file_url || null,
      fileSize:    source.fileSize   || null,
      affiliate_enabled: false,
      commission_type:   'percentage',
      commission_value:  0,
    };

    try {
      const saved = await productService.create(mapAdminProductToApi(uiFormForDuplicate));
      const uiDuplicate = {
        id:          saved.id,
        name:        saved.title       || uiFormForDuplicate.name,
        title:       saved.title       || '',
        creatorName: saved.seller      || uiFormForDuplicate.creatorName,
        category:    saved.category    || 'Uncategorized',
        shortDesc:   saved.description || '',
        description: saved.description || '',
        price:       parseFloat(saved.price) || 0,
        status:      'Draft',
        isFeatured:  false,
        featured:    false,
        thumbnail:   saved.thumbnail   || null,
        tags:        saved.tags        || [],
        downloads:   0,
        dateAdded:   saved.created_at  ? saved.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      };
      setProducts([uiDuplicate, ...products]);
      triggerNotification(`Duplicated "${source.name}"`);
    } catch (err) {
      console.error('Duplicate product failed:', err);
      triggerNotification(`Failed to duplicate product: ${err.message}`, 'error');
    }
  };

  const handleToggleFeatured = async (productId) => {
    const target = products.find(p => p.id === productId);
    if (!target) return;
    const nextFeaturedState = !target.isFeatured;

    try {
      if (productId) {
        // PATCH — send `featured` (API field name), not `isFeatured` (UI field name)
        await productService.update(productId, { featured: nextFeaturedState });
      }
      setProducts(products.map(p => {
        if (p.id === productId) {
          triggerNotification(
            nextFeaturedState
              ? `"${p.name}" featured in luxury grids`
              : `"${p.name}" removed from spotlight`
          );
          // Keep both UI field name (isFeatured) and API field name (featured) in sync
          return { ...p, isFeatured: nextFeaturedState, featured: nextFeaturedState };
        }
        return p;
      }));
    } catch (err) {
      console.error('Toggle featured failed:', err);
      triggerNotification(`Failed to update featured: ${err.message}`, 'error');
    }
  };

  // --- M4-M7: Approve / Reject handlers ---
  const handleApproveProduct = async (productId) => {
    try {
      await backendFetch(`/admin/products/${productId}/approve`, { method: 'POST' });
      setPendingProducts(prev => prev.filter(p => p.id !== productId));
      triggerNotification('Product approved!');
    } catch (err) {
      triggerNotification('Approve failed: ' + err.message, 'error');
    }
  };

  const handleRejectProduct = async () => {
    if (!rejectModal) return;
    try {
      await backendFetch(`/admin/products/${rejectModal.productId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectModal.reason || '' }),
      });
      setPendingProducts(prev => prev.filter(p => p.id !== rejectModal.productId));
      setRejectModal(null);
      triggerNotification('Product rejected.');
    } catch (err) {
      triggerNotification('Reject failed: ' + err.message, 'error');
    }
  };

  return (
    <AdminLayout activePage="products">

      {/* FIXED TOAST NOTIFICATIONS */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_12px_40px_rgba(90,30,126,0.08)]"
          >
            <div className={`w-3 h-3 rounded-full ${notification.type === 'success' ? 'bg-[#B886D0] shadow-[0_0_8px_#B886D0]' : 'bg-[#D8BFE3] shadow-[0_0_8px_#D8BFE3]'}`} />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2D004D]">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>



      {/* API loading indicator — shown briefly on first mount while fetching real products */}
      {/* Only shows the banner overlay — does NOT change any layout, colors, or spacing */}
      {apiLoading && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-[#2D004D]/80 backdrop-blur-md border border-[#D8BFE3]/30 text-xs font-semibold text-[#D8BFE3] tracking-widest uppercase flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#B886D0] animate-pulse" />
          Loading products from database…
        </div>
      )}

      {/* API error notice — shown if backend is unreachable; page falls back to mock data */}
      {apiError && !apiLoading && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-2.5 rounded-full bg-red-900/60 backdrop-blur-md border border-red-400/30 text-xs font-semibold text-red-300 tracking-widest uppercase flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          API unavailable — showing cached data
        </div>
      )}

      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">
        
        {/* --- HEADER & METRICS --- */}
        <section className="mb-14">
          <PageHeader
            title="Product Command Studio"
            subtitle="Welcome to Lumora's elite product command studio. Monitor continuous sales volume, adjust distribution pricing, deploy visual previews, and publish creator nodes effortlessly."
            actions={
              <div className="flex items-center gap-3 flex-wrap">
                <button 
                  onClick={() => {
                    sysSound.playSwoosh();
                    setIsNewProductOpen(true);
                  }}
                  className="btn-admin-primary flex items-center gap-1.5"
                  style={{ fontSize: '0.85rem' }}
                >
                  New Product
                  <ArrowUpRight size={14} />
                </button>

                <button 
                  onClick={() => {
                    setAudioMuted(!audioMuted);
                    sysSound.playTap();
                  }}
                  className="btn-admin-secondary flex items-center gap-1.5"
                >
                  {audioMuted ? <Icon name="VolumeX" size={14} /> : <Icon name="Volume2" size={14} />}
                  <span>{audioMuted ? 'Muted' : 'Sound'}</span>
                </button>

                <div className="bg-white/85 p-1 rounded-xl border border-[#F3EAF8] flex items-center gap-1.5 shadow-sm">
                  <button 
                    onClick={() => { setLayoutMode('grid'); sysSound.playTap(); }}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${layoutMode === 'grid' ? 'bg-[#2D004D] text-white' : 'text-[#7B3FA0] hover:text-[#2D004D]'}`}
                    title="Grid Layout"
                  >
                    <Icon name="Grid" size={15} />
                  </button>
                  <button 
                    onClick={() => { setLayoutMode('list'); sysSound.playTap(); }}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${layoutMode === 'list' ? 'bg-[#2D004D] text-white' : 'text-[#7B3FA0] hover:text-[#2D004D]'}`}
                    title="List Layout"
                  >
                    <Icon name="List" size={15} />
                  </button>
                </div>
              </div>
            }
          />

          {/* --- DYNAMIC METRIC CARDS --- */}
          <StatsGrid columns={4}>
            <DashboardCard
              title="TOTAL REVENUE"
              value={apiLoading ? "..." : `₹${(analytics.revenue ?? 0).toLocaleString()}`}
              icon={<Icon name="DollarSign" size={15} />}
              trend={apiLoading ? undefined : `${(analytics.revenueGrowth ?? 0) >= 0 ? '+' : ''}${analytics.revenueGrowth ?? 0}%`}
              trendLabel=""
            />
            <DashboardCard
              title="CREATOR DOWNLOADS"
              value={apiLoading ? "..." : (analytics.downloads ?? 0).toLocaleString()}
              icon={<Icon name="Download" size={15} />}
              trend={apiLoading ? undefined : `${(analytics.downloadsGrowth ?? 0) >= 0 ? '+' : ''}${analytics.downloadsGrowth ?? 0}%`}
              trendLabel=""
            />
            <DashboardCard
              title="INDEX STATUS"
              value={apiLoading ? "..." : (
                <div className="flex flex-col gap-1">
                  <span className="text-xl font-serif font-black text-[#2D004D]">{analytics.total}</span>
                  <div className="flex gap-2">
                    <span className="text-[8px] font-bold bg-[#B886D0]/30 text-[#2D004D] px-1.5 py-0.5 rounded-full">
                      {analytics.published} Active
                    </span>
                    <span className="text-[8px] font-bold bg-white border border-[#F5E9DD] text-[#7B3FA0] px-1.5 py-0.5 rounded-full">
                      {analytics.draft} Drafts
                    </span>
                  </div>
                </div>
              )}
              icon={<Icon name="Layers" size={15} />}
            />
            <DashboardCard
              title="MARKET LEADER"
              value={apiLoading ? "..." : analytics.bestSeller}
              icon={<Icon name="Award" size={15} />}
            />
          </StatsGrid>
        </section>

        {/* =================================================#
            SYSTEM TELEMETRY STAGE (DYNAMIC LUXURY SVG CHARTS)
            =================================================# */}
        <section className="mb-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart 1: Sales Velocity (Line) */}
          <div className="relative overflow-hidden rounded-3xl bg-white/45 backdrop-blur-xl border border-white/60 p-6 shadow-[0_12px_40px_rgba(90,30,126,0.02)] hover:shadow-[0_15px_45px_rgba(216,191,227,0.08)] transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[9px] tracking-widest uppercase font-black text-[#7B3FA0] block mb-1">
                  TEMPORAL SALES VELOCITY
                </span>
                <h3 className="text-base font-serif text-[#2D004D]">Marketplace Revenue Runrate</h3>
              </div>
              <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                LIVE TELEMETRY
              </span>
            </div>
            
            <div className="relative">
              {/* Dynamic Line SVG */}
              <svg viewBox="0 0 500 200" className="w-full overflow-visible">
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D8BFE3" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#F8F3FB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Gridlines */}
                <line x1="40" y1="30" x2="480" y2="30" stroke="#F5E9DD" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="90" x2="480" y2="90" stroke="#F5E9DD" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="40" y1="150" x2="480" y2="150" stroke="#F5E9DD" strokeWidth="1" strokeDasharray="3 3" />
                
                {/* Chart path rendering */}
                {(() => {
                  const maxVal = Math.max(...chartData.map(d => d.value), 1);
                  const points = chartData.map((d, i) => {
                    const x = 50 + i * 80;
                    const y = 160 - (d.value / maxVal) * 120;
                    return { x, y, label: d.label, val: d.value };
                  });
                  
                  const dPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  const fillPath = `${dPath} L ${points[points.length-1].x} 160 L ${points[0].x} 160 Z`;
                  
                  return (
                    <>
                      <path d={fillPath} fill="url(#lineGrad)" />
                      <path d={dPath} fill="none" stroke="#B886D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      
                      {/* Interaction circles */}
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r="5" 
                            fill="#F8F3FB" 
                            stroke="#B886D0" 
                            strokeWidth="2.5"
                            className="cursor-pointer transition-all duration-300 hover:r-7 hover:fill-[#D8BFE3]"
                            onMouseEnter={(e) => {
                              sysSound.playTap();
                              const rect = e.target.getBoundingClientRect();
                              // Find offset relative to the page document
                              setActiveTooltip({
                                x: rect.left + window.scrollX + 6,
                                y: rect.top + window.scrollY - 38,
                                title: `${p.label} Node`,
                                value: `₹${(p.val ?? 0).toLocaleString()}`
                              });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          />
                          <text 
                            x={p.x} 
                            y="185" 
                            textAnchor="middle" 
                            className="text-[9px] font-bold fill-[#7B3FA0] uppercase tracking-wider"
                          >
                            {p.label}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>

          {/* Chart 2: Creator Performance Matrix (Bar) */}
          <div className="relative overflow-hidden rounded-3xl bg-white/45 backdrop-blur-xl border border-white/60 p-6 shadow-[0_12px_40px_rgba(90,30,126,0.02)] hover:shadow-[0_15px_45px_rgba(216,191,227,0.08)] transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-[9px] tracking-widest uppercase font-black text-[#7B3FA0] block mb-1">
                  CREATOR PERFORMANCE MATRIX
                </span>
                <h3 className="text-base font-serif text-[#2D004D]">Ecosystem Partner Contributions</h3>
              </div>
              <span className="text-[9px] font-bold text-[#7B3FA0] bg-[#F5E9DD]/60 px-2 py-0.5 rounded-full">
                PARTNERSHIP NODES
              </span>
            </div>

            <div className="relative min-h-[180px] flex items-end justify-around gap-2 pt-8">
              {(() => {
                if (creatorData.length === 0) {
                  return (
                    <div className="w-full flex flex-col items-center justify-center gap-2 text-center py-8">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A4D8]">No order data yet</span>
                      <span className="text-[9px] text-[#D8BFE3]">Creator performance will appear once orders are placed.</span>
                    </div>
                  );
                }
                const maxVal = Math.max(...creatorData.map(c => c.revenue), 1);
                return creatorData.map((c, i) => {
                  const percent = (c.revenue / maxVal) * 100;
                  const colorsList = [
                    "from-[#D8BFE3] to-[#B886D0]", 
                    "from-[#D8BFE3] to-[#D8BFE3]", 
                    "from-[#D8BFE3] to-[#EAF4FF]", 
                    "from-[#B886D0] to-[#DDF5E5]"
                  ];
                  const colorGradient = colorsList[i % colorsList.length];
                  
                  return (
                    <div key={c.name} className="flex flex-col items-center flex-1 max-w-[80px] group/bar cursor-pointer">
                      <div className="relative w-full flex items-end justify-center h-28">
                        <div 
                          style={{ height: `${percent}%` }}
                          className={`w-8 rounded-t-xl bg-gradient-to-t ${colorGradient} opacity-75 group-hover/bar:opacity-100 group-hover/bar:scale-x-105 transition-all duration-300 relative shadow-sm`}
                          onMouseEnter={(e) => {
                            sysSound.playTap();
                            const rect = e.target.getBoundingClientRect();
                            setActiveTooltip({
                              x: rect.left + window.scrollX + 16,
                              y: rect.top + window.scrollY - 44,
                              title: c.name,
                              value: `₹${(c.revenue ?? 0).toLocaleString()} (${c.downloads ?? 0} dl)`
                            });
                          }}
                          onMouseLeave={() => setActiveTooltip(null)}
                        >
                          <div className="absolute top-[-3px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white opacity-0 group-hover/bar:opacity-100 transition-opacity duration-300" />
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center gap-1.5">
                        <img 
                          src={c.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"}
                          alt={c.name}
                          className="w-4 h-4 rounded-full object-cover border border-[#F5E9DD]"
                        />
                        <span className="text-[8px] font-bold text-[#2D004D] truncate max-w-[50px] group-hover/bar:text-[#7B3FA0] transition-colors uppercase">
                          {c.name.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </section>

        {/* Global Interactive Hover Tooltip */}
        {activeTooltip && (
          <div 
            style={{ 
              position: 'absolute', 
              left: `${activeTooltip.x}px`, 
              top: `${activeTooltip.y}px`, 
              transform: 'translate(-50%, -100%)' 
            }}
            className="z-[999] pointer-events-none px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_10px_25px_rgba(90,30,126,0.06)] flex flex-col items-center gap-0.5 transition-all duration-100 animate-fade-in"
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-[#7B3FA0] block">
              {activeTooltip.title}
            </span>
            <span className="text-xs font-black text-[#2D004D] whitespace-nowrap">
              {activeTooltip.value}
            </span>
            <div className="w-2 h-2 rotate-45 bg-white/95 border-r border-b border-white/60 absolute bottom-[-5px] left-1/2 -translate-x-1/2" />
          </div>
        )}

        {/* =================================================#
            2. INTERACTIVE FILTER & SEARCH SYSTEM
            =================================================# */}
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Query names, tags, creators..."
          filters={[
            // Category Dropdown
            <div key="category" className="relative">
              <select 
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); sysSound.playTap(); }}
                className="w-full bg-white/50 border border-[#F5E9DD]/80 rounded-xl pl-3 pr-8 h-[42px] text-xs font-semibold text-[#2D004D] focus:outline-none"
              >
                <option value="All">All Categories</option>
                {categoriesList.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>,
            // Status Dropdown
            <div key="status" className="relative">
              <select 
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); sysSound.playTap(); }}
                className="w-full bg-white/50 border border-[#F5E9DD]/80 rounded-xl pl-3 pr-8 h-[42px] text-xs font-semibold text-[#2D004D] focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Pending Review">Pending Review</option>
              </select>
            </div>,
            // Creator Dropdown
            <div key="creator" className="relative">
              <select 
                value={creatorFilter}
                onChange={(e) => { setCreatorFilter(e.target.value); sysSound.playTap(); }}
                className="w-full bg-white/50 border border-[#F5E9DD]/80 rounded-xl pl-3 pr-8 h-[42px] text-xs font-semibold text-[#2D004D] focus:outline-none"
              >
                <option value="All">All Creators</option>
                {creatorsList.filter(c => c !== 'All').map(creator => (
                  <option key={creator} value={creator}>{creator}</option>
                ))}
              </select>
            </div>,
            // Sort Dropdown
            <div key="sort" className="relative">
              <select 
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); sysSound.playTap(); }}
                className="w-full bg-white/50 border border-[#F5E9DD]/80 rounded-xl pl-3 pr-8 h-[42px] text-xs font-semibold text-[#2D004D] focus:outline-none"
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low-High</option>
                <option value="price-desc">Price: High-Low</option>
                <option value="revenue">Top Revenue</option>
                <option value="downloads">Top Downloads</option>
              </select>
            </div>
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest uppercase text-[#7B3FA0]">MAX VALUATION:</span>
                <span className="text-xs font-bold text-[#2D004D] bg-white px-2 rounded-md border border-[#F5E9DD]">
                  ₹{maxPrice}
                </span>
                <input 
                  type="range" 
                  min="30" 
                  max="350" 
                  value={maxPrice} 
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="accent-[#D8BFE3] hover:accent-[#B886D0] cursor-pointer h-1.5 w-32 bg-[#F5E9DD] rounded-lg appearance-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#7B3FA0] font-semibold">
                  Found {filteredProducts.length} artifacts
                </span>
                {(searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All' || creatorFilter !== 'All' || maxPrice !== 300) && (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setSelectedStatus('All');
                      setCreatorFilter('All');
                      setMaxPrice(300);
                      setSortBy('newest');
                      sysSound.playTap();
                    }}
                    className="text-[10px] text-red-400 hover:text-red-600 font-bold tracking-widest uppercase underline"
                  >
                    Clear Filter Overrides
                  </button>
                )}
              </div>
            </div>
          }
        />

        {/* =================================================#
            3. REAL PRODUCT INTERACTIVE GRID / CARD SYSTEM
            =================================================# */}
        <section className="mb-16">

          {/* Error state (M6) */}
          {!apiLoading && apiError && (
            <div className="mb-6 glass-surface rounded-3xl p-6 border border-red-200/40 flex flex-col items-center gap-3 text-center py-10">
              <p className="text-sm font-bold text-[#2D004D]">Failed to Load Products</p>
              <p className="text-[10px] text-[#7B3FA0]">{apiError}</p>
              <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#2D004D] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#7B3FA0] transition-colors">Retry</button>
            </div>
          )}

          {/* M4-M7: Pending Review panel */}
          {selectedStatus === 'Pending Review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
              {pendingProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#7B3FA0', opacity: 0.6 }}>
                  No products pending review.
                </div>
              ) : pendingProducts.map(product => (
                <div key={product.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  padding: '16px 20px', background: 'rgba(255,255,255,0.80)',
                  border: '1px solid rgba(196,148,230,0.20)', borderRadius: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    {product.thumbnail && <img src={product.thumbnail} alt="" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />}
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, color: '#2D004D', fontSize: '0.92rem' }}>{product.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#7B3FA0' }}>
                        {product.category} &bull; ₹{product.price} &bull; by {product.seller || 'Vendor'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleApproveProduct(product.id)}
                      style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'rgba(5,150,105,0.10)', color: '#059669', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => setRejectModal({ productId: product.id, reason: '' })}
                      style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {selectedStatus !== 'Pending Review' && apiLoading && products.length === 0 ? (
              layoutMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white/20 backdrop-blur-md rounded-2xl p-6 border border-[#F3EAF8] shadow-[0_4px_30px_rgba(90,30,126,0.015)] h-96 flex flex-col justify-between">
                      <div>
                        <div className="w-full h-48 bg-[#381347]/10 rounded-xl mb-4" />
                        <div className="h-4 bg-[#381347]/15 rounded-md w-1/4 mb-2" />
                        <div className="h-6 bg-[#381347]/20 rounded-md w-3/4 mb-3" />
                        <div className="h-4 bg-[#381347]/10 rounded-md w-full mb-1" />
                        <div className="h-4 bg-[#381347]/10 rounded-md w-5/6" />
                      </div>
                      <div className="flex justify-between items-center mt-6">
                        <div className="h-8 bg-[#381347]/15 rounded-md w-1/3" />
                        <div className="h-8 bg-[#381347]/20 rounded-md w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-4 bg-white/25 backdrop-blur-md rounded-2xl p-4 border border-white/40 animate-pulse">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white/50 border border-[#F3EAF8] h-20">
                      <div className="flex items-center gap-4 w-full md:w-5/12">
                        <div className="w-16 h-12 bg-[#381347]/15 rounded-lg flex-shrink-0" />
                        <div className="flex-1">
                          <div className="h-3 bg-[#381347]/10 rounded w-1/4 mb-1.5" />
                          <div className="h-4 bg-[#381347]/15 rounded w-3/4" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 w-full md:w-4/12 text-center md:text-left">
                        <div className="h-6 bg-[#381347]/10 rounded mb-1 w-2/3" />
                        <div className="h-6 bg-[#381347]/10 rounded mb-1 w-2/3" />
                        <div className="h-6 bg-[#381347]/10 rounded mb-1 w-2/3" />
                      </div>
                      <div className="h-8 bg-[#381347]/15 rounded w-24 md:w-3/12" />
                    </div>
                  ))}
                </div>
              )
            ) : filteredProducts.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="w-full py-20 rounded-3xl border border-dashed border-[#F3EAF8] bg-white/20 backdrop-blur-md flex flex-col items-center justify-center text-center px-4"
              >
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#7B3FA0] mb-4">
                  <Icon name="Folder" size={20} />
                </div>
                <h3 className="text-lg font-serif text-[#2D004D] mb-1">No matching assets found</h3>
                <p className="text-xs text-[#7B3FA0] max-w-sm leading-relaxed mb-6">
                  Adjust your search parameters, category tag selectors, or pricing scales to inspect alternative creative products inside the operating matrix.
                </p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedStatus('All');
                    setCreatorFilter('All');
                    setMaxPrice(300);
                    sysSound.playTap();
                  }}
                  className="px-5 py-2.5 rounded-xl border border-[#F3EAF8] hover:bg-white bg-white text-xs font-bold uppercase tracking-widest text-[#2D004D] transition-all"
                >
                  Reset Studio Filters
                </button>
              </motion.div>
            ) : layoutMode === 'grid' ? (
              
              // --- CINEMATIC CARD GRID ---
              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
              >
                {pagedProducts.map((product) => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    visualMode={selectedVisualMode}
                    onPreview={() => {
                      sysSound.playSwoosh();
                      setSelectedProductPreview(product);
                    }}
                    onEdit={() => {
                      sysSound.playSwoosh();
                      setEditingProduct(product);
                    }}
                    onTogglePublish={() => handleTogglePublish(product.id)}
                    onDuplicate={() => handleDuplicateProduct(product.id)}
                    onToggleFeatured={() => handleToggleFeatured(product.id)}
                    onDelete={() => handleDeleteProduct(product.id)}
                  />
                ))}
              </motion.div>
            ) : (
              
              // --- PREMIUM SLICK LIST LAYOUT ---
              <motion.div 
                layout
                className="flex flex-col gap-4"
              >
                <TableContainer>
                  <div className="flex flex-col gap-4 p-4">
                    {pagedProducts.map((product) => (
                      <ProductListRow 
                        key={product.id}
                        product={product}
                        onPreview={() => {
                          sysSound.playSwoosh();
                          setSelectedProductPreview(product);
                        }}
                        onEdit={() => {
                          sysSound.playSwoosh();
                          setEditingProduct(product);
                        }}
                        onTogglePublish={() => handleTogglePublish(product.id)}
                        onDuplicate={() => handleDuplicateProduct(product.id)}
                        onToggleFeatured={() => handleToggleFeatured(product.id)}
                        onDelete={() => handleDeleteProduct(product.id)}
                      />
                    ))}
                  </div>
                </TableContainer>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination controls (M6) */}
          {!apiLoading && !apiError && prodTotalPages > 1 && (
            <div className="flex items-center justify-between mt-6 px-1">
              <span className="text-[9px] text-[#7B3FA0] font-bold">
                Page {prodPage} of {prodTotalPages} &bull; {filteredProducts.length} products
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setProdPage(p => Math.max(1, p - 1))}
                  disabled={prodPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setProdPage(p => Math.min(prodTotalPages, p + 1))}
                  disabled={prodPage === prodTotalPages}
                  className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* =================================================#
          4. MODAL: CINEMATIC NEW PRODUCT CREATION STUDIO
          =================================================# */}
      <AnimatePresence>
        {isNewProductOpen && (
          <ProductFormModal 
            onClose={() => {
              sysSound.playSwoosh();
              setIsNewProductOpen(false);
            }}
            onSubmit={handleCreateProduct}
          />
        )}
      </AnimatePresence>

      {/* =================================================#
          5. MODAL: REAL-TIME EDITING WORKFLOW PANEL
          =================================================# */}
      <AnimatePresence>
        {editingProduct && (
          <ProductFormModal 
            product={editingProduct}
            onClose={() => {
              sysSound.playSwoosh();
              setEditingProduct(null);
            }}
            onSubmit={handleUpdateProduct}
          />
        )}
      </AnimatePresence>

      {/* =================================================#
          6. MODAL: ULTRA-PREMIUM PREVIEW STAGE
          =================================================# */}
      <AnimatePresence>
        {selectedProductPreview && (
          <ProductPreviewModal 
            product={selectedProductPreview}
            onClose={() => {
              sysSound.playSwoosh();
              setSelectedProductPreview(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* LUXURY FOOTER METRIC BRANDING */}
      <footer className="w-full py-16 px-6 border-t border-[#F3EAF8] bg-white/20 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-[#2D004D] mb-2">LUMORA OPERATING SYSTEM</span>
            <span className="text-xs text-[#7B3FA0] max-w-sm text-center md:text-left leading-relaxed">
              Bespoke luxury technology for decentralized digital creator marketplaces. Engineered using GPU accelerated shaders and responsive microtonal audio haptics.
            </span>
          </div>
          <div className="flex gap-8 text-[11px] font-bold tracking-widest text-[#7B3FA0] uppercase">
            <a href="#" className="hover:text-[#2D004D] transition-colors">Documentation</a>
            <a href="#" className="hover:text-[#2D004D] transition-colors">API Endpoint</a>
            <a href="#" className="hover:text-[#2D004D] transition-colors">Creator Ledger</a>
          </div>
        </div>
      </footer>
    </AdminLayout>
  );
}

// =========================================================================
// PREMIUM PRODUCT CARD COMPONENT
// =========================================================================
function ProductCard({ product, onPreview, onEdit, onTogglePublish, onDuplicate, onToggleFeatured, onDelete, visualMode }) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0); // For sliding carousel gallery
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const videoRef = useRef(null);

  // Computed visual styling based on user visualMode configuration
  const glowBorderClass = useMemo(() => {
    if (visualMode === 'luminescent') {
      return "hover:border-[#D8BFE3] hover:shadow-[0_15px_35px_rgba(216,191,227,0.22)]";
    }
    return "hover:border-[#D8BFE3] hover:shadow-[0_15px_35px_rgba(216,191,227,0.18)]";
  }, [visualMode]);

  // Combine primary thumbnail and optional extra gallery angles for carousel navigation
  // Support both 'gallery' (Firestore) and 'image_urls' (SQLite backend)
  const mediaList = useMemo(() => {
    const primary = product.thumbnail || product.preview || null;
    const extra = (product.image_urls || product.gallery || []).filter(Boolean);
    const allImages = [primary, ...extra].filter(Boolean);
    // Resolve any relative /uploads/... paths to full backend URLs
    return allImages.map(url =>
      (url && url.startsWith('/')) ? `${BACKEND_ORIGIN}${url}` : url
    );
  }, [product]);

  const handleNextMedia = (e) => {
    e.stopPropagation();
    sysSound.playTap();
    setActiveMediaIndex((prev) => (prev + 1) % mediaList.length);
  };

  const handlePrevMedia = (e) => {
    e.stopPropagation();
    sysSound.playTap();
    setActiveMediaIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length);
  };

  const toggleVideoPlay = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    sysSound.playTap();
    if (isPlayingVideo) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlayingVideo(!isPlayingVideo);
  };

  return (
    <div className={`relative group flex flex-col rounded-2xl bg-white/50 backdrop-blur-md border border-[#F3EAF8]/80 transition-all duration-500 overflow-hidden ${glowBorderClass}`}>
      
      {/* Featured visual strip */}
      {product.isFeatured && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] shadow-sm">
          <Icon name="Star" size={10} className="text-[#2D004D] fill-current" />
          <span className="text-[8px] font-black tracking-widest uppercase text-[#2D004D]">SPOTLIGHT</span>
        </div>
      )}

      {/* Node Status Badge */}
      <div className={`absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full text-[8px] font-extrabold tracking-widest uppercase shadow-sm ${
        product.status === 'Published' 
          ? 'bg-[#B886D0]/80 text-[#365D44]' 
          : 'bg-[#F5E9DD]/80 text-[#7B3FA0]'
      }`}>
        {product.status}
      </div>

      {/* --- PREMIUM COMPOSITE MEDIA CONTAINER --- */}
      <div className="relative w-full aspect-[4/3] bg-white overflow-hidden group-hover:scale-[1.01] transition-transform duration-500">
        
        {/* Playable Video overlay check */}
        {product.videoUrl && isPlayingVideo ? (
          <video 
            ref={videoRef}
            src={product.videoUrl} 
            className="w-full h-full object-cover"
            controls
            autoPlay
            muted
            onEnded={() => setIsPlayingVideo(false)}
          />
        ) : mediaList.length > 0 ? (
          // Visual Image Slide Carousel
          <img 
            src={mediaList[activeMediaIndex]} 
            alt={product.name} 
            className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
            onError={(e) => {
              // Current carousel image 404 — try the next available URL or show placeholder
              const next = mediaList.find((url, i) => i !== activeMediaIndex && url);
              if (next) {
                e.target.src = next;
              } else {
                e.target.style.display = 'none';
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#F8F3FB]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#C4A4D8] opacity-60">No Image</span>
          </div>
        )}

        {/* Dynamic Dark Gradient Shading */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Audio Video Trigger Button (on-card playable) */}
        {product.videoUrl && !isPlayingVideo && (
          <button 
            onClick={toggleVideoPlay}
            className="absolute bottom-4 left-4 z-20 w-9 h-9 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#2D004D] hover:bg-white hover:scale-110 shadow-md transition-all duration-300"
            title="Play Atmospheric Preview"
          >
            <Icon name="Play" size={13} className="ml-0.5" />
          </button>
        )}

        {isPlayingVideo && (
          <button 
            onClick={toggleVideoPlay}
            className="absolute bottom-4 left-4 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center text-[#2D004D] hover:bg-white shadow-md transition-all duration-300"
          >
            <Icon name="Pause" size={13} />
          </button>
        )}

        {/* Carousel Slide Multi-indicators */}
        {mediaList.length > 1 && !isPlayingVideo && (
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 px-2 flex justify-between pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button 
              onClick={handlePrevMedia}
              className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#2D004D] pointer-events-auto hover:bg-white"
            >
              <Icon name="ChevronLeft" size={14} />
            </button>
            <button 
              onClick={handleNextMedia}
              className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-[#2D004D] pointer-events-auto hover:bg-white"
            >
              <Icon name="ChevronRight" size={14} />
            </button>
          </div>
        )}

        {/* Mini dot carousel markers */}
        {mediaList.length > 1 && !isPlayingVideo && (
          <div className="absolute bottom-4 right-4 flex gap-1 z-20">
            {mediaList.map((url, idx) => (
              <span 
                key={url}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activeMediaIndex ? 'bg-white w-3' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- CARD CONTENT PANEL --- */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Creator Profile Stamp */}
          <div className="flex items-center gap-2 mb-3">
            <img 
              src={product.creatorAvatar} 
              alt={product.creatorName}
              className="w-5 h-5 rounded-full object-cover border border-[#F5E9DD]" 
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0]">
              {product.creatorName}
            </span>
            <span className="text-xs text-[#F3EAF8]">•</span>
            <span className="text-[9px] font-bold text-[#7B3FA0] bg-[#F5E9DD]/55 px-2 py-0.5 rounded-full">
              {product.category}
            </span>
          </div>

          <h3 className="text-lg font-serif text-[#2D004D] leading-tight mb-2 hover:text-[#7B3FA0] transition-colors cursor-pointer" onClick={onPreview}>
            {product.name}
          </h3>
          
          <p className="text-xs text-[#7B3FA0] line-clamp-2 leading-relaxed mb-4">
            {product.shortDesc}
          </p>

          {/* Tags cloud */}
          <div className="flex flex-wrap gap-1.5 mb-6">
            {product.tags.map((tag) => (
              <span key={tag} className="text-[9px] font-semibold text-[#7B3FA0] bg-white border border-[#F5E9DD]/60 px-2 py-0.5 rounded">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          {/* Dynamic Sales Volume / Price Info */}
          <div className="py-4 border-t border-[#F3EAF8] grid grid-cols-2 gap-4 items-center mb-5">
            <div>
              <span className="text-[9px] text-[#7B3FA0] font-bold tracking-widest uppercase block mb-1">
                VALUE RATIO
              </span>
              <div className="flex items-center gap-1.5">
                {product.discountPrice ? (
                  <>
                    <span className="text-base font-bold text-[#2D004D]">
                      ₹{product.discountPrice}
                    </span>
                    <span className="text-xs text-[#7B3FA0] line-through">
                      ₹{product.price}
                    </span>
                  </>
                ) : (
                  <span className="text-base font-bold text-[#2D004D]">
                    ₹{product.price}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-[9px] text-[#7B3FA0] font-bold tracking-widest uppercase block mb-1">
                VOLUME PERFORMANCE
              </span>
              <span className="text-xs font-bold text-[#2D004D] block">
                {(product.downloads ?? 0).toLocaleString()} sales
              </span>
              <span className="text-[9px] font-medium text-emerald-500 block">
                +₹{(product.revenue ?? 0).toLocaleString()} revenue
              </span>
            </div>
          </div>

          {/* REAL INTERACTIONS & ACTION BUTTONS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>

            {/* Inspect / Preview */}
            <button
              onClick={() => { sysSound.playTap(); onPreview(); }}
              title="Inspect"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid rgba(245,233,221,0.8)', background: 'transparent',
                height: 'auto', minHeight: 'unset', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                style={{ fill: 'none', stroke: '#7B3FA0', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
            </button>

            {/* Edit */}
            <button
              onClick={() => { sysSound.playTap(); onEdit(); }}
              title="Edit"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid rgba(245,233,221,0.8)', background: 'transparent',
                height: 'auto', minHeight: 'unset', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                style={{ fill: 'none', stroke: '#7B3FA0', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>

            {/* QR Code */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ProductQrButton product={{ id: product.id, title: product.name || product.title, price: product.price }} />
            </div>

            {/* Toggle Publish State */}
            <button
              onClick={() => { sysSound.playTap(); onTogglePublish(); }}
              title={product.status === 'Published' ? 'Unpublish' : 'Publish'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '10px', cursor: 'pointer',
                border: product.status === 'Published' ? '1px solid #d1fae5' : '1px solid rgba(245,233,221,0.8)',
                background: product.status === 'Published' ? 'rgba(209,250,229,0.4)' : 'transparent',
                height: 'auto', minHeight: 'unset', transition: 'all 0.18s',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                style={{ fill: 'none', stroke: product.status === 'Published' ? '#059669' : '#7B3FA0', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </button>

            {/* Duplicate */}
            <button
              onClick={() => { sysSound.playTap(); onDuplicate(); }}
              title="Duplicate"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid rgba(245,233,221,0.8)', background: 'transparent',
                height: 'auto', minHeight: 'unset', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                style={{ fill: 'none', stroke: '#7B3FA0', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>

            {/* Delete */}
            <button
              onClick={() => { sysSound.playTap(); onDelete(); }}
              title="Delete"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '8px', borderRadius: '10px', cursor: 'pointer',
                border: '1px solid #fee2e2', background: 'transparent',
                height: 'auto', minHeight: 'unset', transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                style={{ fill: 'none', stroke: '#ef4444', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', flexShrink: 0 }}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </button>

          </div>


        </div>

      </div>
    </div>
  );
}

// =========================================================================
// PREMIUM PRODUCT ROW COMPONENT (LIST VIEW MODE)
// =========================================================================
function ProductListRow({ product, onPreview, onEdit, onTogglePublish, onDuplicate, onToggleFeatured, onDelete }) {
  return (
    <div className="group flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white/50 hover:bg-white/80 border border-[#F3EAF8] hover:border-[#D8BFE3]/40 transition-all duration-300">
      
      {/* Row core thumbnail & description */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-5/12">
        <div className="w-16 h-12 rounded-lg bg-white overflow-hidden flex-shrink-0">
          <img src={product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold text-[#7B3FA0] bg-[#F5E9DD]/60 px-2 py-0.5 rounded">
              {product.category}
            </span>
            <span className="text-[10px] text-[#7B3FA0] font-bold">
              {product.creatorName}
            </span>
          </div>
          <h4 className="text-sm font-serif font-bold text-[#2D004D] truncate hover:text-[#7B3FA0] cursor-pointer" onClick={onPreview}>
            {product.name}
          </h4>
        </div>
      </div>

      {/* Analytics stats */}
      <div className="grid grid-cols-3 gap-4 w-full md:w-4/12 text-center md:text-left">
        <div>
          <span className="text-[8px] text-[#7B3FA0] font-extrabold tracking-widest block mb-0.5 uppercase">VALUATION</span>
          <span className="text-xs font-bold text-[#2D004D]">
            ₹{product.discountPrice || product.price}
          </span>
        </div>
        <div>
          <span className="text-[8px] text-[#7B3FA0] font-extrabold tracking-widest block mb-0.5 uppercase">DOWNLOADS</span>
          <span className="text-xs font-bold text-[#2D004D]">
            {product.downloads}
          </span>
        </div>
        <div>
          <span className="text-[8px] text-[#7B3FA0] font-extrabold tracking-widest block mb-0.5 uppercase">REVENUE</span>
          <span className="text-xs font-bold text-[#2D004D]">
            ₹{(product.revenue ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Row state toggle + Actions */}
      <div className="flex items-center gap-2 w-full md:w-3/12 justify-end">
        <div className="flex gap-1">
          <button 
            onClick={onPreview}
            className="p-2 rounded-lg hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
            title="Inspect"
          >
            <Icon name="Eye" size={14} />
          </button>
          <button 
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
            title="Edit Parameters"
          >
            <Icon name="Edit2" size={14} />
          </button>
          <ProductQrButton product={{ id: product.id, title: product.name || product.title, price: product.price }} />
          <button 
            onClick={onTogglePublish}
            className={`p-2 rounded-lg transition-colors ${product.status === 'Published' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-[#7B3FA0] hover:bg-white'}`}
            title="Toggle Live State"
          >
            <Icon name="Globe" size={14} />
          </button>
          <button 
            onClick={onDuplicate}
            className="p-2 rounded-lg hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
            title="Duplicate"
          >
            <Icon name="Copy" size={14} />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
            title="Delete Node"
          >
            <Icon name="Trash2" size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}

// =========================================================================
// PREMIUM CREATION & EDITING FORM COMPONENT
// =========================================================================
function ProductFormModal({ product, onClose, onSubmit }) {
  const categories = ["Graphics & UI", "Typography", "Video Assets", "Sound Design", "3D Artifacts"];

  const [form, setForm] = useState({
    name: product?.name || '',
    creatorName: product?.creatorName || '',
    creatorAvatar: product?.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    category: product?.category || 'Graphics & UI',
    shortDesc: product?.shortDesc || '',
    description: product?.description || '',
    price: product?.price != null ? product.price : '',
    discountPrice: product?.discountPrice || '',
    status: product?.status || 'Published',
    tagsInput: product?.tags?.join(', ') || '',
    thumbnail: product?.thumbnail || null,
    galleryInput: product?.gallery?.join(', ') || '',
    videoUrl: product?.videoUrl || '',
    zipName: product?.zipName || '',
    seoTitle: product?.seoTitle || '',
    seoKeywords: product?.seoKeywords || '',
    slug: product?.slug || '',
    // ── Storage delivery fields ───────────────────────────────────────────────
    storagePath:  product?.storagePath  || null,   // Firebase Storage path
    downloadUrl:  product?.downloadUrl  || null,   // permanent HTTPS URL
    fileSize:     product?.fileSize     || null,   // bytes
    fileName:     product?.fileName     || null,   // original filename

    image_urls:    Array.isArray(product?.image_urls)
      ? product.image_urls
      : Array.isArray(product?.imageUrls)
        ? product.imageUrls
        : [],

    // ── Section 5: Features & Specs ──────────────────────────────────────────
    keyFeatures:         Array.isArray(product?.features)            ? product.features            : [],
    whatsIncluded:       Array.isArray(product?.whatYouGet)          ? product.whatYouGet          : [],
    systemRequirements:  Array.isArray(product?.systemRequirements)  ? product.systemRequirements  : [],
    installationGuide:   product?.installationGuide                  || product?.installation_guide || '',
  });

  const [thumbPreview, setThumbPreview] = useState(form.thumbnail);
  const [demoVideoPreview, setDemoVideoPreview] = useState(form.videoUrl);

  // ── Section 5: Features & Specs — scoped input state for DynamicListEditor instances ──
  const [keyFeaturesInput,        setKeyFeaturesInput]        = useState('');
  const [whatsIncludedInput,       setWhatsIncludedInput]      = useState('');
  const [systemRequirementsInput,  setSystemRequirementsInput] = useState('');

  const [isDragging, setIsDragging] = useState({
    thumbnail: false,
    gallery: false,
    video: false,
    zip: false
  });

  const [galleryPreviews, setGalleryPreviews] = useState(
    Array.isArray(product?.image_urls) ? product.image_urls : (product?.gallery || [])
  );

  const [uploadProgress, setUploadProgress] = useState({
    thumbnail: null,
    gallery: null,
    video: null,
    zip: null
  });

  // Tracks whether a real Firebase Storage upload is in progress for each slot
  const [uploadingFile, setUploadingFile] = useState({
    thumbnail: false,
    zip: false,
  });

  // Error state for failed Storage uploads
  const [uploadError, setUploadError] = useState({
    thumbnail: null,
    zip: null,
    gallery: null,
  });

  const simulateUpload = (file, field, onComplete) => {
    sysSound.playTap();
    setUploadProgress(prev => ({ ...prev, [field]: 0 }));
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        sysSound.playSuccess();
        setTimeout(() => {
          setUploadProgress(prev => ({ ...prev, [field]: null }));
          onComplete();
        }, 300);
      }
      setUploadProgress(prev => ({ ...prev, [field]: progress }));
    }, 80);
  };

  const handleDrag = (e, type, active) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [type]: active }));
  };

  const handleDrop = (e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(prev => ({ ...prev, [type]: false }));
    
    if (type === 'gallery') {
      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;
      handleGalleryFiles(files);
    } else {
      const file = e.dataTransfer.files[0];
      if (!file) return;
      handleSingleFile(file, type);
    }
  };

  const handleFileChange = (e, type) => {
    if (type === 'gallery') {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      handleGalleryFiles(files);
    } else {
      const file = e.target.files[0];
      if (!file) return;
      handleSingleFile(file, type);
    }
  };

  const handleSingleFile = (file, type) => {
    // ── ZIP / product deliverable — upload to Firebase Storage ────────────────
    if (type === 'zip') {
      // We need a productId to build the storage path.
      // If editing an existing product, use its id.
      // If creating a new product, use a temporary ID; the save handler will
      // use the Firestore-assigned docId on the final record.
      const tempId = product?.id ? String(product.id) : `tmp_${Date.now()}`;

      setUploadError(prev => ({ ...prev, zip: null }));
      setUploadingFile(prev => ({ ...prev, zip: true }));
      setUploadProgress(prev => ({ ...prev, zip: 0 }));
      sysSound.playTap();

      uploadProductFile(file, tempId, (percent) => {
        setUploadProgress(prev => ({ ...prev, zip: percent }));
      })
        .then((result) => {
          sysSound.playSuccess();
          setUploadProgress(prev => ({ ...prev, zip: null }));
          setUploadingFile(prev => ({ ...prev, zip: false }));
          // Store all three storage fields into form state
          setForm(prev => ({
            ...prev,
            zipName:     result.fileName,
            storagePath: result.storagePath,
            downloadUrl: result.downloadUrl,
            fileSize:    result.fileSize,
            fileName:    result.fileName,
          }));
        })
        .catch((err) => {
          console.error('[ProductForm] ZIP upload failed:', err);
          setUploadProgress(prev => ({ ...prev, zip: null }));
          setUploadingFile(prev => ({ ...prev, zip: false }));
          setUploadError(prev => ({ ...prev, zip: `Upload failed: ${err.message}` }));
        });

      return;
    }

    // ── Thumbnail — upload to Firebase Storage ────────────────────────────────
    if (type === 'thumbnail') {
      const tempId = product?.id ? String(product.id) : `tmp_${Date.now()}`;
      const previewUrl = URL.createObjectURL(file);

      setUploadError(prev => ({ ...prev, thumbnail: null }));
      setUploadingFile(prev => ({ ...prev, thumbnail: true }));
      setUploadProgress(prev => ({ ...prev, thumbnail: 0 }));
      sysSound.playTap();

      // Show local preview immediately while uploading
      setThumbPreview(previewUrl);

      uploadThumbnail(file, tempId, (percent) => {
        setUploadProgress(prev => ({ ...prev, thumbnail: percent }));
      })
        .then((result) => {
          sysSound.playSuccess();
          setUploadProgress(prev => ({ ...prev, thumbnail: null }));
          setUploadingFile(prev => ({ ...prev, thumbnail: false }));
          // Replace the local blob URL with the permanent Storage URL
          setThumbPreview(result.downloadUrl);
          setForm(prev => ({ ...prev, thumbnail: result.downloadUrl }));
        })
        .catch((err) => {
          console.error('[ProductForm] Thumbnail upload failed:', err);
          setUploadProgress(prev => ({ ...prev, thumbnail: null }));
          setUploadingFile(prev => ({ ...prev, thumbnail: false }));
          setUploadError(prev => ({ ...prev, thumbnail: `Thumbnail upload failed: ${err.message}` }));
          // Keep local preview even if upload failed
        });

      return;
    }

    // ── Video — local object URL only (large files, not uploaded to Storage) ──
    if (type === 'video') {
      const objectUrl = URL.createObjectURL(file);
      simulateUpload(file, type, () => {
        setDemoVideoPreview(objectUrl);
        setForm(prev => ({ ...prev, videoUrl: objectUrl }));
      });
    }
  };

  const handleGalleryFiles = (files) => {
    // Upload each gallery image to the backend and add its URL to image_urls
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // Show a preview immediately for UX (local blob URLs while uploading)
    const localPreviews = imageFiles.map(f => URL.createObjectURL(f));
    setGalleryPreviews(prev => [...prev, ...localPreviews]);
    sysSound.playTap();

    // Upload each file in parallel
    Promise.allSettled(
      imageFiles.map((f, i) =>
        uploadGalleryImage(f, (pct) => {
          // Use gallery progress for the first image as a general indicator
          if (i === 0) setUploadProgress(prev => ({ ...prev, gallery: pct }));
        })
      )
    ).then((results) => {
      setUploadProgress(prev => ({ ...prev, gallery: null }));
      sysSound.playSuccess();

      const uploadedUrls = [];
      const failedCount = [];

      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          uploadedUrls.push(res.value.downloadUrl);
          // Replace the local blob preview with the real backend URL
          setGalleryPreviews(prev => {
            const updated = [...prev];
            // find the blob URL for this file and replace it
            const blobIdx = updated.indexOf(localPreviews[i]);
            if (blobIdx !== -1) updated[blobIdx] = res.value.downloadUrl;
            return updated;
          });
        } else {
          failedCount.push(i);
          console.error('[Gallery] Upload failed for image', i, res.reason);
          // Remove the local preview for the failed upload
          setGalleryPreviews(prev => prev.filter(u => u !== localPreviews[i]));
        }
      });

      if (uploadedUrls.length > 0) {
        // Add backend URLs to image_urls so they persist
        handleChange('image_urls', [
          ...(form.image_urls || []),
          ...uploadedUrls.filter(u => !(form.image_urls || []).includes(u)),
        ]);

        // Also keep galleryInput in sync (legacy field)
        setForm(prev => {
          const existing = prev.galleryInput
            ? prev.galleryInput.split(',').map(g => g.trim()).filter(Boolean)
            : [];
          return {
            ...prev,
            galleryInput: [...existing, ...uploadedUrls].filter(Boolean).join(', '),
          };
        });
      }

      if (failedCount.length > 0) {
        setUploadError(prev => ({
          ...prev,
          gallery: `${failedCount.length} image${failedCount.length > 1 ? 's' : ''} failed to upload.`,
        }));
      }
    });
  };

  const handleRemoveGalleryItem = (indexToRemove) => {
    sysSound.playTap();
    const removedUrl = galleryPreviews[indexToRemove];
    const updatedPreviews = galleryPreviews.filter((_, idx) => idx !== indexToRemove);
    setGalleryPreviews(updatedPreviews);
    setForm(prev => ({
      ...prev,
      galleryInput: updatedPreviews.join(', '),
      image_urls: (prev.image_urls || []).filter(u => u !== removedUrl),
    }));
  };

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  // mapAdminProductToApi is defined at module scope (above the App component)
  // so both App and ProductFormModal can call it without duplication.

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.name.trim() === '' || isSubmitting) return;

    setIsSubmitting(true);
    sysSound.playTap();

    // ── Auto-flush any pending tag-input text before submitting ──────────────
    // If the admin typed a feature/tag but didn't press Enter, capture it now
    // so it's not silently lost on save.
    let finalForm = { ...form };

    if (keyFeaturesInput.trim()) {
      finalForm = { ...finalForm, keyFeatures: [...(finalForm.keyFeatures || []), keyFeaturesInput.trim()] };
      setKeyFeaturesInput('');
    }
    if (whatsIncludedInput.trim()) {
      finalForm = { ...finalForm, whatsIncluded: [...(finalForm.whatsIncluded || []), whatsIncludedInput.trim()] };
      setWhatsIncludedInput('');
    }
    if (systemRequirementsInput.trim()) {
      finalForm = { ...finalForm, systemRequirements: [...(finalForm.systemRequirements || []), systemRequirementsInput.trim()] };
      setSystemRequirementsInput('');
    }

    // Translate Admin UI model → FastAPI ProductCreate schema
    const apiPayload = mapAdminProductToApi(finalForm);

    try {
      if (product) {
        // Edit: merge UI id back so the parent handler knows which record to PATCH
        await onSubmit({ id: product.id, ...apiPayload });
      } else {
        await onSubmit(apiPayload);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 w-full h-full bg-[#2D004D]/30 backdrop-blur-md flex justify-end overflow-hidden"
      style={{ zIndex: 1000 }}
    >
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="w-full max-w-2xl bg-white h-full shadow-[-10px_0_40px_rgba(90,30,126,0.1)] flex flex-col justify-between overflow-hidden border-l border-[#F3EAF8]"
      >
        
        {/* Panel Header */}
        <div className="px-8 py-6 border-b border-[#F3EAF8] flex items-center justify-between bg-white/45 backdrop-blur-md">
          <div>
            <span className="text-[10px] tracking-widest uppercase font-extrabold text-[#7B3FA0] block mb-1">
              CREATOR DESIGN MATRIX
            </span>
            <h2 className="text-xl font-serif text-[#2D004D]">
              {product ? `Edit Artifact: ${product.name}` : "Create Creative Product"}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white transition-colors flex items-center justify-center text-[#7B3FA0] hover:text-[#2D004D]"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Dynamic Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-8 flex-1 overflow-y-auto space-y-6">
          
          {/* Section: Basic Metadata */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-3 pb-1 border-b border-[#F3EAF8]">
              1. Identity Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Product Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Celestial Core Shaders"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3] text-[#2D004D]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Creator Persona</label>
                <input 
                  type="text" 
                  value={form.creatorName}
                  onChange={(e) => handleChange('creatorName', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Category Bracket</label>
                <select 
                  value={form.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3]"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Editorial Hook (Short Description)</label>
                <input 
                  type="text" 
                  required
                  placeholder="Atmospheric shaders forged in light..."
                  value={form.shortDesc}
                  onChange={(e) => handleChange('shortDesc', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Technical Specifications (Long Description)</label>
                <textarea 
                  rows={4}
                  placeholder="Complete blueprint properties for creators..."
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3]"
                />
              </div>
            </div>
          </div>

          {/* Section: Pricing System */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-3 pb-1 border-b border-[#F3EAF8]">
              2. Commercial Valuation
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Base Price (₹)</label>
                <input 
                  type="number" 
                  required
                  value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Campaign Discount Price (₹)</label>
                <input 
                  type="number" 
                  placeholder="No active discounts"
                  value={form.discountPrice}
                  onChange={(e) => handleChange('discountPrice', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Live Asset Upload Station */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-4 pb-1 border-b border-[#F3EAF8]">
              3. Visual Preview Assets (Cinematic Upload Studio)
            </h3>
            
            <div className="space-y-6">
              {/* Dropzone 1: Display Thumbnail */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-2">
                  Primary Display Thumbnail
                </label>
                
                <div 
                  className={`relative h-28 rounded-2xl border border-dashed transition-all flex items-center justify-center p-4 ${
                    isDragging.thumbnail 
                      ? 'border-[#D8BFE3] bg-[#D8BFE3]/5' 
                      : 'border-[#F5E9DD] hover:border-[#D8BFE3]/60 bg-white/40'
                  }`}
                  onDragOver={(e) => handleDrag(e, 'thumbnail', true)}
                  onDragLeave={(e) => handleDrag(e, 'thumbnail', false)}
                  onDrop={(e) => handleDrop(e, 'thumbnail')}
                >
                  <input 
                    type="file" 
                    id="thumb-file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'thumbnail')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  
                  {uploadProgress.thumbnail !== null ? (
                    <div className="flex flex-col items-center w-full px-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0] mb-1">
                        Uploading Display Node: {uploadProgress.thumbnail}%
                      </span>
                      <div className="w-full h-1 bg-[#F5E9DD] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] transition-all duration-75"
                          style={{ width: `${uploadProgress.thumbnail}%` }}
                        />
                      </div>
                    </div>
                  ) : thumbPreview ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#F5E9DD]">
                          <img src={thumbPreview} alt="Thumbnail preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[#2D004D] truncate max-w-[200px]">Active Display Node</span>
                          <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Loaded Instantly</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] bg-white border border-[#F5E9DD]/80 px-3 py-1.5 rounded-xl">
                        Replace Node
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <Icon name="Plus" size={16} className="text-[#7B3FA0] mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D]">
                        Drag Thumbnail Here or Browse
                      </span>
                      <span className="text-[9px] text-[#7B3FA0] uppercase tracking-widest mt-0.5">
                        JPEG, PNG up to 10MB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dropzone 2: Gallery Uploads (Multiple Image Files) */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-2">
                  Creative Display Angles (Multiple Gallery Assets)
                </label>
                
                <div 
                  className={`relative h-24 rounded-2xl border border-dashed transition-all flex items-center justify-center p-4 mb-3 ${
                    isDragging.gallery 
                      ? 'border-[#D8BFE3] bg-[#D8BFE3]/5' 
                      : 'border-[#F5E9DD] hover:border-[#D8BFE3]/60 bg-white/40'
                  }`}
                  onDragOver={(e) => handleDrag(e, 'gallery', true)}
                  onDragLeave={(e) => handleDrag(e, 'gallery', false)}
                  onDrop={(e) => handleDrop(e, 'gallery')}
                >
                  <input 
                    type="file" 
                    id="gallery-files"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'gallery')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  
                  {uploadProgress.gallery !== null ? (
                    <div className="flex flex-col items-center w-full px-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0] mb-1">
                        Uploading Gallery Elements: {uploadProgress.gallery}%
                      </span>
                      <div className="w-full h-1 bg-[#F5E9DD] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] transition-all duration-75"
                          style={{ width: `${uploadProgress.gallery}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <Icon name="Plus" size={16} className="text-[#7B3FA0] mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D]">
                        Drag Additional Angles Here or Click
                      </span>
                      <span className="text-[9px] text-[#7B3FA0] uppercase tracking-widest mt-0.5">
                        Select multiple assets
                      </span>
                    </div>
                  )}
                </div>

                {/* Render live gallery cards with deletions */}
                {galleryPreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {galleryPreviews.map((preview, idx) => (
                      <div key={preview} className="relative group/thumb aspect-video rounded-xl border border-[#F3EAF8] overflow-hidden bg-white shadow-sm hover:border-[#D8BFE3] transition-all">
                        <img src={preview} alt={`Gallery preview ${idx+1}`} className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => handleRemoveGalleryItem(idx)}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dropzone 3: Demo Video */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-2">
                  Atmospheric Video Preview File
                </label>
                
                <div 
                  className={`relative h-24 rounded-2xl border border-dashed transition-all flex items-center justify-center p-4 ${
                    isDragging.video 
                      ? 'border-[#D8BFE3] bg-[#D8BFE3]/5' 
                      : 'border-[#F5E9DD] hover:border-[#D8BFE3]/60 bg-white/40'
                  }`}
                  onDragOver={(e) => handleDrag(e, 'video', true)}
                  onDragLeave={(e) => handleDrag(e, 'video', false)}
                  onDrop={(e) => handleDrop(e, 'video')}
                >
                  <input 
                    type="file" 
                    id="video-file"
                    accept="video/*"
                    onChange={(e) => handleFileChange(e, 'video')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  
                  {uploadProgress.video !== null ? (
                    <div className="flex flex-col items-center w-full px-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0] mb-1">
                        Buffering Preview Node: {uploadProgress.video}%
                      </span>
                      <div className="w-full h-1 bg-[#F5E9DD] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#D8BFE3] transition-all duration-75"
                          style={{ width: `${uploadProgress.video}%` }}
                        />
                      </div>
                    </div>
                  ) : demoVideoPreview ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 rounded-xl overflow-hidden border border-[#F5E9DD] bg-black flex items-center justify-center">
                          <Icon name="Play" size={12} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[#2D004D] truncate max-w-[200px]">Atmospheric Preview Stream</span>
                          <span className="text-[9px] text-[#7B3FA0] font-medium block truncate max-w-[200px]">{demoVideoPreview.substring(0, 30)}...</span>
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] bg-white border border-[#F5E9DD]/80 px-3 py-1.5 rounded-xl">
                        Replace Video
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center">
                      <Icon name="Play" size={16} className="text-[#7B3FA0] mb-1" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D]">
                        Drag Preview MP4 Here or Browse
                      </span>
                      <span className="text-[9px] text-[#7B3FA0] uppercase tracking-widest mt-0.5">
                        MP4, WebM formats
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dropzone 4: ZIP File Deliverable */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-2">
                  Distribution ZIP Deliverable
                </label>
                
                <div 
                  className={`relative rounded-2xl border border-dashed transition-all flex items-center justify-center p-4 ${
                    isDragging.zip 
                      ? 'border-[#D8BFE3] bg-[#D8BFE3]/5' 
                      : uploadError.zip
                        ? 'border-red-300 bg-red-50/40'
                        : form.storagePath
                          ? 'border-green-300 bg-green-50/40'
                          : 'border-[#F5E9DD] hover:border-[#D8BFE3]/60 bg-white/40'
                  } ${uploadingFile.zip ? 'min-h-[5rem]' : 'h-20'}`}
                  onDragOver={(e) => handleDrag(e, 'zip', true)}
                  onDragLeave={(e) => handleDrag(e, 'zip', false)}
                  onDrop={(e) => handleDrop(e, 'zip')}
                >
                  <input 
                    type="file" 
                    id="zip-file"
                    accept=".zip"
                    onChange={(e) => handleFileChange(e, 'zip')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={uploadingFile.zip}
                  />
                  
                  {uploadProgress.zip !== null ? (
                    /* Real Firebase Storage upload in progress */
                    <div className="flex flex-col items-center w-full px-6 gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0]">
                        Uploading to Firebase Storage: {uploadProgress.zip}%
                      </span>
                      <div className="w-full h-1.5 bg-[#F5E9DD] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#7B3FA0] transition-all duration-75 rounded-full"
                          style={{ width: `${uploadProgress.zip}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[#8E6AA8]">{form.zipName || 'Uploading...'}</span>
                    </div>
                  ) : uploadError.zip ? (
                    /* Upload error state */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-sm">✗</span>
                        <span className="text-[10px] font-bold text-red-500 block truncate max-w-[210px]">
                          {uploadError.zip}
                        </span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] bg-white border border-[#F5E9DD] px-3 py-1.5 rounded-xl shrink-0">
                        Retry
                      </span>
                    </div>
                  ) : form.storagePath ? (
                    /* File successfully uploaded to Storage */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-sm">✓</span>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-[#2D004D] block truncate max-w-[200px]">
                            {form.fileName || form.zipName}
                          </span>
                          {form.fileSize && (
                            <span className="text-[9px] text-[#7B3FA0]">
                              {(form.fileSize / (1024 * 1024)).toFixed(2)} MB · Stored in Firebase
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] bg-white border border-[#F5E9DD] px-3 py-1.5 rounded-xl shrink-0">
                        Replace
                      </span>
                    </div>
                  ) : (
                    /* Default empty state */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Icon name="Folder" size={16} className="text-[#7B3FA0]" />
                        <span className="text-[10px] font-bold text-[#2D004D] block truncate max-w-[240px]">
                          {form.zipName || "Drop ZIP package or browse"}
                        </span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] bg-white border border-[#F5E9DD] px-3 py-1.5 rounded-xl">
                        Attach ZIP
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>



          {/* Section: Search Engine Optimizations & Tags */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-3 pb-1 border-b border-[#F3EAF8]">
              4. Global Distribution & SEO
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Status Launch Stage</label>
                <select 
                  value={form.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                >
                  <option value="Published">Published / Live</option>
                  <option value="Draft">Draft Mode</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Ecosystem tags (comma separated)</label>
                <input 
                  type="text" 
                  value={form.tagsInput}
                  onChange={(e) => handleChange('tagsInput', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">SEO Title Header</label>
                <input 
                  type="text" 
                  placeholder="Optimal Google/Search metadata title"
                  value={form.seoTitle}
                  onChange={(e) => handleChange('seoTitle', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── Section 5: Features & Specs ─────────────────────────────────────────── */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-3 pb-1 border-b border-[#F3EAF8]">
              5. Features &amp; Specs
            </h3>
            <div className="space-y-5">

              {/* ── 5.1 Key Features ── */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">
                  Key Features <span className="normal-case text-[#7B3FA0] font-normal">(one per line)</span>
                </label>
                {/* Textarea — one feature per line. No pressing Enter required. */}
                <textarea
                  rows={5}
                  value={form.keyFeatures.join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n');
                    handleChange('keyFeatures', lines);
                  }}
                  placeholder={"e.g.\n100+ premium UI components\nCommercial usage license included\nLifetime updates\nResponsive design"}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3] text-[#2D004D] resize-y"
                  style={{ minHeight: '100px' }}
                />
                <p className="text-[10px] text-[#8B6B5B] mt-1">Type each feature on a new line. All features are saved automatically when you click Save.</p>
              </div>

              {/* ── 5.2 What's Included ── */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">
                  What&apos;s Included
                </label>
                {form.whatsIncluded.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {form.whatsIncluded.map((entry, idx) => (
                      <li key={entry} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#F8F3FB] border border-[#F3EAF8] text-xs text-[#2D004D]">
                        <span className="flex-1 truncate">{entry}</span>
                        <button
                          type="button"
                          onClick={() => handleChange('whatsIncluded', form.whatsIncluded.filter((_, i) => i !== idx))}
                          className="text-[#7B3FA0] hover:text-red-500 transition-colors flex-shrink-0"
                          aria-label="Remove item"
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={whatsIncludedInput}
                    onChange={(e) => setWhatsIncludedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = whatsIncludedInput.trim();
                        if (!v) return;
                        handleChange('whatsIncluded', [...form.whatsIncluded, v]);
                        setWhatsIncludedInput('');
                      }
                    }}
                    placeholder="e.g. Figma source file"
                    className="flex-1 bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3] text-[#2D004D]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = whatsIncludedInput.trim();
                      if (!v) return;
                      handleChange('whatsIncluded', [...form.whatsIncluded, v]);
                      setWhatsIncludedInput('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#F3EAF8] hover:bg-[#D8BFE3]/40 text-xs font-bold uppercase tracking-wider text-[#7B3FA0] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* ── 5.3 System Requirements ── */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">
                  System Requirements
                </label>
                {form.systemRequirements.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {form.systemRequirements.map((entry, idx) => (
                      <li key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#F8F3FB] border border-[#F3EAF8] text-xs text-[#2D004D]">
                        <span className="flex-1 truncate">{entry}</span>
                        <button
                          type="button"
                          onClick={() => handleChange('systemRequirements', form.systemRequirements.filter((_, i) => i !== idx))}
                          className="text-[#7B3FA0] hover:text-red-500 transition-colors flex-shrink-0"
                          aria-label="Remove requirement"
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={systemRequirementsInput}
                    onChange={(e) => setSystemRequirementsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = systemRequirementsInput.trim();
                        if (!v) return;
                        handleChange('systemRequirements', [...form.systemRequirements, v]);
                        setSystemRequirementsInput('');
                      }
                    }}
                    placeholder="e.g. Figma 2024 or later"
                    className="flex-1 bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3] text-[#2D004D]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const v = systemRequirementsInput.trim();
                      if (!v) return;
                      handleChange('systemRequirements', [...form.systemRequirements, v]);
                      setSystemRequirementsInput('');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#F3EAF8] hover:bg-[#D8BFE3]/40 text-xs font-bold uppercase tracking-wider text-[#7B3FA0] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* ── 5.4 Installation Guide ── */}
              <div>
                <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">
                  Installation Guide
                </label>
                <textarea
                  rows={5}
                  placeholder="Step-by-step setup and installation instructions (plain text or markdown)..."
                  value={form.installationGuide}
                  onChange={(e) => handleChange('installationGuide', e.target.value)}
                  className="w-full bg-white border border-[#F5E9DD]/60 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#D8BFE3] text-[#2D004D]"
                />
              </div>

            </div>
          </div>

        </form>

        {/* Action Bottom Strip */}
        <div className="px-8 py-5 border-t border-[#F3EAF8] bg-white/45 backdrop-blur-md flex items-center justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-xl border border-[#F5E9DD]/80 hover:bg-white text-xs font-bold uppercase tracking-widest text-[#7B3FA0] transition-colors ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
              isSubmitting 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] text-[#2D004D] hover:shadow-[0_4px_20px_rgba(216,191,227,0.3)]'
            }`}
          >
            {isSubmitting ? "Deploying..." : (product ? "Commit Parameter Updates" : "Deploy Brand Node")}
          </button>
        </div>

      </motion.div>
    </motion.div>
  );
}

// =========================================================================
// ULTRA-PREMIUM INTERACTIVE PREVIEW MODAL
// =========================================================================
function ProductPreviewModal({ product, onClose }) {
  const [activeTab, setActiveTab] = useState('features'); // 'features' | 'analytics' | 'specs'

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 w-full h-full bg-[#2D004D]/40 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 1000 }}
    >
      <motion.div 
        initial={{ scale: 0.95, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(90,30,126,0.15)] border border-white/60 flex flex-col md:flex-row"
      >
        
        {/* Left Side: Cinematic Media Block */}
        <div className="w-full md:w-1/2 bg-[#1a0a2e] relative flex flex-col justify-center min-h-[300px] md:min-h-[500px]">
          {product.videoUrl ? (
            <video 
              src={product.videoUrl} 
              className="w-full h-full object-cover absolute inset-0"
              autoPlay
              loop
              muted
              controls
            />
          ) : (product.thumbnail || product.preview) ? (
            <img 
              src={product.thumbnail || product.preview}
              alt={product.name} 
              className="w-full h-full object-cover absolute inset-0"
              onError={(e) => {
                // thumbnail path missing on disk — fall through to preview, then placeholder
                if (e.target.src !== (product.preview || '') && product.preview && e.target.src !== product.preview) {
                  e.target.src = product.preview;
                } else {
                  e.target.style.display = 'none';
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#4a2060] text-xs font-bold uppercase tracking-widest opacity-40">No Image</span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          
          <div className="absolute bottom-6 left-6 z-10">
            <span className="px-3 py-1 rounded-full bg-[#D8BFE3]/30 text-white text-[9px] font-bold tracking-widest uppercase block mb-2 w-max">
              {product.category}
            </span>
            <h3 className="text-xl md:text-2xl font-serif text-white tracking-tight leading-tight">
              {product.name}
            </h3>
          </div>
        </div>

        {/* Right Side: Deep Properties Panel */}
        <div className="w-full md:w-1/2 p-8 flex flex-col justify-between">
          
          {/* Header Row */}
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#F3EAF8]">
              <div className="flex items-center gap-2">
                <img 
                  src={product.creatorAvatar} 
                  alt={product.creatorName} 
                  className="w-6 h-6 rounded-full border border-[#F5E9DD]"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#7B3FA0]">
                  {product.creatorName}
                </span>
              </div>
              <button 
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white hover:bg-[#F5E9DD]/60 flex items-center justify-center text-[#7B3FA0] hover:text-[#2D004D]"
              >
                <Icon name="X" size={15} />
              </button>
            </div>

            {/* Inner Interactive Tab Nav */}
            <div className="flex gap-4 border-b border-[#F3EAF8] pb-3 mb-6">
              {['features', 'analytics', 'specs'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => { setActiveTab(tab); sysSound.playTap(); }}
                  className={`text-[10px] font-black tracking-widest uppercase pb-1 border-b-2 transition-all ${
                    activeTab === tab 
                      ? 'border-[#D8BFE3] text-[#2D004D]' 
                      : 'border-transparent text-[#7B3FA0]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content screens */}
            {activeTab === 'features' && (
              <div className="space-y-4 overflow-y-auto max-h-[320px] pr-1">
                {/* Description */}
                <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0]">Description</p>
                <p className="text-xs text-[#2D004D] leading-relaxed font-medium">
                  {product.description || product.shortDesc || "No description available."}
                </p>

                {/* Key Features */}
                {Array.isArray(product.features) && product.features.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-1.5">Key Features</p>
                    <ul className="space-y-1">
                      {product.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-xs text-[#2D004D]">
                          <span className="text-[#B886D0] mt-0.5 flex-shrink-0">✓</span>{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* What's Included */}
                {Array.isArray(product.whatYouGet) && product.whatYouGet.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-1.5">What's Included</p>
                    <ul className="space-y-1">
                      {product.whatYouGet.map((w) => (
                        <li key={w} className="flex items-start gap-2 text-xs text-[#2D004D]">
                          <span className="text-[#7B3FA0] mt-0.5 flex-shrink-0">→</span>{w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* System Requirements */}
                {Array.isArray(product.systemRequirements) && product.systemRequirements.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-1.5">System Requirements</p>
                    <ul className="space-y-1">
                      {product.systemRequirements.map((s) => (
                        <li key={s} className="text-xs text-[#2D004D]">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Installation Guide */}
                {product.installation_guide && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0] mb-1.5">Installation Guide</p>
                    <p className="text-xs text-[#2D004D] leading-relaxed whitespace-pre-wrap">{product.installation_guide}</p>
                  </div>
                )}

                {/* Tags */}
                {Array.isArray(product.tags) && product.tags.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    {product.tags.map((t) => (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-[#F5E9DD] text-[#7B3FA0]">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0]">REALTIME CATALOG TELEMETRY</p>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-white border border-[#F5E9DD]">
                    <span className="text-[9px] text-[#7B3FA0] font-bold block mb-1">CUMULATIVE DOWNLOADS</span>
                    <span className="text-lg font-bold text-[#2D004D]">{product.downloads}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-[#F5E9DD]">
                    <span className="text-[9px] text-[#7B3FA0] font-bold block mb-1">REVENUE GENERATED</span>
                    <span className="text-lg font-bold text-[#2D004D]">${(product.revenue ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-[10px] text-[#7B3FA0] leading-relaxed">
                  Active since deployment date of <span className="font-bold text-[#2D004D]">{product.dateAdded}</span>.
                </p>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="space-y-4 text-xs text-[#2D004D]">
                <p className="text-xs font-bold uppercase tracking-widest text-[#7B3FA0]">TECHNICAL SPECIFICATION SHEET</p>
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between py-1 border-b border-[#F3EAF8]">
                    <span className="text-[#7B3FA0]">Deliverable Node Asset</span>
                    <span className="font-bold font-mono">{product.zipName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F3EAF8]">
                    <span className="text-[#7B3FA0]">System Endpoint URL Slug</span>
                    <span className="font-bold font-mono">/market/{product.slug || 'untitled-node'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F3EAF8]">
                    <span className="text-[#7B3FA0]">SEO Core Keywords</span>
                    <span className="font-bold">{product.seoKeywords || 'General Product'}</span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Pricing & Checkout summary info */}
          <div className="mt-8 pt-6 border-t border-[#F3EAF8] flex items-center justify-between bg-white/50 p-4 rounded-2xl border border-[#F3EAF8]">
            <div>
              <span className="text-[8px] tracking-widest uppercase font-extrabold text-[#7B3FA0] block mb-1">DEPLOYED LICENSING</span>
              <span className="text-xl font-bold text-[#2D004D]">
                ${product.discountPrice || product.price}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-[#2D004D] text-white hover:bg-[#7B3FA0] text-xs font-bold uppercase tracking-widest transition-colors shadow-sm"
            >
              Return To Command Grid
            </button>
          </div>

        </div>

      </motion.div>
    </motion.div>
  );
}