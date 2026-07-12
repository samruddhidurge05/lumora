import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Grid3X3, List, Plus, Trash2,
  Edit3, Star, Download, Eye, RefreshCw, ChevronLeft,
  ChevronRight, AlertCircle, Package, X, CheckCircle, Circle,
} from 'lucide-react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useVendorProducts, useVendorProfileComplete } from '../../hooks/useVendorData';
import { useApp } from '../../context/AppContext';
import { ProductQrButton } from '../../components/product/ProductQrCode';

/* ── constants ─────────────────────────────────────────────────────────── */
const CATEGORIES = [
  'All','UI Kits','Icon Packs','Templates','Fonts','Illustrations',
  'Mockups','Plugins','3D Assets','Photography','Music',
  'Website Templates','Landing Pages','Mobile App Designs','Design Assets',
  'E-books','Notion Templates','Productivity Tools','Social Media Kits',
  'AI Tools','React Templates',
];

const STATUS_OPTIONS = [
  { value: '',          label: 'All Status'  },
  { value: 'published', label: 'Published'   },
  { value: 'active',    label: 'Active'      },
  { value: 'draft',     label: 'Draft'       },
  { value: 'paused',    label: 'Paused'      },
];

const SORT_OPTIONS = [
  { value: 'newest',     label: 'Newest First'   },
  { value: 'popular',    label: 'Most Downloads' },
  { value: 'rating',     label: 'Top Rated'      },
  { value: 'price-asc',  label: 'Price ↑'        },
  { value: 'price-desc', label: 'Price ↓'        },
];

/* ── helpers ────────────────────────────────────────────────────────────── */
function HealthBar({ score }) {
  const s = Number(score) || 0;
  const cls = s >= 80 ? 'green' : s >= 55 ? '' : 'amber';
  const label = s >= 80 ? 'Excellent' : s >= 55 ? 'Good' : 'Needs Work';
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:10, color:'var(--v-text3)' }}>{label}</span>
        <span style={{ fontSize:10, fontWeight:600, color:'var(--v-purple)' }}>{s}</span>
      </div>
      <div className="v-progress-track" style={{ height:4 }}>
        <div className={`v-progress-fill ${cls}`} style={{ width:`${s}%` }} />
      </div>
    </div>
  );
}

function Thumb({ src, alt, size = 48 }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{ width:size, height:size, borderRadius:10, overflow:'hidden', flexShrink:0,
      background:'linear-gradient(135deg,#D8BFE3,#B886D0)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      {src && !err
        ? <img src={src} alt={alt} onError={() => setErr(true)} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : <Package size={size * 0.38} style={{ color:'#fff', opacity:0.7 }} />}
    </div>
  );
}

