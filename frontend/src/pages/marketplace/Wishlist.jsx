import React from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';

export default function Wishlist() {
  const { wishlist, toggleWishlist, addToCart, buyNow, navigateTo, formatPrice } = useApp();

  const handleMoveToCart = (product) => {
    addToCart(product);
    toggleWishlist(product);
  };

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,5vw,6rem) 80px', maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Saved Items</span>
          <h1 className="text-editorial" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px' }}>My Wishlist</h1>
        </div>

        {wishlist.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 40px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)' }}>
            <Heart size={48} style={{ color: 'rgba(123,63,160,0.2)', margin: '0 auto 16px' }} />
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--color-espresso)' }}>No saved items yet</h2>
            <p style={{ color: 'var(--color-mocha)', marginTop: '8px', fontSize: '0.88rem' }}>Heart products you love to save them here.</p>
            <button onClick={() => navigateTo('marketplace')} className="btn-premium btn-premium-solid" style={{ marginTop: '24px', padding: '12px 28px' }}>Browse Products</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '24px' }}>
            {wishlist.map(product => (
              <div key={product.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(196,181,253,0.22)' }}>
                <div style={{ position: 'relative', height: '180px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigateTo('product-detail', product.id)}>
                  <img src={product.preview} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={e => { e.stopPropagation(); toggleWishlist(product); }} style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E11D48' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{product.category}</p>
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</h3>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(product.price)}</span>
                    <button onClick={() => handleMoveToCart(product)} className="btn-premium" style={{ padding: '7px 12px', fontSize: '0.72rem', borderRadius: '8px' }}>
                      <ShoppingBag size={12} /> Add to Cart
                    </button>
                  </div>
                  <button onClick={() => buyNow(product)} className="btn-premium btn-premium-solid" style={{ width: '100%', justifyContent: 'center', padding: '9px', fontSize: '0.78rem', borderRadius: '8px' }}>
                    Buy Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
