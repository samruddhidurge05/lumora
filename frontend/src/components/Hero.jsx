import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Star, TrendingUp, Shield, Zap, Search, Users, Download,
  Sparkles, Compass, Layers, Cpu, Box, Type, CheckCircle, ExternalLink, RefreshCw
} from 'lucide-react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

// High-quality showcase product images that rapidly change in the background
const BACKGROUND_PRODUCTS = [
  {
    title: 'Ultimate 3D Glass UI Kit',
    category: 'UI Kits',
    price: '$49',
    rating: '4.9',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    tag: 'Figma & Blender'
  },
  {
    title: 'SaaS Admin Dashboard Pro',
    category: 'Templates',
    price: '$59',
    rating: '5.0',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    tag: 'React & Tailwind'
  },
  {
    title: 'AI Neural Image Generator Pack',
    category: 'AI Tools',
    price: '$39',
    rating: '4.8',
    image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
    tag: 'Prompt Matrix'
  },
  {
    title: 'Minimalist E-Commerce Design System',
    category: 'Design Systems',
    price: '$79',
    rating: '4.9',
    image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80',
    tag: 'Figma UI'
  },
  {
    title: 'Cyberpunk 3D Icon & Asset Bundle',
    category: '3D Assets',
    price: '$29',
    rating: '4.9',
    image: 'https://images.unsplash.com/photo-1614680376593-902f749f7cfc?auto=format&fit=crop&w=1200&q=80',
    tag: 'PNG & OBJ'
  }
];

