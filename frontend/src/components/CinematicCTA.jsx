import React, { useState } from 'react';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CinematicCTA() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);

    // Luxury explosion of pastel confetti
    confetti({
      particleCount: 180,
      spread: 80,
      colors: ['#D8BFE3', '#B886D0', '#7B3FA0', '#5A1E7E'],
      origin: { y: 0.7 }
    });
  };

  // Magnetic Button Effect
  const handleMouseMove = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.25}px, 0)`;
  };

  const handleMouseLeave = (e) => {
    const btn = e.currentTarget;
    btn.style.transform = 'translate3d(0px, 0px, 0)';
  };

  return (
    <section 
      id="cta"
      className="section-padding"
      style={{
        position: 'relative',
        zIndex: 10,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minHeight: '70vh'
      }}
    >
      {/* Intense Radial Glow Background for Cinematic Lighting */}
      <div 
        className="ambient-glow pulse-ambient" 
        style={{
          background: 'radial-gradient(circle, var(--color-lilac-glow) 0%, var(--color-peach) 50%, transparent 100%)',
          width: '700px',
          height: '600px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          opacity: 0.25,
          filter: 'blur(100px)',
        }}
      />

      <div className="container-wide" style={{ position: 'relative', zIndex: 1 }}>
        {/* Subtle Decorative Star */}
        <div style={{ display: 'inline-block', filter: 'drop-shadow(0 0 10px var(--color-lilac-glow))', marginBottom: '24px' }}>
          <Sparkles size={28} style={{ color: 'var(--color-espresso)' }} />
        </div>

        {/* Large Editorial Headline */}
        <h2 
          className="text-editorial title-medium" 
          style={{ 
            fontWeight: 400, 
            color: 'var(--color-espresso)',
            maxWidth: '850px',
            margin: '0 auto 32px auto',
            lineHeight: 1.15
          }}
        >
          Elevate Your Digital Craft. <br />
          <span style={{ fontStyle: 'italic', color: 'var(--color-mocha)', fontWeight: 300 }}>
            Join the Lumora Creator Guild.
          </span>
        </h2>

        {/* Copy */}
        <p
          className="text-sans"
          style={{
            fontSize: '1.1rem',
            color: 'var(--color-mocha)',
            maxWidth: '520px',
            margin: '0 auto 48px auto',
            lineHeight: 1.6,
            fontWeight: 500
          }}
        >
          Receive premium assets directly to your inbox, or request a seat to sell your curated artifacts to creators globally.
        </p>

        {/* Subscriber/Sign-up Form */}
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          {!subscribed ? (
            <form 
              onSubmit={handleSubmit}
              className="glass-surface"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                borderRadius: '50px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 20px 40px -15px rgba(45,0,77,0.35)',
                border: '1px solid rgba(216,191,227,0.20)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px', flex: 1 }}>
                <Mail size={16} style={{ color: 'var(--color-mocha)' }} />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-sans"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.9rem',
                    color: 'var(--color-espresso)',
                    width: '100%',
                    fontWeight: 500
                  }}
                />
              </div>
              <button
                type="submit"
                className="btn-premium btn-premium-solid clickable"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  padding: '12px 28px',
                  fontSize: '0.85rem',
                  border: 'none'
                }}
              >
                Join Access
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            <div 
              className="glass-card flex-center"
              style={{
                padding: '24px 48px',
                borderRadius: '30px',
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--color-espresso)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 15px 30px rgba(0,0,0,0.02)'
              }}
            >
              <span>✨ Welcome to the Guild. Verification Sent!</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
