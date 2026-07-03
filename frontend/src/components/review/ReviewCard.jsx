import React from 'react';
import { Star } from 'lucide-react';

export default function ReviewCard({ review }) {
  return (
    <div className="premium-flat-card" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }}>
            {(review.user || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{review.user}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>{review.date}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill={i < Math.round(review.rating) ? 'var(--color-latte)' : 'none'} stroke="var(--color-latte)" />)}
        </div>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-mocha)', lineHeight: 1.55, fontWeight: 500 }}>"{review.comment}"</p>
    </div>
  );
}
