import React from 'react';
import { Star, ShoppingBag, Heart } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ProductImage from './ProductImage';

export default function ProductCard({ product }) {
  const { addToCart, buyNow, navigateTo, formatPrice, wishlist, toggleWishlist, ownedProducts, cart } = useApp();
  const isWishlisted = wishlist.some(w => w.id === product.id);
  const isOwned = ownedProducts.some(id => String(id) === String(product.id));
  const inCart = cart.some(item => String(item.id) === String(product.id));

  return (
    <div
      className="glass-card"
      onClick={() => navigateTo('product-detail', product.id)}
      style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', border: '1px solid rgba(196,181,253,0.22)', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(45,0,96,0.15)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-premium)'; }}
    >
      <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
        <ProductImage product={product} style={{ objectFit: 'cover' }} />
        {product.badge && (
          <span style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '0.6rem', background: 'rgba(45,0,77,0.70)', color: 'var(--color-lavender)', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}>{product.badge}</span>
        )}
        <button onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
          style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isWishlisted ? '#E11D48' : 'var(--text-muted)' }}>
          <Heart size={13} fill={isWishlisted ? '#E11D48' : 'none'} />
        </button>
        {isOwned && <span style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '0.58rem', background: 'rgba(34,197,94,0.90)', color: '#fff', fontWeight: 800, padding: '3px 7px', borderRadius: '5px' }}>OWNED</span>}
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        <div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{product.category}</p>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
            <Star size={10} fill="var(--color-latte)" stroke="var(--color-latte)" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{product.rating}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({product.reviews})</span>
          </div>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(product.price)}</span>
            <button onClick={e => { e.stopPropagation(); addToCart(product); }} className="btn-premium" style={{ padding: '6px 11px', fontSize: '0.7rem', borderRadius: '7px' }}>
              <ShoppingBag size={11} /> {inCart ? '✓ Added' : 'Add'}
            </button>
          </div>
          <button onClick={e => { e.stopPropagation(); buyNow(product); }} className="btn-premium btn-premium-solid buy-now-glow" style={{ width: '100%', padding: '8px', fontSize: '0.75rem', borderRadius: '8px', justifyContent: 'center' }}>
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
