import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import AnimatedBackground from '../../components/AnimatedBackground';
import { ArrowRight, Share2, Store, Check, Shield, TrendingUp, Users, Headphones } from 'lucide-react';

/* ── Scroll-triggered reveal wrapper (matches Home.jsx) ── */
function Reveal({ children, delay = 0, style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

export default function PartnershipHub() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Partnerships — Lumora Digital Marketplace';
  }, []);

  /* ── Why Partner data ── */
  const whyItems = [
    { icon: <Shield size={22} />, color: 'rgba(220, 198, 255, 0.45)', title: 'Trusted Marketplace', desc: 'Trusted by 45K+ customers worldwide.' },
    { icon: <TrendingUp size={22} />, color: 'rgba(207, 232, 214, 0.45)', title: 'Transparent Earnings', desc: 'Real‑time analytics and clear tracking.' },
    { icon: <Users size={22} />, color: 'rgba(255, 214, 186, 0.45)', title: 'Growing Community', desc: 'Network of top digital creators.' },
    { icon: <Headphones size={22} />, color: 'rgba(220, 238, 255, 0.45)', title: 'Dedicated Support', desc: 'Priority help from our team.' },
  ];

  /* Glass card style helper matching Home.jsx style config exactly */
  const glassCardStyle = (extra = {}) => ({
    background: 'rgba(255, 255, 255, 0.30)',
    backdropFilter: 'blur(36px) saturate(200%) brightness(1.05)',
    WebkitBackdropFilter: 'blur(36px) saturate(200%) brightness(1.05)',
    border: '1px solid rgba(255, 255, 255, 0.40)',
    borderTop: '1.5px solid rgba(255, 255, 255, 0.55)',
    borderRadius: '22px',
    boxShadow: '0 8px 32px rgba(90, 30, 126, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.60)',
    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    ...extra,
  });

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 10 }}>
      <AnimatedBackground />
      <Navbar />

      <main style={{ paddingTop: '120px' }}>

        {/* ═══════════ 1. HERO (Informational Only — No CTA) ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem) 64px', textAlign: 'center', position: 'relative' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 2 }}>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 16px', borderRadius: '100px',
                background: 'rgba(220, 198, 255, 0.30)',
                border: '1px solid rgba(220, 198, 255, 0.55)',
                marginBottom: '24px',
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7B3FA0', boxShadow: '0 0 8px rgba(123,63,160,.6)' }} />
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#5A1E7E', letterSpacing: '.05em' }}>
                PARTNER WITH US
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 44 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                fontFamily: 'var(--font-editorial)',
                fontSize: 'clamp(3rem, 5.5vw, 4.8rem)', lineHeight: 1.06,
                color: '#2D004D', letterSpacing: '-0.02em',
                marginBottom: '20px', fontWeight: 400,
              }}
            >
              Grow with{' '}
              <span style={{
                background: 'linear-gradient(135deg, #7B3FA0, #C084FC)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', fontStyle: 'italic',
              }}>Lumora</span>
            </motion.h1>

            {/* Primary description */}
            <motion.p
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              style={{
                fontSize: '1.05rem', color: '#6B4F7A', lineHeight: 1.7,
                maxWidth: '520px', margin: '0 auto 20px',
              }}
            >
              Unlock new revenue streams by joining our Affiliate or Vendor programs — built for creators, marketers, and entrepreneurs.
            </motion.p>

            {/* Supporting paragraph */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              style={{
                fontSize: '.95rem', color: '#8B7A9E', lineHeight: 1.7,
                maxWidth: '480px', margin: '0 auto 24px',
              }}
            >
              Whether you want to promote world-class digital products or sell your own creations, Lumora provides the platform, tools, and community to help you succeed.
            </motion.p>

            {/* Trust statement */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{
                fontSize: '.8rem', color: '#A89BB5', fontWeight: 600,
                letterSpacing: '.02em',
              }}
            >
              ✔ Helping creators and partners grow with Lumora
            </motion.p>
          </div>
        </section>

        {/* ═══════════ 2. CHOOSE YOUR PATH ═══════════ */}
        <section id="choose-path" style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)', background: 'rgba(220, 198, 255, 0.06)' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>

            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: '52px' }}>
                <p style={{ fontSize: '.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Two Paths, One Platform
                </p>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#2D004D' }}>
                  Choose Your Path
                </h2>
              </div>
            </Reveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

              {/* ── Affiliate Card ── */}
              <Reveal delay={0.06}>
                <div
                  className="glass-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/partnerships/affiliate')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/partnerships/affiliate'); } }}
                  style={glassCardStyle({ padding: '36px', cursor: 'pointer', textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column' })}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 24px 56px rgba(90, 30, 126, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.70)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(90, 30, 126, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.60)';
                  }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '13px',
                    background: 'rgba(220, 198, 255, 0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '18px', color: '#5A1E7E',
                  }}>
                    <Share2 size={22} />
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.4rem', fontWeight: 400, color: '#2D004D', marginBottom: '8px' }}>
                    Become an Affiliate
                  </h3>

                  <p style={{ color: '#6B4F7A', marginBottom: '20px', lineHeight: 1.65, fontSize: '.9rem' }}>
                    Earn commissions by promoting premium digital products to your audience.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Flexible earnings', 'No inventory needed', 'Real‑time analytics'].map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.83rem', color: '#2D004D', fontWeight: 600 }}>
                        <Check size={14} color="var(--color-latte)" /> {item}
                      </li>
                    ))}
                  </ul>

                  <button className="btn-premium" style={{ width: '100%', height: '44px', padding: '0 16px', justifyContent: 'center', fontSize: '.85rem', marginTop: 'auto', borderRadius: '14px', fontWeight: 700 }}>
                    Learn More <ArrowRight size={14} />
                  </button>
                </div>
              </Reveal>

              {/* ── Vendor Card ── */}
              <Reveal delay={0.12}>
                <div
                  className="glass-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/partnerships/vendor')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/partnerships/vendor'); } }}
                  style={glassCardStyle({ padding: '36px', cursor: 'pointer', textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column' })}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 24px 56px rgba(90, 30, 126, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.70)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 32px rgba(90, 30, 126, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.60)';
                  }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '13px',
                    background: 'rgba(255, 214, 186, 0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '18px', color: '#5A1E7E',
                  }}>
                    <Store size={22} />
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.4rem', fontWeight: 400, color: '#2D004D', marginBottom: '8px' }}>
                    Become a Vendor
                  </h3>

                  <p style={{ color: '#6B4F7A', marginBottom: '20px', lineHeight: 1.65, fontSize: '.9rem' }}>
                    Sell your digital products to a global audience of professionals and creators.
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Global reach', 'Secure payouts', 'Full creative control'].map((item, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '.83rem', color: '#2D004D', fontWeight: 600 }}>
                        <Check size={14} color="var(--color-latte)" /> {item}
                      </li>
                    ))}
                  </ul>

                  <button className="btn-premium btn-premium-solid" style={{ width: '100%', height: '44px', padding: '0 16px', justifyContent: 'center', fontSize: '.85rem', marginTop: 'auto', borderRadius: '14px', fontWeight: 700 }}>
                    Learn More <ArrowRight size={14} />
                  </button>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ═══════════ 3. WHY PARTNER WITH LUMORA ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>

            <Reveal>
              <div style={{ textAlign: 'center', marginBottom: '52px' }}>
                <p style={{ fontSize: '.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Why Lumora
                </p>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#2D004D' }}>
                  Built for Partners
                </h2>
              </div>
            </Reveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}
              className="why-partner-grid"
            >
              {whyItems.map((item, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <div
                    className="glass-card"
                    style={glassCardStyle({ padding: '28px 22px', textAlign: 'center', height: '100%', cursor: 'default' })}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = '0 24px 56px rgba(90, 30, 126, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.70)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(90, 30, 126, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.60)';
                    }}
                  >
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '13px',
                      background: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px', color: '#5A1E7E',
                    }}>
                      {item.icon}
                    </div>
                    <h3 style={{ fontSize: '.98rem', fontWeight: 700, color: '#2D004D', marginBottom: '8px' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '.83rem', color: '#6B4F7A', lineHeight: 1.65 }}>
                      {item.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Responsive grid override */}
            <style>{`
              @media (max-width: 768px) {
                .why-partner-grid {
                  grid-template-columns: repeat(2, 1fr) !important;
                }
              }
              @media (max-width: 480px) {
                .why-partner-grid {
                  grid-template-columns: 1fr !important;
                  max-width: 320px;
                  margin: 0 auto;
                }
              }
            `}</style>
          </div>
        </section>

        {/* ═══════════ 4. FINAL CTA ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem) 100px' }}>
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            <Reveal>
              <div
                className="glass-card"
                style={glassCardStyle({
                  textAlign: 'center', position: 'relative', overflow: 'hidden',
                  padding: 'clamp(48px, 8vw, 80px) clamp(24px, 4vw, 48px)',
                  borderRadius: '32px',
                })}
              >
                {/* Background orbs */}
                <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,198,255,.28) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-30%', right: '-10%', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,186,.22) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: '.68rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
                    ✦ Start Today
                  </p>
                  <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 400, color: '#2D004D', lineHeight: 1.1, marginBottom: '18px' }}>
                    Ready to Join?
                  </h2>
                  <p style={{
                    fontSize: '1.05rem', color: '#6B4F7A', lineHeight: 1.7,
                    maxWidth: '460px', margin: '0 auto 32px',
                  }}>
                    Choose the path that fits your goals and start building with Lumora today — no upfront fees, full transparency, and dedicated support.
                  </p>

                  {/* Trust signals */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    {['No upfront fees', 'Real‑time analytics', 'Dedicated support'].map((t, i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.8rem', color: '#8B6B5B', fontWeight: 600 }}>
                        <Check size={13} style={{ color: '#16a34a' }} /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
