import React from 'react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function RevenueChart({ data = [] }) {
  const values = data.length ? data : [1200,1800,2400,980,3100,2760,4200,3600,5100,4800,6200,7500];
  const max = Math.max(...values);
  return (
    <div style={{ padding: '24px' }}>
      <h3 className="text-editorial" style={{ fontSize: '1.3rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '20px' }}>Revenue Overview</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
        {values.map((val, i) => {
          const pct = (val / max) * 100;
          const isLast = i === values.length - 1;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', height: `${pct}%`, borderRadius: '5px 5px 2px 2px', background: isLast ? 'linear-gradient(180deg,#7B3FA0,#5A1E7E)' : 'rgba(196,181,253,0.45)', minHeight: '3px', transition: 'all 0.3s' }} />
              <span style={{ fontSize: '0.5rem', fontWeight: 600, color: isLast ? '#7B3FA0' : 'var(--text-muted)' }}>{MONTHS[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
