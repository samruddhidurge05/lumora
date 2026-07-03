import React from 'react';
import { useApp } from '../../context/AppContext';

export default function NotFound() {
  const { navigateTo } = useApp();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px', position: 'relative', zIndex: 10 }}>
      <span className="text-editorial" style={{ fontSize: '8rem', fontWeight: 400, color: 'rgba(123,63,160,0.15)', lineHeight: 1 }}>404</span>
      <h1 className="text-editorial" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '-16px' }}>Page Not Found</h1>
      <p style={{ color: 'var(--color-mocha)', marginTop: '12px', fontSize: '0.95rem' }}>The page you're looking for doesn't exist.</p>
      <button onClick={() => navigateTo('landing')} className="btn-premium btn-premium-solid" style={{ marginTop: '28px', padding: '12px 28px', fontSize: '0.9rem', borderRadius: '12px' }}>
        Go Home
      </button>
    </div>
  );
}
