import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Star, ShoppingBag, Heart, Grid3X3, List, X, Zap } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';
import ProductImage from '../../components/product/ProductImage';

const ALL_CATS = [
  { id: 'All', icon: '✦' },
  { id: 'UI Kits', icon: '💎' },
  { id: 'Mobile App Designs', icon: '📱' },
  { id: 'React Templates', icon: '⚛️' },
  { id: 'Website Templates', icon: '💻' },
  { id: 'Design Assets', icon: '🎨' },
  { id: 'Graphics & UI', icon: '🖼️' },
  { id: 'E-books', icon: '📖' },
  { id: 'Notion Templates', icon: '🚀' },
  { id: 'Social Media Kits', icon: '📸' },
  { id: 'AI Tools', icon: '🧠' },
  { id: 'AI Prompt Packs', icon: '💬' },
  { id: 'Icons & Illustrations', icon: '✏️' },
  { id: 'Resume Templates', icon: '📄' },
  { id: 'Business Templates', icon: '💼' },
  { id: 'Productivity Tools', icon: '⚡' },
  { id: 'Productivity Systems', icon: '⚙️' },
  { id: 'Figma Resources', icon: '🎯' },
];

const PRICE_RANGES = [
  { label: 'All Prices', min: 0, max: 99999 },
  { label: 'Under ₹1,000', min: 0, max: 12 },
  { label: '₹1,000 – ₹2,500', min: 12, max: 30 },
  { label: '₹2,500 – ₹5,000', min: 30, max: 60 },
  { label: 'Above ₹5,000', min: 60, max: 99999 },
];

