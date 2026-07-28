import React from 'react';

/**
 * Modern shimmer skeleton loader for loading states.
 * Replaces plain spinners with polished placeholder cards and rows.
 */
export default function SkeletonLoader({ type = 'card', count = 1, className = '', height, width }) {
  const items = Array.from({ length: count });

  if (type === 'product-card') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', width: '100%' }}>
        {items.map((_, i) => (
          <div
            key={i}
            className={`glass-card ${className}`}
            style={{
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              borderRadius: '22px',
              border: '1px solid rgba(255, 255, 255, 0.45)',
              background: 'rgba(255, 255, 255, 0.40)',
            }}
          >
            {/* Image Placeholder */}
            <div className="shimmer-skeleton" style={{ width: '100%', height: '180px', borderRadius: '16px' }} />

            {/* Category */}
            <div className="shimmer-skeleton" style={{ width: '40%', height: '14px', borderRadius: '6px' }} />

            {/* Title */}
            <div className="shimmer-skeleton" style={{ width: '85%', height: '20px', borderRadius: '6px' }} />

            {/* Footer Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
              <div className="shimmer-skeleton" style={{ width: '30%', height: '24px', borderRadius: '8px' }} />
              <div className="shimmer-skeleton" style={{ width: '35%', height: '36px', borderRadius: '12px' }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'stat-card') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', width: '100%' }}>
        {items.map((_, i) => (
          <div
            key={i}
            className={`glass-card ${className}`}
            style={{
              padding: '24px',
              borderRadius: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255, 255, 255, 0.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="shimmer-skeleton" style={{ width: '50%', height: '14px', borderRadius: '6px' }} />
              <div className="shimmer-skeleton" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
            </div>
            <div className="shimmer-skeleton" style={{ width: '70%', height: '32px', borderRadius: '8px' }} />
            <div className="shimmer-skeleton" style={{ width: '40%', height: '12px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table-row') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {items.map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.35)',
              border: '1px solid rgba(255, 255, 255, 0.40)',
            }}
          >
            <div className="shimmer-skeleton" style={{ width: '30%', height: '18px', borderRadius: '6px' }} />
            <div className="shimmer-skeleton" style={{ width: '20%', height: '18px', borderRadius: '6px' }} />
            <div className="shimmer-skeleton" style={{ width: '15%', height: '18px', borderRadius: '6px' }} />
            <div className="shimmer-skeleton" style={{ width: '10%', height: '28px', borderRadius: '8px' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {items.map((_, i) => (
        <div
          key={i}
          className={`shimmer-skeleton ${className}`}
          style={{
            width: width || '100%',
            height: height || '120px',
            borderRadius: '20px',
          }}
        />
      ))}
    </div>
  );
}
