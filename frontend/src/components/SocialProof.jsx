import React from 'react';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    text: "Lumora is exactly what the design industry was missing. The standards here are breathtakingly high.",
    author: "Marcello Rossi",
    role: "Design Lead, Aether Studio",
    avatar: "MR"
  },
  {
    text: "I consolidated all my branding products into Lumora, and my sales doubled in three weeks. The interface is magic.",
    author: "Elena Petrova",
    role: "Independent Typographer",
    avatar: "EP"
  },
  {
    text: "The React code templates are flawless. No clutter, pure utility, and beautiful structure. Highly recommend.",
    author: "Devon Harris",
    role: "Senior Frontend Engineer",
    avatar: "DH"
  },
  {
    text: "An absolute masterclass in marketplace design. The transaction experience is incredibly premium.",
    author: "Julienne Dupont",
    role: "Creative Director, Vague Agency",
    avatar: "JD"
  }
];

const collaborativeBrands = [
  "AETHER", "KRYPTON", "APEX DESIGN", "NOVA LABS", "VERTEX CO.", "SOLACE"
];

export default function SocialProof() {
  return (
    <section 
      id="testimonials" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="container-wide">
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="caption-premium" style={{ marginBottom: '12px' }}>GLOBAL CONCENSUS</div>
          <h2 className="text-editorial title-medium" style={{ fontWeight: 400 }}>Approved by Industry Leaders</h2>
        </div>

        {/* Brand Collaborations Row */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '40px',
            marginBottom: '80px',
            borderBottom: '1px solid rgba(45,0,77,0.35)',
            paddingBottom: '48px',
            opacity: 0.65
          }}
        >
          {collaborativeBrands.map((brand, i) => (
            <div 
              key={i} 
              className="text-sans"
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                letterSpacing: '0.25em',
                color: 'var(--color-mocha)',
                fontStyle: 'italic'
              }}
            >
              {brand}
            </div>
          ))}
        </div>

        {/* Auto-scrolling Review Marquee (Continuous Loop) */}
        <div 
          className="marquee-container"
          style={{
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            padding: '20px 0'
          }}
        >
          {/* Left/Right blur fade gradients to smooth out the edges of the marquee */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '100px',
              background: 'linear-gradient(to right, var(--color-warm-white) 20%, transparent 100%)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '100px',
              background: 'linear-gradient(to left, var(--color-warm-white) 20%, transparent 100%)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />

          {/* Marquee Track */}
          <div 
            className="marquee-track"
            style={{
              display: 'flex',
              gap: '24px',
              width: 'max-content',
              animation: 'marquee 30s linear infinite'
            }}
          >
            {/* Double the list to create a seamless infinite scrolling illusion */}
            {[...testimonials, ...testimonials].map((test, index) => (
              <div
                key={index}
                className="glass-card"
                style={{
                  width: '380px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '220px',
                  boxShadow: '0 15px 30px rgba(45,0,77,0.30)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} fill="currentColor" style={{ color: 'var(--color-latte)' }} />
                    ))}
                  </div>
                  <Quote size={16} style={{ color: 'var(--color-mocha)', opacity: 0.3 }} />
                </div>

                <p 
                  className="text-sans" 
                  style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--color-espresso)', 
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                    marginBottom: '20px'
                  }}
                >
                  "{test.text}"
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div 
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--purple-300), var(--purple-500))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: 'var(--color-espresso)',
                      fontWeight: 700
                    }}
                  >
                    {test.avatar}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{test.author}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-mocha)', fontWeight: 500 }}>{test.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
