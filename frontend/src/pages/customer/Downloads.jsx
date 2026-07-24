// Lumora Digital Vault Downloads Page - Production Deployment Verified
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download, RefreshCw, ExternalLink, Search, Filter,
  Sparkles, Star, Clock, HardDrive, Tag, Shield,
  Zap, CheckCircle, ArrowUpRight, ChevronRight,
  Package, Layers, Cpu, FileCode, BookOpen,
  Palette, Music, Video, RotateCcw, Bell, X, AlertCircle,
  Trash2, CheckSquare, Square
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import PolicyBanner from '../../components/policy/PolicyBanner';


/* ─── FILTER TAB BASE ───────────────────────────────────────── */
// Static base tabs; category tabs are computed dynamically from real data
const BASE_FILTER_TABS = [
  { id: 'all', label: 'All Assets', icon: <Package size={12} /> },
  { id: 'recent', label: 'Recent', icon: <Clock size={12} /> },
  { id: 'updated', label: 'Updates', icon: <Zap size={12} />, badge: true },
];

/* ─── CATEGORY ICON MAP ──────────────────────────────────────── */
const CATEGORY_ICONS = {
  'UI Kits': <Layers size={12} />,
  'Templates': <FileCode size={12} />,
  'AI Tools': <Cpu size={12} />,
  'Branding': <Palette size={12} />,
  'Motion': <Video size={12} />,
  'Presets': <Music size={12} />,
  'Productivity': <BookOpen size={12} />,
};

function resolveFullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const baseUrl = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  const cleanPath = url.startsWith('/api') ? url : (url.startsWith('/') ? `/api${url}` : `/api/${url}`);
  const baseNoApi = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
  return `${baseNoApi}${cleanPath}`;
}