export default function Hero() {
  const { navigateTo, setSearchQuery } = useApp();
  const { user } = useAuth();
  const heroRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);

  // Rapidly change background images every 2.2 seconds
  useEffect(() => {
    if (!isAutoCycling) return;
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % BACKGROUND_PRODUCTS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isAutoCycling]);

  // Entrance Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' });
      gsap.fromTo('.hero-title', { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.2, ease: 'power4.out' });
      gsap.fromTo('.hero-sub', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.35, ease: 'power3.out' });
      gsap.fromTo('.hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power3.out' });
      gsap.fromTo('.hero-ticker', { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.7, delay: 0.6, ease: 'power3.out' });
      gsap.fromTo('.hero-search-bar', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.7, ease: 'power3.out' });
      gsap.fromTo('.hero-stats', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.8, ease: 'power3.out' });
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

  const currentProduct = BACKGROUND_PRODUCTS[currentBgIndex];

  return (
    <section ref={heroRef} style={styles.section}>
      {/* ── DYNAMIC RAPIDLY CHANGING BACKGROUND SLIDESHOW ── */}
      <div style={styles.bgSlideshowContainer}>
        {BACKGROUND_PRODUCTS.map((prod, index) => (
          <div
            key={index}
            style={{
              ...styles.bgSlide,
              backgroundImage: `url(${prod.image})`,
              opacity: index === currentBgIndex ? 0.35 : 0,
              transform: index === currentBgIndex ? 'scale(1.04)' : 'scale(1.0)',
              transition: 'opacity 0.8s ease-in-out, transform 2.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        ))}

        {/* Ambient Gradient Overlay ensuring readability */}
        <div style={styles.bgOverlay} />
        
        {/* Soft Radial Ambient Glows */}
        <div style={styles.ambientGlowTop} />
        <div style={styles.ambientGlowBottom} />
      </div>

      {/* ── CENTERED HERO CONTENT ── */}
      <div style={styles.container}>
        {/* 1. Pill Badge */}
        <div className="hero-badge" style={styles.badge}>
          <Sparkles size={13} color="#7B3FA0" />
          <span className="text-sans" style={styles.badgeText}>
            PREMIUM DIGITAL MARKETPLACE
          </span>
        </div>

        {/* 2. Editorial Headline */}
        <h1 className="hero-title" style={styles.title}>
          Discover & Sell<br />
          <span style={styles.titleHighlight}>Premium Digital</span><br />
          Products
        </h1>

        {/* 3. Subtitle */}
        <p className="hero-sub" style={styles.subtext}>
          The curated marketplace for UI kits, templates, AI tools, and digital assets — crafted by world-class creators.
        </p>

        {/* 4. Action Buttons (Sign In / Get Started) */}
        <div className="hero-ctas" style={styles.ctas}>
          <button 
            onClick={() => navigateTo(user ? 'marketplace' : 'register-selection')} 
            className="btn-premium btn-premium-solid btn-shine-sweep clickable" 
            style={styles.ctaSolid}
          >
            {user ? 'Go to Marketplace' : 'Get Started'}
            <ArrowRight size={16} />
          </button>

          {!user && (
            <button 
              onClick={() => navigateTo('login')} 
              className="btn-premium clickable" 
              style={styles.ctaOutline}
            >
              Sign In
            </button>
          )}

          <button 
            onClick={() => navigateTo('marketplace')} 
            className="btn-premium clickable" 
            style={styles.ctaGlass}
          >
            <Compass size={15} color="#7B3FA0" />
            Explore Products
          </button>
        </div>

        {/* 5. Live Showcase Ticker / Currently Changing Image Badge */}
        <div className="hero-ticker glass-card" style={styles.tickerCard}>
          <div style={styles.tickerBadgeLeft}>
            <div style={styles.livePulseDot} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0' }}>LIVE SHOWCASE</span>
          </div>

          <div style={styles.tickerCenter}>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#2D004D' }}>
              {currentProduct.title}
            </span>
            <span style={{ fontSize: '0.70rem', color: '#6B4F7A', fontWeight: 600 }}>
              {currentProduct.category} • <strong style={{ color: '#16A34A' }}>{currentProduct.price}</strong> • ⭐ {currentProduct.rating}
            </span>
          </div>

          {/* Rapid Slide Dots */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {BACKGROUND_PRODUCTS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setCurrentBgIndex(i);
                  setIsAutoCycling(false);
                  setTimeout(() => setIsAutoCycling(true), 6000);
                }}
                style={{
                  width: i === currentBgIndex ? '18px' : '6px',
                  height: '6px',
                  borderRadius: '999px',
                  background: i === currentBgIndex ? '#7B3FA0' : 'rgba(123, 63, 160, 0.25)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* 6. Centered Integrated Search Bar & Quick Categories */}
        <div className="hero-search-bar glass-card" style={styles.searchContainer}>
          <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
            <Search size={18} color="#7B3FA0" />
            <input
              type="text"
              placeholder="Search 10,000+ premium UI kits, 3D assets, AI tools..."
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
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.70)';
                  e.currentTarget.style.color = '#2D004D';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
            <button
              onClick={() => navigateTo('marketplace')}
              style={{ ...styles.categoryPill, background: 'rgba(123, 63, 160, 0.10)', color: '#7B3FA0', fontWeight: 800 }}
            >
              All →
            </button>
          </div>
        </div>

        {/* 7. Stats Bar at Bottom */}
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

      {/* Responsive CSS */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
        }
        @media (max-width: 768px) {
          .hero-search-bar { flex-direction: column !important; gap: 14px !important; }
          .hero-ticker { flex-direction: column !alignment: center !important; text-align: center !important; gap: 8px !important; }
        }
      `}</style>
    </section>
  );
}

// Consolidated Stylesheet matching user's exact specification:
// Centered layout with rapid background slideshow & premium editorial design
const styles = {
  section: {
    minHeight: '100vh',
    padding: '130px clamp(1.5rem, 5vw, 4rem) 60px',
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FAF6F0',
  },

  /* Background Rapid Slideshow Styles */
  bgSlideshowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bgSlide: {
    position: 'absolute',
    top: '-5%',
    left: '-5%',
    width: '110%',
    height: '110%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    filter: 'blur(16px)',
  },
  bgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(250, 246, 240, 0.85) 0%, rgba(250, 246, 240, 0.93) 60%, #FAF6F0 100%)',
    backdropFilter: 'blur(24px)',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: '10%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '600px',
    height: '350px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(192, 132, 252, 0.25) 0%, transparent 70%)',
    filter: 'blur(60px)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: '5%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '700px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123, 63, 160, 0.15) 0%, transparent 70%)',
    filter: 'blur(70px)',
  },

  /* Main Centered Container */
  container: {
    width: '100%',
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '24px',
    position: 'relative',
    zIndex: 2,
  },

  /* Badge */
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 16px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(192, 132, 252, 0.50)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 16px rgba(90, 30, 126, 0.08)',
  },
  badgeText: {
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#7B3FA0',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },

  /* Headline */
  title: {
    fontFamily: 'var(--font-editorial)',
    fontSize: 'clamp(2.8rem, 5.8vw, 4.6rem)',
    fontWeight: 400,
    color: '#2D004D',
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
    margin: 0,
    maxWidth: '900px',
  },
  titleHighlight: {
    fontFamily: 'var(--font-editorial)',
    fontStyle: 'italic',
    fontWeight: 500,
    background: 'linear-gradient(135deg, #7B3FA0 0%, #9333EA 50%, #C084FC 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
  },

  /* Subtitle */
  subtext: {
    fontSize: 'clamp(1rem, 1.8vw, 1.15rem)',
    lineHeight: 1.6,
    color: '#6B4F7A',
    maxWidth: '680px',
    margin: 0,
  },

  /* Buttons */
  ctas: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  ctaSolid: {
    padding: '14px 34px',
    borderRadius: '16px',
    fontSize: '0.94rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
    color: '#ffffff',
    boxShadow: '0 10px 28px rgba(90, 30, 126, 0.32)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  ctaOutline: {
    padding: '14px 30px',
    borderRadius: '16px',
    fontSize: '0.92rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1.5px solid rgba(123, 63, 160, 0.35)',
    color: '#7B3FA0',
  },
  ctaGlass: {
    padding: '14px 28px',
    borderRadius: '16px',
    fontSize: '0.90rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.65)',
    border: '1px solid rgba(192, 132, 252, 0.40)',
    color: '#2D004D',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(10px)',
  },

  /* Live Showcase Ticker Badge */
  tickerCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '10px 20px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(192, 132, 252, 0.45)',
    boxShadow: '0 8px 24px rgba(90, 30, 126, 0.08)',
    marginTop: '6px',
    maxWidth: '720px',
    width: '100%',
  },
  tickerBadgeLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(123, 63, 160, 0.10)',
    padding: '4px 12px',
    borderRadius: '999px',
    flexShrink: 0,
  },
  livePulseDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#16A34A',
    animation: 'pulseDot 1.8s infinite ease-in-out',
  },
  tickerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  /* Centered Search Bar & Categories */
  searchContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(30px)',
    border: '1.5px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 16px 48px rgba(90, 30, 126, 0.10)',
    width: '100%',
    maxWidth: '780px',
    marginTop: '10px',
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.90)',
    padding: '8px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(192, 132, 252, 0.40)',
    boxShadow: '0 2px 8px rgba(90, 30, 126, 0.04) inset',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.90rem',
    color: '#2D004D',
    width: '100%',
    fontFamily: 'var(--font-sans)',
  },
  aiSearchBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 14px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: 800,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(90, 30, 126, 0.25)',
  },
  categoriesRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  categoryPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '7px 13px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.70)',
    border: '1px solid rgba(192, 132, 252, 0.35)',
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#2D004D',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: 'var(--font-sans)',
  },

  /* Stats Container */
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
    padding: '18px 24px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(28px)',
    border: '1px solid rgba(255, 255, 255, 0.90)',
    boxShadow: '0 10px 32px rgba(90, 30, 126, 0.08)',
    width: '100%',
    maxWidth: '820px',
    marginTop: '10px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    justifyContent: 'center',
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
    textAlign: 'left',
  },
  statLabel: {
    fontSize: '0.66rem',
    color: '#6B4F7A',
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: 'left',
  },
};
