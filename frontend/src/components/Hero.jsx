import React, { useEffect, useRef } from 'react';
import { ArrowRight, Star, TrendingUp, Shield, Zap } from 'lucide-react';
import gsap from 'gsap';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const FEATURED = [
  { name: 'Solace Mobile System', price: '₹4,720', cat: 'Mobile Templates', rating: 4.9, img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80' },
  { name: 'Zephyr AI Creator Suite', price: '₹6,320', cat: 'AI Tools', rating: 4.8, img: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80' },
  { name: 'Aura Glassmorphic Kit', price: '₹3,120', cat: 'Web Templates', rating: 4.7, img: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=400&q=80' },
];

export default function Hero() {
  const { navigateTo } = useApp();
  const { user } = useAuth();
  const heroRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-badge', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.2, ease: 'power3.out' });
      gsap.fromTo('.hero-title', { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.0, delay: 0.35, ease: 'power4.out' });
      gsap.fromTo('.hero-sub', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.55, ease: 'power3.out' });
      gsap.fromTo('.hero-ctas', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.70, ease: 'power3.out' });
      gsap.fromTo('.hero-stats', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.85, ease: 'power3.out' });
      gsap.fromTo('.hero-cards > .card-stagger', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.50, stagger: 0.15, ease: 'power3.out' });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={heroRef} style={styles.section}>
      {/* Background ambient decorative glows */}
      <div style={styles.glowOrb1} />
      <div style={styles.glowOrb2} />

      <div className="hero-grid" style={styles.grid}>
        {/* LEFT SECTION: Branding, Headline and Action Controls */}
        <div style={styles.leftCol}>
          {/* Immersive Badge */}
          <div className="hero-badge" style={styles.badge}>
            <span style={styles.badgeDot} />
            <span className="text-sans" style={styles.badgeText}>
              PREMIUM DIGITAL MARKETPLACE
            </span>
          </div>

          {/* Premium Editorial Headline */}
          <h1 className="hero-title" style={styles.title}>
            Discover & Sell<br />
            <span style={styles.titleHighlight}>Premium Digital</span><br />
            Products
          </h1>

          {/* Descriptive Subtext */}
          <p className="hero-sub" style={styles.subtext}>
            The go-to marketplace for UI kits, templates, AI tools, courses, and digital assets — crafted by world-class creators.
          </p>

          {/* Action CTAs */}
          <div className="hero-ctas" style={styles.ctas}>
            {user ? (
              <>
                <button 
                  onClick={() => navigateTo('marketplace')} 
                  className="btn-premium btn-premium-solid clickable" 
                  style={styles.ctaSolid}
                >
                  Browse Products
                  <ArrowRight size={16} />
                </button>
                <button 
                  onClick={() => navigateTo('dashboard')} 
                  className="btn-premium clickable" 
                  style={styles.ctaOutline}
                >
                  My Dashboard
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => navigateTo('login-selection')} 
                  className="btn-premium btn-premium-solid clickable" 
                  style={styles.ctaSolid}
                >
                  Sign In
                  <ArrowRight size={16} />
                </button>
                <button 
                  onClick={() => navigateTo('register-selection')} 
                  className="btn-premium clickable" 
                  style={styles.ctaOutline}
                >
                  Create Account
                </button>
              </>
            )}
          </div>

          {/* Platform Performance Ledger Stats */}
          <div className="hero-stats" style={styles.statsContainer}>
            {[
              { value: '12K+', label: 'Digital Products' },
              { value: '45K+', label: 'Happy Customers' },
              { value: '₹16 Cr+', label: 'Creator Earnings' },
            ].map((s, i) => (
              <div key={i} style={styles.statItem}>
                <div style={styles.statValue}>{s.value}</div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SECTION: Vertically aligned structured featured cards */}
        <div className="hero-cards" style={styles.rightCol}>
          {/* Trust assurances row */}
          <div style={styles.badgeRow}>
            {[
              { icon: <Shield size={12} />, text: 'Secure Payments' },
              { icon: <Zap size={12} />, text: 'Instant Download' },
            ].map((b, i) => (
              <div key={i} style={styles.trustBadge}>
                {b.icon} {b.text}
              </div>
            ))}
          </div>

          {/* Vertical Glassmorphic Cards Stack */}
          {FEATURED.map((item, index) => (
            <div 
              key={index}
              className="glass-card clickable card-stagger"
              onClick={() => navigateTo('marketplace')}
              style={{
                ...styles.card,
                // Soft alternating horizontal alignment shift for a classier offset look
                transform: `translateX(${(index - 1) * 12}px)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = `translateX(${(index - 1) * 12}px) translateY(-6px) scale(1.02)`;
                e.currentTarget.style.boxShadow = '0 25px 50px rgba(45, 0, 96, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(123, 63, 160, 0.35)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = `translateX(${(index - 1) * 12}px) translateY(0px) scale(1)`;
                e.currentTarget.style.boxShadow = '0 15px 30px rgba(45, 0, 96, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(216, 191, 227, 0.22)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.55)';
              }}
            >
              {/* Product Visual Container (Image is oriented vertically) */}
              <div style={styles.cardImageWrapper}>
                <img 
                  src={item.img} 
                  alt={item.name} 
                  style={styles.cardImage} 
                />
              </div>

              {/* Product Meta details */}
              <div style={styles.cardDetails}>
                <div style={styles.cardHeader}>
                  <span className="caption-premium" style={styles.cardCategory}>
                    {item.cat}
                  </span>
                  <span style={styles.cardRating}>
                    <Star size={11} fill="var(--color-latte)" color="var(--color-latte)" />
                    {item.rating}
                  </span>
                </div>
                
                <h3 className="text-editorial" style={styles.cardTitle}>
                  {item.name}
                </h3>

                <div style={styles.cardFooter}>
                  <span className="text-sans" style={styles.cardPrice}>
                    {item.price}
                  </span>
                  <span className="text-sans" style={styles.cardAction}>
                    Get Access →
                  </span>
                </div>
              </div>
            </div>
          ))}

          {/* Trending Highlight Badge */}
          <div style={styles.trendingContainer}>
            <div style={styles.trendingIconWrapper}>
              <TrendingUp size={14} color="#fff" />
            </div>
            <div style={styles.trendingTextWrapper}>
              <span style={styles.trendingLabel}>Trending:</span>
              <span style={styles.trendingValue}>+2,400 sales this week</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .hero-cards { margin-top: 32px; }
        }
      `}</style>
    </section>
  );
}

// Consolidated premium stylesheet object to keep JSX neat, classy and professional
const styles = {
  section: {
    minHeight: '100vh',
    padding: '140px clamp(1.5rem, 5vw, 6rem) 80px',
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
  },
  glowOrb1: {
    position: 'absolute',
    top: '-10%',
    right: '-5%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(90, 30, 126, 0.35) 0%, transparent 65%)',
    filter: 'blur(70px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  glowOrb2: {
    position: 'absolute',
    bottom: '0',
    left: '-8%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(184, 134, 208, 0.15) 0%, transparent 65%)',
    filter: 'blur(70px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  grid: {
    width: '100%',
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.15fr 0.85fr',
    gap: '64px',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  leftCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 14px',
    borderRadius: '50px',
    background: 'rgba(123, 63, 160, 0.06)',
    border: '1px solid rgba(123, 63, 160, 0.12)',
    marginBottom: '28px',
  },
  badgeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--purple-600)',
    boxShadow: '0 0 8px rgba(123, 63, 160, 0.3)',
  },
  badgeText: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: 'var(--purple-850, #5A1E7E)',
    letterSpacing: '0.06em',
  },
  title: {
    fontFamily: 'var(--font-editorial)',
    fontWeight: 400,
    fontSize: 'clamp(2.8rem, 5.2vw, 5.2rem)',
    lineHeight: 1.05,
    color: 'var(--text-primary)',
    marginBottom: '24px',
    letterSpacing: '-0.03em',
  },
  titleHighlight: {
    color: 'var(--color-mocha)',
    fontStyle: 'italic',
  },
  subtext: {
    fontSize: '1.05rem',
    lineHeight: 1.65,
    color: 'var(--text-secondary)',
    maxWidth: '480px',
    marginBottom: '40px',
    fontWeight: 400,
  },
  ctas: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '52px',
  },
  ctaSolid: {
    padding: '14px 32px',
    fontSize: '0.92rem',
    borderRadius: '12px',
    gap: '8px',
  },
  ctaOutline: {
    padding: '14px 32px',
    fontSize: '0.92rem',
    borderRadius: '12px',
  },
  statsContainer: {
    display: 'flex',
    gap: '36px',
    flexWrap: 'wrap',
    paddingTop: '32px',
    borderTop: '1px solid rgba(216, 191, 227, 0.18)',
    width: '100%',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
  },
  statValue: {
    fontSize: '1.85rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1,
    fontFamily: 'var(--font-editorial)',
  },
  statLabel: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    fontWeight: 650,
    marginTop: '6px',
    letterSpacing: '0.04em',
  },
  rightCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    position: 'relative',
    zIndex: 1,
    justifyContent: 'center',
    width: '100%',
  },
  badgeRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
    alignSelf: 'flex-start',
  },
  trustBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '50px',
    background: 'rgba(255, 255, 255, 0.72)',
    border: '1px solid rgba(123, 63, 160, 0.15)',
    boxShadow: '0 4px 12px rgba(123, 63, 160, 0.05)',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--purple-800)',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '18px',
    borderRadius: '28px', // High border radius matching navbar theme
    border: '1px solid rgba(216, 191, 227, 0.22)',
    boxShadow: '0 15px 30px rgba(45, 0, 96, 0.06)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1))',
    cursor: 'none',
    position: 'relative',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(20px)',
  },
  cardImageWrapper: {
    width: '84px',
    height: '84px',
    borderRadius: '18px',
    overflow: 'hidden',
    flexShrink: 0,
    boxShadow: '0 8px 20px rgba(45, 0, 96, 0.08)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardDetails: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCategory: {
    color: 'var(--color-mocha)',
    fontSize: '0.68rem',
  },
  cardRating: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--color-latte)',
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 500,
    color: 'var(--color-espresso)',
    margin: '2px 0 4px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: 'var(--color-espresso)',
  },
  cardAction: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--color-mocha)',
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
  },
  trendingContainer: {
    padding: '10px 16px',
    borderRadius: '16px',
    background: 'rgba(123, 63, 160, 0.05)',
    border: '1px solid rgba(123, 63, 160, 0.10)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    alignSelf: 'flex-start',
    marginTop: '4px',
  },
  trendingIconWrapper: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--purple-600), var(--purple-800))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingTextWrapper: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  trendingLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--purple-800)',
  },
  trendingValue: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--color-espresso)',
  },
};
