import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Star, TrendingUp, Shield, Zap, Search, Users, Download,
  Sparkles, Compass, Layers, Cpu, Box, Type, CheckCircle, ExternalLink, RefreshCw
} from 'lucide-react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

// High-resolution Unsplash photos from 'digital products website' search query
const UNSPLASH_DIGITAL_PRODUCT_IMAGES = [
  {
    id: 1,
    title: 'Digital Product Analytics & Web Dashboard',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 2,
    title: 'Modern Web Design & Digital Product UI',
    image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 3,
    title: 'SaaS Product Interface & Data Metrics',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 4,
    title: 'Digital Design System & Mobile Prototypes',
    image: 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 5,
    title: 'Mobile App UX/UI Product Design',
    image: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?auto=format&fit=crop&w=1920&q=80',
  },
  {
    id: 6,
    title: 'Creative Web Studio & Product Showcase',
    image: 'https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1920&q=80',
  }
];

export default function Hero() {
  const { navigateTo, setSearchQuery } = useApp();
  const { user } = useAuth();
  const heroRef = useRef(null);
  const [localSearch, setLocalSearch] = useState('');
  
  // Active background image index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cycle background images every 4 seconds (4000ms) with smooth opacity fade
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % UNSPLASH_DIGITAL_PRODUCT_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Entrance Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' });
      gsap.fromTo('.hero-title', { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.2, ease: 'power4.out' });
      gsap.fromTo('.hero-sub', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.35, ease: 'power3.out' });
      gsap.fromTo('.hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power3.out' });
      gsap.fromTo('.hero-search-bar', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.65, ease: 'power3.out' });
      gsap.fromTo('.hero-stats', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.75, ease: 'power3.out' });
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

  const activeImage = UNSPLASH_DIGITAL_PRODUCT_IMAGES[currentIndex];

  return (
    <section ref={heroRef} style={styles.section}>
      {/* ── HIGH VISIBILITY FULL-SCREEN UNSPLASH BACKGROUND SLIDESHOW ── */}
      <div style={styles.fullBgWrapper}>
        {UNSPLASH_DIGITAL_PRODUCT_IMAGES.map((item, idx) => (
          <div
            key={item.id}
            style={{
              ...styles.fullBgImage,
              backgroundImage: `url(${item.image})`,
              opacity: idx === currentIndex ? 0.75 : 0, // FULLY VISIBLE high opacity (0.75)
              transform: idx === currentIndex ? 'scale(1.08)' : 'scale(1.00)', // Ken Burns slow zoom
              transition: 'opacity 1500ms cubic-bezier(0.4, 0, 0.2, 1), transform 4000ms ease-out',
            }}
          />
        ))}

        {/* Minimal Vignette & Soft Gradient Tint to preserve edge contrast */}
        <div style={styles.fullBgOverlay} />
      </div>

      {/* ── CENTERED HERO GLASS PANEL (Ensures text legibility while background is fully visible) ── */}
      <div style={styles.container}>
        {/* Glass Card Wrapper around Hero Content */}
        <div style={styles.heroGlassCard}>
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

          {/* 4. Action Buttons */}
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

          {/* 5. Live Background Image Title Badge & Indicators */}
          <div style={styles.imageIndicatorBadge}>
            <div style={styles.livePulseDot} />
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2D004D' }}>
              BACKGROUND: {activeImage.title}
            </span>
            <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto', alignItems: 'center' }}>
              {UNSPLASH_DIGITAL_PRODUCT_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  style={{
                    width: i === currentIndex ? '18px' : '6px',
                    height: '6px',
                    borderRadius: '999px',
                    background: i === currentIndex ? '#7B3FA0' : 'rgba(123, 63, 160, 0.35)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 6. Centered Search Bar & Quick Categories */}
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
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
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
        }
      `}</style>
    </section>
  );
}

const styles = {
  section: {
    minHeight: '100vh',
    padding: '130px clamp(1rem, 4vw, 3rem) 60px',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1A0D28', // Dark base to make images pop!
  },

  /* Full Background Wrapper & Visible Slides */
  fullBgWrapper: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  fullBgImage: {
    position: 'absolute',
    inset: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    willChange: 'opacity, transform',
    filter: 'brightness(0.90) contrast(1.05)',
  },
  fullBgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at center, rgba(26, 13, 40, 0.25) 0%, rgba(26, 13, 40, 0.55) 70%, rgba(26, 13, 40, 0.85) 100%)',
  },

  /* Relative Overlay Container (z-10) */
  container: {
    width: '100%',
    maxWidth: '960px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '20px',
    position: 'relative',
    zIndex: 10,
  },

  /* Hero Glass Card around central typography to make high opacity background pop! */
  heroGlassCard: {
    width: '100%',
    padding: '36px clamp(1.2rem, 4vw, 3rem)',
    borderRadius: '32px',
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1.5px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.25), 0 2px 0 rgba(255, 255, 255, 0.8) inset',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '20px',
  },

  /* Badge */
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 16px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(192, 132, 252, 0.50)',
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
    color: '#4A2E59',
    maxWidth: '680px',
    margin: 0,
    fontWeight: 600,
  },

  /* Buttons */
  ctas: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  ctaSolid: {
    padding: '14px 34px',
    borderRadius: '16px',
    fontSize: '0.94rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
    color: '#ffffff',
    boxShadow: '0 10px 28px rgba(90, 30, 126, 0.35)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  ctaOutline: {
    padding: '14px 30px',
    borderRadius: '16px',
    fontSize: '0.92rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1.5px solid rgba(123, 63, 160, 0.40)',
    color: '#7B3FA0',
    boxShadow: '0 4px 14px rgba(90, 30, 126, 0.08)',
  },
  ctaGlass: {
    padding: '14px 28px',
    borderRadius: '16px',
    fontSize: '0.90rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.90)',
    border: '1px solid rgba(192, 132, 252, 0.45)',
    color: '#2D004D',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },

  /* Live Background Image Indicator Badge */
  imageIndicatorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.95)',
    border: '1px solid rgba(192, 132, 252, 0.40)',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
    marginTop: '6px',
    width: 'fit-content',
  },
  livePulseDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#16A34A',
    animation: 'pulseDot 1.8s infinite ease-in-out',
  },

  /* Search Container */
  searchContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 20px',
    borderRadius: '24px',
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(30px)',
    border: '1.5px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.20)',
    width: '100%',
    maxWidth: '780px',
    marginTop: '6px',
  },
  searchForm: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    background: 'rgba(255, 255, 255, 0.98)',
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
    background: 'rgba(255, 255, 255, 0.85)',
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
    background: 'rgba(255, 255, 255, 0.90)',
    backdropFilter: 'blur(28px)',
    border: '1px solid rgba(255, 255, 255, 0.90)',
    boxShadow: '0 10px 32px rgba(0, 0, 0, 0.20)',
    width: '100%',
    maxWidth: '820px',
    marginTop: '6px',
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
