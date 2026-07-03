import React from 'react';

export default function Loader({ size = 32, color = '#7B3FA0', text = '' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
      <div style={{
        width: `${size}px`, height: `${size}px`,
        borderRadius: '50%',
        border: `3px solid rgba(196,181,253,0.2)`,
        borderTop: `3px solid ${color}`,
        animation: 'spin 0.8s linear infinite',
      }} />
      {text && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{text}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
