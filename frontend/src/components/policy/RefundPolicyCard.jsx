import React from 'react';
import { Info } from 'lucide-react';
import PolicyLink from './PolicyLink';

export default function RefundPolicyCard({ onOpenPolicy, style = {} }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(123, 63, 160, 0.04), rgba(196, 181, 253, 0.08))',
        border: '1px solid rgba(196, 181, 253, 0.35)',
        marginTop: '14px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5A1E7E' }}>
        <Info size={16} style={{ color: '#7B3FA0', shrink: 0 }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Digital Product Notice
        </span>
      </div>
      <p style={{ fontSize: '0.79rem', color: '#524B6B', margin: 0, lineHeight: 1.5, fontWeight: 450 }}>
        Digital products are delivered electronically and cannot be physically returned after delivery or download.
      </p>
      {onOpenPolicy && (
        <div style={{ marginTop: '2px' }}>
          <PolicyLink onClick={onOpenPolicy} label="Read Refund Policy" />
        </div>
      )}
    </div>
  );
}
