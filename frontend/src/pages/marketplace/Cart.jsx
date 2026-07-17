import React from 'react';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, formatPrice, navigateTo, clearCart } = useApp();
  const subtotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

  if (cart.length === 0) return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '120px', textAlign: 'center', padding: '120px 24px 80px' }}>
        <ShoppingBag size={64} style={{ color: 'rgba(123,63,160,0.2)', margin: '0 auto 24px' }} />
        <h2 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>Your cart is empty</h2>
        <p style={{ color: 'var(--color-mocha)', marginTop: '8px', fontSize: '0.9rem' }}>Discover premium digital products in our marketplace.</p>
        <button onClick={() => navigateTo('marketplace')} className="btn-premium btn-premium-solid" style={{ marginTop: '24px', padding: '12px 28px' }}>
          Browse Products <ArrowRight size={15} />
        </button>
      </div>
      <Footer />
    </div>
  );

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div className="lumora-cart-page" style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,5vw,6rem) 80px', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Your Cart</span>
            <h1 className="text-editorial cart-title" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px' }}>{cart.length} Item{cart.length !== 1 ? 's' : ''}</h1>
          </div>
          <button onClick={clearCart} className="btn-premium" style={{ fontSize: '0.75rem', color: '#dc2626', borderColor: 'rgba(220,38,38,0.25)' }}>
            <Trash2 size={13} /> Clear All
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', alignItems: 'start' }} className="cart-grid">
          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cart.map(item => (
              <div key={item.id} className="glass-card lumora-cart-item" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid rgba(196,181,253,0.22)' }}>
                <img 
                  src={item.preview} 
                  alt={item.title} 
                  onClick={() => navigateTo('product-detail', item.id)}
                  className="lumora-cart-item-img"
                  style={{ width: '72px', height: '72px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} 
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{item.category}</p>
                  <h3 
                    onClick={() => navigateTo('product-detail', item.id)}
                    style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  >
                    {item.title}
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>by {item.seller?.name}</p>
                </div>
                <div className="cart-item-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <Minus size={12} />
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)', minWidth: '20px', textAlign: 'center' }}>{item.quantity || 1}</span>
                  <button onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    <Plus size={12} />
                  </button>
                </div>
                <div className="lumora-cart-item-price" style={{ textAlign: 'right', minWidth: '80px' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(item.price * (item.quantity || 1))}</div>
                </div>
                <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,38,38,0.6)', padding: '4px' }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="glass-card cart-summary" style={{ padding: '28px', position: 'sticky', top: '100px' }}>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '20px' }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-mocha)', marginBottom: '10px', fontWeight: 600 }}>
              <span>Subtotal ({cart.length} items)</span><span>{formatPrice(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--color-mocha)', marginBottom: '20px', fontWeight: 600 }}>
              <span>Platform Fee</span><span style={{ color: '#16a34a' }}>Free</span>
            </div>
            <div style={{ borderTop: '1px dashed rgba(196,181,253,0.2)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '24px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-espresso)' }}>Total</span>
              <span className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>{formatPrice(subtotal)}</span>
            </div>
            <button onClick={() => navigateTo('checkout')} className="btn-premium btn-premium-solid buy-now-glow" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '0.9rem', borderRadius: '12px' }}>
              Proceed to Checkout <ArrowRight size={16} />
            </button>
            <button onClick={() => navigateTo('marketplace')} className="btn-premium" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.82rem', borderRadius: '12px', marginTop: '10px' }}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
      <Footer />
      <style>{`@media(max-width:800px){.cart-grid{grid-template-columns:1fr!important;}}`}</style>
    </div>
  );
}
