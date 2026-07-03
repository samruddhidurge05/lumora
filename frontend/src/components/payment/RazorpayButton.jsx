import React from 'react';

// Razorpay integration placeholder — uses simulated payment in current build
export default function RazorpayButton({ amount, onSuccess, onFailure }) {
  const handleClick = () => {
    // Simulated success
    setTimeout(() => onSuccess && onSuccess({ razorpay_payment_id: `pay_${Date.now()}` }), 1500);
  };
  return (
    <button onClick={handleClick} className="btn-premium btn-premium-solid" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.9rem', borderRadius: '12px' }}>
      Pay ₹{amount} with Razorpay
    </button>
  );
}
