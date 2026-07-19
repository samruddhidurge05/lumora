import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function PolicyBanner({ message, style = {} }) {
  return (
    <div
      style={{
        padding: '12px 18px',
        borderRadius: '12px',
        background: 'rgba(123, 63, 160, 0.05)',
        border: '1px solid rgba(196, 181, 253, 0.28)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
        ...style,
      }}
    >
      <ShieldCheck size={18} style={{ color: '#7B3FA0', flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: '0.83rem', color: '#4A2E65', fontWeight: 500, lineHeight: 1.45 }}>
        {message || 'Digital products remain available according to your purchase history and applicable platform policies.'}
      </p>
    </div>
  );
}
