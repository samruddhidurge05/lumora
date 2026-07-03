import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Shield, Lock, Check, Smartphone, Landmark, CheckCircle2, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function Payment() {
  const { cart, navigateTo, completePurchase, formatPrice, buyNowProduct, appliedPromo, checkoutForm, platformStatus } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;

  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi', 'credit_card', 'debit_card', 'netbanking'
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay'); // 'gpay', 'phonepe', 'paytm', 'custom'
  const [upiId, setUpiId] = useState('samdurge@okaxis');
  const [selectedBank, setSelectedBank] = useState('hdfc');
  const [cardForm, setCardForm] = useState({ card: '', expiry: '', cvv: '' });

  // Loading overlay state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const checkoutItems = buyNowProduct ? [buyNowProduct] : cart;
  const subtotal = checkoutItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  
  // Calculations
  const discount = appliedPromo ? subtotal * (appliedPromo.discountPercent / 100) : 0;
  const platformFee = subtotal > 100 ? 0 : 5;
  const total = subtotal - discount + (subtotal > 0 ? platformFee : 0);

  // Cycle loading status text
  useEffect(() => {
    if (!isProcessing) return;
    const timers = [
      setTimeout(() => setProcessingStep(1), 500),
      setTimeout(() => setProcessingStep(2), 1000),
      setTimeout(() => {
        setIsProcessing(false);
        // Generate a simulated payment transaction ID
        const simulatedPaymentId = `SIM-${paymentMethod.toUpperCase()}-${Date.now()}`;
        completePurchase(
          paymentMethod,
          simulatedPaymentId,
          appliedPromo?.code || null,
          discount
        );
      }, 1600)
    ];
    return () => timers.forEach(clearTimeout);
  }, [isProcessing]);

  const handleCardChange = e => {
    let { name, value } = e.target;
    if (name === 'card') {
      // Format: 1111 2222 3333 4444
      value = value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    }
    if (name === 'expiry') {
      value = value.replace(/\D/g, '');
      if (value.length > 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
    }
    if (name === 'cvv') {
      value = value.replace(/\D/g, '');
    }
    setCardForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    setIsProcessing(true);
    setProcessingStep(0);
  };

  const getProcessingText = () => {
    switch (processingStep) {
      case 0: return 'Establishing PCI-DSS secure connection...';
      case 1: return 'Authorizing transaction with bank gateway...';
      case 2: return 'Compiling licensing credentials...';
      default: return 'Finalizing checkout...';
    }
  };

  const inputStyle = {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(123,63,160,0.2)',
    background: '#fff',
    color: 'var(--color-espresso)',
    fontSize: '0.85rem',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <div style={{ minHeight: '100vh', padding: '32px clamp(16px, 4vw, 48px)', position: 'relative', zIndex: 20 }}>
      {/* Back button */}
      <button onClick={() => navigateTo('checkout')} className="btn-premium"
        style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '20px', marginBottom: '32px' }}>
        <ArrowLeft size={14} /> Back to Details
      </button>

      <div className="checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', maxWidth: '1100px', margin: '0 auto', alignItems: 'start' }}>
        {/* Left Column: Form */}
        <div className="glass-card" style={{ padding: '40px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>Complete Payment</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--purple-700)', fontSize: '0.72rem', fontWeight: 700 }}>
              <Lock size={12} /> SSL Secured
            </div>
          </div>

          {/* Customer & Billing Summary (Read Only Review) */}
          <div style={{ padding: '16px 20px', borderRadius: '12px', background: 'rgba(123, 63, 160, 0.03)', border: '1px solid rgba(123, 63, 160, 0.12)', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--color-espresso)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em', marginBottom: '2px' }}>DELIVER TO</span>
                <strong>{checkoutForm.name}</strong> · {checkoutForm.email} · {checkoutForm.phone}
              </div>
              <div style={{ textAlign: 'right' }} className="text-left-mobile">
                <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em', marginBottom: '2px' }}>BILLING ADDRESS</span>
                {checkoutForm.city}, {checkoutForm.state}, {checkoutForm.country}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Payment Tabs Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>SELECT PAYMENT METHOD</label>
              <div className="glass-surface" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '4px', borderRadius: '14px', gap: '4px' }}>
                <button type="button" onClick={() => setPaymentMethod('upi')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', borderRadius: '10px', border: 'none', background: paymentMethod === 'upi' ? 'var(--color-espresso)' : 'transparent', color: paymentMethod === 'upi' ? '#fff' : 'var(--color-mocha)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s' }}>
                  <Smartphone size={13} /> UPI
                </button>
                <button type="button" onClick={() => setPaymentMethod('credit_card')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', borderRadius: '10px', border: 'none', background: paymentMethod === 'credit_card' ? 'var(--color-espresso)' : 'transparent', color: paymentMethod === 'credit_card' ? '#fff' : 'var(--color-mocha)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s' }}>
                  <CreditCard size={13} /> Credit Card
                </button>
                <button type="button" onClick={() => setPaymentMethod('debit_card')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', borderRadius: '10px', border: 'none', background: paymentMethod === 'debit_card' ? 'var(--color-espresso)' : 'transparent', color: paymentMethod === 'debit_card' ? '#fff' : 'var(--color-mocha)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s' }}>
                  <CreditCard size={13} /> Debit Card
                </button>
                <button type="button" onClick={() => setPaymentMethod('netbanking')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 4px', borderRadius: '10px', border: 'none', background: paymentMethod === 'netbanking' ? 'var(--color-espresso)' : 'transparent', color: paymentMethod === 'netbanking' ? '#fff' : 'var(--color-mocha)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s' }}>
                  <Landmark size={13} /> Net Banking
                </button>
              </div>
            </div>

            {/* Payment Method Content */}
            <div className="payment-content" style={{ padding: '24px', borderRadius: '16px', background: 'rgba(123, 63, 160, 0.03)', border: '1px solid rgba(123, 63, 160, 0.12)' }}>
              
              {/* UPI Tab */}
              {paymentMethod === 'upi' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'gpay', label: 'Google Pay' },
                      { id: 'phonepe', label: 'PhonePe' },
                      { id: 'paytm', label: 'Paytm' },
                      { id: 'custom', label: 'Other UPI ID' }
                    ].map(app => (
                      <button key={app.id} type="button" onClick={() => { setSelectedUpiApp(app.id); if (app.id !== 'custom') setUpiId(`samdurge@ok${app.id}`); else setUpiId(''); }}
                        style={{ flex: 1, minWidth: '110px', padding: '10px 14px', borderRadius: '10px', border: selectedUpiApp === app.id ? '2px solid var(--purple-600)' : '1px solid rgba(123,63,160,0.25)', background: selectedUpiApp === app.id ? 'rgba(123,63,160,0.06)' : '#fff', color: 'var(--color-espresso)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {selectedUpiApp === app.id && <CheckCircle2 size={12} style={{ color: 'var(--purple-700)' }} />}
                        {app.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>
                      {selectedUpiApp === 'custom' ? 'ENTER VPA / UPI ID' : `${selectedUpiApp.toUpperCase()} ID`}
                    </label>
                    <input value={upiId} onChange={e => setUpiId(e.target.value)} required placeholder="username@bank"
                      style={inputStyle} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-mocha)', opacity: 0.8 }}>
                    💡 Tap "Authorize & Pay" below. We'll simulate a 1-click verification request sent to your payment app.
                  </div>
                </div>
              )}

              {/* CARD Tabs (Credit and Debit) */}
              {(paymentMethod === 'credit_card' || paymentMethod === 'debit_card') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>CARD NUMBER</label>
                    <div style={{ position: 'relative' }}>
                      <input name="card" value={cardForm.card} onChange={handleCardChange} required placeholder="•••• •••• •••• ••••" maxLength={19}
                        style={{ ...inputStyle, paddingLeft: '44px' }} />
                      <CreditCard size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-mocha)' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>EXPIRY</label>
                      <input name="expiry" value={cardForm.expiry} onChange={handleCardChange} required placeholder="MM/YY" maxLength={5}
                        style={inputStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>CVV</label>
                      <input name="cvv" value={cardForm.cvv} onChange={handleCardChange} required placeholder="•••" maxLength={4} type="password"
                        style={inputStyle} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', opacity: 0.6 }}>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, border: '1px solid #7B3FA0', color: '#7B3FA0', padding: '2px 5px', borderRadius: '3px' }}>VISA</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, border: '1px solid #7B3FA0', color: '#7B3FA0', padding: '2px 5px', borderRadius: '3px' }}>MC</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, border: '1px solid #7B3FA0', color: '#7B3FA0', padding: '2px 5px', borderRadius: '3px' }}>AMEX</span>
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, border: '1px solid #7B3FA0', color: '#7B3FA0', padding: '2px 5px', borderRadius: '3px' }}>RUPAY</span>
                  </div>
                </div>
              )}

              {/* Net Banking Tab */}
              {paymentMethod === 'netbanking' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      { id: 'hdfc', label: 'HDFC Bank' },
                      { id: 'sbi', label: 'SBI' },
                      { id: 'icici', label: 'ICICI Bank' },
                      { id: 'axis', label: 'Axis Bank' }
                    ].map(bank => (
                      <button key={bank.id} type="button" onClick={() => setSelectedBank(bank.id)}
                        style={{ padding: '12px', borderRadius: '10px', border: selectedBank === bank.id ? '2px solid var(--purple-600)' : '1px solid rgba(123,63,160,0.25)', background: selectedBank === bank.id ? 'rgba(123,63,160,0.06)' : '#fff', color: 'var(--color-espresso)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Landmark size={14} style={{ color: selectedBank === bank.id ? 'var(--purple-700)' : 'var(--color-mocha)' }} />
                        {bank.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>SELECT FROM ALL BANKS</label>
                    <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)}
                      style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.2)', background: '#fff', color: 'var(--color-espresso)', fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                      <option value="hdfc">HDFC Bank</option>
                      <option value="sbi">State Bank of India</option>
                      <option value="icici">ICICI Bank</option>
                      <option value="axis">Axis Bank</option>
                      <option value="kotak">Kotak Mahindra Bank</option>
                      <option value="pnb">Punjab National Bank</option>
                      <option value="bob">Bank of Baroda</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Trust Badges and Indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.68rem', color: 'var(--color-mocha)', fontWeight: 600 }} className="trust-row-mobile">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(45,0,77,0.02)', border: '1px solid rgba(45,0,77,0.08)' }}>
                <Check size={14} style={{ color: 'var(--purple-600)' }} /> PCI-DSS Compliant Secure
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(45,0,77,0.02)', border: '1px solid rgba(45,0,77,0.08)' }}>
                <Shield size={14} style={{ color: 'var(--purple-600)' }} /> Money-Back Guarantee
              </div>
            </div>

            {/* Submit CTA */}
            {isPlatformPaused ? (
              <div style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(29,78,216,0.08))',
                border: '1px solid rgba(37,99,235,0.25)',
                color: '#1d4ed8',
                textAlign: 'center',
                fontSize: '0.88rem',
                fontWeight: 700,
                marginTop: '8px',
              }}>
                Purchases are paused. Platform Maintenance is active.
              </div>
            ) : (
              <button type="submit" className="btn-premium btn-premium-solid buy-now-glow"
                style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: '0.9rem', borderRadius: '12px', marginTop: '8px', boxShadow: '0 8px 24px rgba(123,63,160,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} /> Authorize & Pay · {formatPrice(total)}
              </button>
            )}
          </form>

          {/* Secure simulated transaction loader overlay */}
          {isProcessing && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: '20px', zIndex: 99, padding: '40px', textAlign: 'center',
              animation: 'fade-in 0.3s ease'
            }}>
              <RefreshCw size={44} className="spin" style={{ animation: 'spin 1.5s linear infinite', color: 'var(--purple-700)', marginBottom: '24px' }} />
              <div className="caption-premium" style={{ letterSpacing: '0.15em', fontSize: '0.72rem', color: 'var(--purple-600)' }}>Securing Connection</div>
              <h3 className="text-editorial" style={{ fontSize: '1.6rem', color: 'var(--color-espresso)', marginTop: '8px', fontWeight: 500 }}>
                Processing Secure Payment
              </h3>
              <p style={{ color: 'var(--color-mocha)', fontSize: '0.85rem', marginTop: '10px', maxWidth: '300px', lineHeight: 1.4, fontWeight: 500 }}>
                {getProcessingText()}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Order Summary */}
        <div className="glass-card" style={{ padding: '32px', position: 'sticky', top: '100px' }}>
          <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '20px' }}>Order Summary</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {checkoutItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={item.preview} alt={item.title} style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(45,0,96,0.06)' }} />
                  <div>
                    <span style={{ color: 'var(--color-espresso)', fontWeight: 700, display: 'block', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-mocha)', fontWeight: 600 }}>Qty: {item.quantity || 1}</span>
                  </div>
                </div>
                <span style={{ fontWeight: 700, color: 'var(--color-espresso)' }}>{formatPrice(item.price * (item.quantity || 1))}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(216,191,227,0.15)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
                <span>Discount ({appliedPromo.code})</span>
                <span style={{ color: 'var(--purple-600)' }}>-{formatPrice(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
              <span>Platform Fee</span>
              <span>{platformFee === 0 ? 'Waived' : formatPrice(platformFee)}</span>
            </div>
            <div style={{ borderTop: '1px dashed rgba(216,191,227,0.15)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)' }}>Total</span>
              <span className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>{formatPrice(total)}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (max-width: 900px) {
          .checkout-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
        @media (max-width: 480px) {
          .trust-row-mobile { grid-template-columns: 1fr !important; }
          .text-left-mobile { text-align: left !important; }
        }
      `}</style>
    </div>
  );
}
