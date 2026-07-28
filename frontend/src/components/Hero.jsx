import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Star, TrendingUp, Shield, Zap, Search, Users, Download,
  Sparkles, Compass, Layers, Cpu, Box, Type, Check, CheckCircle
} from 'lucide-react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function Hero() {
  const { navigateTo, setSearchQuery } = useApp();
  const { user } = useAuth();
  const heroRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.15, ease: 'power3.out' });
      gsap.fromTo('.hero-title', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.25, ease: 'power4.out' });
      gsap.fromTo('.hero-sub', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.40, ease: 'power3.out' });
      gsap.fromTo('.hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.55, ease: 'power3.out' });
      gsap.fromTo('.hero-stats', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.65, ease: 'power3.out' });
      gsap.fromTo('.hero-composite', { opacity: 0, scale: 0.94, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 1.0, delay: 0.3, ease: 'power3.out' });
      gsap.fromTo('.hero-search-bar', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.75, ease: 'power3.out' });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (setSearchQuery) setSearchQuery(localSearch);
    navigateTo('marketplace');
  };

  const handleCategoryClick = (catName) => {
    if (setSearchQuery) setSearchQuery(catName);
    navigateTo('marketplace');
  };

  return (
    <section ref={heroRef} style={styles.section}>

      <div style={{ width: '100%', maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {/* TOP HERO GRID: Left Content + Right 3D Layered Composite */}
        <div className="hero-grid" style={styles.grid}>
          
          {/* ── LEFT COLUMN ── */}
          <div style={styles.leftCol}>
            {/* Pill Badge */}
            <div className="hero-badge" style={styles.badge}>
              <Sparkles size={12} color="#7B3FA0" />
              <span className="text-sans" style={styles.badgeText}>
                PREMIUM DIGITAL MARKETPLACE
              </span>
            </div>

            {/* Editorial Headline with Purple Italic Accent */}
            <h1 className="hero-title" style={styles.title}>
              Discover & Sell<br />
              <span style={styles.titleHighlight}>Premium Digital</span><br />
              Products
            </h1>

            {/* Subtitle */}
            <p className="hero-sub" style={styles.subtext}>
              The curated marketplace for UI kits, templates, AI tools, and digital assets — crafted by world-class creators.
            </p>

            {/* Primary Action Buttons */}
            <div className="hero-ctas" style={styles.ctas}>
              <button 
                onClick={() => navigateTo(user ? 'marketplace' : 'register-selection')} 
                className="btn-premium btn-premium-solid btn-shine-sweep clickable" 
                style={styles.ctaSolid}
              >
                Get Started
                <ArrowRight size={16} />
              </button>

              <button 
                onClick={() => navigateTo('marketplace')} 
                className="btn-premium clickable" 
                style={styles.ctaOutline}
              >
                <Compass size={15} color="#7B3FA0" />
                Explore Products
              </button>
            </div>

            {/* Stats Ledger Bar */}
            <div className="hero-stats glass-card" style={styles.statsContainer}>
              {[
                { icon: <Users size={16} color="#7B3FA0" />, value: '120K+', label: 'Happy Customers', bg: 'rgba(123, 63, 160, 0.10)' },
                { icon: <Download size={16} color="#D97706" />, value: '1.2M+', label: 'Downloads', bg: 'rgba(217, 119, 6, 0.10)' },
                { icon: <Shield size={16} color="#16A34A" />, value: '500+', label: 'Top Creators', bg: 'rgba(22, 163, 74, 0.10)' },
                { icon: <CheckCircle size={16} color="#E11D48" />, value: '97%', label: 'Satisfaction Rate', bg: 'rgba(225, 29, 72, 0.10)' },
              ].map((s, i) => (
                <div key={i} style={styles.statItem}>
                  <div style={{ ...styles.statIconBox, background: s.bg }}>
                    {s.icon}
                  </div>
                  <div>
                    <div style={styles.statValue}>{s.value}</div>
                    <div style={styles.statLabel}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: LAYERED 3D COMPOSITE SHOWCASE ── */}
          <div className="hero-composite" style={styles.rightCol}>
            
            {/* 1. TOP-LEFT: Sales Overview Glass Card */}
            <div className="glass-card animate-float" style={styles.salesOverviewCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: '#6B4F7A', fontWeight: 700, textTransform: 'uppercase' }}>Sales Overview</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#2D004D' }}>$24,590</div>
                  <span style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <TrendingUp size={11} /> +12.9% this month
                  </span>
                </div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7B3FA0', background: 'rgba(123, 63, 160, 0.10)', padding: '3px 8px', borderRadius: '6px' }}>
                  2026
                </div>
              </div>

              {/* Sparkline Curve */}
              <svg width="100%" height="45" viewBox="0 0 200 45" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7B3FA0" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#7B3FA0" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d="M0,35 Q30,10 60,25 T120,15 T180,8 L200,5" fill="none" stroke="#7B3FA0" strokeWidth="2.5" />
                <path d="M0,35 Q30,10 60,25 T120,15 T180,8 L200,5 L200,45 L0,45 Z" fill="url(#purpleGrad)" />
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(123, 63, 160, 0.12)' }}>
                <div>
                  <span style={{ fontSize: '0.6rem', color: '#6B4F7A', fontWeight: 600 }}>Total Sales</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D004D' }}>1.2M</div>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#16A34A', fontWeight: 700 }}>▲ 18.2%</div>
              </div>
            </div>

            {/* 2. TOP-RIGHT: Rating Pill Badge Card */}
            <div className="glass-card" style={styles.ratingBadgeCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={18} fill="#F59E0B" color="#F59E0B" />
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2D004D', lineHeight: 1.1 }}>4.9/5</div>
                  <div style={{ fontSize: '0.65rem', color: '#6B4F7A', fontWeight: 600 }}>From 15K+ Reviews</div>
                </div>
              </div>
              {/* Stacked Avatar Circles */}
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
                {['https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
                  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
                  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80',
                ].map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt="Reviewer Avatar"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      border: '2px solid #ffffff',
                      marginLeft: idx > 0 ? '-8px' : 0,
                      objectFit: 'cover',
                    }}
                  />
                ))}
                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#7B3FA0', marginLeft: '6px' }}>+12k</span>
              </div>
            </div>

            {/* 3. CENTER MOBILE MOCKUP FRAME */}
            <div className="glass-card" style={styles.phoneMockupFrame}>
              {/* Phone Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(123, 63, 160, 0.12)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2D004D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7B3FA0' }} /> Lumora
                </span>
                <span style={{ fontSize: '0.65rem', color: '#6B4F7A' }}>9:41</span>
              </div>

              {/* Product Preview in Mobile */}
              <div style={{ background: 'rgba(255, 255, 255, 0.85)', borderRadius: '14px', padding: '12px', border: '1px solid rgba(192, 132, 252, 0.35)' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2D004D', margin: '0 0 4px 0' }}>
                  Ultimate UI Kit
                </h4>
                <p style={{ fontSize: '0.68rem', color: '#6B4F7A', margin: 0 }}>Beautifully crafted UI components</p>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '8px 0' }}>
                  <Star size={11} fill="#F59E0B" color="#F59E0B" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2D004D' }}>4.9</span>
                  <span style={{ fontSize: '0.62rem', color: '#6B4F7A' }}>(2.8k)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <div>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2D004D' }}>$49</span>
                    <span style={{ fontSize: '0.65rem', color: '#9CA3AF', textDecoration: 'line-through', marginLeft: '4px' }}>$89</span>
                  </div>
                  <button 
                    onClick={() => navigateTo('marketplace')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(90, 30, 126, 0.30)',
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>

            {/* 4. BOTTOM-LEFT DARK AI GENERATOR CARD */}
            <div className="glass-card" style={styles.darkAiCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: 800, background: '#9333EA', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>AI</span>
                <span style={{ fontSize: '0.62rem', color: '#C084FC', fontWeight: 600 }}>Generator</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>AI Image Generator</div>
              <img
                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=300&q=80"
                alt="AI Preview"
                style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '10px', marginBottom: '8px' }}
              />
            </div>

            {/* 5. BOTTOM-RIGHT DARK DESIGN SYSTEM CARD */}
            <div className="glass-card" style={styles.darkDesignCard}>
              <span style={{ fontSize: '0.6rem', color: '#C084FC', fontWeight: 700, textTransform: 'uppercase' }}>Design System</span>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff', marginTop: '2px' }}>Violet v2.0</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                {['Figma', 'Sketch', 'XD', 'PS'].map((tool, idx) => (
                  <span key={idx} style={{ fontSize: '0.58rem', fontWeight: 800, background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '3px 6px', borderRadius: '5px' }}>
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Floating Top Marketplace Badge */}
            <div style={styles.topMarketplaceBadge}>
              🏆 Top Marketplace
            </div>

            {/* Floating Instant Access Badge */}
            <div style={styles.instantAccessBadge}>
              ⚡ Instant Access
            </div>

            {/* Floating Sales Growth Widget */}
            <div className="glass-card" style={styles.salesGrowthWidget}>
              <span style={{ fontSize: '0.6rem', color: '#6B4F7A', fontWeight: 700 }}>This Week</span>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#2D004D' }}>+2,400 Sales</div>
              <span style={{ fontSize: '0.6rem', color: '#16A34A', fontWeight: 700 }}>+18.2% vs last week</span>
            </div>

          </div>
        </div>

        {/* ── BOTTOM INTEGRATED SEARCH & QUICK CATEGORY FILTER BAR ── */}
        <div className="hero-search-bar glass-card" style={styles.bottomSearchBar}>
          <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
            <Search size={18} color="#7B3FA0" />
            <input
              type="text"
              placeholder="Search 10,000+ premium digital products..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              style={styles.searchInput}
            />
            <button type="submit" style={styles.aiSearchBtn}>
              <Sparkles size={14} /> AI Search
            </button>
          </form>

          <div style={styles.categoriesRow}>
            {[
              { label: 'UI Kits', icon: <Layers size={13} /> },
              { label: 'Templates', icon: <CheckCircle size={13} /> },
              { label: 'AI Tools', icon: <Cpu size={13} /> },
              { label: 'Icons', icon: <Sparkles size={13} /> },
              { label: '3D Assets', icon: <Box size={13} /> },
              { label: 'Fonts', icon: <Type size={13} /> },
            ].map((cat, idx) => (
              <button
                key={idx}
                onClick={() => handleCategoryClick(cat.label)}
                style={styles.categoryPill}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(123, 63, 160, 0.15)';
                  e.currentTarget.style.color = '#7B3FA0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.60)';
                  e.currentTarget.style.color = '#2D004D';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
            <button
              onClick={() => navigateTo('marketplace')}
              style={{ ...styles.categoryPill, background: 'rgba(123, 63, 160, 0.08)', color: '#7B3FA0', fontWeight: 800 }}
            >
              All →
            </button>
          </div>
        </div>

      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 1024px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hero-composite { min-height: 480px !important; }
        }
        @media (max-width: 640px) {
          .hero-search-bar { flex-direction: column !important; gap: 16px !important; }
          .hero-composite { display: none !important; }
        }
      `}</style>
    </section>
  );
}

// Consolidated Stylesheet matching screenshot exact positioning & Lumora brand colors
const styles = {
  section: {
    minHeight: '100vh',
    padding: '130px clamp(1.5rem, 4vw, 5rem) 60px',
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#FAF6F0',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: '40px',
    alignItems: 'center',
    width: '100%',
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    zIndex: 2,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '999px',
    background: 'rgba(216, 191, 227, 0.35)',
    border: '1px solid rgba(192, 132, 252, 0.50)',
    backdropFilter: 'blur(10px)',
    width: 'fit-content',
  },
  badgeText: {
    fontSize: '0.70rem',
    fontWeight: 800,
    color: '#7B3FA0',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'var(--font-editorial)',
    fontSize: 'clamp(2.6rem, 5.2vw, 4.2rem)',
    fontWeight: 400,
    color: '#2D004D',
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
    margin: 0,
  },
  titleHighlight: {
    fontFamily: 'var(--font-editorial)',
    fontStyle: 'italic',
    fontWeight: 500,
    background: 'linear-gradient(135deg, #7B3FA0 0%, #C084FC 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
  },
  subtext: {
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#6B4F7A',
    maxWidth: '520px',
    margin: 0,
  },
  ctas: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  ctaSolid: {
    padding: '14px 32px',
    borderRadius: '16px',
    fontSize: '0.92rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
    color: '#ffffff',
    boxShadow: '0 10px 28px rgba(90, 30, 126, 0.35)',
  },
  ctaOutline: {
    padding: '14px 28px',
    borderRadius: '16px',
    fontSize: '0.90rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.70)',
    border: '1px solid rgba(192, 132, 252, 0.45)',
    color: '#2D004D',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '16px',
    padding: '20px 24px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(28px)',
    border: '1px solid rgba(255, 255, 255, 0.80)',
    boxShadow: '0 10px 32px rgba(90, 30, 126, 0.08)',
    marginTop: '12px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statIconBox: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '1.05rem',
    fontWeight: 800,
    color: '#2D004D',
    lineHeight: 1.1,
  },
  statLabel: {
    fontSize: '0.66rem',
    color: '#6B4F7A',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  rightCol: {
    position: 'relative',
    width: '100%',
    height: '540px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── IMPROVED 3D Composite Layer Cards ── */

  /* Sales Overview: top-left, slight counter-clockwise tilt */
  salesOverviewCard: {
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '230px',
    padding: '16px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(32px)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 8px 32px rgba(90, 30, 126, 0.10), 0 1px 0 rgba(255,255,255,0.8) inset',
    zIndex: 3,
    transform: 'rotate(-3deg) translateY(0px)',
  },

  /* Rating card: top-right, slight clockwise tilt */
  ratingBadgeCard: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    padding: '14px 18px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(32px)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 8px 32px rgba(90, 30, 126, 0.10)',
    zIndex: 4,
    transform: 'rotate(2.5deg)',
  },

  /* Center: product card (was phoneMockupFrame) — the hero card, straight, elevated */
  phoneMockupFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -46%) rotate(-1deg)',
    width: '240px',
    padding: '16px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.97)',
    backdropFilter: 'blur(40px)',
    border: '1.5px solid rgba(192, 132, 252, 0.45)',
    boxShadow: '0 24px 64px rgba(90, 30, 126, 0.18), 0 1px 0 rgba(255,255,255,1) inset',
    zIndex: 5,
  },

  /* Bottom-left dark AI card */
  darkAiCard: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    width: '175px',
    padding: '14px',
    borderRadius: '20px',
    background: 'linear-gradient(145deg, #2D004D 0%, #1a0030 100%)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(147, 51, 234, 0.30)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.22)',
    zIndex: 4,
    transform: 'rotate(-2.5deg)',
  },

  /* Bottom-right dark design card */
  darkDesignCard: {
    position: 'absolute',
    bottom: '10px',
    right: '0px',
    width: '178px',
    padding: '14px',
    borderRadius: '20px',
    background: 'linear-gradient(145deg, #190030 0%, #0f0020 100%)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(192, 132, 252, 0.28)',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.20)',
    zIndex: 4,
    transform: 'rotate(2deg)',
  },

  /* Pill badges */
  topMarketplaceBadge: {
    position: 'absolute',
    top: '100px',
    right: '-8px',
    padding: '6px 13px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(192, 132, 252, 0.35)',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#7B3FA0',
    boxShadow: '0 6px 20px rgba(90, 30, 126, 0.10)',
    zIndex: 6,
  },
  instantAccessBadge: {
    position: 'absolute',
    bottom: '155px',
    right: '-8px',
    padding: '6px 13px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(192, 132, 252, 0.35)',
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#7B3FA0',
    boxShadow: '0 6px 20px rgba(90, 30, 126, 0.10)',
    zIndex: 6,
  },
  salesGrowthWidget: {
    position: 'absolute',
    bottom: '-8px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 18px',
    borderRadius: '16px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 8px 28px rgba(90, 30, 126, 0.12)',
    zIndex: 6,
    whiteSpace: 'nowrap',
  },

  /* Bottom Integrated Search Bar */
  bottomSearchBar: {
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    padding: '12px 20px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 12px 40px rgba(90, 30, 126, 0.10)',
    width: '100%',
    zIndex: 5,
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    maxWidth: '460px',
    background: 'rgba(255, 255, 255, 0.70)',
    padding: '6px 14px',
    borderRadius: '16px',
    border: '1px solid rgba(192, 132, 252, 0.35)',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    color: '#2D004D',
    width: '100%',
    fontFamily: 'var(--font-sans)',
  },
  aiSearchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '10px',
    background: 'rgba(123, 63, 160, 0.10)',
    color: '#7B3FA0',
    fontSize: '0.72rem',
    fontWeight: 800,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
  },
  categoriesRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  categoryPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '8px 14px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.60)',
    border: '1px solid rgba(192, 132, 252, 0.30)',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#2D004D',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: 'var(--font-sans)',
  },
};
