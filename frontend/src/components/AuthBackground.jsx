import React from 'react';
import './AuthBackground.css';
import { useApp } from '../context/AppContext';

export default function AuthBackground({ children }) {
  const { navigateTo } = useApp();

  return (
    <div className="auth-bg-wrapper">
      {/* ── Back to Home button — top-left corner ── */}
      <button
        onClick={() => navigateTo('landing')}
        style={{
          position: 'fixed',
          top: '20px',
          left: '24px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 16px',
          borderRadius: '30px',
          background: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.28)',
          color: 'rgba(255,255,255,0.90)',
          fontSize: '0.78rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'none',
          outline: 'none',
          transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
          boxShadow: '0 2px 12px rgba(45,0,77,0.18)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.22)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        {/* Arrow icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Home
      </button>

      <div className="auth-bg-content">{children}</div>
    </div>
  );
}
