import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import AnimatedBackground from '../../components/AnimatedBackground';
import { ArrowLeft, ArrowRight, DollarSign, BarChart3, Globe, Zap, Check } from 'lucide-react';

export default function Affiliate() {
  const navigate = useNavigate();
  const [backHover, setBackHover] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Affiliate Program — Lumora';
  }, []);

  const handleCTA = () => navigate('/auth/register?role=affiliate');

  /* ── Why Join data ── */
  const whyItems = [
    { icon: <DollarSign size={22} />, title: 'Flexible Earnings', desc: 'Competitive commissions on every referral you drive.' },
    { icon: <Globe size={22} />, title: 'No Inventory Needed', desc: 'Promote premium products without managing stock or fulfillment.' },
    { icon: <BarChart3 size={22} />, title: 'Real‑Time Analytics', desc: 'Track clicks, conversions, and earnings from your personal dashboard.' },
    { icon: <Zap size={22} />, title: 'Work From Anywhere', desc: 'Earn from anywhere in the world with just a referral link.' },
  ];

  /* ── How It Works steps ── */
  const steps = [
    { num: '01', title: 'Apply', desc: 'Quick application to join.' },
    { num: '02', title: 'Get Approved', desc: 'Fast review by our team.' },
    { num: '03', title: 'Share Links', desc: 'Access your unique referral links.' },
    { num: '04', title: 'Earn', desc: 'Commission on every sale.' },
  ];

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

        {/* ═══════════ 1. HERO ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem) 64px', position: 'relative', minHeight: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Floating Premium Back Button */}
          <button
            onClick={() => navigate('/partnerships')}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            style={{
              position: 'absolute',
              top: '24px',
              left: 'clamp(24px, 6vw, 7rem)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0 18px',
              height: '46px',
              borderRadius: '9999px',
              background: backHover ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1.5px solid rgba(255, 255, 255, 0.60)',
              boxShadow: backHover ? '0 8px 24px rgba(90, 30, 126, 0.15)' : '0 4px 16px rgba(90, 30, 126, 0.06)',
              transform: backHover ? 'translateY(-2px)' : 'translateY(0)',
              transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'pointer',
              color: '#5A1E7E',
              fontSize: '.9rem',
              fontWeight: 700,
              zIndex: 10,
            }}
            onFocus={(e) => { e.currentTarget.style.outline = '2px solid rgba(123, 63, 160, 0.5)'; e.currentTarget.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.currentTarget.style.outline = 'none'; e.currentTarget.style.outlineOffset = '0'; }}
          >
            <ArrowLeft size={18} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
            <span style={{ display: 'inline-block', verticalAlign: 'middle', lineHeight: '1' }}>Back</span>
          </button>

          <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 16px', borderRadius: '100px',
              background: 'rgba(220, 198, 255, 0.30)',
              border: '1px solid rgba(220, 198, 255, 0.55)',
              marginBottom: '24px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7B3FA0', boxShadow: '0 0 8px rgba(123,63,160,.6)' }} />
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#5A1E7E', letterSpacing: '.05em' }}>
                AFFILIATE PROGRAM
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: 'var(--font-editorial)',
              fontSize: 'clamp(2.8rem, 5vw, 4.2rem)', lineHeight: 1.06,
              color: '#2D004D', letterSpacing: '-0.02em',
              marginBottom: '28px', fontWeight: 400,
            }}>
              Become a Lumora{' '}
              <span style={{
                background: 'linear-gradient(135deg, #7B3FA0, #C084FC)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text', fontStyle: 'italic',
              }}>Affiliate</span>
            </h1>

            {/* Sub */}
            <p style={{
              fontSize: '1.1rem', color: '#6B4F7A', lineHeight: 1.75,
              maxWidth: '600px', margin: '0 auto 24px',
            }}>
              Promote world‑class digital products and earn competitive commissions — no inventory, no hassle, no limits on your earning potential.
            </p>

            {/* Supporting paragraph */}
            <p style={{
              fontSize: '.98rem', color: '#8B7A9E', lineHeight: 1.75,
              maxWidth: '540px', margin: '0 auto 24px',
            }}>
              Whether you're a creator, marketer, or educator, Lumora gives you the tools and resources to grow your income with confidence.
            </p>

            {/* Trust statement */}
            <p style={{
              fontSize: '.8rem', color: '#A89BB5', fontWeight: 600,
              letterSpacing: '.02em',
            }}>
              ✔ Trusted by creators worldwide
            </p>
          </div>
        </section>

        {/* ═══════════ 2. WHY JOIN ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{ fontSize: '.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Why Join
              </p>
              <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#2D004D' }}>
                Built for Affiliates
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              {whyItems.map((item, i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={glassCardStyle({ padding: '28px 22px', textAlign: 'center', cursor: 'default' })}
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
                    margin: '0 auto 16px', color: '#5A1E7E',
                  }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontSize: '.98rem', fontWeight: 700, color: '#2D004D', marginBottom: '8px' }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '.83rem', color: '#6B4F7A', lineHeight: 1.7 }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ 3. HOW IT WORKS ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)', background: 'rgba(220, 198, 255, 0.06)' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '52px' }}>
              <p style={{ fontSize: '.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Getting Started
              </p>
              <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#2D004D' }}>
                How It Works
              </h2>
            </div>

            {/* Timeline grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}
              className="how-it-works-grid"
            >
              {steps.map((step, i) => (
                <div key={i} style={{ textAlign: 'center', position: 'relative' }}>
                  {/* Step circle */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                    color: '#fff', fontSize: '.75rem', fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 14px',
                    boxShadow: '0 4px 16px rgba(90, 30, 126, 0.25)',
                    position: 'relative', zIndex: 2,
                  }}>
                    {step.num}
                  </div>

                  {/* Connector (hidden on last) */}
                  {i < steps.length - 1 && (
                    <div className="timeline-connector" style={{
                      position: 'absolute', top: '20px',
                      left: 'calc(50% + 24px)', width: 'calc(100% - 48px)',
                      height: '2px',
                      background: 'linear-gradient(90deg, rgba(123,63,160,0.25), rgba(123,63,160,0.06))',
                      zIndex: 1,
                    }} />
                  )}

                  <h3 style={{ fontSize: '.88rem', fontWeight: 700, color: '#2D004D', marginBottom: '4px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: '.78rem', color: '#6B4F7A', lineHeight: 1.55 }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Mobile-friendly responsive override */}
            <style>{`
              @media (max-width: 640px) {
                .how-it-works-grid {
                  grid-template-columns: 1fr !important;
                  gap: 28px !important;
                  max-width: 280px;
                  margin: 0 auto;
                }
                .timeline-connector { display: none !important; }
              }
              @media (min-width: 641px) and (max-width: 768px) {
                .how-it-works-grid {
                  grid-template-columns: repeat(2, 1fr) !important;
                }
                .how-it-works-grid .timeline-connector:nth-child(n) { display: none !important; }
              }
            `}</style>
          </div>
        </section>

        {/* ═══════════ 4. FINAL CTA ═══════════ */}
        <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem) 100px' }}>
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            <div
              className="glass-card"
              style={glassCardStyle({
                textAlign: 'center', position: 'relative', overflow: 'hidden',
                padding: 'clamp(48px, 8vw, 76px) clamp(28px, 4vw, 52px)',
                borderRadius: '32px',
              })}
            >
              <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(220,198,255,.22) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-30%', right: '-10%', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,186,.18) 0%, transparent 65%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: '#2D004D', lineHeight: 1.1, marginBottom: '16px' }}>
                  Ready to Start Earning?
                </h2>
                <p style={{
                  fontSize: '1.02rem', color: '#6B4F7A', lineHeight: 1.65,
                  maxWidth: '440px', margin: '0 auto 32px',
                }}>
                  Join Lumora's affiliate network and start earning commissions by recommending products people love.
                </p>
                <button
                  className="btn-premium btn-premium-solid"
                  style={{ height: '48px', padding: '0 36px', fontSize: '.95rem', borderRadius: '14px', gap: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={handleCTA}
                >
                  Become an Affiliate <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
