import React, { useState } from 'react';
import { Star, Send } from 'lucide-react';

export default function ReviewForm({ onSubmit }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit && onSubmit({ rating, comment });
    setComment('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Rating</label>
        <div style={{ display: 'flex', gap: '4px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} type="button"
              onClick={() => setRating(i + 1)}
              onMouseEnter={() => setHover(i + 1)}
              onMouseLeave={() => setHover(0)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
              <Star size={22} fill={(hover || rating) > i ? 'var(--color-latte)' : 'none'} stroke="var(--color-latte)" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your Review</label>
        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} required placeholder="Share your experience…"
          style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.3)', background: '#fff', fontSize: '0.83rem', fontFamily: 'var(--font-sans)', color: 'var(--color-espresso)', outline: 'none', width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
      </div>
      <button type="submit" className="btn-premium btn-premium-solid" style={{ alignSelf: 'flex-start', padding: '10px 22px', borderRadius: '10px', fontSize: '0.82rem' }}>
        <Send size={13} /> Submit Review
      </button>
    </form>
  );
}
