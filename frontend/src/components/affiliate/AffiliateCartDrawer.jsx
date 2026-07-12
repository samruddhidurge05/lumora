import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, X, Trash2, Plus, Minus, ShoppingCart, ArrowRight } from 'lucide-react';
import { useAffiliateCart } from '../../context/AffiliateCartContext';

const PROMO_CODES = {
  LUMORA20:  { code: 'LUMORA20',  discountPercent: 20 },
  LAUNCH10:  { code: 'LAUNCH10',  discountPercent: 10 },
  PREMIUM50: { code: 'PREMIUM50', discountPercent: 50 },
};

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(v));

export default function AffiliateCartDrawer() {
  const {
    affCart,
    isAffCartOpen,
    setIsAffCartOpen,
    removeFromAffCart,
    updateAffQuantity,
    clearAffCart,
    affCartTotal,
  } = useAffiliateCart();

  const [promoInput, setPromoInput]   = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError]   = useState('');

  const discount    = appliedPromo ? affCartTotal * (appliedPromo.discountPercent / 100) : 0;
  const platformFee = affCartTotal > 100 ? 0 : 5;
  const gst         = Math.round((affCartTotal - discount + platformFee) * 0.18);
  const total       = Math.round(affCartTotal - discount + (affCartTotal > 0 ? platformFee : 0) + gst);

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setAppliedPromo(PROMO_CODES[code]);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code.');
    }
  };

  const handleCheckout = () => {
    setIsAffCartOpen(false);
    window.location.href = '/checkout?role=affiliate';
  };

  return (
    <AnimatePresence>
      {isAffCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="aff-cart-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsAffCartOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,10,22,0.55)',
              backdropFilter: 'blur(8px)',
              zIndex: 10000,
            }}
          />

          {/* Drawer */}
          <motion.div
            key="aff-cart-drawer"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            style={{
              position: 'fixed', top: 0, right: 0,
              width: 'min(420px, 100vw)',
              height: '100vh',
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(40px) saturate(200%)',
              borderLeft: '1px solid rgba(196,181,253,0.30)',
              boxShadow: '-20px 0 80px rgba(90,30,126,0.12)',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '24px 28px',
              borderBottom: '1px solid rgba(196,181,253,0.20)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ShoppingBag size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B3FA0' }}>
                    Affiliate
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    My Cart ({affCart.length})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsAffCartOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: '1px solid rgba(196,181,253,0.35)',
                  background: 'rgba(255,255,255,0.80)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {affCart.length === 0 ? (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '16px', textAlign: 'center', padding: '60px 20px',
                }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(123,63,160,0.08)',
                    border: '1px solid rgba(123,63,160,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <ShoppingCart size={28} color="#7B3FA0" />
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Your cart is empty</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Browse products and add them to your cart.</div>
                  </div>
                </div>
              ) : (
                affCart.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', gap: '14px', alignItems: 'flex-start',
                    padding: '14px', borderRadius: '14px',
                    background: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(196,181,253,0.20)',
                    boxShadow: '0 2px 12px rgba(90,30,126,0.04)',
                  }}>
                    <img
                      src={item.preview || item.thumbnail}
                      alt={item.title}
                      style={{ width: 56, height: 56, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{item.category}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            onClick={() => updateAffQuantity(item.id, item.quantity - 1)}
                            style={{ width: 24, height: 24, borderRadius: '6px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.80)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}
                          ><Minus size={10} /></button>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '20px', textAlign: 'center', color: 'var(--text-primary)' }}>{item.quantity}</span>
                          <button
                            onClick={() => updateAffQuantity(item.id, item.quantity + 1)}
                            style={{ width: 24, height: 24, borderRadius: '6px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.80)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}
                          ><Plus size={10} /></button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(item.price * item.quantity)}</span>
                          <button
                            onClick={() => removeFromAffCart(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.7)', padding: '2px', display: 'flex', alignItems: 'center' }}
                          ><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {affCart.length > 0 && (
              <div style={{
                flexShrink: 0,
                padding: '20px 28px',
                borderTop: '1px solid rgba(196,181,253,0.20)',
                display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                {/* Promo code */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Promo code"
                    value={promoInput}
                    onChange={e => { setPromoInput(e.target.value); setPromoError(''); }}
                    style={{
                      flex: 1, padding: '9px 14px', borderRadius: '10px',
                      border: `1px solid ${promoError ? 'rgba(239,68,68,0.50)' : 'rgba(196,181,253,0.35)'}`,
                      background: 'rgba(255,255,255,0.80)',
                      fontSize: '0.78rem', fontFamily: 'var(--font-sans)',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleApplyPromo}
                    style={{
                      padding: '9px 16px', borderRadius: '10px',
                      border: '1.5px solid rgba(123,63,160,0.35)',
                      background: 'rgba(255,255,255,0.80)',
                      fontSize: '0.78rem', fontWeight: 700,
                      color: '#7B3FA0', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >Apply</button>
                </div>
                {promoError && <div style={{ fontSize: '0.72rem', color: '#ef4444' }}>{promoError}</div>}
                {appliedPromo && (
                  <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>
                    ✓ {appliedPromo.discountPercent}% discount applied!
                  </div>
                )}

                {/* Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal</span><span style={{ fontWeight: 600 }}>{formatINR(affCartTotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                      <span>Discount ({appliedPromo.discountPercent}%)</span><span>-{formatINR(discount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Platform Fee</span><span>{platformFee === 0 ? 'Free' : `₹${platformFee}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>GST (18%)</span><span>{formatINR(gst)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', paddingTop: '8px', borderTop: '1px solid rgba(196,181,253,0.20)', marginTop: '4px' }}>
                    <span>Total</span><span>{formatINR(total)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={clearAffCart}
                    style={{
                      flex: '0 0 auto', padding: '11px 16px', borderRadius: '12px',
                      border: '1px solid rgba(196,181,253,0.35)',
                      background: 'rgba(255,255,255,0.80)',
                      fontSize: '0.75rem', fontWeight: 600,
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >Clear</button>
                  <button
                    onClick={handleCheckout}
                    style={{
                      flex: 1, padding: '12px 20px', borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                      color: '#fff', fontSize: '0.84rem', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      boxShadow: '0 4px 16px rgba(123,63,160,0.35)',
                    }}
                  >
                    Checkout <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
