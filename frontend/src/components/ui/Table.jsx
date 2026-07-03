import React from 'react';

export default function Table({ columns = [], data = [], emptyMessage = 'No data found.' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'var(--font-sans)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(45,0,96,0.08)' }}>
            {columns.map((col, i) => (
              <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid rgba(45,0,96,0.04)' }}>
                {columns.map((col, ci) => (
                  <td key={ci} style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
