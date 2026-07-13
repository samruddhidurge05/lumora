import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Clock, RefreshCw } from 'lucide-react';
import { backendFetch } from '../../utils/api';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(amount));

export default function UpiQrDisplay({ paymentData, onVerified }) {
  const upiId  = paymentData?.upi_id  || 'lumora@upi';
  const qrData = paymentData?.qr_code_data || paymentData?.upi_intent_url || upiId;
  const amount = paymentData?.amount || 0;

  // ── Compute initial seconds remaining from expires_at ──────────────────
  const calcInitialSeconds = () => {
    if (paymentData?.expires_at) {
      const rem = Math.floor((new Date(paymentData.expires_at).getTime() - Date.now()) / 1000);
      return rem > 0 ? rem : 0;
    }
    return 15 * 60; // default 15 min
  };

  const [timeLeft,  setTimeLeft]  = useState(calcInitialSeconds);
  const [status,    setStatus]    = useState(timeLeft <= 0 ? 'EXPIRED' : 'PENDING');
  const [copied,    setCopied]    = useState(false);
  const [verifying, setVerifying] = useState(false);

  // ── Single interval — no dependency on timeLeft to avoid re-creating every second ──
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  useEffect(() => {
    // If already expired on mount, don't start timer
    if (timeLeftRef.current <= 0) {
      sessionStorage.removeItem('lumora_upi_session');
      sessionStorage.removeItem('lumora_idempotency_key');
      sessionStorage.removeItem('lumora_pending_payment_ref');
      setStatus('EXPIRED');
      return;
    }

    const timer = setInterval(() => {
      const next = timeLeftRef.current - 1;
      setTimeLeft(next);
      if (next <= 0) {
        clearInterval(timer);
        sessionStorage.removeItem('lumora_upi_session');
        sessionStorage.removeItem('lumora_idempotency_key');
        sessionStorage.removeItem('lumora_pending_payment_ref');
        setStatus('EXPIRED');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []); // ← runs once per mount; payment_ref change triggers remount via key prop

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMockVerify = async () => {
    setVerifying(true);
    const backendRefPattern = /^LUM-\d{8}-[A-Z0-9]{8}$/;
    const isLocalRef = !paymentData?.payment_ref || !backendRefPattern.test(paymentData.payment_ref);

    const finish = (res) => {
      sessionStorage.removeItem('lumora_upi_session');
      sessionStorage.removeItem('lumora_idempotency_key');
      sessionStorage.removeItem('lumora_pending_payment_ref');
      setStatus('SUCCESS');
      setTimeout(() => onVerified(res), 1500);
    };

    if (isLocalRef) {
      finish({ payment_ref: paymentData.payment_ref, success: true });
      return;
    }

    try {
      const res = await backendFetch('/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          payment_ref:        paymentData.payment_ref,
          gateway_payment_id: 'mock_pay_' + Date.now(),
          gateway_signature:  'mock_sig',
          payment_method:     'upi_qr',
        }),
      });
      finish(res?.success ? res : { payment_ref: paymentData.payment_ref, success: true });
    } catch {
      finish({ payment_ref: paymentData.payment_ref, success: true });
    }
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── EXPIRED screen ───────────────────────────────────────────────────────
  if (status === 'EXPIRED') {
    sessionStorage.removeItem('lumora_upi_session');
    sessionStorage.removeItem('lumora_idempotency_key');
    sessionStorage.removeItem('lumora_pending_payment_ref');
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 30,
          background: 'rgba(220,38,38,0.10)', color: '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <Clock size={30} />
        </div>
        <h3 style={{ fontSize: '1.4rem', color: 'var(--color-espresso)', marginBottom: 10 }}>
          Payment Session Expired
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          The 15-minute window for this QR code has passed.
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.75 }}>
          Click below to instantly get a brand-new QR with a fresh 15-minute timer.
        </p>
        <button
          onClick={() => {
            sessionStorage.removeItem('lumora_upi_session');
            sessionStorage.removeItem('lumora_idempotency_key');
            sessionStorage.removeItem('lumora_pending_payment_ref');
            if (typeof onVerified === 'function') onVerified(null);
          }}
          className="btn-premium"
          style={{ marginTop: 24, padding: '12px 28px', fontSize: '0.9rem' }}
        >
          Generate New QR Code
        </button>
      </div>
    );
  }

  // ── SUCCESS screen ───────────────────────────────────────────────────────
  if (status === 'SUCCESS') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 30,
          background: 'rgba(34,197,94,0.10)', color: '#16a34a',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
        }}>
          <Check size={30} />
        </div>
        <h3 style={{ fontSize: '1.4rem', color: 'var(--color-espresso)', marginBottom: 10 }}>
          Payment Successful!
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Redirecting to your order...</p>
      </div>
    );
  }

  // ── QR screen ────────────────────────────────────────────────────────────
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&margin=10`;
  const isUrgent   = timeLeft < 300;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 10 }}>

      {/* Timer pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', borderRadius: 20,
        background: isUrgent ? 'rgba(220,38,38,0.10)' : 'rgba(123,63,160,0.10)',
        color: isUrgent ? '#dc2626' : 'var(--purple-700)',
        fontSize: '0.85rem', fontWeight: 700,
      }}>
        <Clock size={16} />
        Expires in {formatTime(timeLeft)}
      </div>

      {/* QR image */}
      <div style={{
        padding: 20, background: '#fff', borderRadius: 16,
        border: '1px solid rgba(123,63,160,0.2)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
      }}>
        <img src={qrImageUrl} alt="UPI QR Code" style={{ width: 180, height: 180, display: 'block', borderRadius: 8 }} />
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.05em' }}>
          SCAN TO PAY
        </p>
        <p style={{ fontSize: '1.8rem', color: 'var(--color-espresso)', fontWeight: 400 }} className="text-editorial">
          {formatINR(amount)}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Order Ref: {paymentData.payment_ref}
        </p>
      </div>

      {/* UPI ID copy row */}
      <div style={{
        width: '100%', maxWidth: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(123,63,160,0.04)', border: '1px dashed rgba(123,63,160,0.3)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-mocha)', fontWeight: 800 }}>UPI ID</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-espresso)', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {upiId}
          </span>
        </div>
        <button type="button" onClick={handleCopy}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-600)', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 700 }}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>

      {/* Verify button */}
      <button
        type="button"
        onClick={handleMockVerify}
        disabled={verifying}
        className="btn-premium btn-premium-solid"
        style={{ width: '100%', maxWidth: 300, marginTop: 10, padding: 16, display: 'flex', justifyContent: 'center', gap: 8, fontSize: '0.9rem' }}
      >
        {verifying
          ? <><RefreshCw size={16} style={{ animation: 'spin 1.5s linear infinite' }} /> Verifying...</>
          : "I've Paid (Mock Verify)"
        }
      </button>

      <style>{`@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
