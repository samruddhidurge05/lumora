import React, { useState } from 'react';
import { Search, Copy, Check, Star, SlidersHorizontal, Link2, Tag, Eye, ShoppingCart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAffiliateCart } from '../../context/AffiliateCartContext';
import AffiliateProductDetail from './ProductDetail';
import { buildAffiliateReferralLink, calculateCommission } from '../../utils/referralUtils';

const COMMISSION_RATES = {
  'Website Templates': 20,
  'Mobile Templates': 18,
  'Mobile App Designs': 18,
  'UI Kits': 22,
  'AI Creator Tools': 25,
  'AI Tools': 25,
  'Branding Assets': 20,
  'Design Assets': 20,
  'Presets': 15,
  'Courses': 30,
  'E-books': 30,
  'Productivity Systems': 18,
  'Productivity Tools': 18,
  'Notion Templates': 18,
  'Social Media Kits': 20,
  'Digital Art': 20,
};

export default function AffiliateProducts({ profile, stats, commissions }) {
  const { products, formatPrice } = useApp();
  const { addToAffCart, isProductInAffCart } = useAffiliateCart();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('commission');
  const [copiedId, setCopiedId] = useState(null);
  const [addedId, setAddedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCount, setShowCount] = useState(24);

  const REFERRAL_CODE = profile?.referral_code || 'AFF0001';

  // If a product is selected, show its detail page
  if (selectedProduct) {
    return (
      <AffiliateProductDetail
        product={selectedProduct}
        onBack={() => setSelectedProduct(null)}
        profile={profile}
        stats={stats}
        commissions={commissions}
      />
    );
  }

  const filtered = products
    .filter(p => (!p.status || p.status === 'published' || p.status === 'active') && p.affiliate_enabled !== false) // Only affiliate-enabled published products
    .filter(p => activeCategory === 'All' || p.category === activeCategory)
    .filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'commission') {
        const ca = calculateCommission(a.price, a.commission_mode || a.commission_type, a.commission_value);
        const cb = calculateCommission(b.price, b.commission_mode || b.commission_type, b.commission_value);
        return cb - ca;
      }
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return b.reviews - a.reviews;
    });

  const buildAffLink = (prod) =>
    buildAffiliateReferralLink(prod, REFERRAL_CODE);

  const handleCopy = (prod) => {
    const link = buildAffLink(prod);
    navigator.clipboard.writeText(link).catch(() => {});
    setCopiedId(prod.id || prod);
    setToast('Referral link copied to clipboard!');
    setTimeout(() => { setCopiedId(null); setToast(null); }, 2400);
  };

  const handleAddToCart = (product) => {
    addToAffCart(product);
    setAddedId(product.id);
    setToast('Added to your affiliate cart!');
    setTimeout(() => { setAddedId(null); setToast(null); }, 2000);
  };

  const formatCommission = (product) => {
    if (product.commission_type === 'fixed') {
      return `₹${Math.round(product.commission_value || 0)}`;
    }
    return `${product.commission_value !== undefined ? product.commission_value : (COMMISSION_RATES[product.category] || 15)}%`;
  };

  const calcEarning = (product) => {
    if (product.commission_type === 'fixed') {
      return Math.round(product.commission_value || 0);
    }
    const priceINR = Math.round(product.price);
    const rateVal = product.commission_value !== undefined ? product.commission_value : (COMMISSION_RATES[product.category] || 15);
    return Math.round((priceINR * rateVal) / 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative' }}>

      {/* ── TOAST ─────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(34,197,94,0.90)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(34,197,94,0.40)',
          color: '#fff', fontFamily: 'var(--font-sans)',
          fontSize: '0.8rem', fontWeight: 600,
          padding: '12px 24px', borderRadius: '30px',
          boxShadow: '0 8px 32px rgba(34,197,94,0.25)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'toastIn 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <Check size={14} /> {toast}
        </div>
      )}

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Affiliate Tools</span>
          <h2 className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '4px' }}>Browse & Promote</h2>
          <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', marginTop: '4px', fontWeight: 500 }}>
            {filtered.length} products available · earn commissions on every sale · showing {Math.min(showCount, filtered.length)} of {filtered.length}
          </p>
        </div>

        {/* Search */}
        <div className="glass-surface" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '30px', width: '280px', border: '1px solid rgba(123,63,160,0.22)' }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: 'var(--text-primary)', width: '100%' }}
          />
        </div>
      </div>

      {/* ── CONTROLS ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Categories */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }} className="aff-cat-scroll">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setShowCount(24); }}
              style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600,
                border: activeCategory === cat ? '1.5px solid rgba(123,63,160,0.45)' : '1px solid rgba(45,0,96,0.10)',
                background: activeCategory === cat ? 'linear-gradient(135deg, #7B3FA0, #5A1E7E)' : 'rgba(255,255,255,0.80)',
                color: activeCategory === cat ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                boxShadow: activeCategory === cat ? '0 3px 12px rgba(123,63,160,0.28)' : 'none',
                transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >{cat}</button>
          ))}
        </div>

        {/* Sort */}
        <div className="glass-surface" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(123,63,160,0.18)' }}>
          <SlidersHorizontal size={13} style={{ color: 'var(--text-muted)' }} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
          >
            <option value="popular">Most Popular</option>
            <option value="commission">Highest Commission</option>
            <option value="rating">Top Rated</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="price-asc">Price: Low → High</option>
          </select>
        </div>
      </div>

      {/* ── PRODUCT GRID ──────────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {filtered.slice(0, showCount).map(product => {
            const rateStr = formatCommission(product);
            const earning = calcEarning(product);
            const isCopied = copiedId === product.id;

            return (
              <div
                key={product.id}
                className="glass-card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(196,181,253,0.22)',
                  boxShadow: 'var(--shadow-premium)',
                }}
              >
                {/* Image */}
                <div style={{ position: 'relative', height: '170px', overflow: 'hidden', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
                  <img src={product.preview} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                  {/* Category badge */}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '0.6rem', background: 'rgba(45,0,77,0.70)', border: '1px solid rgba(216,191,227,0.20)', color: 'var(--color-lavender)', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
                    {product.category}
                  </div>

                  {/* Commission badge */}
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    fontSize: '0.62rem', fontWeight: 800,
                    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                    color: '#fff', padding: '4px 8px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', gap: '3px',
                  }}>
                    <Tag size={9} /> {rateStr} Comm.
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {/* Title + rating */}
                  <div>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-espresso)' }}>
                        <Star size={10} fill="var(--color-latte)" stroke="var(--color-latte)" />
                        {product.rating}
                      </div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {(product.reviews || 0)} reviews
                      </span>
                      {product.badge && (
                        <span style={{ fontSize: '0.6rem', padding: '2px 7px', borderRadius: '20px', background: 'rgba(123,63,160,0.08)', color: 'var(--purple-700)', fontWeight: 700, border: '1px solid rgba(196,181,253,0.25)' }}>
                          {product.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price + commission earning */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.18)' }}>
                    <div>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Price</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-espresso)', marginTop: '1px' }}>{formatPrice(product.price)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>You Earn</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7B3FA0', marginTop: '1px' }}>
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(earning)}
                      </div>
                    </div>
                  </div>

                  {/* Affiliate link preview */}
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Link2 size={10} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{buildAffLink(product.id)}</span>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap' }}>
                    {/* View Details */}
                    <button
                      onClick={() => setSelectedProduct(product)}
                      style={{
                        flex: '1 1 auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        padding: '9px 8px', fontSize: '0.72rem', fontWeight: 700,
                        borderRadius: '10px',
                        border: '1.5px solid rgba(123,63,160,0.22)',
                        background: 'rgba(255,255,255,0.80)',
                        color: '#7B3FA0',
                        cursor: 'pointer', outline: 'none',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.22s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; }}
                    >
                      <Eye size={12} /> Details
                    </button>

                    {/* Add to Affiliate Cart */}
                    <button
                      onClick={() => handleAddToCart(product)}
                      style={{
                        flex: '0 0 auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        padding: '9px 10px', fontSize: '0.72rem', fontWeight: 700,
                        borderRadius: '10px',
                        border: addedId === product.id ? '1.5px solid rgba(34,197,94,0.50)' : '1.5px solid rgba(123,63,160,0.22)',
                        background: addedId === product.id ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.80)',
                        color: addedId === product.id ? '#16a34a' : '#7B3FA0',
                        cursor: 'pointer', outline: 'none',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.22s',
                      }}
                      title="Add to cart"
                    >
                      {addedId === product.id ? <Check size={12} /> : <ShoppingCart size={12} />}
                    </button>

                    {/* Copy Affiliate Link */}
                    <button
                      onClick={() => handleCopy(product.id)}
                      style={{
                        flex: '1 1 auto',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                        padding: '9px 8px', fontSize: '0.72rem', fontWeight: 700,
                        borderRadius: '10px',
                        border: isCopied ? '1.5px solid rgba(34,197,94,0.50)' : '1.5px solid rgba(123,63,160,0.35)',
                        background: isCopied ? 'rgba(34,197,94,0.07)' : 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                        color: isCopied ? '#16a34a' : '#fff',
                        cursor: 'pointer', outline: 'none',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all 0.25s',
                        boxShadow: isCopied ? 'none' : '0 3px 12px rgba(123,63,160,0.28)',
                      }}
                    >
                      {isCopied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length > showCount && (
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button
              onClick={() => setShowCount(c => c + 48)}
              style={{
                padding: '12px 40px', borderRadius: '30px',
                border: '1.5px solid rgba(123,63,160,0.30)',
                background: 'rgba(255,255,255,0.80)',
                color: '#7B3FA0', fontSize: '0.84rem', fontWeight: 700,
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                transition: 'all 0.22s', backdropFilter: 'blur(16px)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.08)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.50)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.30)'; }}
            >
              Load {Math.min(48, filtered.length - showCount)} More · {filtered.length - showCount} remaining
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="glass-card" style={{ padding: '56px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)' }}>
          <div style={{ fontSize: '1.4rem', color: 'var(--color-espresso)', marginBottom: '8px' }}>No Products Found</div>
          <p style={{ color: 'var(--color-mocha)', fontSize: '0.82rem' }}>Try a different category or search term.</p>
        </div>
      )}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .aff-cat-scroll { scrollbar-width: none; }
        .aff-cat-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
