import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X, Trash2, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(v));

export default function AffiliateWishlistDrawer({ isOpen, setIsOpen, onSelectProduct }) {
  const { wishlist, toggleWishlist } = useApp();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="aff-wishlist-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(15,10,22,0.55)',
              backdropFilter: 'blur(8px)',
              zIndex: 10000,
            }}
          />

          {/* Drawer */}
          <motion.div
            key="aff-wishlist-drawer"
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
                  <Heart size={16} color="#fff" fill="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B3FA0' }}>
                    Affiliate
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                    My Wishlist ({wishlist.length})
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
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
              {wishlist.length === 0 ? (
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
                    <Heart size={28} color="#7B3FA0" />
                  </div>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Your wishlist is empty</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Browse products and add them to your wishlist.</div>
                  </div>
                </div>
              ) : (
                wishlist.map(item => (
                  <div key={item.id}
                    onClick={() => onSelectProduct && onSelectProduct(item)}
                    style={{
                      display: 'flex', gap: '14px', alignItems: 'flex-start',
                      padding: '14px', borderRadius: '14px',
                      background: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(196,181,253,0.20)',
                      boxShadow: '0 2px 12px rgba(90,30,126,0.04)',
                      cursor: onSelectProduct ? 'pointer' : 'default',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (onSelectProduct) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(90,30,126,0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (onSelectProduct) {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = '0 2px 12px rgba(90,30,126,0.04)';
                      }
                    }}
                  >
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(item.price)}</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectProduct) onSelectProduct(item);
                            }}
                            style={{
                              background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(123,63,160,0.22)',
                              color: '#7B3FA0', fontSize: '0.65rem', fontWeight: 700,
                              padding: '4px 10px', borderRadius: '6px', cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleWishlist(item);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.7)', padding: '2px', display: 'flex', alignItems: 'center' }}
                            title="Remove from wishlist"
                          ><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {wishlist.length > 0 && (
              <div style={{
                flexShrink: 0,
                padding: '20px 28px',
                borderTop: '1px solid rgba(196,181,253,0.20)',
                display: 'flex', gap: '12px',
              }}>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    flex: 1, padding: '12px 20px', borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                    color: '#fff', fontSize: '0.84rem', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(123,63,160,0.35)',
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
