import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Star, TrendingUp, Shield, Zap, Search, Users, Download,
  Sparkles, Compass, Layers, Cpu, Box, Type, CheckCircle, ExternalLink, RefreshCw
} from 'lucide-react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export default function Hero() {
  const { navigateTo } = useApp();
  const { user } = useAuth();
  const heroRef = useRef(null);

  // Entrance Animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'power3.out' });
      gsap.fromTo('.hero-title', { opacity: 0, y: 35 }, { opacity: 1, y: 0, duration: 0.9, delay: 0.2, ease: 'power4.out' });
      gsap.fromTo('.hero-sub', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.35, ease: 'power3.out' });
      gsap.fromTo('.hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.5, ease: 'power3.out' });
      gsap.fromTo('.hero-stats', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.65, ease: 'power3.out' });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} style={styles.section}>
      {/* ── FULL-SCREEN CINEMATIC BACKGROUND VIDEO WITH DARK VIGNETTE ── */}
      <div style={styles.fullBgWrapper}>
        <video
          autoPlay
          loop
          muted
          playsInline
          style={styles.bgVideo}
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark Vignette Overlay for rich rich colors and maximum text readability */}
        <div style={styles.fullBgOverlay} />
        {/* Soft, subtle bottom edge transition mask to blend smoothly into lower section */}
        <div style={styles.bottomSoftBlend} />
      </div>

      {/* ── CENTERED HERO CONTENT DIRECTLY ON BACKGROUND ── */}
      <div style={styles.container}>
        {/* 1. Pill Badge */}
        <div className="hero-badge" style={styles.badge}>
          <Sparkles size={13} color="#C084FC" />
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
            <Compass size={15} color="#E9D5FF" />
            Explore Products
          </button>
        </div>

        {/* 5. Compact Slim Stats Bar */}
        <div className="hero-stats glass-card" style={styles.statsContainer}>
          {[
            { icon: <Users size={14} color="#C084FC" />, value: '120K+', label: 'Happy Customers', bg: 'rgba(192, 132, 252, 0.15)' },
            { icon: <Download size={14} color="#FBBF24" />, value: '1.2M+', label: 'Downloads', bg: 'rgba(251, 191, 36, 0.15)' },
            { icon: <Shield size={14} color="#4ADE80" />, value: '500+', label: 'Top Creators', bg: 'rgba(74, 222, 128, 0.15)' },
            { icon: <CheckCircle size={14} color="#FB7185" />, value: '97%', label: 'Satisfaction Rate', bg: 'rgba(251, 113, 133, 0.15)' },
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
    </section>
  );
}

const styles = {
  section: {
    minHeight: '115vh',
    padding: '140px clamp(1rem, 4vw, 3rem) 160px',
    position: 'relative',
    zIndex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0D0518',
  },

  /* Full Background Wrapper & Visible Slides */
  fullBgWrapper: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bgVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    filter: 'brightness(0.9) contrast(1.05)',
  },
  fullBgOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, rgba(13, 5, 24, 0.45) 0%, rgba(13, 5, 24, 0.60) 65%, rgba(13, 5, 24, 0.85) 100%)',
    backdropFilter: 'blur(1px)',
  },
  bottomSoftBlend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '110px',
    background: 'linear-gradient(180deg, rgba(13, 5, 24, 0) 0%, rgba(250, 246, 240, 0.35) 60%, #FAF6F0 100%)',
    pointerEvents: 'none',
    zIndex: 2,
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
    gap: '28px',
    position: 'relative',
    zIndex: 10,
  },

  /* Badge directly on background */
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 18px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(192, 132, 252, 0.40)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  badgeText: {
    fontSize: '0.75rem',
    fontWeight: 800,
    color: '#E9D5FF',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },

  /* Editorial Headline on background with text shadow */
  title: {
    fontFamily: 'var(--font-editorial)',
    fontSize: 'clamp(2.8rem, 6vw, 4.8rem)',
    fontWeight: 400,
    color: '#FFFFFF',
    lineHeight: 1.08,
    letterSpacing: '-0.03em',
    margin: 0,
    maxWidth: '900px',
    textShadow: '0 4px 24px rgba(0, 0, 0, 0.7)',
  },
  titleHighlight: {
    fontFamily: 'var(--font-editorial)',
    fontStyle: 'normal',
    fontWeight: 800,
    color: '#FFFFFF',
    display: 'inline-block',
  },

  /* Subtitle on background */
  subtext: {
    fontSize: 'clamp(1.05rem, 1.9vw, 1.2rem)',
    lineHeight: 1.6,
    color: '#F3E8FF',
    maxWidth: '720px',
    margin: 0,
    fontWeight: 500,
    textShadow: '0 2px 16px rgba(0, 0, 0, 0.8)',
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
    background: 'linear-gradient(135deg, #9333EA, #6B21A8)',
    color: '#ffffff',
    boxShadow: '0 10px 32px rgba(147, 51, 234, 0.45)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  },
  ctaOutline: {
    padding: '14px 30px',
    borderRadius: '16px',
    fontSize: '0.92rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.15)',
    border: '1.5px solid rgba(255, 255, 255, 0.35)',
    color: '#ffffff',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  },
  ctaGlass: {
    padding: '14px 28px',
    borderRadius: '16px',
    fontSize: '0.90rem',
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.12)',
    border: '1px solid rgba(192, 132, 252, 0.35)',
    color: '#F3E8FF',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(12px)',
  },

  /* Compact Slim Stats Container */
  statsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
    gap: '12px',
    padding: '8px 20px',
    borderRadius: '999px',
    background: 'rgba(255, 255, 255, 0.12)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1.5px solid rgba(255, 255, 255, 0.22)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.30)',
    width: '100%',
    maxWidth: '780px',
    marginTop: '48px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
  },
  statIconBox: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statValue: {
    fontSize: '0.92rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.1,
    textAlign: 'left',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  },
  statLabel: {
    fontSize: '0.62rem',
    color: '#E9D5FF',
    fontWeight: 600,
    lineHeight: 1.2,
    textAlign: 'left',
  },
};
