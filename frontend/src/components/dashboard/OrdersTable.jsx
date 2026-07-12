import React from 'react';

export default function OrdersTable({ orders = [] }) {
  if (orders.length === 0) return <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', padding: '20px 0' }}>No orders yet.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(45,0,96,0.08)' }}>
            {['Order ID', 'Items', 'Total', 'Status', 'Date'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id} style={{ borderBottom: '1px solid rgba(45,0,96,0.04)' }}>
              <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-espresso)' }}>#{o.id.slice(-8).toUpperCase()}</td>
              <td style={{ padding: '12px', color: 'var(--color-mocha)' }}>{(o.items || []).length} item(s)</td>
              <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-espresso)' }}>₹{Math.round(o.total || 0).toLocaleString('en-IN')}</td>
              <td style={{ padding: '12px' }}><span style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', color: '#16a34a', fontWeight: 700 }}>{o.status}</span></td>
              <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
