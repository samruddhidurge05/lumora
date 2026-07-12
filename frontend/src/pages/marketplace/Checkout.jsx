import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Shield, Tag, AlertCircle, CheckCircle, ShoppingBag, Trash2 } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';

const INPUT = {
  padding: '11px 16px', borderRadius: '10px',
  border: '1px solid rgba(196,181,253,0.30)', background: '#fff',
  fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 500,
  color: 'var(--color-espresso)', outline: 'none',
  width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s',
};

const PROMOS = {
  'LUMORA20': { discountPercent: 20, code: 'LUMORA20', label: '20% OFF' },
  'SAVE10':   { discountPercent: 10, code: 'SAVE10',   label: '10% OFF' },
  'FIRST15':  { discountPercent: 15, code: 'FIRST15',  label: '15% OFF — First purchase' },
};

export default function Checkout() {
  const {
    cart, buyNowProduct, formatPrice, navigateTo,
    appliedPromo, setAppliedPromo,
    checkoutForm, setCheckoutForm,
    removeFromCart, platformStatus,
  } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;
  const { user } = useAuth();

  const items = buyNowProduct ? [buyNowProduct] : cart;
  const subtotal = items.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const discount = appliedPromo ? subtotal * (appliedPromo.discountPercent / 100) : 0;
  const platformFee = subtotal > 100 ? 0 : 5;
  const gst = Math.round((subtotal - discount + platformFee) * 0.18);  // 18% GST on taxable amount
  const totalINR = Math.round(subtotal - discount + platformFee + gst);

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError]  = useState('');
  const [errors, setErrors]          = useState({});
  const [saveAddr, setSaveAddr]      = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!user) navigateTo('login-selection');
  }, [user]);

  // Pre-fill from Firebase user
  useEffect(() => {
    if (user) {
      setCheckoutForm(prev => ({
        ...prev,
        name:  prev.name  || user.displayName || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user]);

  // Empty cart guard
  useEffect(() => {
    if (items.length === 0) navigateTo('marketplace');
  }, [items.length]);

  const update = (field, val) => {
    setCheckoutForm(prev => ({ ...prev, [field]: val }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    const p = PROMOS[code];
    if (p) {
      setAppliedPromo(p);
      setPromoError('');
      setPromoInput('');
      return;
    }

    // Try to validate as affiliate referral code
    setValidatingCode(true);
    setPromoError('');
    try {
      const res = await backendFetch(`/affiliate/track-click/${code}`, {
        method: 'POST'
      });
      if (res && res.tracked) {
        // Store in sessionStorage for order conversion tracking
        sessionStorage.setItem('lumora_aff_ref', code);
        setAppliedPromo({
          discountPercent: 10,
          code: code,
          label: `10% OFF — Affiliate Referral (${code})`
        });
        setPromoError('');
        setPromoInput('');
      } else {
        setPromoError('Invalid code. Try standard promos or a valid referral code.');
      }
    } catch (err) {
      console.warn('Referral verification notice:', err.message);
      setPromoError('Invalid code. Try: LUMORA20 · SAVE10 · FIRST15 or a valid referral code.');
    } finally {
      setValidatingCode(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError('');
    sessionStorage.removeItem('lumora_aff_ref');
  };

  const validate = () => {
    const e = {};
    if (!checkoutForm.name?.trim())  e.name  = 'Full name is required';
    if (!checkoutForm.email?.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(checkoutForm.email)) e.email = 'Enter a valid email';
    if (!checkoutForm.phone?.trim()) e.phone = 'Phone number is required';
    if (!checkoutForm.city?.trim())  e.city  = 'City is required';
    if (!checkoutForm.state?.trim()) e.state = 'State is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;
    if (saveAddr) {
      try { sessionStorage.setItem('lumora_saved_addr', JSON.stringify(checkoutForm)); } catch (_) {}
    }
    navigateTo('payment');
  };

  // Load saved address
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('lumora_saved_addr') || 'null');
      if (saved) {
        setCheckoutForm(prev => ({
          ...prev,
          phone:   prev.phone   || saved.phone   || '',
          city:    prev.city    || saved.city     || '',
          state:   prev.state   || saved.state    || '',
          country: prev.country || saved.country  || 'India',
          pincode: prev.pincode || saved.pincode  || '',
        }));
        setSaveAddr(true);
      }
    } catch (_) {}
  }, []);

  const field = (label, key, props = {}) => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label} {props.required !== false && <span style={{ color: '#dc2626' }}>*</span>}
      </label>
      <input
        style={{
          ...INPUT,
          borderColor: errors[key] ? 'rgba(220,38,38,0.45)' : 'rgba(196,181,253,0.30)',
          boxShadow: errors[key] ? '0 0 0 3px rgba(220,38,38,0.08)' : 'none',
        }}
        value={checkoutForm[key] || ''}
        onChange={e => update(key, e.target.value)}
        onFocus={e  => { if (!errors[key]) e.target.style.borderColor = 'rgba(123,63,160,0.50)'; }}
        onBlur={e   => { if (!errors[key]) e.target.style.borderColor = 'rgba(196,181,253,0.30)'; }}
        {...props}
      />
      {errors[key] && (
        <p style={{ fontSize: '0.68rem', color: '#dc2626', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={11} /> {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,4vw,4rem) 80px', maxWidth: '1100px', margin: '0 auto' }}>

        {/* Progress stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '36px', fontSize: '0.75rem', fontWeight: 700 }}>
          <span style={{ color: '#7B3FA0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => navigateTo('cart')}>
            <ShoppingBag size={13} /> Cart
          </span>
          <span style={{ color: 'rgba(196,181,253,0.6)' }}>›</span>
          <span style={{ color: '#2D004D' }}>Billing Details</span>
          <span style={{ color: 'rgba(196,181,253,0.6)' }}>›</span>
          <span style={{ color: '#B0A0C0' }}>Payment</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '40px', alignItems: 'start' }} className="checkout-grid">

          {/* ── Left: Billing form ── */}
          <div className="glass-card" style={{ padding: '40px' }}>
            <h1 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '8px' }}>
              Billing Details
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '32px' }}>
              Fields marked <span style={{ color: '#dc2626' }}>*</span> are required
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Name + Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {field('Full Name', 'name', { placeholder: 'Your full name' })}
                {field('Phone', 'phone', { placeholder: '+91 98765 43210', type: 'tel' })}
              </div>

              {/* Email */}
              {field('Email Address', 'email', { placeholder: 'you@example.com', type: 'email' })}

              {/* City + State + Country */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {field('City', 'city', { placeholder: 'Mumbai' })}
                {field('State', 'state', { placeholder: 'Maharashtra' })}
                {field('Country', 'country', { placeholder: 'India', required: false })}
              </div>

              {/* Pincode (optional) */}
              <div style={{ maxWidth: '180px' }}>
                {field('PIN Code', 'pincode', { placeholder: '400001', required: false })}
              </div>

              {/* Save address checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.80rem', fontWeight: 600, color: 'var(--color-espresso)' }}>
                <input
                  type="checkbox"
                  checked={saveAddr}
                  onChange={e => setSaveAddr(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#7B3FA0' }}
                />
                Save this address for future checkouts
              </label>

              {/* Promo code */}
              <div style={{ padding: '20px', borderRadius: '14px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.28)' }}>
                <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <Tag size={11} style={{ display: 'inline', marginRight: '5px' }} />
                  Promo Code
                </label>

                {appliedPromo ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                    <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d' }}>
                        {appliedPromo.code} — {appliedPromo.label || `${appliedPromo.discountPercent}% OFF`} applied!
                      </span>
                      <span style={{ display: 'block', fontSize: '0.70rem', color: '#16a34a', marginTop: '2px' }}>
                        You save {formatPrice(discount)}
                      </span>
                    </div>
                    <button onClick={removePromo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '2px', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        style={{ ...INPUT, flex: 1 }}
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(''); }}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyPromo())}
                        placeholder="Enter promo code"
                      />
                      <button
                        onClick={applyPromo}
                        disabled={validatingCode}
                        className="btn-premium"
                        style={{ padding: '11px 18px', fontSize: '0.78rem', borderRadius: '10px', whiteSpace: 'nowrap' }}
                      >
                        {validatingCode ? 'Applying...' : 'Apply'}
                      </button>
                    </div>
                    {promoError && (
                      <p style={{ fontSize: '0.70rem', color: '#dc2626', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={11} /> {promoError}
                      </p>
                    )}
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Available: LUMORA20 · SAVE10 · FIRST15 · Or enter any valid Affiliate Referral Code for 10% OFF
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* CTA */}
            {isPlatformPaused ? (
              <div style={{
                marginTop: '32px',
                padding: '16px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(29,78,216,0.08))',
                border: '1px solid rgba(37,99,235,0.25)',
                color: '#1d4ed8',
                textAlign: 'center',
                fontSize: '0.88rem',
                fontWeight: 700,
                lineHeight: 1.4
              }}>
                Platform Maintenance: Purchases are temporarily disabled.
              </div>
            ) : (
              <button
                onClick={handleContinue}
                className="btn-premium btn-premium-solid buy-now-glow"
                style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: '0.9rem', borderRadius: '12px', marginTop: '32px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Shield size={16} /> Continue to Payment <ArrowRight size={16} />
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '14px' }}>
              🔒 256-bit SSL encrypted · PCI-DSS compliant
            </p>
          </div>

          {/* ── Right: Order Summary ── */}
          <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Back button */}
            <button
              onClick={() => navigateTo('cart')}
              className="btn-premium"
              style={{ fontSize: '0.75rem', borderRadius: '20px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={13} /> Back to Cart
            </button>

            <div className="glass-card" style={{ padding: '28px' }}>
              <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '20px' }}>
                Order Summary
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({items.length} item{items.length !== 1 ? 's' : ''})
                </span>
              </h3>

              {/* Item list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                {items.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <img
                      src={item.preview || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&q=70'}
                      alt={item.title}
                      style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(220,198,255,0.25)' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.category} · Qty {item.quantity || 1}
                      </p>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7B3FA0', flexShrink: 0 }}>
                      {formatPrice(item.price * (item.quantity || 1))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price breakdown */}
              <div style={{ borderTop: '1px dashed rgba(196,181,253,0.25)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
                  <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#16a34a' }}>
                    <span>Promo ({appliedPromo.code})</span>
                    <span>−{formatPrice(discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
                  <span>Platform Fee</span>
                  <span style={{ color: platformFee === 0 ? '#16a34a' : 'inherit' }}>
                    {platformFee === 0 ? 'Waived' : formatPrice(platformFee)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-mocha)' }}>
                  <span>GST (18%)</span>
                  <span>₹{gst.toLocaleString('en-IN')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '12px', marginTop: '4px', borderTop: '1px solid rgba(196,181,253,0.20)' }}>
                  <span style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--color-espresso)' }}>Total (INR)</span>
                  <span className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, color: 'var(--color-espresso)' }}>
                    ₹{totalINR.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Trust badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed rgba(196,181,253,0.20)' }}>
                {[
                  '🔒 256-bit SSL secure checkout',
                  '♾ Lifetime access to all purchases',
                  '↩ 7-day refund policy',
                ].map(t => (
                  <p key={t} style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{t}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media(max-width:800px){.checkout-grid{grid-template-columns:1fr!important;}}
        @media(max-width:480px){.checkout-grid > div:first-child{padding:24px!important;}}
      `}</style>
    </div>
  );
}
