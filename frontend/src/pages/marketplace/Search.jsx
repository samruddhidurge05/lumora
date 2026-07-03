import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Search as SearchIcon, X, Clock, SlidersHorizontal, Star,
  ShoppingBag, Heart, Zap, TrendingUp, Package, ChevronDown,
} from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getSearchHistory, addSearchHistory, clearSearchHistory } from '../../services/searchService';
import { backendFetch } from '../../utils/api';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'popular',   label: 'Most Popular'  },
  { value: 'rating',    label: 'Top Rated'     },
  { value: 'newest',    label: 'Newest'        },
  { value: 'price-asc', label: 'Price: Low → High' },
  { value: 'price-desc',label: 'Price: High → Low' },
];

const PRICE_RANGES = [
  { label: 'All Prices',      min: 0,   max: 99999 },
  { label: 'Under ₹1,000',    min: 0,   max: 13    },
  { label: '₹1,000 – ₹2,500', min: 13,  max: 31    },
  { label: '₹2,500 – ₹5,000', min: 31,  max: 63    },
  { label: 'Above ₹5,000',    min: 63,  max: 99999 },
];

const QUICK_SUGGESTIONS = [
  'UI Kit', 'Figma templates', 'React components',
  'Notion planner', 'AI tools', 'Social media kit',
];

