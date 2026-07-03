import React from 'react';

export default function Input({ label, type = 'text', value, onChange, placeholder, required, name, error, style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </label>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          padding: '11px 16px',
          borderRadius: '12px',
          border: `1px solid ${error ? 'rgba(220,38,38,0.4)' : 'rgba(196,181,253,0.30)'}`,
          background: 'rgba(255,255,255,0.68)',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          color: 'var(--color-espresso)',
          outline: 'none',
          width: '100%',
          ...style,
        }}
      />
      {error && <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>{error}</span>}
    </div>
  );
}
