import React, { useState, useEffect } from 'react';
import { Copy, Check, Clock, RefreshCw } from 'lucide-react';
import { backendFetch } from '../../utils/api';

const formatINR = (amount) => 
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(amount));

export default function UpiQrDisplay({ paymentData, onVerified }) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [status, setStatus] = useState(paymentData?.status || 'PENDING');
  const [verifying, setVerifying] = useState(false);

  const upiId = paymentData?.upi_id || 'lumora@upi';
  const qrData = paymentData?.qr_code_data || paymentData?.upi_intent_url || upiId;
  const amount = paymentData?.amount || 0;
  
  // Calculate expiry based on backend expires_at if available
  useEffect(() => {
    if (paymentData?.expires_at) {
      const expiresAt = new Date(paymentData.expires_at).getTime();
      const now = new Date().getTime();
      const remainingSeconds = Math.floor((expiresAt - now) / 1000);
      if (remainingSeconds > 0) {
        setTimeLeft(remainingSeconds);
      } else {
        setTimeLeft(0);
        setStatus('EXPIRED');
      }
    }
  }, [paymentData]);

  // Expiry timer
  useEffect(() => {
    if (status !== 'PENDING') return;
    
    if (timeLeft <= 0) {
      setStatus('EXPIRED');
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  const handleCopy = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMockVerify = async () => {
    setVerifying(true);
    
    try {
      // Send mock confirmation to backend
      const res = await backendFetch('/payments/confirm', {
        method: 'POST',
        body: JSON.stringify({
          payment_ref: paymentData.payment_ref,
          gateway_payment_id: 'mock_pay_' + Date.now(),
          gateway_signature: 'mock_sig',
          payment_method: 'upi_qr'
        })
      });
      
      if (res && res.success) {
        setStatus('SUCCESS');
        // Let user see success briefly before redirecting
        setTimeout(() => {
          onVerified(res);
        }, 1500);
      } else {
        alert('Payment confirmation failed. Try again.');
        setVerifying(false);
      }
    } catch (err) {
      console.error('Verification failed', err);
      // Fallback for mock if backend fails but we want to unblock checkout
      alert('Payment confirmation failed. Try again.');
      setVerifying(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (status === 'EXPIRED') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Clock size={30} />
        </div>
        <h3 style={{ fontSize: '1.4rem', color: 'var(--color-espresso)', marginBottom: '10px' }}>Payment Session Expired</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>The 15-minute window for this QR code has passed.</p>
        <button onClick={() => window.location.reload()} className="btn-premium" style={{ marginTop: '20px', padding: '10px 20px' }}>
          Start New Checkout
        </button>
      </div>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: 'rgba(34,197,94,0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Check size={30} />
        </div>
        <h3 style={{ fontSize: '1.4rem', color: 'var(--color-espresso)', marginBottom: '10px' }}>Payment Successful!</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Redirecting to your order...</p>
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&margin=10`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', background: timeLeft < 300 ? 'rgba(220,38,38,0.1)' : 'rgba(123,63,160,0.1)', color: timeLeft < 300 ? '#dc2626' : 'var(--purple-700)', fontSize: '0.85rem', fontWeight: 700 }}>
        <Clock size={16} /> 
        Expires in {formatTime(timeLeft)}
      </div>

      <div style={{ padding: '20px', background: '#fff', borderRadius: '16px', border: '1px solid rgba(123,63,160,0.2)', boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}>
        <img src={qrImageUrl} alt="UPI QR Code" style={{ width: '180px', height: '180px', display: 'block', borderRadius: '8px' }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>SCAN TO PAY</p>
        <p style={{ fontSize: '1.8rem', color: 'var(--color-espresso)', fontWeight: 400 }} className="text-editorial">
          {formatINR(amount)}
        </p>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Order Ref: {paymentData.payment_ref}
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(123,63,160,0.04)', border: '1px dashed rgba(123,63,160,0.3)', borderRadius: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-mocha)', fontWeight: 800 }}>UPI ID</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-espresso)', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden' }}>{upiId}</span>
        </div>
        <button type="button" onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--purple-600)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
      </div>

      <button 
        type="button"
        onClick={handleMockVerify} 
        disabled={verifying}
        className="btn-premium btn-premium-solid"
        style={{ width: '100%', maxWidth: '300px', marginTop: '10px', padding: '16px', display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '0.9rem' }}
      >
        {verifying ? (
          <><RefreshCw size={16} className="spin" style={{ animation: 'spin 1.5s linear infinite' }} /> Verifying...</>
        ) : (
          'I\'ve Paid (Mock Verify)'
        )}
      </button>
      <style>{`
        .spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