export default function Search() {
  const { products, navigateTo, addToCart, buyNow, toggleWishlist, wishlist, formatPrice, setActiveCategory } = useApp();
  const { user } = useAuth();

  const [query,      setQuery]      = useState('');
  const [submitted,  setSubmitted]  = useState('');
  const [history,    setHistory]    = useState(() => getSearchHistory());
  const [sort,       setSort]       = useState('relevance');
  const [priceIdx,   setPriceIdx]   = useState(0);
  const [activeCategory, setCat]    = useState('All');
  const [showFilters,setFilters]    = useState(false);
  const [suggestions,setSuggestions]= useState([]);
  const [showSug,    setShowSug]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [page, setPage]                 = useState(1);
  const itemsPerPage = 5;
  const inputRef = useRef(null);
  const sugRef   = useRef(null);

  // All unique categories from products
  const allCats = useMemo(() => (
    ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort()]
  ), [products]);

  // ── Load backend search history ──────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!user) { setHistory(getSearchHistory()); return; }
    try {
      const data = await backendFetch('/search/history');
      if (Array.isArray(data)) setHistory(data.map(i => i.query || i).filter(Boolean));
    } catch { setHistory(getSearchHistory()); }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Live autocomplete suggestions ────────────────────────────
  const fetchSuggestions = useCallback(async (val) => {
    if (!val || val.length < 2) { setSuggestions([]); return; }
    try {
      const data = await backendFetch(`/search/suggestions?query_str=${encodeURIComponent(val)}`);
      if (data?.products || data?.categories) {
        const items = [
          ...(data.categories || []).map(c => ({ type: 'category', label: c })),
          ...(data.products  || []).map(p => ({ type: 'product',  label: p.title, id: p.id })),
          ...(data.creators  || []).map(c => ({ type: 'creator',  label: c })),
        ];
        setSuggestions(items.slice(0, 6));
      }
    } catch {
      // Fall back to local match
      const q = val.toLowerCase();
      const local = products
        .filter(p => p.title?.toLowerCase().includes(q))
        .slice(0, 5)
        .map(p => ({ type: 'product', label: p.title, id: p.id }));
      setSuggestions(local);
    }
  }, [products]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.length >= 2) { fetchSuggestions(query); setShowSug(true); }
      else { setSuggestions([]); setShowSug(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, fetchSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    const h = (e) => {
      if (sugRef.current && !sugRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSug(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Filter & sort results ─────────────────────────────────────
  const results = useMemo(() => {
    if (!submitted.trim()) return [];
    const q = submitted.toLowerCase();
    const range = PRICE_RANGES[priceIdx];
    let list = products.filter(p => (
      (p.title?.toLowerCase().includes(q) ||
       p.category?.toLowerCase().includes(q) ||
       p.description?.toLowerCase().includes(q) ||
       p.seller?.name?.toLowerCase().includes(q) ||
       (p.compatibility || []).some(t => t.toLowerCase().includes(q))) &&
      (activeCategory === 'All' || p.category === activeCategory) &&
      p.price >= range.min && p.price < range.max &&
      (p.rating || 5.0) >= ratingFilter
    ));
    switch (sort) {
      case 'price-asc':  return [...list].sort((a,b) => a.price - b.price);
      case 'price-desc': return [...list].sort((a,b) => b.price - a.price);
      case 'rating':     return [...list].sort((a,b) => (b.rating||0) - (a.rating||0));
      case 'popular':    return [...list].sort((a,b) => (b.downloads||0) - (a.downloads||0));
      case 'newest':     return [...list].sort((a,b) => (b.newArrival?1:0) - (a.newArrival?1:0));
      default:           return list; // relevance = natural order
    }
  }, [submitted, products, sort, priceIdx, activeCategory, ratingFilter]);

  useEffect(() => {
    setPage(1);
  }, [submitted, sort, priceIdx, activeCategory, ratingFilter]);

  const totalPages = Math.ceil(results.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return results.slice(start, start + itemsPerPage);
  }, [results, page]);

  const doSearch = async (term) => {
    const t = term.trim();
    if (!t) return;
    setLoading(true);
    setShowSug(false);
    addSearchHistory(t);
    if (user) {
      backendFetch('/search/history', { method: 'POST', body: JSON.stringify({ query: t }) })
        .then(() => loadHistory()).catch(() => {});
    }
    setHistory(prev => [t, ...prev.filter(h => h !== t)].slice(0, 8));
    setSubmitted(t);
    setLoading(false);
  };

  const handleSubmit = (e) => { e.preventDefault(); doSearch(query); };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
    if (user) backendFetch('/search/history', { method: 'DELETE' }).catch(() => {});
  };

  const clearSearch = () => { setQuery(''); setSubmitted(''); setSuggestions([]); setShowSug(false); };

  const handleSuggestionClick = (s) => {
    if (s.type === 'product' && s.id) { navigateTo('product-detail', s.id); return; }
    if (s.type === 'category') { setActiveCategory('All'); setCat(s.label); }
    setQuery(s.label);
    doSearch(s.label);
  };

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,5vw,6rem) 80px', maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <span className="caption-premium" style={{ color: '#7B3FA0' }}>Marketplace</span>
        <h1 className="text-editorial" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px', marginBottom: '32px' }}>
          Search
        </h1>

        {/* ── Search bar ── */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '28px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div ref={inputRef} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '30px', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(196,181,253,0.40)', boxShadow: '0 4px 20px rgba(123,63,160,0.08)', position: 'relative' }}>
              <SearchIcon size={18} style={{ color: '#7B3FA0', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSug(true); }}
                placeholder="Search products, categories, creators…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.95rem', fontFamily: 'var(--font-sans)', color: 'var(--color-espresso)', width: '100%' }}
                autoFocus
              />
              {query && (
                <button type="button" onClick={clearSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                  <X size={15} />
                </button>
              )}
            </div>
            <button type="submit" className="btn-premium btn-premium-solid" style={{ padding: '14px 28px', borderRadius: '20px', fontSize: '0.88rem', flexShrink: 0 }}>
              Search
            </button>
          </div>

          {/* Live suggestions dropdown */}
          {showSug && suggestions.length > 0 && (
            <div ref={sugRef} style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: '110px', background: '#fff', border: '1px solid rgba(196,181,253,0.35)', borderRadius: '16px', boxShadow: '0 16px 40px rgba(45,0,96,0.14)', zIndex: 9999, overflow: 'hidden', animation: 'dropIn 0.18s ease' }}>
              {suggestions.map((s, i) => (
                <button key={i} type="button" onClick={() => handleSuggestionClick(s)}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 18px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', fontFamily: 'var(--font-sans)', color: '#2D004D', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,63,160,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {s.type === 'category' ? <Package size={13} style={{ color: '#7B3FA0', flexShrink: 0 }} /> : s.type === 'creator' ? <Star size={13} style={{ color: '#C7A55A', flexShrink: 0 }} /> : <SearchIcon size={13} style={{ color: '#8B6B5B', flexShrink: 0 }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                  <span style={{ fontSize: '0.62rem', color: '#B0A0C0', fontWeight: 700, textTransform: 'uppercase' }}>{s.type}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* ── Quick suggestions (pre-search) ── */}
        {!submitted && (
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              <TrendingUp size={11} style={{ display: 'inline', marginRight: '5px' }} />
              Trending searches
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {QUICK_SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.80)', color: '#5A1E7E', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.18s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.08)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.30)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.35)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent history ── */}
        {!submitted && history.length > 0 && (
          <div style={{ marginBottom: '32px', marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.70rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                <Clock size={11} style={{ display: 'inline', marginRight: '5px' }} />
                Recent Searches
              </span>
              <button onClick={handleClearHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#7B3FA0', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>
                Clear all
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {history.map((h, i) => (
                <button key={i} onClick={() => { setQuery(h); doSearch(h); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(196,181,253,0.30)', background: 'rgba(255,255,255,0.80)', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(196,181,253,0.30)'}
                >
                  <Clock size={11} /> {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Results section ── */}
        {submitted && (
          <div>
            {/* Result header + filters toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {loading ? 'Searching…' : (
                  <><strong style={{ color: 'var(--color-espresso)' }}>{results.length}</strong> result{results.length !== 1 ? 's' : ''} for "<strong style={{ color: '#7B3FA0' }}>{submitted}</strong>"</>
                )}
              </p>
              <button
                onClick={() => setFilters(f => !f)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(196,181,253,0.35)', background: showFilters ? 'rgba(123,63,160,0.08)' : 'rgba(255,255,255,0.80)', color: '#5A1E7E', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                <SlidersHorizontal size={13} />
                Filters & Sort
                <ChevronDown size={12} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div style={{ marginBottom: '24px', padding: '20px 24px', borderRadius: '16px', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(20px)', border: '1px solid rgba(196,181,253,0.28)', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Category */}
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</label>
                  <select
                    value={activeCategory}
                    onChange={e => setCat(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: '#fff', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#2D004D', outline: 'none', cursor: 'pointer' }}
                  >
                    {allCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {/* Price range */}
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Price Range</label>
                  <select
                    value={priceIdx}
                    onChange={e => setPriceIdx(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: '#fff', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#2D004D', outline: 'none', cursor: 'pointer' }}
                  >
                    {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
                  </select>
                </div>
                {/* Sort */}
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sort By</label>
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: '#fff', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#2D004D', outline: 'none', cursor: 'pointer' }}
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {/* Rating */}
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rating</label>
                  <select
                    value={ratingFilter}
                    onChange={e => setRatingFilter(Number(e.target.value))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: '#fff', fontSize: '0.82rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: '#2D004D', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value={0}>All Ratings</option>
                    <option value={4.5}>4.5★ &amp; above</option>
                    <option value={4.0}>4.0★ &amp; above</option>
                    <option value={3.5}>3.5★ &amp; above</option>
                  </select>
                </div>
                {/* Reset */}
                <div style={{ flex: '0 0 auto', paddingTop: '22px' }}>
                  <button
                    onClick={() => { setCat('All'); setPriceIdx(0); setSort('relevance'); setRatingFilter(0); }}
                    style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(255,255,255,0.90)', color: '#dc2626', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* Results list */}
            {results.length === 0 ? (
              <div className="glass-card" style={{ padding: '64px 40px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.28)' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🔍</p>
                <h3 className="text-editorial" style={{ fontSize: '1.6rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '10px' }}>
                  No results for "{submitted}"
                </h3>
                <p style={{ color: 'var(--color-mocha)', fontSize: '0.88rem', marginBottom: '24px' }}>
                  Try different keywords, or explore a category below.
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {QUICK_SUGGESTIONS.slice(0, 4).map(s => (
                    <button key={s} onClick={() => { setQuery(s); doSearch(s); }}
                      className="btn-premium" style={{ fontSize: '0.78rem', borderRadius: '20px', padding: '7px 16px' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {paginatedResults.map(p => {
                  const isWished = wishlist.some(w => w.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="glass-card"
                      onClick={() => navigateTo('product-detail', p.id)}
                      style={{ padding: '18px 22px', display: 'flex', gap: '18px', alignItems: 'center', cursor: 'pointer', border: '1px solid rgba(196,181,253,0.22)', transition: 'all 0.22s' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 36px rgba(45,0,96,0.12)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.28)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.22)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                    >
                      {/* Thumbnail */}
                      <img
                        src={p.preview || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&q=70'}
                        alt={p.title}
                        style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(220,198,255,0.25)' }}
                      />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#7B3FA0', background: 'rgba(123,63,160,0.08)', padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {p.category}
                          </span>
                          {p.badge && (
                            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', padding: '2px 8px', borderRadius: '6px' }}>
                              {p.badge}
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                          {p.title}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Star size={11} fill="#C7A55A" stroke="#C7A55A" />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8B6B5B' }}>{p.rating || 4.8}</span>
                            <span style={{ fontSize: '0.68rem', color: '#B08968' }}>({p.reviews || 0})</span>
                          </div>
                          <span style={{ fontSize: '0.70rem', color: '#B08968' }}>
                            by {p.seller?.name || p.creator?.name || 'Lumora Creator'}
                          </span>
                          {p.downloads > 0 && (
                            <span style={{ fontSize: '0.68rem', color: '#B0A0C0', fontWeight: 600 }}>
                              {p.downloads.toLocaleString()} downloads
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Price + actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D004D' }}>
                          {formatPrice(p.price)}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={e => { e.stopPropagation(); toggleWishlist(p); }}
                            style={{ width: '32px', height: '32px', borderRadius: '9px', border: '1px solid rgba(220,198,255,0.35)', background: 'rgba(255,255,255,0.90)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isWished ? '#E11D48' : '#8B6B5B', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            <Heart size={13} fill={isWished ? '#E11D48' : 'none'} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); addToCart(p); }}
                            style={{ width: '32px', height: '32px', borderRadius: '9px', border: '1px solid rgba(123,63,160,0.25)', background: 'rgba(255,255,255,0.90)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A1E7E', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#7B3FA0'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.90)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.25)'; }}
                          >
                            <ShoppingBag size={13} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); buyNow(p); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(90,30,126,0.28)', transition: 'all 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 5px 16px rgba(90,30,126,0.40)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(90,30,126,0.28)'}
                          >
                            <Zap size={11} /> Buy
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '24px' }}>
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: 'rgba(255,255,255,0.80)', color: '#5A1E7E', fontSize: '0.78rem', fontWeight: 700, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1, fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: 'rgba(255,255,255,0.80)', color: '#5A1E7E', fontSize: '0.78rem', fontWeight: 700, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1, fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <Footer />
      <style>{`
        @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
