import React, { useEffect } from 'react';
import { CheckCircle, ArrowRight, X, Shield, Package } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DownloadReadyPopup({ isOpen, onClose, onGoToDownloads, purchasedItems = [], orderDetails = null }) {

  useEffect(() => {
    if (!isOpen) return;

    // Fire celebration confetti
    confetti({
      particleCount: 150,
      spread: 100,
      colors: ['#D8BFE3', '#B886D0', '#7B3FA0', '#22c55e'],
      origin: { y: 0.6 },
    });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(12, 10, 18, 0.65)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      <div style={{
        maxWidth: '520px',
        width: '90%',
        padding: '36px',
        textAlign: 'center',
        position: 'relative',
        borderRadius: '28px',
        border: '1px solid rgba(220, 198, 255, 0.4)',
        background: '#FFFDF9',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.25)',
        animation: 'dl-fadein 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(78, 59, 49, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-espresso)',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Success icon */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))',
          border: '2px solid rgba(34,197,94,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#16a34a',
          boxShadow: '0 12px 32px rgba(34,197,94,0.2)',
        }}>
          <CheckCircle size={40} />
        </div>

        {/* Main content */}
        <div style={{ marginBottom: '24px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            ✦ Lumora Payment Verified
          </span>
          <h2 style={{
            fontSize: '1.65rem',
            fontWeight: 700,
            color: 'var(--color-espresso)',
            marginTop: '4px',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}>
            Payment Successful!
          </h2>
          <p style={{
            fontSize: '0.92rem',
            color: 'var(--color-mocha)',
            marginBottom: '16px',
            lineHeight: 1.55,
          }}>
            Your purchase is complete. Your digital product{purchasedItems.length > 1 ? 's have' : ' has'} been added to your <strong>Digital Vault</strong>.
          </p>

          {/* Order details */}
          {orderDetails && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              background: 'rgba(123,63,160,0.08)',
              borderRadius: '20px',
              border: '1px solid rgba(196,181,253,0.25)',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#7B3FA0',
              marginBottom: '16px',
            }}>
              Order #{orderDetails.order_id || orderDetails.id}
              {orderDetails.total_amount && (
                <span> • ₹{Number(orderDetails.total_amount).toLocaleString('en-IN')}</span>
              )}
            </div>
          )}
        </div>

        {/* Purchased Items List */}
        {purchasedItems.length > 0 && (
          <div style={{
            textAlign: 'left',
            marginBottom: '24px',
            maxHeight: '220px',
            overflowY: 'auto',
          }}>
            <h4 style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--color-mocha)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '10px',
            }}>
              Purchased Vault Items ({purchasedItems.length} item{purchasedItems.length > 1 ? 's' : ''})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {purchasedItems.slice(0, 3).map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  background: 'rgba(61,184,119,0.06)',
                  borderRadius: '14px',
                  border: '1px solid rgba(61,184,119,0.2)',
                }}>
                  {item.preview || item.thumbnail ? (
                    <img
                      src={item.preview || item.thumbnail}
                      alt={item.title || item.name}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(78,59,49,0.08)', color: 'var(--color-espresso)' }}>
                      <Package size={20} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--color-espresso)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '2px',
                    }}>
                      {item.title || item.name || 'Digital Product'}
                    </p>
                    <p style={{
                      fontSize: '0.72rem',
                      color: '#16a34a',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Shield size={12} style={{ color: '#16a34a' }} />
                      Available in Vault (Preview & Download)
                    </p>
                  </div>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(34,197,94,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CheckCircle size={14} style={{ color: '#16a34a' }} />
                  </div>
                </div>
              ))}
              {purchasedItems.length > 3 && (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-mocha)',
                  textAlign: 'center',
                  fontStyle: 'italic',
                  marginTop: '4px',
                }}>
                  +{purchasedItems.length - 3} more item{purchasedItems.length - 3 > 1 ? 's' : ''} in Vault
                </p>
              )}
            </div>
          </div>
        )}

        {/* Guidance notice */}
        <p style={{
          fontSize: '0.78rem',
          color: 'var(--color-mocha)',
          lineHeight: 1.5,
          marginBottom: '24px',
          background: 'rgba(78,59,49,0.04)',
          padding: '12px 16px',
          borderRadius: '14px',
          border: '1px solid rgba(78,59,49,0.08)',
          textAlign: 'left'
        }}>
          💡 <strong>Vault Inspection:</strong> To inspect or preview your purchased items online without downloading them to your computer or phone, click <strong>Go to Downloads Vault</strong>.
        </p>

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={onGoToDownloads}
            style={{
              padding: '12px 24px',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4E3B31, #2C1E18)',
              color: '#FFFDF9',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(45,30,24,0.25)'
            }}
          >
            Go to Downloads Vault
            <ArrowRight size={16} />
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '12px 20px',
              fontSize: '0.88rem',
              fontWeight: 700,
              borderRadius: '14px',
              background: 'rgba(78,59,49,0.08)',
              color: 'var(--color-espresso)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}