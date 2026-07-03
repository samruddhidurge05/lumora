import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Simple currency formatter helper
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const CartSummary = ({
  subtotal,
  discount,
  platformFee,
  total,
  appliedPromo,
  promoSuccess,
  promoError,
  onApplyPromo,
  onRemovePromo,
  onCheckout,
  checkoutStep,
  onContinueBrowsing,
  selectedPayment = 'upi',
  onSelectPayment,
}) => {
  const [promoInput, setPromoInput] = useState('');

  const isProcessing = checkoutStep === 'processing';
  const isComplete = checkoutStep === 'complete';

  const handlePromoSubmit = (e) => {
    e.preventDefault();
    onApplyPromo(promoInput);
  };

  // payment method nodes
  const paymentMethods = [
    {
      id: 'upi',
      label: 'UPI / QR Code',
      icon: (
        <svg viewBox="0 0 24 8" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '16px' }}>
          <path
            d="M1 0.5H3V6.2C3 6.9 3.5 7.4 4.2 7.4H7.8C8.5 7.4 9 6.9 9 6.2V0.5H11V6.2C11 7.9 9.6 9.3 7.8 9.3H4.2C2.4 9.3 1 7.9 1 6.2V0.5ZM16.3 3.5H14.3V5H16.3C16.8 5 17.2 4.7 17.2 4.2C17.2 3.8 16.8 3.5 16.3 3.5ZM14.3 0.5H16.3C18 0.5 19.4 1.8 19.4 3.5C19.4 5.2 18 6.5 16.3 6.5H14.3V8.8H12.3V0.5H14.3ZM23 0.5V8.8H21V0.5H23Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      id: 'visa',
      label: 'Visa Card',
      icon: (
        <svg viewBox="0 0 24 8" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '14px' }}>
          <path
            d="M3.7 7.7L5.5 0.3H8.3L6.5 7.7H3.7ZM11.1 0.5C10.7 0.3 9.9 0.2 9.1 0.2C7 0.2 5.5 1.3 5.4 3C5.3 4.2 6.4 4.8 7.2 5.2C8 5.6 8.3 5.8 8.3 6.2C8.3 6.8 7.6 7 7 7C6 7 5.4 6.7 4.9 6.4L4.5 7.6C4.9 7.8 5.8 8 6.7 8C8.9 8 10.3 6.9 10.4 5.2C10.5 4 9.7 3.4 8.7 2.9C8.1 2.6 7.8 2.4 7.8 2.1C7.8 1.6 8.4 1.2 9.3 1.2C10.1 1.2 10.7 1.4 11 1.6L11.1 0.5ZM17.1 5.2L18.4 1.5C18.4 1.5 18.7 0.3 18.8 0.3H21.2L19.1 7.7H16.5L14.7 2C14.3 1 13.9 0.7 13.1 0.3V0.3H16.4C16.9 0.3 17 0.6 17.1 1.2L17.1 5.2ZM2.8 0.3L0.1 6.8C-0.1 7.2 -0.1 7.4 0.2 7.7C0.7 8.1 1.6 8.5 2.5 8.5H5.1L5.6 6.3L2.8 0.3H2.8Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
    {
      id: 'mastercard',
      label: 'Mastercard',
      icon: (
        <svg viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '24px' }}>
          <circle cx="8" cy="8" r="8" fill="#FFD6BA" opacity="0.85" />
          <circle cx="16" cy="8" r="8" fill="#FFDCE5" opacity="0.85" />
          <path
            d="M12 12.5C13.2 11.4 14 9.8 14 8C14 6.2 13.2 4.6 12 3.5C10.8 4.6 10 6.2 10 8C10 9.8 10.8 11.4 12 12.5Z"
            fill="#A174B8"
          />
        </svg>
      ),
    },
    {
      id: 'applepay',
      label: 'Apple Pay',
      icon: (
        <svg viewBox="0 0 24 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ height: '16px' }}>
          <path
            d="M3.7 9C4.8 9 5.5 8.1 5.5 7.1C5.5 6 4.8 5.1 3.7 5.1C2.6 5.1 1.9 6 1.9 7.1C1.9 8.1 2.6 9 3.7 9ZM3.7 10C1.7 10 0 8.5 0 6.8C0 5 1.7 3.5 3.7 3.5C5.7 3.5 7.4 5 7.4 6.8C7.4 8.5 5.7 10 3.7 10ZM10.5 4.5V8.8C10.5 9.4 10.1 9.8 9.5 9.8C8.9 9.8 8.5 9.4 8.5 8.8V4.5H10.5ZM9.5 3C9 3 8.5 2.5 8.5 2C8.5 1.5 9 1 9.5 1C10 1 10.5 1.5 10.5 2C10.5 2.5 10 3 9.5 3ZM13.8 6.5C13.8 5.6 13.1 5 12.1 5H11.5V8H12.1C13.1 8 13.8 7.4 13.8 6.5ZM13.8 9H11.5V9.8C11.5 10.4 11.1 10.8 10.5 10.8C9.9 10.8 9.5 10.4 9.5 9.8V4.5H12.1C13.8 4.5 15.3 5.4 15.3 7C15.3 8.6 13.8 9 13.8 9Z"
            fill="currentColor"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="lumora-glass-card summary-panel">
      <h2 className="summary-title">Your Order</h2>

      {/* Math details */}
      <div className="summary-rows">
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>

        {discount > 0 && (
          <div className="summary-row">
            <span>Special Offer Discount</span>
            <span className="discount-amount">-{formatCurrency(discount)}</span>
          </div>
        )}

        <div className="summary-row">
          <span>Platform Fee</span>
          <span>
            {platformFee === 0 ? (
              <>
                <span style={{ textDecoration: 'line-through', marginRight: '4px', opacity: 0.5 }}>
                  {formatCurrency(5.00)}
                </span>
                <span className="summary-fee-badge">Waived</span>
              </>
            ) : (
              formatCurrency(platformFee)
            )}
          </span>
        </div>

        {/* Large visual total row */}
        <div className="summary-row total-row">
          <span>Total Amount</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Promo Code section */}
      {!isComplete && (
        <div className="promo-code-container">
          <AnimatePresence mode="wait">
            {appliedPromo ? (
              <motion.div
                key="applied"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="promo-success-chip"
              >
                <div className="promo-success-details">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    <strong>{appliedPromo.code}</strong> ({appliedPromo.discountPercent}% OFF)
                  </span>
                </div>
                <button
                  type="button"
                  className="promo-remove-btn"
                  onClick={() => {
                    onRemovePromo();
                    setPromoInput('');
                  }}
                  aria-label="Remove promo code"
                >
                  Remove
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="input-form"
                onSubmit={handlePromoSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <label htmlFor="promo-input" className="promo-label">
                  HAVE A PREMIUM KEY?
                </label>
                <div className="promo-input-group">
                  <input
                    id="promo-input"
                    type="text"
                    className="promo-input"
                    placeholder="Enter key (e.g. LUMORA20)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    autoComplete="off"
                  />
                  <button type="submit" className="promo-btn">
                    Apply
                  </button>
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {promoError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: -5, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="promo-error-msg"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{promoError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Interactive payment methods pills grid */}
      {!isComplete && (
        <div className="payment-section-container">
          <span className="promo-label">PAYMENT METHOD</span>
          <div className="payment-grid">
            {paymentMethods.map((method) => {
              const isActive = selectedPayment === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  className={`payment-pill ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectPayment(method.id)}
                  aria-label={`Pay with ${method.label}`}
                >
                  <div className="payment-pill-svg-wrapper">{method.icon}</div>
                  <span className="payment-pill-label">{method.label}</span>

                  {isActive && (
                    <div className="payment-pill-check">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Action CTAs with simple copy */}
      {isComplete ? (
        <div className="checkout-success-view">
          <div className="checkout-success-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h3 className="checkout-success-title">Order Unlocked</h3>
          <p className="checkout-success-desc">
            Your download links have been sent. Check your email to start creating immediately.
          </p>
          <button type="button" className="checkout-btn" onClick={onContinueBrowsing}>
            Explore Catalog
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`checkout-btn ${isProcessing ? 'processing' : ''}`}
            onClick={onCheckout}
            disabled={isProcessing || subtotal === 0}
          >
            {isProcessing ? (
              <>
                <svg
                  style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                <span>Processing your order...</span>
              </>
            ) : (
              <>
                <span>Checkout</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </>
            )}
          </button>

          <button type="button" className="continue-btn" onClick={onContinueBrowsing}>
            <span>Continue Browsing</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </>
      )}

      {/* Inline styles for basic spin keyframe */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default CartSummary;
