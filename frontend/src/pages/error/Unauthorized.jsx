import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Unauthorized() {
  const { navigateTo } = useApp();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px', position: 'relative', zIndex: 10 }}>
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', marginBottom: '20px' }}>
        <ShieldAlert size={36} />
      </div>
      <h1 className="text-editorial" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--color-espresso)' }}>Access Denied</h1>
      <p style={{ color: 'var(--color-mocha)', marginTop: '12px', fontSize: '0.95rem' }}>You don't have permission to view this page.</p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
        <button onClick={() => navigateTo('login-selection')} className="btn-premium btn-premium-solid" style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '12px' }}>Sign In</button>
        <button onClick={() => navigateTo('landing')} className="btn-premium" style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '12px' }}>Go Home</button>
      </div>
    </div>
  );
}