export default function Products() {
  const { products, addToCart, buyNow, navigateTo, formatPrice,
          activeCategory, setActiveCategory, wishlist, toggleWishlist, ownedProducts } = useApp();
  const [search, setSearch]     = useState('');
  const [sort, setSort]         = useState('featured');
  const [priceIdx, setPriceIdx] = useState(0);
  const [view, setView]         = useState('grid');

  const catCounts = useMemo(() => {
    const m = { All: products.length };
    products.forEach(p => { m[p.category] = (m[p.category] || 0) + 1; });
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const range = PRICE_RANGES[priceIdx];
    let list = products
      .filter(p => activeCategory === 'All' || p.category === activeCategory)
      .filter(p => p.price >= range.min && p.price < range.max)
      .filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.title?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q);
      });
    switch (sort) {
      case 'price-asc':  return [...list].sort((a, b) => a.price - b.price);
      case 'price-desc': return [...list].sort((a, b) => b.price - a.price);
      case 'rating':     return [...list].sort((a, b) => (b.rating||0) - (a.rating||0));
      case 'popular':    return [...list].sort((a, b) => (b.downloads||0) - (a.downloads||0));
      case 'newest':     return [...list].sort((a, b) => {
        const tsA = a.createdAt || a.created_at;
        const tsB = b.createdAt || b.created_at;
        const ta = tsA ? new Date(tsA).getTime() : (Number(a.id) || 0);
        const tb = tsB ? new Date(tsB).getTime() : (Number(b.id) || 0);
        if (tb !== ta) return tb - ta;
        // Secondary: new_arrival flag for mock products
        return (b.newArrival || b.new_arrival ? 1 : 0) - (a.newArrival || a.new_arrival ? 1 : 0);
      });
      default:           return [...list].sort((a, b) => (b.featured?1:0) - (a.featured?1:0));
    }
  }, [products, activeCategory, search, sort, priceIdx]);

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Navbar />
      <div style={{ background: 'transparent', minHeight: '100vh', paddingTop: '100px' }}>

        {/* ── Header band ── */}
        <div style={{ background: 'transparent', borderBottom: '1px solid rgba(123,63,160,0.12)', padding: '28px clamp(1.5rem,5vw,5rem) 0' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Marketplace</p>
              <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 400, color: '#2D004D', marginTop: '4px' }}>
                {activeCategory === 'All' ? 'All Products' : activeCategory}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#8B6B5B', marginLeft: '12px' }}>({filtered.length})</span>
              </h1>
            </div>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '1px' }} className="scroll-container">
              {ALL_CATS.filter(c => catCounts[c.id] > 0 || c.id === 'All').map(cat => {
                const active = activeCategory === cat.id;
                return (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 15px', borderRadius: '10px 10px 0 0', border: active ? '1px solid rgba(123,63,160,0.20)' : '1px solid transparent', borderBottom: active ? '2px solid #7B3FA0' : '2px solid transparent', background: active ? 'rgba(123,63,160,0.07)' : 'transparent', color: active ? '#5A1E7E' : '#8B6B5B', fontSize: '0.78rem', fontWeight: active ? 700 : 500, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.18s', fontFamily: 'var(--font-sans)' }}>
                    {cat.id}
                    <span style={{ fontSize: '0.58rem', background: active ? '#7B3FA0' : 'rgba(123,63,160,0.10)', color: active ? '#fff' : '#7B3FA0', padding: '1px 5px', borderRadius: '8px', fontWeight: 800 }}>
                      {catCounts[cat.id] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px clamp(1.5rem,5vw,5rem) 80px' }}>
          {/* ── Filter bar ── */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '200px', maxWidth: '320px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(196,181,253,0.30)', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(123,63,160,0.06)' }}>
              <Search size={15} style={{ color: '#8B6B5B', flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.83rem', fontFamily: 'var(--font-sans)', color: '#2D004D', width: '100%' }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B6B5B', padding: 0, display: 'flex' }}><X size={13} /></button>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(196,181,253,0.30)', backdropFilter: 'blur(12px)' }}>
              <SlidersHorizontal size={13} style={{ color: '#8B6B5B' }} />
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#2D004D', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                <option value="featured">Featured</option>
                <option value="popular">Most Popular</option>
                <option value="rating">Top Rated</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price ↑</option>
                <option value="price-desc">Price ↓</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderRadius: '14px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(196,181,253,0.30)', backdropFilter: 'blur(12px)' }}>
              <select value={priceIdx} onChange={e => setPriceIdx(Number(e.target.value))} style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.78rem', fontWeight: 700, color: '#2D004D', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}>
                {PRICE_RANGES.map((r, i) => <option key={i} value={i}>{r.label}</option>)}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px', padding: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(196,181,253,0.25)' }}>
              {[['grid', <Grid3X3 size={14} />], ['list', <List size={14} />]].map(([m, icon]) => (
                <button key={m} onClick={() => setView(m)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: view === m ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'transparent', color: view === m ? '#fff' : '#8B6B5B', transition: 'all 0.2s' }}>{icon}</button>
              ))}
            </div>
          </div>

          {/* ── Grid / List ── */}
          {filtered.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', background: 'rgba(255,255,255,0.75)', borderRadius: '24px', border: '1px dashed rgba(123,63,160,0.22)' }}>
              <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</p>
              <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.6rem', color: '#2D004D', marginBottom: '8px' }}>No products found</h3>
              <p style={{ color: '#8B6B5B', marginBottom: '20px' }}>Try different filters or search terms</p>
              <button onClick={() => { setSearch(''); setActiveCategory('All'); setPriceIdx(0); }}
                style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Clear Filters
              </button>
            </div>
          ) : view === 'grid' ? (
            <div className="product-auto-grid">
              {filtered.map((p, i) => <GlassProductCard key={p.id} product={p} index={i} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map(p => <ProductListRow key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ═══════════════════════════════════════
   PREMIUM GLASS PRODUCT CARD
═══════════════════════════════════════ */
function GlassProductCard({ product, index }) {
  const { addToCart, buyNow, navigateTo, formatPrice, wishlist, toggleWishlist, ownedProducts } = useApp();
  const [hov, setHov] = useState(false);
  const isWished  = wishlist.some(w => w.id === product.id);
  const isOwned   = ownedProducts.some(id => String(id) === String(product.id));

  // Generate multiple preview images based on category
  const extraImages = getExtraImages(product);


  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, delay: (index % 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      onClick={() => navigateTo('product-detail', product.id)}
      style={{
        background: hov
          ? 'rgba(255, 255, 255, 0.75)'
          : 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        border: `1px solid ${hov ? 'rgba(196,148,230,0.55)' : 'rgba(255, 255, 255, 0.65)'}`,
        borderTop: hov ? '1px solid rgba(255,255,255,0.95)' : '1px solid rgba(255,255,255,0.80)',
        borderRadius: '24px', overflow: 'hidden',
        boxShadow: hov
          ? '0 32px 80px rgba(123, 63, 160, 0.16), 0 8px 24px rgba(123,63,160,0.08), inset 0 1px 0 rgba(255,255,255,0.90)'
          : '0 4px 24px rgba(123, 63, 160, 0.06), 0 1px 3px rgba(123,63,160,0.04), inset 0 1px 0 rgba(255,255,255,0.75)',
        transform: hov ? 'translateY(-8px) scale(1.015)' : 'translateY(0) scale(1)',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* ── Image area with multi-preview on hover ── */}
      <div style={{ height: '195px', overflow: 'hidden', position: 'relative', borderRadius: '24px 24px 0 0' }}>
        <ProductImage
          product={product}
          style={{ transform: hov ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.5s ease, opacity 0.3s' }}
        />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: hov ? 'linear-gradient(180deg,transparent 50%,rgba(45,0,77,0.12))' : 'transparent', transition: 'background 0.3s', pointerEvents: 'none' }} />

        {/* Mini image strip on hover */}
        {hov && extraImages.length > 1 && (
          <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
            {extraImages.slice(0, 4).map((img, i) => (
              <div key={i} style={{ width: '36px', height: '26px', borderRadius: '5px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.80)', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }}>
                <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {product.badge && (
            <span style={{ fontSize: '0.56rem', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 800, padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.04em', backdropFilter: 'blur(8px)' }}>
              {product.badge}
            </span>
          )}
          {product.trending && !product.badge && (
            <span style={{ fontSize: '0.56rem', background: 'rgba(255,214,186,0.92)', color: '#8B4A1A', fontWeight: 800, padding: '3px 9px', borderRadius: '20px', backdropFilter: 'blur(8px)' }}>
              🔥 Trending
            </span>
          )}
          {isOwned && (
            <span style={{ fontSize: '0.56rem', background: 'rgba(34,197,94,0.90)', color: '#fff', fontWeight: 800, padding: '3px 9px', borderRadius: '20px' }}>
              ✓ Owned
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
          style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(8px)', border: '1px solid rgba(220,198,255,0.40)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isWished ? '#E11D48' : '#8B6B5B', boxShadow: '0 2px 8px rgba(45,0,96,0.10)', transition: 'all 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.12)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <Heart size={13} fill={isWished ? '#E11D48' : 'none'} />
        </button>
      </div>

      {/* ── Card body ── */}
      <div style={{ padding: '18px 18px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Category + rating row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'rgba(123,63,160,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
            {product.category}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Star size={10} fill="#C7A55A" stroke="#C7A55A" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8B6B5B' }}>{product.rating || 4.8}</span>
            <span style={{ fontSize: '0.62rem', color: '#B08968' }}>({product.reviews || 0})</span>
          </div>
        </div>

        {/* Title */}
        <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D004D', lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: 0 }}>
          {product.title}
        </h3>

        {/* Seller */}
        <p style={{ fontSize: '0.70rem', color: '#B08968', fontWeight: 500, margin: 0 }}>
          by {product.seller?.name || product.creator?.name || 'Lumora Creator'}
        </p>

        {/* Compatibility tags */}
        {product.compatibility && product.compatibility.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {product.compatibility.slice(0, 3).map(c => (
              <span key={c} style={{ fontSize: '0.56rem', fontWeight: 600, color: '#6B4F7A', background: 'rgba(220,198,255,0.22)', padding: '2px 7px', borderRadius: '5px', border: '1px solid rgba(220,198,255,0.35)' }}>{c}</span>
            ))}
          </div>
        )}

        {/* Price + CTAs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(220,198,255,0.18)' }}>
          <div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>{formatPrice(product.price)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span style={{ fontSize: '0.72rem', color: '#B08968', textDecoration: 'line-through', marginLeft: '6px' }}>{formatPrice(product.originalPrice)}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={e => { e.stopPropagation(); addToCart(product); }}
              style={{ width: '32px', height: '32px', borderRadius: '9px', border: '1.5px solid rgba(123,63,160,0.25)', background: 'rgba(255,255,255,0.90)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A1E7E', transition: 'all 0.2s', boxShadow: hov ? '0 2px 10px rgba(123,63,160,0.12)' : 'none' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#7B3FA0'; e.currentTarget.style.transform = 'scale(1.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.90)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.25)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <ShoppingBag size={13} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); buyNow(product); }}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 14px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(90,30,126,0.28)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(90,30,126,0.40)'; e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(90,30,126,0.28)'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <Zap size={11} /> Buy
            </button>
          </div>
        </div>
      </div>

      {/* Glass sheen line at top */}
      <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.80),transparent)', pointerEvents: 'none' }} />
    </motion.div>
  );
}

/* ── List row ─────────────────────────────────────────── */
function ProductListRow({ product }) {
  const { addToCart, buyNow, navigateTo, formatPrice, wishlist, toggleWishlist } = useApp();
  const isWished = wishlist.some(w => w.id === product.id);
  return (
    <div onClick={() => navigateTo('product-detail', product.id)}
      style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px 20px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', border: '1px solid rgba(220,198,255,0.28)', borderRadius: '18px', cursor: 'pointer', transition: 'all 0.22s', boxShadow: '0 2px 12px rgba(123,63,160,0.05)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 32px rgba(123,63,160,0.12)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.28)'; e.currentTarget.style.transform = 'translateX(3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(123,63,160,0.05)'; e.currentTarget.style.borderColor = 'rgba(220,198,255,0.28)'; e.currentTarget.style.transform = 'translateX(0)'; }}>
      <img src={product.preview || product.thumbnail || (Array.isArray(product.image_urls) && product.image_urls[0]) || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=70'} alt=""
        style={{ width: '74px', height: '74px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(220,198,255,0.25)' }} loading="lazy"
        onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=70'; }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#7B3FA0', background: 'rgba(123,63,160,0.08)', padding: '2px 7px', borderRadius: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{product.category}</span>
          {product.badge && <span style={{ fontSize: '0.56rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', padding: '2px 7px', borderRadius: '5px' }}>{product.badge}</span>}
        </div>
        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{product.title}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '1px' }}>{[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < Math.round(product.rating||4.8)?'#C7A55A':'none'} stroke="#C7A55A" />)}</div>
          <span style={{ fontSize: '0.68rem', color: '#8B6B5B', fontWeight: 600 }}>{product.rating||4.8}</span>
          <span style={{ fontSize: '0.68rem', color: '#B08968' }}>· by {product.seller?.name||'Creator'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D004D' }}>{formatPrice(product.price)}</span>
        <button onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
          style={{ width: '34px', height: '34px', borderRadius: '9px', border: '1px solid rgba(220,198,255,0.30)', background: 'rgba(255,255,255,0.90)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isWished?'#E11D48':'#8B6B5B' }}>
          <Heart size={13} fill={isWished?'#E11D48':'none'} />
        </button>
        <button onClick={e => { e.stopPropagation(); addToCart(product); }}
          style={{ padding: '8px 16px', borderRadius: '10px', border: '1.5px solid rgba(123,63,160,0.25)', background: '#fff', color: '#5A1E7E', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>Add</button>
        <button onClick={e => { e.stopPropagation(); buyNow(product); }}
          style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(90,30,126,0.25)' }}>Buy Now</button>
      </div>
    </div>
  );
}

/* ── Extra images per category ────────────────────────── */
const CAT_IMAGES = {
  'UI Kits':             ['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80','https://images.unsplash.com/photo-1587440871875-191322ee64b0?w=600&q=80','https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&q=80'],
  'Mobile App Designs':  ['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80','https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&q=80','https://images.unsplash.com/photo-1551650975-87deedd944c3?w=600&q=80'],
  'React Templates':     ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=80','https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=600&q=80','https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=600&q=80'],
  'Website Templates':   ['https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=600&q=80','https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&q=80','https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=600&q=80'],
  'Design Assets':       ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80','https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=600&q=80','https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80'],
  'E-books':             ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&q=80','https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&q=80','https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=600&q=80'],
  'Notion Templates':    ['https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&q=80','https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80','https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=600&q=80'],
  'Social Media Kits':   ['https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80','https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80','https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=600&q=80'],
  'AI Tools':            ['https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&q=80','https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=600&q=80','https://images.unsplash.com/photo-1676277791608-ac54525aa94d?w=600&q=80'],
  'AI Prompt Packs':     ['https://images.unsplash.com/photo-1676573400816-97b1b00fc75c?w=600&q=80','https://images.unsplash.com/photo-1678995729893-23e6f0cb4a1e?w=600&q=80','https://images.unsplash.com/photo-1680783954745-05cf3dd5ffc9?w=600&q=80'],
  'Icons & Illustrations':['https://images.unsplash.com/photo-1572044162444-ad60f128bdea?w=600&q=80','https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&q=80','https://images.unsplash.com/photo-1614854262318-831574f15f1f?w=600&q=80'],
  'Resume Templates':    ['https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80','https://images.unsplash.com/photo-1555421689-491a97ff2040?w=600&q=80','https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&q=80'],
  'Business Templates':  ['https://images.unsplash.com/photo-1664575602554-2087b04935a5?w=600&q=80','https://images.unsplash.com/photo-1542744094-24638eff58bb?w=600&q=80','https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&q=80'],
  'Productivity Tools':  ['https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600&q=80','https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=600&q=80','https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&q=80'],
};

function getExtraImages(product) {
  const preview = product.preview || product.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80';

  // Prefer explicitly stored pCloud/external image URLs (image_urls column)
  const pcloudImages = Array.isArray(product.image_urls || product.imageUrls)
    ? (product.image_urls || product.imageUrls).filter(Boolean)
    : [];

  if (pcloudImages.length > 0) {
    return [preview, ...pcloudImages.filter(img => img !== preview)];
  }

  // Fallback: category stock images
  const catImgs = CAT_IMAGES[product.category] || CAT_IMAGES['Design Assets'];
  return [preview, ...catImgs.filter(img => img !== preview)];
}
