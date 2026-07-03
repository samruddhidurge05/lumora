import React from 'react';
import { useApp } from '../../context/AppContext';
import { Zap, ShoppingBag, Star } from 'lucide-react';

export default function ProductDetails({ product }) {
  const { addToCart, buyNow, formatPrice, wishlist, toggleWishlist } = useApp();
  if (!product) return null;
  const isWishlisted = wishlist.some(w => w.id === product.id);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{product.category}</span>
        <h2 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px' }}>{product.title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
          {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill={i < Math.round(product.rating) ? 'var(--color-latte)' : 'none'} stroke="var(--color-latte)" />)}
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{product.rating}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({product.reviews})</span>
        </div>
      </div>
      <p style={{ fontSize: '0.88rem', color: 'var(--color-mocha)', lineHeight: 1.65 }}>{product.description}</p>
      <div className="text-editorial" style={{ fontSize: '2.4rem', fontWeight: 400, color: 'var(--color-espresso)' }}>{formatPrice(product.price)}</div>
      <button onClick={() => buyNow(product)} className="btn-premium btn-premium-solid buy-now-glow" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.9rem', borderRadius: '12px' }}>
        <Zap size={16} /> Buy Now
      </button>
      <button onClick={() => addToCart(product)} className="btn-premium" style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '0.85rem', borderRadius: '12px' }}>
        <ShoppingBag size={15} /> Add to Cart
      </button>
    </div>
  );
}
