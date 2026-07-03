import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import CartItem from './cart/CartItem';

const PROMO_CODES = {
  LUMORA20: { code: 'LUMORA20', discountPercent: 20 },
  LAUNCH10: { code: 'LAUNCH10', discountPercent: 10 },
  PREMIUM50: { code: 'PREMIUM50', discountPercent: 50 },
};

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    clearCart,
    navigateTo,
    formatPrice,
  } = useApp();

  const [savedItems, setSavedItems] = useState([]);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = appliedPromo ? subtotal * (appliedPromo.discountPercent / 100) : 0;
  const platformFee = subtotal > 100 ? 0 : 5;
  const total = subtotal - discount + (subtotal > 0 ? platformFee : 0);

  const handleQuantityChange = (id, delta) => {
    const item = cart.find((i) => i.id === id);
    if (item) {
      updateQuantity(id, item.quantity + delta);
    }
  };

  const handleSaveForLater = (id) => {
    const item = cart.find((i) => i.id === id);
    if (item) {
      setSavedItems((prev) => [...prev, { ...item, quantity: 1 }]);
      removeFromCart(id);
    }
  };

  const handleMoveToCart = (id) => {
    const item = savedItems.find((i) => i.id === id);
    if (item) {
      setSavedItems((prev) => prev.filter((i) => i.id !== id));
      updateQuantity(id, 1); // will add via addToCart if not exists
    }
  };

  const handleRemoveSaved = (id) => {
    setSavedItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleApplyPromo = (e) => {
    e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setAppliedPromo(PROMO_CODES[code]);
      setPromoError('');
    } else {
      setPromoError('Invalid promo code. Try LUMORA20.');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError('');
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    navigateTo('cart');
  };

  const handleContinueBrowsing = () => {
    setIsCartOpen(false);
    navigateTo('marketplace');
  };

  // Overlay + Drawer animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const drawerVariants = {
    hidden: { x: '100%', opacity: 0.5 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    exit: {
      x: '100%',
      opacity: 0,
      transition: { duration: 0.25, ease: 'easeIn' },
    },
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-overlay"
            className="cart-drawer-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={() => setIsCartOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(20, 10, 30, 0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 99990,
              cursor: 'pointer',
            }}
          />

          {/* Drawer Panel */}
          <motion.div
            key="cart-drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '420px',
              maxWidth: '92vw',
              height: '100vh',
              zIndex: 99991,
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(255, 255, 255, 0.65)',
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              borderLeft: '1.5px solid rgba(255, 255, 255, 0.45)',
              boxShadow: '-8px 0 40px rgba(90, 30, 126, 0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid rgba(123,63,160,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--purple-700, #5a1e7e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span
                  style={{
                    fontFamily: 'var(--font-editorial, "Playfair Display", serif)',
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: 'var(--purple-800, #3d0a5c)',
                    letterSpacing: '0.02em',
                  }}
                >
                  Your Cart
                </span>
                {cart.length > 0 && (
                  <span
                    style={{
                      background: 'linear-gradient(135deg, var(--purple-500, #7b3fa0), var(--purple-700, #5a1e7e))',
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {cart.reduce((sum, i) => sum + i.quantity, 0)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                style={{
                  background: 'rgba(123,63,160,0.06)',
                  border: '1px solid rgba(123,63,160,0.12)',
                  borderRadius: '10px',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--purple-600, #6a2d8c)',
                  transition: '0.2s',
                }}
                aria-label="Close cart"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
              }}
            >
              {cart.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '16px',
                    textAlign: 'center',
                    padding: '40px 20px',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      background: 'rgba(123,63,160,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple-400, #9370c0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </div>
                  <p
                    style={{
                      color: 'var(--purple-600, #6a2d8c)',
                      fontWeight: 500,
                      fontSize: '1rem',
                    }}
                  >
                    Your cart is empty
                  </p>
                  <p
                    style={{
                      color: 'var(--purple-400, #9370c0)',
                      fontSize: '0.85rem',
                      maxWidth: '220px',
                      lineHeight: 1.5,
                    }}
                  >
                    Browse the marketplace and add premium digital assets to your collection.
                  </p>
                  <button
                    onClick={handleContinueBrowsing}
                    style={{
                      marginTop: '8px',
                      background: 'linear-gradient(135deg, var(--purple-500, #7b3fa0), var(--purple-700, #5a1e7e))',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '10px 24px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '0.03em',
                      transition: '0.2s',
                    }}
                  >
                    Browse Marketplace
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <AnimatePresence mode="popLayout">
                    {cart.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => {
                          setIsCartOpen(false);
                          navigateTo('product-detail', item.id);
                        }}
                        style={{
                          display: 'flex',
                          gap: '14px',
                          padding: '14px',
                          background: 'rgba(123,63,160,0.03)',
                          borderRadius: '14px',
                          border: '1px solid rgba(123,63,160,0.08)',
                          alignItems: 'center',
                          cursor: 'pointer',
                          userSelect: 'none',
                          WebkitTapHighlightColor: 'transparent',
                          transition: 'background 0.2s, border-color 0.2s, transform 0.18s, box-shadow 0.2s',
                        }}
                        whileHover={{
                          background: 'rgba(123,63,160,0.07)',
                          borderColor: 'rgba(123,63,160,0.22)',
                          y: -2,
                          boxShadow: '0 4px 20px rgba(90,30,126,0.10)',
                        }}
                        whileTap={{ scale: 0.99 }}
                      >
                        {/* Thumbnail */}
                        <div
                          style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: item.gradient || 'linear-gradient(135deg, #e0d4f0, #c8b0e0)',
                          }}
                        >
                          <img
                            src={item.preview}
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: 'var(--purple-800, #3d0a5c)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--purple-400, #9370c0)',
                              marginTop: '2px',
                            }}
                          >
                            by {item.creator?.name || item.creator || 'Unknown'}
                          </div>
                          <div
                            style={{
                              marginTop: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                          >
                            {/* Quantity Controls — stopPropagation so clicking +/- doesn't navigate */}
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(123,63,160,0.06)',
                                borderRadius: '8px',
                                padding: '2px 4px',
                              }}
                            >
                              <button
                                onClick={e => { e.stopPropagation(); handleQuantityChange(item.id, -1); }}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--purple-600, #6a2d8c)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                }}
                              >
                                −
                              </button>
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: 'var(--purple-700, #5a1e7e)',
                                  minWidth: '18px',
                                  textAlign: 'center',
                                }}
                              >
                                {item.quantity}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); handleQuantityChange(item.id, 1); }}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--purple-600, #6a2d8c)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '6px',
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                }}
                              >
                                +
                              </button>
                            </div>
                            <span
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                color: 'var(--purple-700, #5a1e7e)',
                              }}
                            >
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>

                        {/* Remove Button — stopPropagation so it doesn't navigate */}
                        <button
                          onClick={e => { e.stopPropagation(); removeFromCart(item.id); }}
                          style={{
                            background: 'rgba(200,50,80,0.06)',
                            border: '1px solid rgba(200,50,80,0.12)',
                            borderRadius: '8px',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#c83250',
                            flexShrink: 0,
                            transition: '0.2s',
                          }}
                          aria-label={`Remove ${item.title}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Clear Cart */}
                  {cart.length > 1 && (
                    <button
                      onClick={clearCart}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--purple-400, #9370c0)',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: '8px',
                        borderRadius: '8px',
                        transition: '0.2s',
                        marginTop: '4px',
                      }}
                    >
                      Clear All Items
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            {cart.length > 0 && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.65)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}
              >
                {/* Promo Code */}
                <form
                  onSubmit={handleApplyPromo}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '14px',
                  }}
                >
                  {appliedPromo ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        background: 'rgba(40,180,100,0.06)',
                        border: '1px solid rgba(40,180,100,0.2)',
                        borderRadius: '10px',
                        padding: '8px 12px',
                      }}
                    >
                      <span style={{ color: '#1a8a50', fontSize: '0.8rem', fontWeight: 600 }}>
                        ✓ {appliedPromo.code} ({appliedPromo.discountPercent}% OFF)
                      </span>
                      <button
                        type="button"
                        onClick={handleRemovePromo}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#c83250',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder="Promo code"
                        style={{
                          flex: 1,
                          border: '1px solid rgba(123,63,160,0.15)',
                          borderRadius: '10px',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          outline: 'none',
                          background: 'rgba(123,63,160,0.03)',
                          color: 'var(--purple-800, #3d0a5c)',
                        }}
                      />
                      <button
                        type="submit"
                        style={{
                          background: 'rgba(123,63,160,0.08)',
                          border: '1px solid rgba(123,63,160,0.18)',
                          borderRadius: '10px',
                          padding: '8px 16px',
                          color: 'var(--purple-700, #5a1e7e)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: '0.2s',
                        }}
                      >
                        Apply
                      </button>
                    </>
                  )}
                </form>
                {promoError && (
                  <div style={{ color: '#c83250', fontSize: '0.75rem', marginBottom: '8px', marginTop: '-6px' }}>
                    {promoError}
                  </div>
                )}

                {/* Price breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--purple-500, #7b3fa0)' }}>
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#1a8a50' }}>
                      <span>Discount</span>
                      <span>-{formatPrice(discount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--purple-500, #7b3fa0)' }}>
                    <span>Platform Fee</span>
                    <span>{platformFee === 0 ? 'Waived' : formatPrice(platformFee)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--purple-800, #3d0a5c)',
                      borderTop: '1px solid rgba(123,63,160,0.1)',
                      paddingTop: '8px',
                      marginTop: '4px',
                    }}
                  >
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>

                {/* Checkout button */}
                <button
                  onClick={handleCheckout}
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    background: 'linear-gradient(135deg, var(--purple-500, #7b3fa0), var(--purple-700, #5a1e7e))',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '14px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: '0.25s',
                    boxShadow: '0 4px 18px rgba(90,30,126,0.18)',
                  }}
                >
                  <span>View Cart & Checkout</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>

                {/* Continue Browsing */}
                <button
                  onClick={handleContinueBrowsing}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--purple-500, #7b3fa0)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'center',
                    borderRadius: '10px',
                    transition: '0.2s',
                  }}
                >
                  Continue Browsing
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
