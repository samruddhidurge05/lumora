import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, UserPlus, ExternalLink, TrendingUp } from 'lucide-react';

const creators = [
  {
    name: "Sophia Vance",
    role: "3D Visual Artist",
    earnings: "₹1,14,24,000",
    sales: "2,350 sales",
    rating: "4.9 ★",
    accent: "var(--color-lavender)",
    initials: "SV",
    recentAsset: "Aether 3D Shapes Pack",
    gradient: "linear-gradient(135deg, var(--color-warm-white) 0%, var(--color-rose) 100%)"
  },
  {
    name: "Liam Sterling",
    role: "System Architect",
    earnings: "c. ₹2,48,32,000",
    sales: "4,120 sales",
    rating: "5.0 ★",
    accent: "var(--purple-300)",
    initials: "LS",
    recentAsset: "Quantum UI Design System",
    gradient: "linear-gradient(135deg, var(--purple-100) 0%, var(--purple-300) 100%)"
  },
  {
    name: "Evelyn Moreau",
    role: "Editorial Strategist",
    earnings: "₹75,36,000",
    sales: "1,410 sales",
    rating: "4.8 ★",
    accent: "var(--color-peach)",
    initials: "EM",
    recentAsset: "Bespoke Branding Kit",
    gradient: "linear-gradient(135deg, var(--color-warm-white) 0%, var(--color-vanilla-cream) 100%)"
  },
  {
    name: "Kenji Takahashi",
    role: "SwiftUI Engineer",
    earnings: "₹1,56,48,000",
    sales: "3,110 sales",
    rating: "4.9 ★",
    accent: "var(--color-mint)",
    initials: "KT",
    recentAsset: "Lumen iOS Boilerplate",
    gradient: "linear-gradient(135deg, var(--color-warm-white) 0%, var(--color-mint-glow) 100%)"
  }
];

export default function CreatorShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % creators.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + creators.length) % creators.length);
  };

  return (
    <section 
      id="creators" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="container-wide">
        {/* Section Header */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '72px',
            flexWrap: 'wrap',
            gap: '24px'
          }}
        >
          <div>
            <div className="caption-premium" style={{ marginBottom: '12px' }}>CREATOR NETWORK</div>
            <h2 className="text-editorial title-medium" style={{ fontWeight: 400 }}>Elite Guild of Authors</h2>
          </div>

          {/* Slider Controls */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={handlePrev}
              className="glass-surface clickable"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid rgba(216,191,227,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-espresso)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-espresso)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(216,191,227,0.20)'}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="glass-surface clickable"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                border: '1px solid rgba(216,191,227,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-espresso)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-espresso)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(216,191,227,0.20)'}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Creator Showcase Panel */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: '0.9fr 1.1fr',
            gap: '64px',
            alignItems: 'center'
          }}
          className="creator-grid"
        >
          {/* Left Panel: Creator Profile Info */}
          <div
            className="glass-card"
            style={{
              padding: '48px',
              minHeight: '440px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 25px 50px -12px rgba(45,0,77,0.35)'
            }}
          >
            <div>
              {/* Creator Main Identity */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                <div 
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: creators[activeIndex].gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    color: 'var(--color-espresso)',
                    fontWeight: 600,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                    border: '2px solid white'
                  }}
                >
                  {creators[activeIndex].initials}
                </div>
                <div>
                  <h3 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 500, color: 'var(--color-espresso)' }}>
                    {creators[activeIndex].name}
                  </h3>
                  <p className="text-sans" style={{ fontSize: '0.85rem', color: 'var(--color-mocha)', fontWeight: 600 }}>
                    {creators[activeIndex].role}
                  </p>
                </div>
              </div>

              {/* Creator Performance Metrics */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '24px', 
                  marginBottom: '40px',
                  borderTop: '1px solid rgba(45,0,77,0.35)',
                  paddingTop: '24px'
                }}
              >
                <div>
                  <div className="text-sans" style={{ fontSize: '0.75rem', color: 'var(--color-mocha)', fontWeight: 600, letterSpacing: '0.05em' }}>LUMORA INCOME</div>
                  <div className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 500, color: 'var(--color-espresso)', marginTop: '4px' }}>
                    {creators[activeIndex].earnings}
                  </div>
                </div>
                <div>
                  <div className="text-sans" style={{ fontSize: '0.75rem', color: 'var(--color-mocha)', fontWeight: 600, letterSpacing: '0.05em' }}>SATISFACTION RATING</div>
                  <div className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 500, color: 'var(--color-espresso)', marginTop: '4px' }}>
                    {creators[activeIndex].rating}
                  </div>
                </div>
              </div>
            </div>

            {/* Interaction Row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button 
                className="btn-premium btn-premium-solid"
                style={{ padding: '14px 28px', fontSize: '0.85rem' }}
              >
                <UserPlus size={14} />
                Follow Creator
              </button>
              <button 
                className="btn-premium"
                style={{ padding: '14px 28px', fontSize: '0.85rem' }}
              >
                View Profile
                <ExternalLink size={14} />
              </button>
            </div>
          </div>

          {/* Right Panel: Creator Catalog Graphic Mockup */}
          <div 
            style={{ 
              position: 'relative',
              height: '440px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {/* Background design system representing creator's aesthetic */}
            <div 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '30px',
                background: creators[activeIndex].gradient,
                boxShadow: '0 30px 60px -20px rgba(216,191,227,0.15)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '40px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'background 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Overlay graphic texture */}
              <div 
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.1,
                  backgroundSize: '30px 30px',
                  backgroundImage: 'radial-gradient(var(--color-espresso) 1px, transparent 1px)'
                }}
              />

              {/* Header inside graphic mockup */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', zIndex: 1 }}>
                <span className="caption-premium" style={{ color: 'var(--color-espresso)', background: 'rgba(255,255,255,0.4)', padding: '6px 16px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.3)' }}>
                  LATEST RELEASE
                </span>
                <span className="text-sans" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-espresso)' }}>
                  <TrendingUp size={14} />
                  Trending #{activeIndex + 1}
                </span>
              </div>

              {/* Graphic Mockup Central Asset Window */}
              <div 
                className="glass-surface"
                style={{
                  padding: '24px 32px',
                  borderRadius: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 20px 40px rgba(45,0,77,0.35)',
                  zIndex: 1,
                  border: '1px solid rgba(216,191,227,0.18)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--color-mocha)', fontWeight: 700, letterSpacing: '0.05em' }}>FEATURED PRODUCT</div>
                <div className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 500, color: 'var(--color-espresso)' }}>
                  {creators[activeIndex].recentAsset}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', padding: '4px 12px', borderRadius: '20px', background: creators[activeIndex].accent, color: 'var(--color-espresso)', fontWeight: 700 }}>
                    Asset Approved
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-mocha)', fontWeight: 600 }}>
                    {creators[activeIndex].sales}
                  </span>
                </div>
              </div>

              {/* Small details inside mockup */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-mocha)', fontWeight: 600, zIndex: 1 }}>
                <span>METADATA: CRYPTO ENCRYPTED</span>
                <span>AUTHENTICITY GUARANTEED ✧</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 768px) {
          .creator-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}
