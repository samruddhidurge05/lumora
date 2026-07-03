import React from 'react';

export default function Button({ children, variant = 'default', size = 'md', onClick, disabled, className = '', style = {}, type = 'button' }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    borderRadius: '12px', fontFamily: 'var(--font-sans)', fontWeight: 700,
    cursor: 'none', outline: 'none', border: 'none', transition: 'all 0.22s',
  };
  const sizes = {
    sm: { padding: '6px 14px', fontSize: '0.74rem' },
    md: { padding: '10px 20px', fontSize: '0.82rem' },
    lg: { padding: '14px 28px', fontSize: '0.95rem' },
  };
  const variants = {
    default: { background: 'rgba(255,255,255,0.72)', border: '1.5px solid rgba(196,181,253,0.35)', color: 'var(--text-primary)' },
    primary: { background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', boxShadow: '0 4px 16px rgba(90,30,126,0.35)' },
    ghost:   { background: 'transparent', color: 'var(--text-muted)' },
    danger:  { background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style, opacity: disabled ? 0.5 : 1 }}
      className={className}
    >
      {children}
    </button>
  );
}