function statusBadgeClass(s) {
  if (s === 'active' || s === 'published') return 'v-badge-green';
  if (s === 'draft') return 'v-badge-gray';
  return 'v-badge-amber';
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════ */
export default function ManageProducts() {
  const navigate = useNavigate();
  const { isProfileComplete, profileChecks } = useVendorProfileComplete();

  /* Profile incomplete modal state */
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);

  /* Filter state */
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('');
  const [status,   setStatus]   = useState('');
  const [sort,     setSort]     = useState('newest');
  const [page,     setPage]     = useState(1);
  const [view,     setView]     = useState('table'); // 'grid' | 'table'
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  /* Debounced search — avoid calling API on every keystroke */
  const [searchInput, setSearchInput] = useState('');
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(window._searchTimer);
    window._searchTimer = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  const { products, total, pages, currentPage, loading, error, refresh, deleteProduct } =
    useVendorProducts({ search, category, status, sort, page, limit: 15 });
  const { refetchProducts } = useApp();

  /* ── handlers ─────────────────────────────────────────────────────── */
  /* Guard: only navigate to Add Product if profile is complete */
  const handleAddProduct = () => {
    if (!isProfileComplete) {
      setShowIncompleteModal(true);
    } else {
      navigate('/vendor/add-product');
    }
  };
  const handleFilter = (field, val) => {
    if (field === 'category') setCategory(val === 'All' ? '' : val);
    if (field === 'status')   setStatus(val);
    if (field === 'sort')     setSort(val);
    setPage(1);
  };

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setDeleting(id);
    setDeleteError(null);
    try {
      await deleteProduct(id);
      if (typeof refetchProducts === 'function') {
        refetchProducts();
      }
    }
    catch (e) { setDeleteError(`Delete failed: ${e.message}`); }
    finally { setDeleting(null); }
  }, [deleteProduct, refetchProducts]);

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} product(s)?`)) return;
    for (const id of selected) await deleteProduct(id).catch(() => {});
    setSelected([]);
    if (typeof refetchProducts === 'function') {
      refetchProducts();
    }
    refresh();
  };

  const toggleSelect = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const toggleAll = (checked) =>
    setSelected(checked ? products.map(p => p.id) : []);

  const goEdit = (p) => navigate(`/vendor/edit-product/${p.id}`, { state: { product: p } });

  return (
    <VendorLayout activePage="products" title="Products"
      subtitle={loading ? 'Loading…' : `${total} product${total !== 1 ? 's' : ''} in your store`}
      actions={
        <div style={{ display:'flex', gap:8 }}>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={refresh} disabled={loading}
            style={{ display:'flex', alignItems:'center', gap:5 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
            Refresh
          </button>
          <button className="v-btn v-btn-primary v-btn-sm" onClick={handleAddProduct}
            style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={14} /> Add Product
          </button>
        </div>
      }
    >

      {/* ── Error banner ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom:16, padding:'11px 16px', borderRadius:12, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.20)', color:'#dc2626', fontSize:13, display:'flex', gap:8, alignItems:'center' }}>
          <AlertCircle size={14} /> Backend error: {error}
        </div>
      )}

      {deleteError && (
        <div style={{ marginBottom:16, padding:'11px 16px', borderRadius:12, background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.20)', color:'#dc2626', fontSize:13, display:'flex', gap:8, alignItems:'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertCircle size={14} /> {deleteError}
          </div>
          <button onClick={() => setDeleteError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Filter + search bar ───────────────────────────────────────── */}
      <div className="v-card v-card-pad" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 220px', padding:'8px 14px', borderRadius:10, background:'rgba(255,255,255,0.80)', border:'1px solid rgba(196,148,230,0.28)', backdropFilter:'blur(12px)' }}>
            <Search size={14} style={{ color:'var(--v-text3)', flexShrink:0 }} />
            <input
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search products…"
              style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'var(--v-sans)', color:'var(--v-dark)', width:'100%' }}
            />
          </div>

          {/* Category */}
          <select className="v-select" style={{ flex:'0 1 170px', marginBottom:0 }}
            value={category || 'All'} onChange={e => handleFilter('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Status */}
          <select className="v-select" style={{ flex:'0 1 140px', marginBottom:0 }}
            value={status} onChange={e => handleFilter('status', e.target.value)}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          {/* Sort */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:10, background:'rgba(255,255,255,0.80)', border:'1px solid rgba(196,148,230,0.28)' }}>
            <SlidersHorizontal size={13} style={{ color:'var(--v-text3)' }} />
            <select style={{ background:'transparent', border:'none', outline:'none', fontSize:13, fontFamily:'var(--v-sans)', fontWeight:600, color:'var(--v-dark)', cursor:'pointer' }}
              value={sort} onChange={e => handleFilter('sort', e.target.value)}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div style={{ display:'flex', gap:3, padding:4, borderRadius:10, background:'rgba(255,255,255,0.80)', border:'1px solid rgba(196,148,230,0.22)', marginLeft:'auto' }}>
            {[['table', <List size={14} />], ['grid', <Grid3X3 size={14} />]].map(([m, icon]) => (
              <button key={m} onClick={() => setView(m)}
                style={{ width:30, height:30, borderRadius:7, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  background: view === m ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'transparent',
                  color: view === m ? '#fff' : 'var(--v-text3)', transition:'all 0.2s' }}>
                {icon}
              </button>
            ))}
          </div>

          {/* Bulk actions */}
          {selected.length > 0 && (
            <button className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626', display:'flex', alignItems:'center', gap:5 }}
              onClick={handleBulkDelete}>
              <Trash2 size={13} /> Delete ({selected.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Loading skeleton ──────────────────────────────────────────── */}
      {loading && products.length === 0 && (
        <div className="v-card v-card-pad" style={{ textAlign:'center', padding:'60px 24px' }}>
          <RefreshCw size={28} style={{ color:'var(--v-purple)', animation:'spin 1.2s linear infinite', margin:'0 auto 14px', display:'block' }} />
          <div style={{ color:'var(--v-text3)', fontSize:14 }}>Loading your products…</div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!loading && products.length === 0 && (
        <div className="v-card">
          <div className="v-empty">
            <div className="v-empty-icon"><Package size={40} style={{ opacity:0.25 }} /></div>
            <div className="v-empty-title">{search || category || status ? 'No products match' : 'No products yet'}</div>
            <div className="v-empty-sub">
              {search || category || status
                ? 'Try clearing the filters'
                : 'Create your first product listing to start selling'}
            </div>
            {!search && !category && !status && (
              <button className="v-btn v-btn-primary" style={{ marginTop:16, display:'inline-flex', alignItems:'center', gap:6 }}
                onClick={handleAddProduct}>
                <Plus size={14} /> Add First Product
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Table view ───────────────────────────────────────────────── */}
      {!loading && products.length > 0 && view === 'table' && (
        <div className="v-card">
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width:36 }}>
                    <input type="checkbox" style={{ accentColor:'#B886D0' }}
                      checked={selected.length === products.length && products.length > 0}
                      onChange={e => toggleAll(e.target.checked)} />
                  </th>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Category</th>
                  <th><Download size={12} style={{ display:'inline', marginRight:3 }} />Downloads</th>
                  <th><Star size={12} style={{ display:'inline', marginRight:3 }} />Rating</th>
                  <th>Health</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ opacity: deleting === p.id ? 0.4 : 1, transition:'opacity 0.2s' }}>
                    <td>
                      <input type="checkbox" style={{ accentColor:'#B886D0' }}
                        checked={selected.includes(p.id)}
                        onChange={() => toggleSelect(p.id)} />
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Thumb src={p.thumbnail || p.preview} alt={p.title} size={44} />
                        <div>
                          <div style={{ fontWeight:600, color:'var(--v-dark)', fontSize:13.5, maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                          <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:2 }}>ID: {p.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight:700, color:'var(--v-deep)' }}>₹{Number(p.price).toLocaleString('en-IN')}</td>
                    <td><span style={{ fontSize:11, fontWeight:600, color:'var(--v-text2)' }}>{p.category || '—'}</span></td>
                    <td style={{ fontWeight:500, color:'var(--v-text2)' }}>{(p.downloads || 0).toLocaleString()}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ color:'#f59e0b', fontSize:13 }}>★</span>
                        <span style={{ fontWeight:600, fontSize:13 }}>{Number(p.rating || 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td><HealthBar score={p.healthScore || 75} /></td>
                    <td>
                      <span className={`v-badge ${statusBadgeClass(p.status)}`}>
                        <span className="v-badge-dot" />
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="v-btn v-btn-ghost v-btn-sm" onClick={() => goEdit(p)}
                          style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <Edit3 size={12} /> Edit
                        </button>
                        <ProductQrButton product={p} />
                        <button className="v-btn v-btn-ghost v-btn-sm"
                          style={{ color:'#dc2626', display:'flex', alignItems:'center', gap:4 }}
                          onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grid view ────────────────────────────────────────────────── */}
      {!loading && products.length > 0 && view === 'grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))', gap:16 }}>
          {products.map(p => (
            <div key={p.id} className="v-card" style={{ overflow:'hidden', display:'flex', flexDirection:'column', transition:'transform 0.25s, box-shadow 0.25s', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 20px 44px rgba(90,30,126,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}>
              {/* Thumbnail */}
              <div style={{ height:140, overflow:'hidden', background:'linear-gradient(135deg,#D8BFE3,#B886D0)', position:'relative' }}>
                <Thumb src={p.thumbnail || p.preview} alt={p.title} size={0} />
                {p.thumbnail || p.preview
                  ? <img src={p.thumbnail || p.preview} alt={p.title}
                      style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }}
                      onError={e => { e.target.style.display='none'; }} />
                  : <Package size={40} style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', color:'#fff', opacity:0.5 }} />
                }
                <span className={`v-badge ${statusBadgeClass(p.status)}`}
                  style={{ position:'absolute', top:8, left:8, backdropFilter:'blur(8px)' }}>
                  <span className="v-badge-dot" />{p.status}
                </span>
              </div>
              {/* Body */}
              <div style={{ padding:'12px 14px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:12, color:'var(--v-text3)' }}>{p.category}</div>
                <div style={{ fontWeight:700, fontSize:13.5, color:'var(--v-dark)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:800, fontSize:15, color:'var(--v-deep)' }}>₹{Number(p.price).toLocaleString('en-IN')}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:11, color:'var(--v-text2)' }}>
                    <span style={{ color:'#f59e0b' }}>★</span>{Number(p.rating || 0).toFixed(1)}
                  </div>
                </div>
                <HealthBar score={p.healthScore || 75} />
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  <button className="v-btn v-btn-secondary v-btn-sm" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}
                    onClick={() => goEdit(p)}>
                    <Edit3 size={12} /> Edit
                  </button>
                  <ProductQrButton product={p} />
                  <button className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626', display:'flex', alignItems:'center', gap:4 }}
                    onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, marginTop:24, fontSize:13, color:'var(--v-text2)' }}>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontWeight:600 }}>Page {currentPage} of {pages}</span>
          <span style={{ color:'var(--v-text3)' }}>({total} total)</span>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={currentPage >= pages} style={{ display:'flex', alignItems:'center', gap:4 }}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Incomplete Profile Modal ──────────────────────────────────── */}
      {showIncompleteModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(15,10,22,0.55)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }} onClick={() => setShowIncompleteModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 24,
            padding: '32px 28px',
            maxWidth: 460,
            width: '100%',
            boxShadow: '0 32px 80px rgba(90,30,126,0.22)',
            border: '1px solid rgba(196,148,230,0.28)',
            fontFamily: 'var(--v-sans)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.06))',
                  border: '1px solid rgba(239,68,68,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle size={22} style={{ color: '#dc2626' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--v-dark)', lineHeight: 1.2 }}>
                    Profile Incomplete
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--v-text3)', marginTop: 3 }}>
                    Complete your Vendor Profile before adding products.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowIncompleteModal(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--v-text3)', padding: 4, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.2s',
              }}>
                <X size={18} />
              </button>
            </div>

            {/* Checklist */}
            <div style={{
              background: 'rgba(216,191,227,0.10)',
              border: '1px solid rgba(196,148,230,0.20)',
              borderRadius: 14, padding: '14px 16px',
              marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {profileChecks.map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {item.done
                    ? <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    : <Circle     size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
                  }
                  <span style={{
                    fontSize: 13.5, fontWeight: 500,
                    color: item.done ? 'var(--v-text2)' : 'var(--v-dark)',
                    textDecoration: item.done ? 'none' : 'none',
                  }}>
                    {item.label}
                  </span>
                  {item.done && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#16a34a', fontWeight: 700 }}>Done</span>
                  )}
                  {!item.done && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Required</span>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="v-btn v-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setShowIncompleteModal(false); navigate('/vendor/profile'); }}
              >
                Complete Profile
              </button>
              <button
                className="v-btn v-btn-ghost"
                style={{ padding: '0 20px' }}
                onClick={() => setShowIncompleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
