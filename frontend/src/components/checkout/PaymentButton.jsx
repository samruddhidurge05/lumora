import React from 'react';
import { Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function PaymentButton({ total, onClick, loading }) {
  const { formatPrice } = useApp();
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="btn-premium btn-premium-solid buy-now-glow"
      style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '0.9rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <Shield size={16} />
      {loading ? 'Processing…' : `Pay ${formatPrice(total)}`}
    </button>
  );
}