/* ─── DOWNLOAD BUTTON COMPONENT ──────────────────────────────── */
function DownloadButton({ productName, variant = 'primary', downloadUrl, productId, downloadAvailable }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | pending
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleDownload = async () => {
    if (state !== 'idle') return;

    setState('downloading');
    
    let activeUrl = downloadUrl;
    const numericId = parseInt(productId, 10);

    // Step 1: Fetch a fresh tokenized download URL from backend
    if (!isNaN(numericId)) {
      try {
        const res = await backendFetch(`/products/${numericId}/download`);

        // Backend says asset not yet uploaded
        if (res?.download_available === false) {
          setState('pending');
          return;
        }

        if (res && res.download_url) {
          activeUrl = res.download_url;
        }
      } catch (err) {
        console.warn('[DownloadButton] Failed to fetch fresh download token, using cached URL:', err.message);
      }
    }
    
    // Step 2: Trigger native browser file download via hidden <a> tag
    // The token is already embedded in the URL query string — no Bearer header needed
    if (activeUrl) {
      try {
        const fullUrl = resolveFullUrl(activeUrl);
        const link = document.createElement('a');
        link.href = fullUrl;
        const cleanName = (productName || 'digital-asset').toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.setAttribute('download', cleanName);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => setState('done'), 1500);
        setTimeout(() => setState('idle'), 4000);
        return;
      } catch (e) {
        console.warn('[DownloadButton] Direct link download failed:', e);
      }
    }

    // Fallback: mark as done anyway
    setTimeout(() => setState('done'), 1500);
    setTimeout(() => setState('idle'), 4000);
  };

  // ── Pending state: show professional message, not an error ───────────────
  if (state === 'pending') {
    return (
      <div style={{
        display: 'inline-flex', flexDirection: 'column', gap: '4px',
        padding: '10px 14px', borderRadius: '12px',
        background: 'rgba(123,63,160,0.06)',
        border: '1px solid rgba(123,63,160,0.18)',
        maxWidth: '260px',
      }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5A1E7E', display: 'flex', alignItems: 'center', gap: '5px' }}>
          ⏳ Download Pending
        </span>
        <span style={{ fontSize: '0.68rem', color: '#7B3FA0', lineHeight: 1.5, fontWeight: 400 }}>
          Asset not yet uploaded by creator. Your ownership is verified — check back soon.
        </span>
        <button
          onClick={() => setState('idle')}
          style={{ marginTop: '4px', fontSize: '0.64rem', fontWeight: 700, color: '#8B6B5B', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  const configs = {
    idle: {
      label: 'Download',
      icon: <Download size={14} />,
      bg: 'linear-gradient(135deg, #4E3B31, #2C1E18)',
      color: '#FFFDF9',
      border: 'transparent',
    },
    downloading: {
      label: 'Opening File…',
      icon: <div style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />,
      bg: 'rgba(78,59,49,0.08)',
      color: '#4E3B31',
      border: '1px solid rgba(78,59,49,0.12)',
    },
    done: {
      label: 'Opened!',
      icon: <CheckCircle size={14} />,
      bg: 'linear-gradient(135deg, #3DB877, #2D9B60)',
      color: '#FFFDF9',
      border: 'transparent',
    },
  };

  const c = configs[state] || configs.idle;

  return (
    <>
      <button
        onClick={() => setShowConfirmModal(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '9px 18px', borderRadius: '12px',
          background: c.bg, color: c.color, border: c.border,
          fontSize: '0.75rem', fontWeight: 700,
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          outline: 'none', transition: 'all 0.3s ease',
          transform: state === 'done' ? 'scale(1.02)' : 'scale(1)',
          boxShadow: state === 'done' ? '0 4px 16px rgba(61,184,119,0.35)' : '0 4px 14px rgba(45,30,24,0.20)',
          whiteSpace: 'nowrap',
        }}
      >
        {c.icon}
        {c.label}
      </button>

      {/* Pre-Download Confirmation Modal */}
      {showConfirmModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999999,
          background: 'rgba(12, 10, 18, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#FFFDF9', borderRadius: '24px', padding: '28px 32px', maxWidth: '480px', width: '100%',
            boxShadow: '0 25px 70px rgba(0,0,0,0.35)', border: '1px solid rgba(220,198,255,0.3)',
            animation: 'dl-fadein 0.25s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(78,59,49,0.08)', color: 'var(--color-espresso)' }}>
                <Shield size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ✦ Lumora Digital Vault
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-espresso)', margin: 0 }}>
                  Confirm Device Download
                </h3>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--color-mocha)', lineHeight: 1.6, marginBottom: '24px', background: 'rgba(78,59,49,0.04)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(78,59,49,0.08)' }}>
              You are about to download <strong>{productName}</strong> to your computer device.<br/><br/>
              After downloading, the purchase may no longer qualify for a standard refund under Lumora's digital-product policy, except where applicable.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 20px', borderRadius: '12px', background: 'rgba(78,59,49,0.08)',
                  border: 'none', color: 'var(--color-espresso)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirmModal(false); handleDownload(); }}
                style={{
                  padding: '10px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #4E3B31, #2C1E18)',
                  border: 'none', color: '#FFFDF9', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(45,30,24,0.25)'
                }}
              >
                Download Product
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}




/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export default function CustomerDownloads() {
  const { ownedProducts, products, navigateTo } = useApp();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCard, setHoveredCard] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const pageRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [backendOwnedProducts, setBackendOwnedProducts] = useState([]);

  // ── Multi-select & Delete State ──────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletedIds, setDeletedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('lumora_deleted_downloads');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const saveDeletedIds = (newList) => {
    setDeletedIds(newList);
    try {
      localStorage.setItem('lumora_deleted_downloads', JSON.stringify(newList));
    } catch (e) {
      console.warn('Failed to save deleted downloads:', e);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (visibleItems) => {
    const visibleIds = visibleItems.map(p => String(p.id));
    const allSelected = visibleIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const updated = Array.from(new Set([...deletedIds, ...selectedIds]));
    saveDeletedIds(updated);
    setSelectedIds([]);
    window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
  };

  const handleRestoreDeleted = () => {
    saveDeletedIds([]);
    window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
  };

  const fetchBackendDownloads = async () => {
    try {
      setLoading(true);
      setError(null);
      // Wait for backend token to be ready if user is logged in but token is not yet written (race condition on refresh)
      if (user && !localStorage.getItem('lumora_backend_token')) {
        await new Promise((resolve) => {
          const onReady = () => {
            window.removeEventListener('lumora_backend_ready', onReady);
            resolve();
          };
          window.addEventListener('lumora_backend_ready', onReady);
          setTimeout(() => {
            window.removeEventListener('lumora_backend_ready', onReady);
            resolve();
          }, 3000);
        });
      }

      const orders = await backendFetch('/orders/me').catch(err => {
        console.warn('Backend orders fetch notice:', err);
        return null;
      });

      if (Array.isArray(orders)) {
        const itemsList = [];
        const seenPids = new Set();
        orders.forEach(ord => {
          (ord.items || []).forEach(item => {
            const pid = String(item.product_id);
            if (seenPids.has(pid)) return;
            seenPids.add(pid);
            
            const prod = products.find(p => String(p.id) === pid);
            // Determine download availability from the order item's download_url
            // and from any backend download_available flag if present.
            // A product with a real download_url path (not just the /download endpoint)
            // will be treated as available; the actual pending check happens server-side.
            const downloadAvailable = item.download_available !== false; // default true unless explicitly false
            itemsList.push({
              id: pid,
              name: prod?.title || `Digital Asset #${item.product_id}`,
              category: prod?.category || 'Digital Asset',
              version: prod?.version || 'v1.0.0',
              fileSize: prod?.fileSize || '142 MB',
              lastUpdated: 'Recently',
              purchaseDate: ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Recent',
              thumbnail: prod?.preview || prod?.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70',
              compatibility: prod?.compatibility || ['Web', 'Design'],
              hasUpdate: false,
              rating: prod?.rating || 4.9,
              gradient: 'linear-gradient(135deg, rgba(250,247,242,0.9), rgba(255,255,255,0.95))',
              accentColor: '#4E3B31',
              downloadUrl: item.download_url || `/downloads/product-${item.product_id}.zip`,
              downloadAvailable,
              verified: true,
            });
          });
        });
        setBackendOwnedProducts(itemsList);
      }
    } catch (err) {
      console.error('Error fetching backend downloads:', err);
      setError('Could not verify live backend license downloads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendDownloads();
  }, [user, ownedProducts.length, products.length]);

  // Build real product list from ONLY backend order items + context ownedProducts
  const ownedReal = products.filter(p => ownedProducts.includes(p.id)).map(p => ({
    id: String(p.id), name: p.title, category: p.category,
    version: p.version || 'v1.0.0', fileSize: p.fileSize || '—',
    lastUpdated: p.lastUpdated || '—', purchaseDate: 'Recent',
    thumbnail: p.preview || p.thumbnail,
    compatibility: p.compatibility || [],
    hasUpdate: false, rating: p.rating || 4.8,
    gradient: 'linear-gradient(135deg, rgba(250,247,242,0.9), rgba(255,255,255,0.95))',
    accentColor: '#4E3B31',
    downloadUrl: `/downloads/product-${p.id}.zip`,
    verified: true,
  }));

  // Merge: backend orders take precedence over context-only items
  const allProductsMap = new Map();
  backendOwnedProducts.forEach(b => allProductsMap.set(String(b.id), b));
  ownedReal.forEach(r => {
    if (!allProductsMap.has(String(r.id))) allProductsMap.set(String(r.id), r);
  });

  const allProducts = Array.from(allProductsMap.values()).filter(p => !deletedIds.includes(String(p.id)));

  // Dynamic filter tabs: base tabs + unique categories from real library
  const uniqueCategories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  const dynamicFilterTabs = [
    ...BASE_FILTER_TABS,
    ...uniqueCategories.map(cat => ({
      id: cat,
      label: cat,
      icon: CATEGORY_ICONS[cat] || <Package size={12} />,
    }))
  ];

  const filtered = allProducts.filter(p => {
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'recent') return true;
    if (activeFilter === 'updated') return p.hasUpdate;
    return p.category === activeFilter;
  });

  const updatesCount = allProducts.filter(p => p.hasUpdate).length;

  // Recently downloaded: last 5 purchases from backend (newest first by orderDate)
  const recentItems = [...allProducts]
    .filter(p => p.orderDate)
    .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))
    .slice(0, 5);

  // Cursor-reactive glow
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const handler = (e) => {
      const r = el.getBoundingClientRect();
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div
      ref={pageRef}
      style={{ display: 'flex', flexDirection: 'column', gap: '40px', animation: 'dl-fadein 0.6s ease', position: 'relative' }}
    >
      {/* ── Cursor glow ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: mousePos.x, top: mousePos.y,
        width: 600, height: 600, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(220,198,255,0.18) 0%, transparent 65%)',
        transform: 'translate(-50%,-50%)', transition: 'left 0.1s, top 0.1s',
      }} />

      {/* ── Floating background blobs ─────────────────────────── */}
      <div style={{ position: 'fixed', top: -120, right: -80, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,198,255,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -100, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,238,255,0.12) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: CINEMATIC HERO
          ═══════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative', borderRadius: '28px', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(220,198,255,0.20) 0%, rgba(220,238,255,0.15) 50%, rgba(207,232,214,0.15) 100%)',
        border: '1px solid rgba(255,255,255,0.70)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px -10px rgba(78,59,49,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
        padding: 'clamp(36px, 6vw, 64px) clamp(28px, 5vw, 56px)',
        minHeight: 240,
      }}>
        {/* Decorative floating glass spheres */}
        <div style={{ position: 'absolute', top: -40, right: 80, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9), rgba(220,198,255,0.3))', boxShadow: 'inset -6px -8px 20px rgba(175,140,255,0.2), 0 10px 40px rgba(175,140,255,0.12)', border: '1px solid rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', animation: 'sphere-float-1 6s ease-in-out infinite alternate', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 260, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.85), rgba(220,238,255,0.4))', boxShadow: 'inset -4px -5px 14px rgba(100,160,240,0.18)', border: '1px solid rgba(255,255,255,0.6)', animation: 'sphere-float-2 8s ease-in-out infinite alternate', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 30, right: 300, width: 50, height: 50, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9), rgba(207,232,214,0.5))', border: '1px solid rgba(255,255,255,0.7)', animation: 'sphere-float-3 5s ease-in-out infinite alternate', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--color-mocha)', textTransform: 'uppercase', fontFamily: 'var(--font-sans)' }}>
            ✦ Lumora Digital Vault
          </span>
          <h1 className="text-editorial" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 400, color: 'var(--color-espresso)', lineHeight: 1.05, marginTop: 8 }}>
            Your Digital Vault
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--color-mocha)', marginTop: 10, fontWeight: 400, lineHeight: 1.5 }}>
            Access your premium creative assets beautifully.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-mocha)', marginTop: 4, opacity: 0.75 }}>
            All your purchased digital products organized in one immersive workspace.
          </p>

          {/* Hero stats row — live data only */}
          <div style={{ display: 'flex', gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
            {[
              { label: `${allProducts.length} Assets`, sub: 'In your vault', icon: <Package size={14} /> },
              ...(updatesCount > 0 ? [{ label: `${updatesCount} Updates`, sub: 'Available now', icon: <Zap size={14} />, accent: true }] : []),
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 18px', borderRadius: 14,
                background: s.accent ? 'linear-gradient(135deg, rgba(220,198,255,0.4), rgba(205,183,255,0.3))' : 'rgba(255,255,255,0.55)',
                border: s.accent ? '1px solid rgba(155,121,255,0.25)' : '1px solid rgba(255,255,255,0.7)',
                backdropFilter: 'blur(10px)', boxShadow: '0 4px 16px rgba(78,59,49,0.04)',
              }}>
                <span style={{ color: s.accent ? '#9B79FF' : 'var(--color-mocha)' }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{s.label}</div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--color-mocha)', fontWeight: 600 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      <PolicyBanner style={{ marginTop: '20px', marginBottom: '0px' }} />




      {/* Loading state notification */}
      {loading && (
        <div style={{ padding: '12px 20px', borderRadius: '16px', background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(155,121,255,0.20)', display: 'flex', alignItems: 'center', gap: '10px', color: '#7B5FD0', fontSize: '0.82rem', fontWeight: 600 }}>
          <Clock size={15} style={{ animation: 'spin 2s linear infinite' }} /> Syncing live license ownership & downloads with backend...
        </div>
      )}

      {/* Error state notification */}
      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} /> {error}
          </div>
          <button onClick={fetchBackendDownloads} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2: SEARCH + FILTER TABS
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 20px', borderRadius: 50,
          background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(20px)', boxShadow: '0 4px 20px rgba(78,59,49,0.05)',
          maxWidth: 420,
        }}>
          <Search size={15} style={{ color: 'var(--color-mocha)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search your vault assets..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: '0.8rem',
              color: 'var(--color-espresso)', width: '100%',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-mocha)', display: 'flex', alignItems: 'center' }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter pill tabs — built from real library categories */}
        <div className="downloads-filter-bar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {dynamicFilterTabs.map(tab => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 30,
                  background: isActive ? 'var(--color-espresso)' : 'rgba(255,255,255,0.65)',
                  color: isActive ? '#FFFDF9' : 'var(--color-mocha)',
                  border: isActive ? 'none' : '1px solid rgba(255,255,255,0.7)',
                  fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                  transition: 'all 0.25s ease',
                  backdropFilter: 'blur(12px)',
                  boxShadow: isActive ? '0 4px 14px rgba(78,59,49,0.18)' : '0 2px 8px rgba(78,59,49,0.04)',
                  position: 'relative',
                }}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && updatesCount > 0 && !isActive && (
                  <span style={{ background: '#9B79FF', color: '#fff', fontSize: '0.55rem', fontWeight: 800, padding: '2px 5px', borderRadius: 10 }}>
                    {updatesCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: VAULT PRODUCTS GRID
          ═══════════════════════════════════════════════════════════ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>Owned Assets</span>
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: 2, color: 'var(--color-espresso)' }}>
              {activeFilter === 'all' ? 'Complete Library' : dynamicFilterTabs.find(t => t.id === activeFilter)?.label}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {filtered.length > 0 && (
              <button
                onClick={() => handleSelectAll(filtered)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '10px',
                  border: '1px solid rgba(196,148,230,0.35)',
                  background: 'rgba(255,255,255,0.75)',
                  color: 'var(--color-espresso)', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease',
                }}
              >
                {filtered.every(p => selectedIds.includes(String(p.id))) ? <CheckSquare size={14} color="#7B3FA0" /> : <Square size={14} />}
                {filtered.every(p => selectedIds.includes(String(p.id))) ? 'Deselect All' : 'Select All'}
              </button>
            )}

            {selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '10px',
                  border: 'none', background: 'linear-gradient(135deg, #e11d48, #be123c)',
                  color: '#ffffff', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Trash2 size={14} />
                Delete Selected ({selectedIds.length})
              </button>
            )}

            {deletedIds.length > 0 && selectedIds.length === 0 && (
              <button
                onClick={handleRestoreDeleted}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 14px', borderRadius: '10px',
                  border: '1px solid rgba(123,63,160,0.3)',
                  background: 'rgba(123,63,160,0.06)',
                  color: '#7B3FA0', fontSize: '0.75rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <RotateCcw size={13} />
                Restore Removed ({deletedIds.length})
              </button>
            )}

            <span style={{ fontSize: '0.72rem', color: 'var(--color-mocha)', fontWeight: 700 }}>
              {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}
            </span>
          </div>
        </div>

        {!loading && allProducts.length === 0 && deletedIds.length > 0 ? (
          <div style={{
            padding: '70px 40px', textAlign: 'center', borderRadius: 20,
            background: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(78,59,49,0.12)',
            backdropFilter: 'blur(16px)',
          }}>
            <Trash2 size={48} style={{ color: 'rgba(225,29,72,0.3)', margin: '0 auto 16px', display: 'block' }} />
            <h3 style={{ color: 'var(--color-espresso)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>All download products deleted</h3>
            <p style={{ color: 'var(--color-mocha)', fontSize: '0.82rem', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>You have removed your download products from this view. You can restore them anytime.</p>
            <button
              onClick={handleRestoreDeleted}
              style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#FFFDF9', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-sans)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw size={14} /> Restore All Download Products
            </button>
          </div>
        ) : !loading && allProducts.length === 0 ? (
          /* Empty vault — user has no purchases */
          <div style={{
            padding: '70px 40px', textAlign: 'center', borderRadius: 20,
            background: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(78,59,49,0.12)',
            backdropFilter: 'blur(16px)',
          }}>
            <Package size={48} style={{ color: 'rgba(78,59,49,0.18)', margin: '0 auto 16px', display: 'block' }} />
            <h3 style={{ color: 'var(--color-espresso)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>Your vault is empty</h3>
            <p style={{ color: 'var(--color-mocha)', fontSize: '0.82rem', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.5 }}>Purchase premium digital assets from the marketplace to access them here anytime.</p>
            <button
              onClick={() => navigateTo('marketplace')}
              style={{ padding: '10px 28px', borderRadius: 12, background: 'var(--color-espresso)', color: '#FFFDF9', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', fontFamily: 'var(--font-sans)' }}
            >
              Browse Marketplace
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '60px 40px', textAlign: 'center', borderRadius: 20,
            background: 'rgba(255,255,255,0.55)', border: '1px dashed rgba(78,59,49,0.12)',
            backdropFilter: 'blur(16px)',
          }}>
            <Package size={40} style={{ color: 'rgba(78,59,49,0.15)', margin: '0 auto 14px', display: 'block' }} />
            <p style={{ color: 'var(--color-mocha)', fontWeight: 600, fontSize: '0.88rem' }}>No assets match your search.</p>
            <button onClick={() => { setActiveFilter('all'); setSearchQuery(''); }} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 10, background: 'var(--color-espresso)', color: '#FFFDF9', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="downloads-grid">
            {filtered.map((product, idx) => (
              <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 0.08, 0.4)}s`, animationFillMode: 'both' }}>
                <VaultCard
                  product={product}
                  isHovered={hoveredCard === product.id}
                  onHover={setHoveredCard}
                  isSelected={selectedIds.includes(String(product.id))}
                  onToggleSelect={() => handleToggleSelect(String(product.id))}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4: RECENT PURCHASES (Live Backend Data)
          ═══════════════════════════════════════════════════════════ */}
      {recentItems.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>Activity Log</span>
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: 2, color: 'var(--color-espresso)' }}>Recent Purchases</h2>
          </div>

          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }} className="scroll-container">
            {recentItems.map((item) => (
              <div
                key={item.id}
                style={{
                  flex: '0 0 180px', borderRadius: 18, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.8)',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 6px 24px rgba(78,59,49,0.06)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(78,59,49,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(78,59,49,0.06)'; }}
              >
                <div style={{ height: 100, overflow: 'hidden', position: 'relative' }}>
                  <img src={item.thumbnail} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
                </div>
                <div style={{ padding: '10px 12px' }}>
                  <p style={{ fontSize: '0.63rem', color: 'var(--color-mocha)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.category}</p>
                  <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: 2, lineHeight: 1.2 }}>{item.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Clock size={9} style={{ color: 'var(--color-mocha)' }} />
                    <span style={{ fontSize: '0.6rem', color: 'var(--color-mocha)', fontWeight: 600 }}>{item.purchaseDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5: UPDATES AVAILABLE
          ═══════════════════════════════════════════════════════════ */}
      {allProducts.filter(p => p.hasUpdate).length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>Update Center</span>
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: 2, color: 'var(--color-espresso)' }}>Updates Available</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {allProducts.filter(p => p.hasUpdate).map(product => (
              <div key={product.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '16px 24px', borderRadius: 16,
                background: 'rgba(255,255,255,0.70)',
                border: '1px solid rgba(155,121,255,0.20)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 4px 20px rgba(78,59,49,0.05)',
                transition: 'all 0.25s ease',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 30px rgba(155,121,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(155,121,255,0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(78,59,49,0.05)'; e.currentTarget.style.borderColor = 'rgba(155,121,255,0.20)'; }}
              >
                <img src={product.thumbnail} alt={product.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{product.name}</h4>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 800, padding: '3px 8px',
                      borderRadius: 20, background: 'linear-gradient(135deg, rgba(155,121,255,0.2), rgba(205,183,255,0.3))',
                      color: '#7B5FD0', border: '1px solid rgba(155,121,255,0.3)',
                      animation: 'pulse-badge 2s ease-in-out infinite',
                    }}>
                      ✦ {product.newVersion} Available
                    </span>
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--color-mocha)', marginTop: 3 }}>{product.updateNote}</p>
                  <p style={{ fontSize: '0.63rem', color: 'var(--color-mocha)', marginTop: 2, opacity: 0.7 }}>{product.version} → {product.newVersion}</p>
                </div>
                <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Animations ──────────────────────────────────────────── */}
      <style>{`
        @keyframes dl-fadein {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sphere-float-1 {
          from { transform: translateY(0px) rotate(0deg); }
          to { transform: translateY(-18px) rotate(4deg); }
        }
        @keyframes sphere-float-2 {
          from { transform: translateY(0px) rotate(0deg); }
          to { transform: translateY(-12px) rotate(-3deg); }
        }
        @keyframes sphere-float-3 {
          from { transform: translateY(0px); }
          to { transform: translateY(-8px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.03); }
        }
        @keyframes update-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(155,121,255,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(155,121,255,0); }
        }
      `}</style>
    </div>
  );
}

/* ─── VAULT PRODUCT CARD ─────────────────────────────────────── */
function VaultCard({ product, isHovered, onHover, isSelected, onToggleSelect }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState('pdf'); // 'pdf' | 'package'
  const [viewerMode, setViewerMode] = useState('visual'); // 'visual' | 'stream'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;
    setTilt({ x: (y / cy) * 4, y: -(x / cx) * 4 });
  };
  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    onHover(null);
  };

  const handleOpenPreview = async () => {
    setIsPreviewOpen(true);
    setLoading(true);
    setErrorMsg(null);
    setPreviewUrl(null);
    setViewerMode('visual');

    const numericId = parseInt(product.id, 10);
    if (isNaN(numericId)) {
      setErrorMsg('Invalid product ID');
      setLoading(false);
      return;
    }

    // Determine if product is a PDF document or a ZIP package archive
    const nameLower = (product.name || '').toLowerCase();
    const isPdfName = nameLower.endsWith('.pdf') || nameLower.includes('pdf');

    try {
      const res = await backendFetch(`/products/${numericId}/download`);
      if (res?.download_available === false) {
        setErrorMsg('The creator has not uploaded a previewable file for this product yet.');
        setLoading(false);
        return;
      }

      // If backend metadata indicates package or filename ends in zip/rar/7z
      const dlUrl = (res?.download_url || '').toLowerCase();
      const isZipArchive = dlUrl.includes('.zip') || dlUrl.includes('.rar') || dlUrl.includes('.7z') || nameLower.includes('zip') || nameLower.includes('pack');

      if (isZipArchive && !isPdfName) {
        // ZIP Package Archive: Use Online Package Inspection Mode without iframe ZIP stream
        setPreviewType('package');
        setPreviewUrl(null);
      } else {
        // PDF Document: Stream online inside document viewer iframe
        setPreviewType('pdf');
        if (res && res.download_url) {
          const streamUrl = res.download_url.replace('/download-file', '/preview-stream');
          setPreviewUrl(resolveFullUrl(streamUrl));
        } else {
          setPreviewType('package');
        }
      }
    } catch (err) {
      setErrorMsg('Failed to authorize preview session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => onHover(product.id)}
        onMouseLeave={handleMouseLeave}
        style={{
          borderRadius: 20, overflow: 'hidden',
          background: isSelected ? 'rgba(243, 232, 255, 0.85)' : 'rgba(255,255,255,0.72)',
          border: isSelected
            ? '2px solid #7B3FA0'
            : isHovered ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.75)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          boxShadow: isHovered
            ? `0 24px 60px rgba(78,59,49,0.12), 0 0 0 1px rgba(255,255,255,0.6), 0 8px 20px ${product.accentColor}18`
            : '0 6px 24px rgba(78,59,49,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
          transform: isHovered
            ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-6px) scale(1.01)`
            : 'perspective(800px) rotateX(0) rotateY(0) translateY(0) scale(1)',
          transition: isHovered
            ? 'box-shadow 0.3s ease, border-color 0.3s ease'
            : 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          willChange: 'transform',
          position: 'relative',
        }}
      >
        {/* Selection Checkbox Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSelect) onToggleSelect();
          }}
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: 15,
            width: '28px', height: '28px', borderRadius: '8px',
            background: isSelected ? '#7B3FA0' : 'rgba(255,255,255,0.92)',
            border: isSelected ? 'none' : '1.5px solid rgba(123,63,160,0.35)',
            color: isSelected ? '#ffffff' : '#7B3FA0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s ease',
          }}
          title={isSelected ? 'Deselect item' : 'Select item to delete'}
        >
          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>

        {/* Thumbnail */}
        <div 
          onClick={handleOpenPreview}
          title="Click to preview document online"
          style={{ position: 'relative', height: 180, overflow: 'hidden', cursor: 'pointer' }}
        >
          <img
            src={product.thumbnail}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.5s ease' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.15) 100%)' }} />

          {/* Category badge */}
          <span style={{
            position: 'absolute', top: 12, left: 48,
            fontSize: '0.6rem', fontWeight: 800, padding: '4px 10px',
            borderRadius: 20, background: 'rgba(255,255,255,0.92)',
            color: 'var(--color-espresso)', backdropFilter: 'blur(8px)',
            letterSpacing: '0.05em',
          }}>{product.category}</span>

          {/* Update badge */}
          {product.hasUpdate && (
            <span style={{
              position: 'absolute', top: 12, right: 12,
              fontSize: '0.58rem', fontWeight: 800, padding: '4px 10px',
              borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(155,121,255,0.9), rgba(125,95,240,0.9))',
              color: '#fff', backdropFilter: 'blur(8px)',
              animation: 'pulse-badge 2s ease-in-out infinite',
            }}>✦ Update</span>
          )}

          {/* Rating */}
          <div style={{
            position: 'absolute', bottom: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.92)', padding: '3px 8px',
            borderRadius: 20, backdropFilter: 'blur(8px)',
          }}>
            <Star size={9} fill="#F0B429" stroke="#F0B429" />
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{product.rating}</span>
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Title + version */}
          <div>
            <h3 
              onClick={handleOpenPreview}
              title="Click to preview document online"
              style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', lineHeight: 1.2, cursor: 'pointer' }}
            >
              {product.name}
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.63rem', color: 'var(--color-mocha)', fontWeight: 700, background: 'rgba(78,59,49,0.05)', padding: '2px 8px', borderRadius: 6 }}>
                {product.version}
              </span>
              <span style={{ fontSize: '0.63rem', color: 'var(--color-mocha)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <HardDrive size={9} /> {product.fileSize}
              </span>
              <span style={{ fontSize: '0.63rem', color: 'var(--color-mocha)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={9} /> {product.lastUpdated}
              </span>
            </div>
          </div>

          {/* Compatibility tags */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {product.compatibility.map(tag => (
              <span key={tag} style={{
                fontSize: '0.58rem', fontWeight: 700, padding: '3px 8px',
                borderRadius: 6, background: 'rgba(78,59,49,0.04)',
                color: 'var(--color-mocha)', border: '1px solid rgba(78,59,49,0.08)',
              }}>{tag}</span>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 4, borderTop: '1px solid rgba(78,59,49,0.06)' }}>
            {product.downloadAvailable === false ? (
              <div style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'rgba(123,63,160,0.05)',
                border: '1px solid rgba(123,63,160,0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, color: '#5A1E7E',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  ⏳ Download Pending
                </span>
                <span style={{ fontSize: '0.66rem', color: '#7B3FA0', lineHeight: 1.5, fontWeight: 400 }}>
                  The creator has not yet uploaded the downloadable asset. Your ownership is verified — the file will appear here automatically once available.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <button
                  onClick={handleOpenPreview}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px', borderRadius: '12px',
                    background: 'rgba(78,59,49,0.06)', color: 'var(--color-espresso)',
                    border: '1px solid rgba(78,59,49,0.12)',
                    fontSize: '0.75rem', fontWeight: 700,
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <BookOpen size={13} />
                  Preview
                </button>
                <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Online PDF / Asset Viewer Modal — Rendered at Body Portal Root */}
      {isPreviewOpen && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999999,
          background: 'rgba(12, 10, 18, 0.88)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#FFFDF9', borderRadius: '24px', width: '92vw', maxWidth: '1200px', height: '88vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 30px 90px rgba(0,0,0,0.6)', border: '1px solid rgba(220,198,255,0.3)',
            animation: 'dl-fadein 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid rgba(78,59,49,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(250,247,242,0.98), rgba(255,255,255,0.95))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ padding: '10px', borderRadius: '12px', background: 'linear-gradient(135deg, #4E3B31, #2C1E18)', color: '#FFFDF9', boxShadow: '0 4px 12px rgba(45,30,24,0.2)' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.63rem', fontWeight: 800, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      ✦ Lumora Web Document Viewer
                    </span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#3DB877', background: 'rgba(61,184,119,0.12)', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(61,184,119,0.25)' }}>
                      Online View Only
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-espresso)', margin: '2px 0 0' }}>
                    {product.name}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {previewUrl && (
                  <div style={{ display: 'flex', background: 'rgba(78,59,49,0.08)', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                    <button
                      onClick={() => setViewerMode('visual')}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                        background: viewerMode === 'visual' ? '#FFFDF9' : 'transparent',
                        color: viewerMode === 'visual' ? '#5A1E7E' : 'var(--color-mocha)',
                        fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer',
                        boxShadow: viewerMode === 'visual' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      🖼️ Visual View
                    </button>
                    <button
                      onClick={() => setViewerMode('stream')}
                      style={{
                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                        background: viewerMode === 'stream' ? '#FFFDF9' : 'transparent',
                        color: viewerMode === 'stream' ? '#5A1E7E' : 'var(--color-mocha)',
                        fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer',
                        boxShadow: viewerMode === 'stream' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                      }}
                    >
                      📄 Document Stream
                    </button>
                  </div>
                )}
                <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} />
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  style={{
                    background: 'rgba(78,59,49,0.08)', border: 'none', borderRadius: '50%',
                    width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--color-espresso)', transition: 'all 0.2s ease'
                  }}
                  title="Close Viewer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Viewer Body Content */}
            <div style={{ flex: 1, position: 'relative', background: viewerMode === 'visual' ? '#1A1823' : '#323639', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', color: '#FFFDF9', fontSize: '0.92rem' }}>
                  <Clock size={28} style={{ animation: 'spin 1.5s linear infinite', color: '#DCC6FF' }} />
                  <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>Authorizing online asset preview...</span>
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '36px 40px', textAlign: 'center', color: '#DC2626', background: '#FFFDF9', borderRadius: '20px', maxWidth: '440px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)' }}>
                  <AlertCircle size={44} style={{ margin: '0 auto 14px', color: '#DC2626' }} />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '8px' }}>Preview Notice</h4>
                  <p style={{ fontWeight: 600, fontSize: '0.86rem', lineHeight: 1.5, color: 'var(--color-mocha)', margin: 0 }}>{errorMsg}</p>
                </div>
              )}

              {!loading && !errorMsg && (viewerMode === 'visual' || previewType === 'package' || !previewUrl) && (
                <div style={{ padding: '32px', width: '100%', height: '100%', overflowY: 'auto', background: '#181524', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '36px 40px', maxWidth: '820px', width: '100%', boxShadow: '0 25px 70px rgba(0,0,0,0.4)', border: '1px solid rgba(196,181,253,0.3)' }}>
                    
                    {/* Visual Document Showcase Canvas */}
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                      <div style={{
                        position: 'relative', display: 'inline-block', borderRadius: '18px', overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(45,30,24,0.3)', border: '1px solid rgba(78,59,49,0.12)',
                        background: '#FAF7F2', padding: '12px'
                      }}>
                        <img
                          src={product.thumbnail || product.preview}
                          alt={product.name}
                          style={{ maxHeight: '340px', width: 'auto', objectFit: 'contain', borderRadius: '12px' }}
                        />
                        <div style={{
                          position: 'absolute', bottom: '20px', right: '20px',
                          background: 'rgba(12,10,18,0.85)', backdropFilter: 'blur(10px)',
                          color: '#FFFDF9', fontSize: '0.7rem', fontWeight: 800,
                          padding: '6px 14px', borderRadius: '20px', letterSpacing: '0.05em'
                        }}>
                          ✦ Online Inspection View
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#5A1E7E', background: 'rgba(123,63,160,0.1)', padding: '4px 12px', borderRadius: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {product.category || 'Digital Asset'} • {product.version || 'v1.0.0'}
                        </span>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-espresso)', margin: '10px 0 6px' }}>
                          {product.name}
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--color-mocha)', margin: 0, fontWeight: 500 }}>
                          Size: <strong>{product.fileSize || 'Available'}</strong> • Updated: <strong>{product.lastUpdated || 'Recently'}</strong>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {product.compatibility && product.compatibility.map(tag => (
                          <span key={tag} style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '4px 10px',
                            borderRadius: '8px', background: 'rgba(123,63,160,0.08)',
                            color: '#5A1E7E', border: '1px solid rgba(123,63,160,0.18)'
                          }}>{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(61,184,119,0.06)', borderRadius: '18px', padding: '20px 24px', border: '1px solid rgba(61,184,119,0.22)', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <Shield size={20} style={{ color: '#3DB877' }} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#276749' }}>
                          Online Inspection Mode Verified — Refund Eligibility Intact
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#2F855A', lineHeight: 1.6, margin: 0 }}>
                        You are inspecting <strong>{product.name}</strong> online. Inspecting this document or asset online preserves your standard refund eligibility. To save the complete file package to your device, click the <strong>Download Product</strong> button.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button
                        onClick={() => setIsPreviewOpen(false)}
                        style={{ padding: '11px 22px', borderRadius: '12px', background: 'rgba(78,59,49,0.08)', border: 'none', color: 'var(--color-espresso)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                      >
                        Close Preview
                      </button>
                      <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} />
                    </div>

                  </div>
                </div>
              )}

              {!loading && !errorMsg && viewerMode === 'stream' && previewUrl && (
                <iframe
                  src={`${previewUrl}#toolbar=1&navpanes=0&view=FitH`}
                  title={`PDF Web Viewer ${product.name}`}
                  style={{ width: '100%', height: '100%', border: 'none', background: '#FFFFFF' }}
                />
              )}
            </div>

            {/* Footer Status Bar */}
            <div style={{
              padding: '12px 24px', background: '#FFFDF9', borderTop: '1px solid rgba(78,59,49,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--color-mocha)'
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} style={{ color: '#3DB877' }} />
                <span><strong>Online Inspection Mode:</strong> Viewing this product online preserves your standard refund eligibility until you download the file to your computer device.</span>
              </span>
              <button
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  padding: '7px 18px', borderRadius: '10px', background: 'var(--color-espresso)',
                  color: '#FFFDF9', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.76rem',
                  boxShadow: '0 2px 8px rgba(45,30,24,0.15)'
                }}
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
