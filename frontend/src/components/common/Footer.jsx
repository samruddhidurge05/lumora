import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Footer() {
  const { navigateTo } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer style={{
      position: 'relative', zIndex: 10,
      background: 'rgba(13, 5, 24, 0.65)',
      backdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      WebkitBackdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      borderTop: '1px solid rgba(255,255,255,0.30)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.40), 0 -4px 20px rgba(0,0,0,0.35)',
      padding: '48px clamp(1.5rem,5vw,6rem) 32px',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '40px', marginBottom: '40px' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#9333EA,#6B21A8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.8rem', boxShadow: '0 0 12px rgba(147,51,234,0.5)' }}>L</span>
              <span className="text-editorial" style={{ fontSize: '1.2rem', fontWeight: 500, color: '#FFFFFF', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Lumora</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#FFFFFF', lineHeight: 1.6, maxWidth: '200px', opacity: 0.9 }}>
              Premium digital marketplace for creators and builders.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#D8B4FE', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px', textShadow: '0 0 10px rgba(192,132,252,0.5)' }}>Marketplace</h4>
            {['marketplace', 'search', 'categories'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: '0.82rem', color: '#FFFFFF', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '4px', opacity: 0.9 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#D8B4FE'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.color = '#FFFFFF'; }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#D8B4FE', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px', textShadow: '0 0 10px rgba(192,132,252,0.5)' }}>Company</h4>
            {['about', 'contact'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: '0.82rem', color: '#FFFFFF', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '4px', opacity: 0.9 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#D8B4FE'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.color = '#FFFFFF'; }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Account */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: '#D8B4FE', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px', textShadow: '0 0 10px rgba(192,132,252,0.5)' }}>Account</h4>
            {[['login-selection', 'Sign In'], ['register-selection', 'Sign Up'], ['dashboard', 'Dashboard']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: '0.82rem', color: '#FFFFFF', fontFamily: 'var(--font-sans)', textAlign: 'left', marginBottom: '4px', opacity: 0.9 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#D8B4FE'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.color = '#FFFFFF'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.20)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '0.75rem', color: '#FFFFFF', opacity: 0.85 }}>© {year} Lumora. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[['privacy', 'Privacy'], ['terms', 'Terms']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#FFFFFF', fontFamily: 'var(--font-sans)', opacity: 0.85 }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#D8B4FE'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.color = '#FFFFFF'; }}
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
