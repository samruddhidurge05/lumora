import React from 'react';
import { useApp } from '../../context/AppContext';

export default function Footer() {
  const { navigateTo } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer style={{
      position: 'relative', zIndex: 10,
      background: 'rgba(255,255,255,0.25)',
      backdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      WebkitBackdropFilter: 'blur(36px) saturate(200%) brightness(1.04)',
      borderTop: '1px solid rgba(255,255,255,0.40)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), 0 -4px 20px rgba(90,30,126,0.06)',
      padding: '48px clamp(1.5rem,5vw,6rem) 32px',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: '40px', marginBottom: '40px' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '0.8rem' }}>L</span>
              <span className="text-editorial" style={{ fontSize: '1.2rem', fontWeight: 500, color: '#3b0764' }}>Lumora</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '200px' }}>
              Premium digital marketplace for creators and builders.
            </p>
          </div>

          {/* Marketplace */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Marketplace</h4>
            {['marketplace', 'search', 'categories'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'none', padding: '4px 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '4px' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Company</h4>
            {['about', 'contact'].map(v => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'none', padding: '4px 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textAlign: 'left', textTransform: 'capitalize', marginBottom: '4px' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Account */}
          <div>
            <h4 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>Account</h4>
            {[['login-selection', 'Sign In'], ['register-selection', 'Sign Up'], ['dashboard', 'Dashboard']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ display: 'block', background: 'none', border: 'none', cursor: 'none', padding: '4px 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', textAlign: 'left', marginBottom: '4px' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(196,181,253,0.16)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>© {year} Lumora. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[['privacy', 'Privacy'], ['terms', 'Terms']].map(([v, label]) => (
              <button key={v} onClick={() => navigateTo(v)}
                style={{ background: 'none', border: 'none', cursor: 'none', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
