import React, { useState } from 'react';
import { Star, ShoppingBag, Heart, Share2, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ProductImage from './ProductImage';

export default function ProductCard({ product }) {
  const { addToCart, buyNow, navigateTo, formatPrice, wishlist, toggleWishlist, ownedProducts, cart } = useApp();
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const isWishlisted = wishlist.some(w => w.id === product.id);
  const isOwned = ownedProducts.some(id => String(id) === String(product.id));
  const inCart = cart.some(item => String(item.id) === String(product.id));

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#product/${product.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const productUrl = `/#product/${product.id}`;

  return (
    <a
      href={productUrl}
      className="glass-card hover-lift"
      onClick={(e) => {
        // Allow ctrl+click or middle-click or right-click to use browser native behavior
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          navigateTo('product-detail', product.id);
        }
      }}
      style={{
        padding: 0,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        border: isHovered ? '1.5px solid rgba(123, 63, 160, 0.65)' : '1.5px solid rgba(123, 63, 160, 0.38)',
        background: 'rgba(255, 255, 255, 0.55)',
        boxShadow: isHovered
          ? '0 20px 48px rgba(90, 30, 126, 0.16), 0 4px 12px rgba(90, 30, 126, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.90)'
          : '0 8px 32px rgba(90, 30, 126, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.70)',
        transform: isHovered ? 'translateY(-6px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container with Zoom & Slide-up Quick Actions */}
      <div className="pcard-img" style={{ position: 'relative', height: '195px', overflow: 'hidden' }}>
        <div style={{
          width: '100%',
          height: '100%',
          transform: isHovered ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <ProductImage product={product} isHovered={isHovered} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
        </div>

        {/* Badge */}
        {product.badge && (
          <span style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            fontSize: '0.6rem',
            background: 'rgba(45, 0, 77, 0.78)',
            backdropFilter: 'blur(8px)',
            color: 'var(--color-lavender)',
            fontWeight: 800,
            padding: '4px 9px',
            borderRadius: '8px',
            letterSpacing: '0.04em',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            {product.badge}
          </span>
        )}

        {/* Owned Badge */}
        {isOwned && (
          <span style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            fontSize: '0.58rem',
            background: 'rgba(34, 197, 94, 0.92)',
            color: '#fff',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.25)',
          }}>
            OWNED
          </span>
        )}

        {/* Top Right Quick Actions (Wishlist & Share) */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 5,
        }}>
          <button
            onClick={e => { e.stopPropagation(); toggleWishlist(product); }}
            title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.60)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isWishlisted ? '#E11D48' : 'var(--text-muted)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Heart size={14} fill={isWishlisted ? '#E11D48' : 'none'} className={isWishlisted ? 'heart-pop' : ''} />
          </button>

          <button
            onClick={handleShare}
            title={copied ? 'Link Copied!' : 'Share Product'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.60)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: copied ? '#15803D' : 'var(--text-muted)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              opacity: isHovered ? 1 : 0,
              transform: isHovered ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.8)',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Share2 size={13} />
          </button>
        </div>

        {/* Slide-Up Overlay Action Bar on Hover */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '10px 14px',
          background: 'linear-gradient(to top, rgba(45, 0, 77, 0.85) 0%, rgba(45, 0, 77, 0) 100%)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
          opacity: isHovered ? 1 : 0,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Eye size={14} /> Quick Details
          </span>
        </div>
      </div>

      {/* Card Details Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        <div>
          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {product.category}
          </p>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', lineHeight: 1.35, maxHeight: '2.7em' }}>
            {product.title}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
            <Star
              size={11}
              fill="var(--color-latte)"
              stroke="var(--color-latte)"
              style={{
                transform: isHovered ? 'scale(1.2) rotate(12deg)' : 'scale(1) rotate(0deg)',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{product.rating}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({product.reviews})</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{
              fontSize: '1.05rem',
              fontWeight: 800,
              color: 'var(--color-espresso)',
              textShadow: isHovered ? '0 0 12px rgba(192, 132, 252, 0.4)' : 'none',
              transition: 'text-shadow 0.3s ease',
              flexShrink: 0,
            }}>
              {formatPrice(product.price)}
            </span>
            <button
              onClick={e => { e.stopPropagation(); addToCart(product); }}
              className={`btn-premium ${inCart ? 'btn-added-state' : ''}`}
              style={{ padding: '6px 10px', fontSize: '0.68rem', borderRadius: '10px', flexShrink: 0 }}
            >
              <ShoppingBag size={11} className={inCart ? 'cart-added-icon' : ''} /> {inCart ? '✓' : 'Add'}
            </button>
          </div>

          <button
            onClick={e => { e.stopPropagation(); buyNow(product); }}
            className="btn-premium btn-premium-solid btn-shine-sweep buy-now-glow"
            style={{ width: '100%', padding: '8px', fontSize: '0.76rem', borderRadius: '12px', justifyContent: 'center' }}
          >
            Buy Now
          </button>
        </div>
      </div>
    </a>
  );
}

