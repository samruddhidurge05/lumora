import React from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function WishlistCard({ product }) {
  const { addToCart, toggleWishlist, navigateTo, formatPrice } = useApp();
  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(196,181,253,0.22)' }}>
      <div style={{ height: '160px', overflow: 'hidden', position: 'relative', cursor: 'pointer' }} onClick={() => navigateTo('product-detail', product.id)}>
        <img src={product.preview} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <button onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
          style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E11D48' }}>
          <Heart size={12} fill="#E11D48" />
        </button>
      </div>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(product.price)}</span>
          <button onClick={() => addToCart(product)} className="btn-premium" style={{ padding: '6px 11px', fontSize: '0.7rem', borderRadius: '7px' }}>
            <ShoppingBag size={11} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}
