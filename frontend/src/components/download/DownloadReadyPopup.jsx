import React, { useEffect, useState } from 'react';
import { CheckCircle, Download, ArrowRight, X, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DownloadReadyPopup({ isOpen, onClose, onGoToDownloads, purchasedItems = [], orderDetails = null }) {
  const [countdown, setCountdown] = useState(3);
  const [autoRedirectEnabled, setAutoRedirectEnabled] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fire celebration confetti
    confetti({
      particleCount: 150,
      spread: 100,
      colors: ['#D8BFE3', '#B886D0', '#7B3FA0', '#22c55e'],
      origin: { y: 0.6 },
    });

    // Auto-trigger downloads for all purchased items
    purchasedItems.forEach((item, index) => {
      setTimeout(() => {

        if (item.download_url) {
          const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
          let finalUrl = item.download_url;
          if (finalUrl.startsWith('/api')) {
            finalUrl = `${BACKEND_URL}${finalUrl.replace('/api', '')}`;
          } else if (finalUrl.startsWith('/')) {
            finalUrl = `${BACKEND_URL}${finalUrl}`;
          } else if (!finalUrl.startsWith('http')) {
            finalUrl = `${BACKEND_URL}/${finalUrl}`;
          }

          const link = document.createElement('a');
          link.href = finalUrl;
          link.download = `${item.title || item.name || 'product'}.zip`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }, index * 500); // Stagger downloads by 500ms
    });

    // Countdown timer for auto-redirect
    if (autoRedirectEnabled) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onGoToDownloads();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, purchasedItems, autoRedirectEnabled, onGoToDownloads]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0, 0, 0, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth: '520px',
        width: '90%',
        padding: '32px',
        textAlign: 'center',
        position: 'relative',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.7)',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(0, 0, 0, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-mocha)',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        {/* Success icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(34,197,94,0.25),rgba(34,197,94,0.10))',
          border: '2px solid rgba(34,197,94,0.40)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          color: '#16a34a',
          boxShadow: '0 12px 40px rgba(34,197,94,0.25)',
        }}>
          <CheckCircle size={42} />
        </div>

        {/* Main content */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 600,
            color: 'var(--color-espresso)',
            marginBottom: '8px',
            lineHeight: 1.2,
          }}>
            ✔ Payment Successful
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: 'var(--color-mocha)',
            marginBottom: '16px',
            lineHeight: 1.5,
          }}>
            Your purchase has been completed successfully.<br />
            Your digital product{purchasedItems.length > 1 ? 's are' : ' is'} now available.
          </p>

          {/* Order details */}
          {orderDetails && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(123,63,160,0.08)',
              borderRadius: '20px',
              border: '1px solid rgba(196,181,253,0.25)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#7B3FA0',
              marginBottom: '20px',
            }}>
              Order #{orderDetails.order_id || orderDetails.id}
              {orderDetails.total_amount && (
                <span> • ₹{Number(orderDetails.total_amount).toLocaleString('en-IN')}</span>
              )}
            </div>
          )}
        </div>

        {/* Downloaded items preview */}
        {purchasedItems.length > 0 && (
          <div style={{
            textAlign: 'left',
            marginBottom: '24px',
            maxHeight: '200px',
            overflowY: 'auto',
          }}>
            <h4 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-mocha)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '12px',
            }}>
              Downloads Started ({purchasedItems.length} item{purchasedItems.length > 1 ? 's' : ''})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {purchasedItems.slice(0, 3).map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  background: 'rgba(34,197,94,0.06)',
                  borderRadius: '10px',
                  border: '1px solid rgba(34,197,94,0.15)',
                }}>
                  {item.preview && (
                    <img
                      src={item.preview || item.thumbnail}
                      alt={item.title || item.name}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--color-espresso)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginBottom: '2px',
                    }}>
                      {item.title || item.name || 'Digital Product'}
                    </p>
                    <p style={{
                      fontSize: '0.7rem',
                      color: '#16a34a',
                      fontWeight: 600,
                    }}>
                      <Download size={10} style={{ marginRight: '4px', display: 'inline' }} />
                      Download started
                    </p>
                  </div>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(34,197,94,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CheckCircle size={12} style={{ color: '#16a34a' }} />
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
                  +{purchasedItems.length - 3} more item{purchasedItems.length - 3 > 1 ? 's' : ''} downloading...
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={onGoToDownloads}
            className="btn-premium btn-premium-solid"
            style={{
              padding: '14px 28px',
              fontSize: '0.95rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Download size={16} />
            Go to Downloads
          </button>

          <button
            onClick={() => {
              setAutoRedirectEnabled(false);
              onClose();
            }}
            className="btn-premium"
            style={{
              padding: '14px 24px',
              fontSize: '0.95rem',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Continue Shopping
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Auto-redirect countdown */}
        {autoRedirectEnabled && countdown > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: 'rgba(123,63,160,0.08)',
            borderRadius: '8px',
            border: '1px solid rgba(196,181,253,0.20)',
          }}>
            <p style={{
              fontSize: '0.8rem',
              color: '#7B3FA0',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              margin: 0,
            }}>
              <Clock size={14} />
              Redirecting to Downloads in {countdown} second{countdown !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setAutoRedirectEnabled(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7B3FA0',
                fontSize: '0.75rem',
                textDecoration: 'underline',
                cursor: 'pointer',
                marginTop: '4px',
              }}
            >
              Cancel auto-redirect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}