import React, { useState, useEffect } from 'react';
import { ArrowLeft, CreditCard, Shield, Lock, Check, Smartphone, Landmark, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { backendFetch } from '../../utils/api';
import UpiQrDisplay from '../../components/payment/UpiQrDisplay';

export default function Payment() {
  const { cart, navigateTo, completePurchase, formatPrice, buyNowProduct, appliedPromo, checkoutForm, platformStatus } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;

  const [paymentMethod, setPaymentMethod] = useState('razorpay'); // 'upi', 'upi_qr', 'credit_card', 'debit_card', 'netbanking'
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay'); // 'gpay', 'phonepe', 'paytm', 'custom'
  const [upiId, setUpiId] = useState('samdurge@okaxis');
  const [selectedBank, setSelectedBank] = useState('hdfc');
  const [cardForm, setCardForm] = useState({ card: '', expiry: '', cvv: '' });

  // Loading overlay state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  
  // UPI QR Session state
  const [upiSessionData, setUpiSessionData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('lumora_upi_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Discard expired sessions so the user never sees "Payment Session Expired" on load
      if (parsed?.expires_at) {
        const expiresAt = new Date(parsed.expires_at).getTime();
        if (Date.now() >= expiresAt) {
          sessionStorage.removeItem('lumora_upi_session');
          sessionStorage.removeItem('lumora_idempotency_key');
          return null;
        }
      }
      return parsed;
    } catch { return null; }
  });

  const checkoutItems = buyNowProduct ? [buyNowProduct] : cart;
  const subtotal = checkoutItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);
  
  // Calculations
  const discount = appliedPromo ? subtotal * (appliedPromo.discountPercent / 100) : 0;
  const platformFee = subtotal > 100 ? 0 : 5;
  const gst = Math.round((subtotal - discount + platformFee) * 0.18);  // 18% GST
  const total = Math.round(subtotal - discount + platformFee + gst);

  // Persist UPI session to sessionStorage
  useEffect(() => {
    if (upiSessionData) {
      sessionStorage.setItem('lumora_upi_session', JSON.stringify(upiSessionData));
    } else {
      sessionStorage.removeItem('lumora_upi_session');
    }
  }, [upiSessionData]);

  // Payment ref for status polling on recovery
  const [pendingPaymentRef, setPendingPaymentRef] = useState(() =>
    sessionStorage.getItem('lumora_pending_payment_ref') || null
  );

  // Persist pending payment ref for browser-close recovery
  useEffect(() => {
    if (pendingPaymentRef) {
      sessionStorage.setItem('lumora_pending_payment_ref', pendingPaymentRef);
    } else {
      sessionStorage.removeItem('lumora_pending_payment_ref');
    }
  }, [pendingPaymentRef]);

  // Safeguard: Redirect to marketplace if cart and buyNowProduct are empty (e.g. after refresh)
  useEffect(() => {
    if (checkoutItems.length === 0) {
      navigateTo('marketplace');
    }
  }, [checkoutItems.length, navigateTo]);

  // Recovery: check if there's an incomplete payment from a previous session
  useEffect(() => {
    const ref = sessionStorage.getItem('lumora_pending_payment_ref');
    if (!ref) return;
    
    backendFetch(`/payments/${ref}`).then(p => {
      if (p?.status === 'SUCCESS') {
        // Already fulfilled — clear and redirect to success
        sessionStorage.removeItem('lumora_pending_payment_ref');
        sessionStorage.removeItem('lumora_idempotency_key');
        sessionStorage.removeItem('lumora_upi_session');
        completePurchase('razorpay', ref, appliedPromo?.code || null, discount);
      } else if (p?.status === 'FAILED' || p?.status === 'CANCELLED') {
        // Failed/cancelled — clear stale session data
        sessionStorage.removeItem('lumora_pending_payment_ref');
        sessionStorage.removeItem('lumora_idempotency_key');
        sessionStorage.removeItem('lumora_upi_session');
        setPendingPaymentRef(null);
      }
      // PENDING/PROCESSING — leave it for the user to retry with fresh session
    }).catch(() => {
      // Network error — clear stale data to prevent indefinite recovery attempts
      sessionStorage.removeItem('lumora_pending_payment_ref');
      sessionStorage.removeItem('lumora_idempotency_key');
      sessionStorage.removeItem('lumora_upi_session');
      setPendingPaymentRef(null);
    });
  }, []);

  /**
   * Open Razorpay Checkout modal.
   * Called after backend creates the gateway order and returns gateway_order_id.
   */
  const openRazorpayCheckout = (initResponse) => {
    if (!window.Razorpay) {
      alert('Payment SDK failed to load. Please check your network connection.');
      setIsProcessing(false);
      return;
    }

    const options = {
      key: initResponse.gateway_key,
      amount: Math.round(total * 100),   // paise
      currency: initResponse.currency || 'INR',
      name: 'Lumora Digital Marketplace',
      description: 'Secure Digital Product Purchase',
      order_id: initResponse.gateway_order_id,
      image: '/favicon.ico',
      prefill: {
        name:    checkoutForm?.name  || '',
        email:   checkoutForm?.email || '',
        contact: checkoutForm?.phone || '',
      },
      theme: { color: '#7B3FA0' },
      modal: {
        ondismiss: () => {
          setIsProcessing(false);
          setProcessingStep(0);
          console.info('[Payment] Razorpay modal dismissed by user.');
        },
      },
      handler: async function (response) {
        // Called by Razorpay after successful payment
        setIsProcessing(true);
        setProcessingStep(2);
        try {
          const confirmRes = await backendFetch('/payments/confirm', {
            method: 'POST',
            body: JSON.stringify({
              payment_ref:        initResponse.payment_ref,
              gateway_payment_id: response.razorpay_payment_id,
              gateway_signature:  response.razorpay_signature,
              payment_method:     paymentMethod,
            }),
          });
          if (confirmRes?.success) {
            // Clear all session data on successful confirmation
            setPendingPaymentRef(null);
            sessionStorage.removeItem('lumora_pending_payment_ref');
            sessionStorage.removeItem('lumora_idempotency_key');
            sessionStorage.removeItem('lumora_upi_session');
            completePurchase(
              'razorpay',
              confirmRes.payment_ref || initResponse.payment_ref,
              appliedPromo?.code || null,
              discount
            );
          } else {
            alert('Payment confirmation failed. Please contact support with ref: ' + initResponse.payment_ref);
            setIsProcessing(false);
          }
        } catch (err) {
          console.error('[Payment] Confirm error:', err);
          alert('Server error during confirmation. Your payment may have been captured. Ref: ' + initResponse.payment_ref);
          setIsProcessing(false);
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      console.error('[Payment] Razorpay payment failed:', response.error);
      alert(`Payment failed: ${response.error.description}`);
      setIsProcessing(false);
    });
    rzp.open();
  };

  const handleCardChange = e => {
    let { name, value } = e.target;
    if (name === 'card') {
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

  // ── generateUpiQr: defined FIRST so handleSubmit and handleQrVerified can call it ──
  const generateUpiQr = async () => {
    const freshIdempotencyKey = 'idemp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('lumora_idempotency_key', freshIdempotencyKey);

    setIsProcessing(true);
    setProcessingStep(0);

    const upiPayeeId = 'lumora@upi';
    const merchantName = 'Lumora Marketplace';
    const intentUrl = `upi://pay?pa=${upiPayeeId}&pn=${encodeURIComponent(merchantName)}&am=${total.toFixed(2)}&tr=${freshIdempotencyKey}&cu=INR`;
    const freshExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const localSessionData = {
      payment_ref: 'LUM-' + Date.now(),
      upi_id: upiPayeeId,
      upi_intent_url: intentUrl,
      qr_code_data: intentUrl,
      amount: total,
      currency: 'INR',
      status: 'PENDING',
      expires_at: freshExpiry,
    };

    try {
      const res = await backendFetch('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({
          items: checkoutItems.map(i => ({ product_id: parseInt(i.id), price_paid: parseFloat(i.price) || 0 })),
          total_amount: parseFloat(total.toFixed(2)),
          currency: 'INR',
          payment_method: 'upi_qr',
          idempotency_key: freshIdempotencyKey,
          promo_code: appliedPromo?.code || null,
          affiliate_code: sessionStorage.getItem('lumora_aff_ref') || null,
          discount_amount: parseFloat(discount.toFixed(2)),
          tax_amount: parseFloat((platformFee + gst).toFixed(2)),
        }),
      });
      if (res?.gateway_order_id && !res.gateway_order_id.startsWith('mock_')) {
        // Live Razorpay - open Checkout modal instead of UpiQrDisplay
        if (!window.Razorpay) {
          alert('Payment gateway SDK (Razorpay) failed to load. Please check your internet connection or disable ad blockers.');
          setIsProcessing(false);
          return;
        }
        setIsProcessing(false);
        openRazorpayCheckout(res);
        return;
      }
      setUpiSessionData({
        ...localSessionData,
        ...(res?.payment_ref ? { payment_ref: res.payment_ref } : {}),
        ...(res?.upi_id ? { upi_id: res.upi_id } : {}),
        ...(res?.upi_intent_url ? { upi_intent_url: res.upi_intent_url, qr_code_data: res.upi_intent_url } : {}),
        ...(res?.expires_at ? { expires_at: res.expires_at } : {}),
      });
      if (res?.payment_ref) setPendingPaymentRef(res.payment_ref);
    } catch (err) {
      console.error('[Payment] Generate QR failed:', err);
      // 429 Rate Limit — show a friendly cooldown message instead of crashing
      if (err.message && err.message.includes('429')) {
        alert('Too many payment requests. Please wait 30 seconds before trying again.');
      } else {
        alert('Failed to generate QR code: ' + (err.message || 'Please try again.'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Generate a fresh idempotency key for each new payment attempt to prevent reuse
    const freshIdempotencyKey = 'idemp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Build shared payload — amounts are in INR (no * 80 conversion)
    const basePayload = {
      items: checkoutItems.map(i => ({
        product_id: parseInt(i.id),
        price_paid: parseFloat(i.price) || 0,
      })),
      total_amount: parseFloat(total.toFixed(2)),
      currency: 'INR',
      payment_method: paymentMethod,
      idempotency_key: freshIdempotencyKey,
      promo_code:     appliedPromo?.code || null,
      affiliate_code: sessionStorage.getItem('lumora_aff_ref') || null,
      discount_amount: parseFloat(discount.toFixed(2)),
      tax_amount: parseFloat((platformFee + gst).toFixed(2)),
    };

    // Store the fresh idempotency key
    sessionStorage.setItem('lumora_idempotency_key', basePayload.idempotency_key);

    // ── Razorpay Checkout Flow (card, UPI, netbanking, wallet) ──────────────
    setIsProcessing(true);
    setProcessingStep(1);
    try {
      const res = await backendFetch('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify(basePayload),
      });

      if (!res?.payment_ref) {
        throw new Error('Invalid initiate response from server');
      }

      setPendingPaymentRef(res.payment_ref);
      setProcessingStep(2);

      // If the gateway is mock (no real credentials), fall back to simulated flow
      if (!res.gateway_order_id || res.gateway_order_id.startsWith('mock_')) {
        // Mock mode — complete without Razorpay modal
        await new Promise(resolve => setTimeout(resolve, 800));
        
        try {
          await backendFetch('/payments/confirm', {
            method: 'POST',
            body: JSON.stringify({
              payment_ref:        res.payment_ref,
              gateway_payment_id: 'mock_pay_' + Date.now(),
              gateway_signature:  'mock_sig',
              payment_method:     paymentMethod,
            }),
          });
        } catch (confirmErr) {
          console.warn('[Payment] Mock confirmation backend call failed:', confirmErr.message);
        }

        // Clear session data before completing purchase
        setPendingPaymentRef(null);
        sessionStorage.removeItem('lumora_idempotency_key');
        sessionStorage.removeItem('lumora_pending_payment_ref');
        sessionStorage.removeItem('lumora_upi_session');
        
        completePurchase(paymentMethod, res.payment_ref, appliedPromo?.code || null, discount);
        setIsProcessing(false);
        return;
      }

      // Live Razorpay — open checkout modal
      if (!window.Razorpay) {
        alert('Payment gateway SDK (Razorpay) failed to load. Please check your internet connection or disable ad blockers.');
        setIsProcessing(false);
        return;
      }

      setIsProcessing(false);
      openRazorpayCheckout(res);

    } catch (err) {
      console.error('[Payment] Initiate failed:', err);
      if (err.message && err.message.includes('429')) {
        alert('Too many payment requests. Please wait 30 seconds before trying again.');
      } else {
        alert('Failed to start payment: ' + (err.message || 'Please try again.'));
      }
      setIsProcessing(false);
    }
  };

  const handleTestBypass = async () => {
    setIsProcessing(true);
    setProcessingStep(1);
    
    const freshIdempotencyKey = 'bypass_idemp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const basePayload = {
      items: checkoutItems.map(i => ({
        product_id: parseInt(i.id),
        price_paid: parseFloat(i.price) || 0,
      })),
      total_amount: parseFloat(total.toFixed(2)),
      currency: 'INR',
      payment_method: 'test_bypass',
      idempotency_key: freshIdempotencyKey,
      promo_code:     appliedPromo?.code || null,
      affiliate_code: sessionStorage.getItem('lumora_aff_ref') || null,
      discount_amount: parseFloat(discount.toFixed(2)),
      tax_amount: parseFloat((platformFee + gst).toFixed(2)),
    };

    try {
      const res = await backendFetch('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify(basePayload),
      });

      if (!res?.payment_ref) {
        throw new Error('Invalid initiate response from server');
      }

      setProcessingStep(2);

      await backendFetch('/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          payment_ref:        res.payment_ref,
          gateway_payment_id: 'bypass_pay_' + Date.now(),
          gateway_signature:  'bypass_signature_verification_test',
          payment_method:     'test_bypass',
        }),
      });

      setPendingPaymentRef(null);
      sessionStorage.removeItem('lumora_idempotency_key');
      sessionStorage.removeItem('lumora_pending_payment_ref');
      sessionStorage.removeItem('lumora_upi_session');
      
      completePurchase('test_bypass', res.payment_ref, appliedPromo?.code || null, discount);
      
    } catch (err) {
      console.error('[Payment] Test bypass failed:', err);
      alert('Test bypass failed: ' + (err.message || 'Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQrVerified = async (confirmResponse) => {
    // Clear persisted UPI session completely
    sessionStorage.removeItem('lumora_upi_session');
    sessionStorage.removeItem('lumora_idempotency_key');
    sessionStorage.removeItem('lumora_pending_payment_ref');
    setUpiSessionData(null);
    setPendingPaymentRef(null);

    if (!confirmResponse) {
      // Session expired — regenerate QR only if not already processing (prevents 429 loop)
      if (!isProcessing) {
        await generateUpiQr();
      }
      return;
    }

    // Complete checkout — use confirmed payment_ref or fallback to session data ref
    const ref = confirmResponse?.payment_ref || ('LUM-' + Date.now());
    completePurchase(
      'upi_qr',
      ref,
      appliedPromo?.code || null,
      discount
    );
  };

  const getProcessingText = () => {
    if (paymentMethod === 'upi_qr') return 'Generating UPI QR Code...';
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
    <div className="lumora-checkout-page" style={{ minHeight: '100vh', padding: '32px clamp(16px, 4vw, 48px)', position: 'relative', zIndex: 20 }}>
      {/* Back button */}
      <button onClick={() => navigateTo('checkout')} className="btn-premium"
        style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '20px', marginBottom: '32px' }}>
        <ArrowLeft size={14} /> Back to Details
      </button>

      <div className="checkout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', maxWidth: '1100px', margin: '0 auto', alignItems: 'start' }}>
        {/* Left Column: Form */}
        <div className="glass-card" style={{ padding: '40px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h1 className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>Secure Checkout</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--purple-700)', fontSize: '0.72rem', fontWeight: 700 }}>
              <Lock size={12} /> SSL Secured
            </div>
          </div>

          {/* Customer & Billing Details */}
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em', marginBottom: '12px', textTransform: 'uppercase' }}>Customer & Billing Details</h3>
            <div style={{ padding: '20px', borderRadius: '14px', background: 'rgba(123, 63, 160, 0.03)', border: '1px solid rgba(123, 63, 160, 0.12)', fontSize: '0.82rem', color: 'var(--color-espresso)', lineHeight: '1.6' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }} className="trust-row-mobile">
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em', marginBottom: '4px', textTransform: 'uppercase' }}>Contact Information</span>
                  <strong>{checkoutForm.name}</strong>
                  <div style={{ opacity: 0.85 }}>{checkoutForm.email}</div>
                  <div style={{ opacity: 0.85 }}>{checkoutForm.phone}</div>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.05em', marginBottom: '4px', textTransform: 'uppercase' }}>Billing Address</span>
                  <div>{checkoutForm.city}, {checkoutForm.state}</div>
                  <div>{checkoutForm.country}</div>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              }}>
                Purchases are paused. Platform Maintenance is active.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button type="submit" className="btn-premium btn-premium-solid buy-now-glow"
                  style={{ width: '100%', justifyContent: 'center', padding: '18px', fontSize: '1rem', borderRadius: '12px', boxShadow: '0 8px 24px rgba(123,63,160,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={16} /> Pay {formatPrice(total)}
                </button>
                
                <button type="button" onClick={handleTestBypass} className="btn-premium"
                  style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '0.85rem', borderRadius: '12px', background: '#F59E0B', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }}>
                  ⚡ Test Bypass Checkout (Free)
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <button type="button" onClick={() => navigateTo('checkout')} style={{ background: 'none', border: 'none', color: 'var(--purple-700)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                    Change order details
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Secure transaction indicators */}
          <div className="payment-trust-grid" style={{ fontSize: '0.68rem', color: 'var(--color-mocha)', fontWeight: 600, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(45,0,77,0.02)', border: '1px solid rgba(45,0,77,0.08)' }}>
              <Check size={14} style={{ color: 'var(--purple-600)' }} /> PCI-DSS Compliant Secure
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(45,0,77,0.02)', border: '1px solid rgba(45,0,77,0.08)' }}>
              <Shield size={14} style={{ color: 'var(--purple-600)' }} /> Money-Back Guarantee
            </div>
          </div>

          {/* Secure simulated transaction loader overlay */}
          {isProcessing && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(255, 255, 255, 0.94)',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
              <span>GST (18%)</span>
              <span>{formatPrice(gst)}</span>
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
