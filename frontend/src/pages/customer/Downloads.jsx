import React, { useState, useRef, useEffect } from 'react';
import {
  Download, RefreshCw, ExternalLink, Search, Filter,
  Sparkles, Star, Clock, HardDrive, Tag, Shield,
  Zap, CheckCircle, ArrowUpRight, ChevronRight,
  Package, Layers, Cpu, FileCode, BookOpen,
  Palette, Music, Video, RotateCcw, Bell, X, AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';

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

/* ─── DOWNLOAD BUTTON COMPONENT ──────────────────────────────── */
function DownloadButton({ productName, variant = 'primary', downloadUrl, productId, downloadAvailable, pcloudDownloadLink }) {
  const [state, setState] = useState('idle'); // idle | downloading | done | pending

  const handleDownload = async () => {
    if (state !== 'idle') return;

    // ── Fast path: pCloud link → open instantly, no API round-trip ────────────
    if (pcloudDownloadLink) {
      window.open(pcloudDownloadLink, '_blank');
      setState('downloading');
      setTimeout(() => setState('done'), 600);
      setTimeout(() => setState('idle'), 4000);
      return;
    }

    setState('downloading');
    
    let activeUrl = downloadUrl;
    const numericId = parseInt(productId, 10);

    // Fetch a fresh tokenized download URL from backend
    if (!isNaN(numericId)) {
      try {
        const res = await backendFetch(`/products/${numericId}/download`);

        // ── Download Pending: backend signals asset not yet uploaded ──────────
        if (res?.download_available === false) {
          setState('pending');
          return;
        }

        // Handle pCloud / external redirect (temporary dev/testing implementation)
        if (res?.type === 'external' && res?.redirect_url) {
          window.open(res.redirect_url, '_blank');
          setTimeout(() => setState('done'), 400);
          setTimeout(() => setState('idle'), 4500);
          return;
        }
        if (res && res.download_url) {
          activeUrl = res.download_url;
        }
      } catch (err) {
        console.warn('[DownloadButton] Failed to fetch fresh download token, falling back to cached URL:', err.message);
      }
    }
    
    // Connect to backend download URL if provided
    if (activeUrl) {
      try {
        // ── Check if the actual file response is pending ─────────────────────
        // The download-file endpoint returns JSON {type:"pending"} when no file
        // is uploaded — intercept before triggering a browser download attempt.
        const fileCheckUrl = activeUrl.startsWith('/api')
          ? activeUrl.replace('/api', '')
          : activeUrl;
        const token = localStorage.getItem('lumora_backend_token');
        const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const fileResp = await fetch(`${BACKEND_URL}${fileCheckUrl.startsWith('/') ? fileCheckUrl : '/' + fileCheckUrl}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!fileResp.ok) {
          throw new Error(`HTTP error! status: ${fileResp.status}`);
        }

        const contentType = fileResp.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const fileRespJson = await fileResp.json();
          if (fileRespJson?.type === 'pending') {
            setState('pending');
            return;
          }
          if (fileRespJson?.type === 'external' && fileRespJson?.redirect_url) {
            window.open(fileRespJson.redirect_url, '_blank');
            setTimeout(() => setState('done'), 400);
            setTimeout(() => setState('idle'), 4500);
            return;
          }
        } else {
          // It's a binary stream! Download via blob
          const blob = await fileResp.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.setAttribute('download', `${productName.toLowerCase().replace(/\s+/g, '-')}.zip`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);
          setTimeout(() => setState('done'), 1800);
          setTimeout(() => setState('idle'), 4500);
          return;
        }
      } catch (e) {
        console.warn('Download link trigger:', e);
      }
    }

    setTimeout(() => setState('done'), 1800);
    setTimeout(() => setState('idle'), 4500);
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
      label: variant === 'redownload' ? 'Re-download' : 'Download',
      icon: variant === 'redownload' ? <RotateCcw size={12} /> : <Download size={12} />,
      bg: variant === 'primary'
        ? 'linear-gradient(135deg, #4E3B31, #3A2820)'
        : 'rgba(78,59,49,0.06)',
      color: variant === 'primary' ? '#FFFDF9' : '#4E3B31',
      border: variant === 'primary' ? 'transparent' : '1px solid rgba(78,59,49,0.12)',
    },
    downloading: {
      label: 'Downloading…',
      icon: <div style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />,
      bg: 'rgba(78,59,49,0.08)',
      color: '#4E3B31',
      border: '1px solid rgba(78,59,49,0.12)',
    },
    done: {
      label: 'Completed!',
      icon: <CheckCircle size={12} />,
      bg: 'linear-gradient(135deg, #3DB877, #2D9B60)',
      color: '#FFFDF9',
      border: 'transparent',
    },
  };

  const c = configs[state] || configs.idle;

  return (
    <button
      onClick={handleDownload}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '8px 16px', borderRadius: '10px',
        background: c.bg, color: c.color, border: c.border,
        fontSize: '0.72rem', fontWeight: 700,
        fontFamily: 'var(--font-sans)', cursor: 'pointer',
        outline: 'none', transition: 'all 0.3s ease',
        transform: state === 'done' ? 'scale(1.02)' : 'scale(1)',
        boxShadow: state === 'done' ? '0 4px 16px rgba(61,184,119,0.35)' :
          variant === 'primary' ? '0 4px 16px rgba(78,59,49,0.18)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {c.icon}
      {c.label}
    </button>
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
              pcloud_download_link: prod?.pcloud_download_link || null,
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
    pcloud_download_link: p.pcloud_download_link || null,
    verified: true,
  }));

  // Merge: backend orders take precedence over context-only items
  const allProductsMap = new Map();
  backendOwnedProducts.forEach(b => allProductsMap.set(String(b.id), b));
  ownedReal.forEach(r => {
    if (!allProductsMap.has(String(r.id))) allProductsMap.set(String(r.id), r);
  });

  const allProducts = Array.from(allProductsMap.values());

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>Owned Assets</span>
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: 2, color: 'var(--color-espresso)' }}>
              {activeFilter === 'all' ? 'Complete Library' : dynamicFilterTabs.find(t => t.id === activeFilter)?.label}
            </h2>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-mocha)', fontWeight: 700 }}>
            {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'}
          </span>
        </div>

        {!loading && allProducts.length === 0 ? (
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
            {filtered.map(product => (
              <VaultCard
                key={product.id}
                product={product}
                isHovered={hoveredCard === product.id}
                onHover={setHoveredCard}
              />
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
                <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} pcloudDownloadLink={product.pcloud_download_link} />
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
function VaultCard({ product, isHovered, onHover }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
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

  const handleOpen = () => {
    // ── Fast path: open pCloud link instantly, no API needed ─────────────────
    const quickUrl = product.pcloud_download_link || product.downloadUrl;
    if (quickUrl && (quickUrl.includes('pcloud') || quickUrl.includes('publink'))) {
      window.open(quickUrl, '_blank');
      return;
    }

    // ── Fallback: resolve via backend for non-pCloud products ─────────────────
    const numericId = parseInt(product.id, 10);
    if (isNaN(numericId)) return;

    (async () => {
      try {
        const res = await backendFetch(`/products/${numericId}/download`);
        if (res?.download_available === false) {
          alert('The creator has not yet uploaded the downloadable asset.');
          return;
        }
        if (res?.type === 'external' && res?.redirect_url) {
          window.open(res.redirect_url, '_blank');
          return;
        }
        const activeUrl = res?.download_url || product.downloadUrl;
        if (activeUrl) {
          const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
          const fileCheckUrl = activeUrl.startsWith('/api') ? activeUrl.replace('/api', '') : activeUrl;
          window.open(`${BACKEND_URL}${fileCheckUrl.startsWith('/') ? fileCheckUrl : '/' + fileCheckUrl}`, '_blank');
        }
      } catch (err) {
        console.warn('[OpenButton] Failed to resolve download link:', err);
        const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
        const fallbackUrl = product.downloadUrl?.startsWith('http')
          ? product.downloadUrl
          : `${BACKEND_URL}${product.downloadUrl?.startsWith('/') ? product.downloadUrl : '/' + product.downloadUrl}`;
        window.open(fallbackUrl, '_blank');
      }
    })();
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => onHover(product.id)}
      onMouseLeave={handleMouseLeave}
      style={{
        borderRadius: 20, overflow: 'hidden',
        background: 'rgba(255,255,255,0.72)',
        border: isHovered ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.75)',
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
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
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
          position: 'absolute', top: 12, left: 12,
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
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', lineHeight: 1.2 }}>{product.name}</h3>
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
            /* ── Download Pending: asset not yet uploaded by creator ──────────
               Never removes the card from the vault. Ownership is preserved.
               The message is production-friendly — no technical errors shown. */
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
            <>
              <DownloadButton productName={product.name} variant="primary" downloadUrl={product.downloadUrl} productId={product.id} pcloudDownloadLink={product.pcloud_download_link} />
              <DownloadButton productName={product.name} variant="redownload" downloadUrl={product.downloadUrl} productId={product.id} pcloudDownloadLink={product.pcloud_download_link} />
              <button 
                onClick={handleOpen}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '8px 14px', borderRadius: 10, marginLeft: 'auto',
                  background: 'rgba(78,59,49,0.04)', border: '1px solid rgba(78,59,49,0.08)',
                  color: 'var(--color-mocha)', fontSize: '0.7rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', outline: 'none',
                }}
              >
                <ExternalLink size={11} /> Open
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
