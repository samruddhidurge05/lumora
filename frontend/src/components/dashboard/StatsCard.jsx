import React from 'react';

export default function StatsCard({ label, value, icon, sub, color = '#7B3FA0' }) {
  return (
    <div className="premium-flat-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '6px', lineHeight: 1 }}>{value}</div>
        {sub && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: '5px' }}>{sub}</span>}
      </div>
      {icon && (
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.06)', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      )}
    </div>
  );
}
