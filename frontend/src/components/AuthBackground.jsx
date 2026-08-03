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
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(184,134,208,0.30)',
          color: '#4A1570',
          fontSize: '0.78rem',
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s',
          boxShadow: '0 4px 16px rgba(45,0,77,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
          e.currentTarget.style.borderColor = 'rgba(184,134,208,0.55)';
          e.currentTarget.style.color = '#2D004D';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.75)';
          e.currentTarget.style.borderColor = 'rgba(184,134,208,0.30)';
          e.currentTarget.style.color = '#4A1570';
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
