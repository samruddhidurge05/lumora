import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Copy, Check, Star, Tag, Link2,
  Download, Users, TrendingUp, ShoppingBag,
  ExternalLink, Share2, BarChart2, Clock,
  FileText, Package, Shield, Zap, DollarSign, Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { buildAffiliateReferralLink } from '../../utils/referralUtils';

const COMMISSION_RATES = {
  'Website Templates': 20,
  'Mobile Templates': 18,
  'UI Kits': 22,
  'AI Creator Tools': 25,
  'Branding Assets': 20,
  'Presets': 15,
  'Courses': 30,
  'Productivity Systems': 18,
  'Design Assets': 20,
  'AI Tools': 25,
  'E-books': 30,
  'Notion Templates': 18,
  'Productivity Tools': 18,
  'Social Media Kits': 20,
  'Mobile App Designs': 20,
  'Digital Art': 20,
};

const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

export default function AffiliateProductDetail({ product, onBack, profile, stats, commissions }) {
  const { formatPrice } = useApp();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [customLinks, setCustomLinks] = useState([]);
  const [customName, setCustomName] = useState('');
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [copiedCustomId, setCopiedCustomId] = useState(null);

  const fetchCustomLinks = async () => {
    // product_id must be a valid integer for the backend
    const productIdNum = parseInt(product?.id, 10);
    if (isNaN(productIdNum)) {
      setCustomLinks([]);
      return;
    }
    try {
      setLoadingLinks(true);
      setLinkError(null);
      const res = await backendFetch(`/affiliate/referral-links?product_id=${productIdNum}`);
      setCustomLinks(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error fetching custom links:", err);
      setLinkError(err.message || "Failed to load custom links.");
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleGenerateCustomLink = async (e) => {
    e.preventDefault();
    if (!customName.trim()) return;
    // product_id must be a valid integer for the backend
    const productIdNum = parseInt(product?.id, 10);
    if (isNaN(productIdNum)) {
      setLinkError("Custom referral links are only available for products listed in the Lumora store.");
      return;
    }
    try {
      setLoadingLinks(true);
      setLinkError(null);
      await backendFetch('/affiliate/referral-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productIdNum,
          name: customName.trim(),
        }),
      });
      setCustomName("");
      await fetchCustomLinks();
    } catch (err) {
      console.error("Error creating custom link:", err);
      setLinkError(err.message || "Failed to create custom link.");
      setLoadingLinks(false);
    }
  };

  const handleDeleteCustomLink = async (linkId) => {
    if (!window.confirm("Are you sure you want to delete this custom referral link?")) return;
    try {
      setLoadingLinks(true);
      setLinkError(null);
      await backendFetch(`/affiliate/referral-links/${linkId}`, {
        method: 'DELETE',
      });
      await fetchCustomLinks();
    } catch (err) {
      console.error("Error deleting custom link:", err);
      setLinkError(err.message || "Failed to delete custom link.");
      setLoadingLinks(false);
    }
  };

  const handleCopyCustom = (linkId, url) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopiedCustomId(linkId);
    setTimeout(() => setCopiedCustomId(null), 2200);
  };

  useEffect(() => {
    if (activeTab === 'affiliate tools' && product?.id) {
      fetchCustomLinks();
    }
  }, [activeTab, product?.id]);

  /* ── Referral code: prefer live stats → profile → fallback ─────────── */
  const REFERRAL_CODE = stats?.referral_code || profile?.referral_code || 'AFF001';

  /* ── Commission rate: prefer product-specific → profile rate → category default ── */
  const isFixed = product?.commission_type === 'fixed';
  const customCommVal = product?.commission_value;
  const rate = isFixed
    ? `₹${Math.round(customCommVal || 0)}`
    : `${customCommVal !== undefined ? customCommVal : (profile?.commission_rate ?? COMMISSION_RATES[product?.category] ?? 15)}%`;

  /* ── Price + earning per sale ─────────────────────────────────────── */
  const priceINR  = Math.round(product?.price || 0);
  const earnPerSale = isFixed
    ? Math.round(customCommVal || 0)
    : Math.round((priceINR * parseFloat(rate)) / 100);

  /* ── Affiliate links built with live referral code ────────────────── */
  const affLink   = buildAffiliateReferralLink(product, REFERRAL_CODE);
  const shortLink = `lumora.in/p/${product?.id}?r=${REFERRAL_CODE}`;

  /* ── Product-specific analytics from live commissions ─────────────── */
  const productStats = useMemo(() => {
    const productName = product?.title || '';
    const productId   = String(product?.id || '');

    // Filter commissions that match this product (by name or product_id)
    const matched = (commissions || []).filter(c => {
      const nameMatch = c.product_name && (
        c.product_name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(c.product_name.toLowerCase())
      );
      const idMatch = c.product_id && String(c.product_id) === productId;
      return nameMatch || idMatch;
    });

    const earned       = matched.reduce((s, c) => s + (c.commission_amt || 0), 0);
    const conversions  = matched.length;
    const paidCount    = matched.filter(c => c.status === 'paid').length;
    const pendingCount = matched.filter(c => c.status === 'pending').length;

    // Total clicks and conversion rate from global stats if product-level is unavailable
    const totalClicks = stats?.total_clicks || 0;
    const globalConvRate = stats?.conversion_rate || 0;

    return {
      clicks:       totalClicks,             // product-level click tracking not in backend yet
      conversions,
      earned,
      convRate:     conversions > 0 && totalClicks > 0
                      ? ((conversions / totalClicks) * 100).toFixed(1)
                      : globalConvRate.toFixed(1),
      paidCount,
      pendingCount,
      hasRealData:  conversions > 0,
    };
  }, [commissions, product, stats]);

  const handleCopy = (type) => {
    if (type === 'full') {
      navigator.clipboard.writeText(affLink).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } else {
      navigator.clipboard.writeText(shortLink).catch(() => {});
      setCopiedShort(true);
      setTimeout(() => setCopiedShort(false), 2400);
    }
  };

  if (!product) return null;

  const TABS = ['overview', 'affiliate tools', 'analytics'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative' }}>

      {/* ── Back button ── */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(196,181,253,0.30)',
          borderRadius: '20px',
          padding: '9px 20px',
          fontSize: '0.78rem', fontWeight: 700,
          color: '#7B3FA0',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'all 0.22s',
          width: 'fit-content',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.08)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.30)'; }}
      >
        <ArrowLeft size={14} /> Back to Products
      </button>

      {/* ── Hero section ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '28px',
        alignItems: 'start',
      }} className="aff-detail-grid">

        {/* Left: Image + Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Cover image */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '20px', position: 'relative' }}>
            <img
              src={product.preview}
              alt={product.title}
              style={{ width: '100%', height: '300px', objectFit: 'cover', display: 'block' }}
            />
            {/* Overlay badges */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {product.badge && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 800,
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  color: '#fff', padding: '5px 10px', borderRadius: '8px',
                  boxShadow: '0 2px 12px rgba(123,63,160,0.40)',
                }}>{product.badge}</span>
              )}
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                background: 'rgba(45,0,77,0.75)',
                backdropFilter: 'blur(8px)',
                color: 'rgba(216,191,227,0.95)',
                border: '1px solid rgba(216,191,227,0.20)',
                padding: '5px 10px', borderRadius: '8px',
              }}>{product.category}</span>
            </div>

            {/* Commission badge */}
            <div style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'rgba(34,197,94,0.90)',
              backdropFilter: 'blur(10px)',
              color: '#fff', fontSize: '0.75rem', fontWeight: 800,
              padding: '6px 12px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '4px',
              boxShadow: '0 4px 16px rgba(34,197,94,0.30)',
            }}>
              <Tag size={11} /> {rate} Commission
            </div>

            {/* Earned overlay — shown if user has real earnings for this product */}
            {productStats.hasRealData && (
              <div style={{
                position: 'absolute', bottom: '16px', right: '16px',
                background: 'rgba(123,63,160,0.85)',
                backdropFilter: 'blur(10px)',
                color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                padding: '5px 12px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <DollarSign size={11} /> Earned: {formatINR(productStats.earned)}
              </div>
            )}
          </div>

          {/* Product title + meta */}
          <div className="glass-card" style={{ padding: '28px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B3FA0' }}>
              {product.category}
            </span>
            <h2 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.1 }}>
              {product.title}
            </h2>

            {/* Rating + meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {[1,2,3,4,5].map(i => (
                  <Star key={i} size={13}
                    fill={i <= Math.round(product.rating) ? 'var(--color-latte, #C9A96E)' : 'transparent'}
                    stroke="var(--color-latte, #C9A96E)"
                  />
                ))}
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginLeft: '4px' }}>{product.rating}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>({product.reviews || 0} reviews)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500 }}>
                <Download size={12} /> {(product.downloads || 0).toLocaleString()} downloads
              </div>
              {product.version && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>v{product.version}</span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '16px', fontWeight: 500 }}>
                {product.description}
              </p>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginTop: '24px', padding: '4px', background: 'rgba(123,63,160,0.05)', borderRadius: '12px', border: '1px solid rgba(196,181,253,0.18)' }}>
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '9px',
                    border: 'none', outline: 'none', cursor: 'pointer',
                    fontSize: '0.72rem', fontWeight: 700,
                    textTransform: 'capitalize',
                    fontFamily: 'var(--font-sans)',
                    background: activeTab === tab ? '#fff' : 'transparent',
                    color: activeTab === tab ? '#7B3FA0' : 'var(--text-muted)',
                    boxShadow: activeTab === tab ? '0 2px 8px rgba(123,63,160,0.10)' : 'none',
                    transition: 'all 0.22s',
                  }}
                >{tab}</button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ marginTop: '20px' }}>

              {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Features */}
                  {product.features && product.features.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Highlights</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {product.features.map((f, i) => (
                          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: 'rgba(123,63,160,0.08)', border: '1px solid rgba(196,181,253,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                              <Zap size={9} style={{ color: '#7B3FA0' }} />
                            </div>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.5 }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Compatibility */}
                  {product.compatibility && product.compatibility.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>Compatible With</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {product.compatibility.map((c, i) => (
                          <span key={i} style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(196,181,253,0.22)', color: '#7B3FA0', fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { label: 'File Size',    value: product.fileSize    || 'N/A',      icon: <FileText size={13} /> },
                      { label: 'Last Updated', value: product.lastUpdated || 'Recently', icon: <Clock size={13} /> },
                      { label: 'Version',      value: product.version     || 'v1.0.0',   icon: <Package size={13} /> },
                      { label: 'License',      value: 'Commercial',                      icon: <Shield size={13} /> },
                    ].map(m => (
                      <div key={m.label} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.15)' }}>
                        <span style={{ color: '#7B3FA0', flexShrink: 0 }}>{m.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{m.label}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '1px' }}>{m.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── AFFILIATE TOOLS TAB ──────────────────────────────────── */}
              {activeTab === 'affiliate tools' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Referral URLs */}
                  {[
                    { label: 'Full Affiliate Link', value: affLink,   copied: copiedLink,  type: 'full'  },
                    { label: 'Short Link',           value: shortLink, copied: copiedShort, type: 'short' },
                  ].map(link => (
                    <div key={link.type} style={{ padding: '16px', borderRadius: '14px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.20)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '8px' }}>{link.label}</div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <a
                          href={link.type === 'short' ? affLink : link.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: '0.75rem', color: '#7B3FA0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          <Link2 size={11} style={{ flexShrink: 0, color: '#7B3FA0' }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{link.value}</span>
                        </a>
                        <button
                          onClick={() => handleCopy(link.type)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '7px 14px', borderRadius: '8px',
                            border: link.copied ? '1.5px solid rgba(34,197,94,0.50)' : '1.5px solid rgba(123,63,160,0.30)',
                            background: link.copied ? 'rgba(34,197,94,0.07)' : 'rgba(123,63,160,0.06)',
                            color: link.copied ? '#16a34a' : '#7B3FA0',
                            cursor: 'pointer', outline: 'none',
                            fontFamily: 'var(--font-sans)', fontSize: '0.72rem', fontWeight: 700,
                            transition: 'all 0.25s', whiteSpace: 'nowrap',
                          }}
                        >
                          {link.copied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Referral code chip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.22)' }}>
                    <Tag size={13} style={{ color: '#7B3FA0', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Your referral code:</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.06em' }}>{REFERRAL_CODE}</span>
                  </div>

                  {/* Custom Referral Links Manager */}
                  <div style={{ padding: '20px', borderRadius: '14px', background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(196,181,253,0.30)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Custom Referral Links</div>
                    
                    {linkError && (
                      <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#DC2626', fontSize: '0.72rem', fontWeight: 600 }}>
                        {linkError}
                      </div>
                    )}

                    <form onSubmit={handleGenerateCustomLink} style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        placeholder="Campaign or channel name (e.g. YouTube Ad)..."
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        disabled={loadingLinks}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: '10px',
                          border: '1.5px solid rgba(196,181,253,0.35)',
                          background: 'rgba(255,255,255,0.80)',
                          fontSize: '0.78rem', outline: 'none', color: 'var(--text-primary)',
                          fontFamily: 'var(--font-sans)',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={loadingLinks || !customName.trim()}
                        style={{
                          padding: '10px 20px', borderRadius: '10px', border: 'none',
                          background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                          color: '#fff', fontSize: '0.76rem', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          boxShadow: '0 3px 10px rgba(123,63,160,0.25)',
                          opacity: (loadingLinks || !customName.trim()) ? 0.6 : 1,
                        }}
                      >
                        Generate Link
                      </button>
                    </form>

                    {loadingLinks && customLinks.length === 0 ? (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>Loading custom links...</div>
                    ) : customLinks.length === 0 ? (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', textAlign: 'center', padding: '12px', border: '1px dashed rgba(196,181,253,0.20)', borderRadius: '8px' }}>
                        No custom links generated for this product.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {customLinks.map(link => {
                          const isCopied = copiedCustomId === link.id;
                          return (
                            <div key={link.id} style={{ display: 'flex', alignItems: 'center', justifyItems: 'space-between', padding: '10px 12px', borderRadius: '10px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.18)', gap: '10px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)' }}>{link.name}</span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7B3FA0', background: 'rgba(123,63,160,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{link.referral_code}</span>
                                </div>
                                <a
                                  href={link.referral_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.68rem', color: '#7B3FA0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px', display: 'block', textDecoration: 'none' }}
                                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {link.referral_url}
                                </a>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-light)', marginTop: '2px', fontWeight: 500 }}>
                                  Clicks: <strong style={{ color: 'var(--text-primary)' }}>{link.clicks_count}</strong> · Created {new Date(link.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button
                                  onClick={() => handleCopyCustom(link.id, link.referral_url)}
                                  style={{
                                    padding: '6px 12px', borderRadius: '6px',
                                    border: isCopied ? '1.5px solid rgba(34,197,94,0.50)' : '1.5px solid rgba(123,63,160,0.30)',
                                    background: isCopied ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.80)',
                                    color: isCopied ? '#16a34a' : '#7B3FA0',
                                    cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.68rem', fontWeight: 700,
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomLink(link.id)}
                                  style={{
                                    padding: '6px', borderRadius: '6px',
                                    border: '1.5px solid rgba(239,68,68,0.25)',
                                    background: 'rgba(255,255,255,0.80)',
                                    color: '#DC2626',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Social share ideas */}
                  <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.20)' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
                      <Share2 size={11} style={{ display: 'inline', marginRight: '4px' }} />
                      Promotional Copy
                    </div>
                    {[
                      {
                        platform: 'Twitter/X',
                        text: `🔥 Just found this amazing ${product.category}: "${product.title}" — rated ${product.rating}★. Grab it here! ${shortLink}`,
                      },
                      {
                        platform: 'Instagram Bio',
                        text: `✨ Check out "${product.title}" — ${product.description?.slice(0, 80)}... Link: ${shortLink}`,
                      },
                    ].map(s => (
                      <div key={s.platform} style={{ marginBottom: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(196,181,253,0.18)' }}>
                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7B3FA0', marginBottom: '4px' }}>{s.platform}</div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500, margin: 0 }}>{s.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ANALYTICS TAB ───────────────────────────────────────── */}
              {activeTab === 'analytics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Source badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', background: productStats.hasRealData ? 'rgba(34,197,94,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${productStats.hasRealData ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'}`, width: 'fit-content' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: productStats.hasRealData ? '#22c55e' : '#F59E0B' }} />
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: productStats.hasRealData ? '#15803D' : '#B45309' }}>
                      {productStats.hasRealData ? 'Live data from your commission history' : 'No commissions for this product yet'}
                    </span>
                  </div>

                  {/* Stats rows */}
                  {[
                    {
                      label: 'Your Clicks',
                      value: (productStats.clicks || 0).toLocaleString(),
                      icon: <TrendingUp size={14} />,
                      color: '#7B3FA0',
                      note: 'Tracked via referral link',
                    },
                    {
                      label: 'Conversions',
                      value: productStats.conversions,
                      icon: <ShoppingBag size={14} />,
                      color: '#7B3FA0',
                      note: 'Sales attributed to your code',
                    },
                    {
                      label: 'Conversion Rate',
                      value: `${productStats.convRate}%`,
                      icon: <BarChart2 size={14} />,
                      color: '#7B3FA0',
                      note: 'Clicks → purchases',
                    },
                    {
                      label: 'Commission Earned',
                      value: formatINR(productStats.earned),
                      icon: <DollarSign size={14} />,
                      color: '#22c55e',
                      note: `${productStats.paidCount} paid · ${productStats.pendingCount} pending`,
                    },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: '12px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.18)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: s.color === '#22c55e' ? 'rgba(34,197,94,0.08)' : 'rgba(123,63,160,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                          {s.icon}
                        </div>
                        <div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{s.label}</span>
                          {s.note && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '1px', fontWeight: 500 }}>{s.note}</div>}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: s.color }}>{s.value}</span>
                    </div>
                  ))}

                  {/* Earn per sale reminder */}
                  <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'linear-gradient(135deg,rgba(123,63,160,0.06),rgba(90,30,126,0.03))', border: '1px solid rgba(196,181,253,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Earn per new sale</span>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7B3FA0' }}>{formatINR(earnPerSale)}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right: Commission + CTA panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '80px' }}>

          {/* Earnings card */}
          <div className="glass-card" style={{
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(246,244,255,0.92) 0%, rgba(237,233,254,0.70) 100%)',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Your Commission</span>
            <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#7B3FA0', marginTop: '8px', lineHeight: 1 }}>
              {formatINR(earnPerSale)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px', fontWeight: 500 }}>
              {isFixed ? `${rate} per sale` : `${rate} of ${formatINR(priceINR)} per sale`}
            </div>

            {/* Total earned for this product (live) */}
            {productStats.hasRealData && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#15803D' }}>Total earned from this product</span>
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#15803D' }}>{formatINR(productStats.earned)}</span>
              </div>
            )}

            <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.80)', border: '1px solid rgba(196,181,253,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Product Price</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(product.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>Commission Rate</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7B3FA0' }}>{rate}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(196,181,253,0.20)', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>You Earn (INR)</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#7B3FA0' }}>{formatINR(earnPerSale)}</span>
              </div>
            </div>

            {/* Referral stats mini-strip */}
            <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Conversions',      value: productStats.conversions },
                { label: 'Total Earned',     value: formatINR(productStats.earned) },
              ].map((item, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(196,181,253,0.22)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#7B3FA0', marginTop: '3px' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Copy affiliate link CTA */}
            <button
              onClick={() => handleCopy('full')}
              style={{
                width: '100%', marginTop: '16px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px', fontSize: '0.85rem', fontWeight: 700,
                borderRadius: '12px',
                border: copiedLink ? '1.5px solid rgba(34,197,94,0.50)' : 'none',
                background: copiedLink ? 'rgba(34,197,94,0.08)' : 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                color: copiedLink ? '#16a34a' : '#fff',
                cursor: 'pointer', outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxShadow: copiedLink ? 'none' : '0 4px 20px rgba(123,63,160,0.38)',
                transition: 'all 0.25s',
              }}
            >
              {copiedLink ? <><Check size={15} /> Link Copied!</> : <><Copy size={15} /> Copy Affiliate Link</>}
            </button>

            {/* View on marketplace */}
            <a
              href={`/#product/${product.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                width: '100%', marginTop: '10px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', fontSize: '0.82rem', fontWeight: 700,
                borderRadius: '12px',
                border: '1.5px solid rgba(123,63,160,0.25)',
                background: 'rgba(255,255,255,0.80)',
                color: '#7B3FA0',
                textDecoration: 'none',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.22s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; }}
            >
              <ExternalLink size={13} /> View on Marketplace
            </a>
          </div>

          {/* Creator info */}
          {product.creator && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>Creator</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {product.creator.avatar ? (
                  <img src={product.creator.avatar} alt={product.creator.name}
                    style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover', border: '2px solid rgba(196,181,253,0.30)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '1.1rem', flexShrink: 0 }}>
                    {(product.creator.name || 'C')[0]}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{product.creator.name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
                    {product.creator.sales} sales · {product.creator.rating}★
                  </div>
                </div>
              </div>
              {product.creator.bio && (
                <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '12px', fontWeight: 500 }}>
                  {product.creator.bio}
                </p>
              )}
            </div>
          )}

          {/* Reviews preview */}
          {product.reviewsList && product.reviewsList.length > 0 && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Reviews</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={12} fill="var(--color-latte, #C9A96E)" stroke="var(--color-latte, #C9A96E)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{product.rating}</span>
                </div>
              </div>
              {product.reviewsList.slice(0, 2).map((r, i) => (
                <div key={i} style={{ marginBottom: '12px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(123,63,160,0.03)', border: '1px solid rgba(196,181,253,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.user}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>{r.date}</span>
                  </div>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
