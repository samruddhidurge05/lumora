import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AnalyticsChart({ data, title = 'Analytics', color = '#7B3FA0' }) {
  const values = data?.length ? data : [800,1200,1600,900,2100,1800,2800,2400,3200,2900,3800,4500];
  const max = Math.max(...values);
  return (
    <div className="glass-card" style={{ padding: '24px 28px' }}>
      <h3 className="text-editorial" style={{ fontSize: '1.3rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '20px' }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '120px' }}>
        {values.map((val, i) => {
          const pct = (val / max) * 100;
          const isLast = i === values.length - 1;
          return (
            <div key={i} title={`${MONTHS[i]}: ${val}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${pct}%`, borderRadius: '5px 5px 2px 2px', background: isLast ? `linear-gradient(180deg,${color},${color}CC)` : 'rgba(196,181,253,0.40)', minHeight: '3px', transition: 'all 0.3s' }} />
              <span style={{ fontSize: '0.48rem', fontWeight: 600, color: isLast ? color : 'var(--text-muted)' }}>{MONTHS[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
