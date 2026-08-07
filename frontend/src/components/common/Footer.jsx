import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Footer() {
  const { navigateTo } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer style={{
      position: 'relative', zIndex: 10,
      background: 'rgba(255, 255, 255, 0.75)',
      backdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      WebkitBackdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      borderTop: '1.5px solid rgba(123, 63, 160, 0.35)',
      boxShadow: '0 -8px 32px rgba(123, 63, 160, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.90)',
      padding: '48px clamp(1.5rem,5vw,6rem) 32px',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '40px', marginBottom: '40px' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(123,63,160,0.30)' }}>L</span>
              <span className="text-editorial" style={{ fontSize: '1.35rem', fontWeight: 600, color: '#2D004D' }}>Lumora</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '220px' }}>
              Premium digital marketplace for creators and builders.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Marketplace</h4>
            {['marketplace', 'search', 'categories'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: '0.84rem', color: '#4A2B68', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '2px', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4A2B68'; }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Company</h4>
            {['about', 'contact'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: '0.84rem', color: '#4A2B68', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '2px', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4A2B68'; }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Account */}
          <div>
            <h4 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Account</h4>
            {[['login-selection', 'Sign In'], ['register-selection', 'Sign Up'], ['dashboard', 'Dashboard']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 0', fontSize: '0.84rem', color: '#4A2B68', fontFamily: 'var(--font-sans)', textAlign: 'left', marginBottom: '2px', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4A2B68'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1.5px solid rgba(123, 63, 160, 0.20)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>© {year} Lumora. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[['privacy', 'Privacy Policy'], ['terms', 'Terms of Service']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', color: '#4A2B68', fontFamily: 'var(--font-sans)', fontWeight: 500, transition: 'color 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#4A2B68'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
