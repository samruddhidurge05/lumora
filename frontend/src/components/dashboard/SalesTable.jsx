import React from 'react';

export default function SalesTable({ sales = [] }) {
  if (!sales.length) return <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No sales data.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(45,0,96,0.08)' }}>
            {['Product', 'Units', 'Revenue', 'Date'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(45,0,96,0.04)' }}>
              <td style={{ padding: '12px', fontWeight: 600, color: 'var(--color-espresso)' }}>{s.product}</td>
              <td style={{ padding: '12px', color: 'var(--color-mocha)' }}>{s.units}</td>
              <td style={{ padding: '12px', fontWeight: 700, color: '#7B3FA0' }}>₹{s.revenue?.toLocaleString()}</td>
              <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{s.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
