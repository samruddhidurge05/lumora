import React from 'react';
import { Check } from 'lucide-react';

export default function PolicyAcknowledgementCheckbox({ checked, onChange, label, id = "policy-ack-checkbox" }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        cursor: 'pointer',
        userSelect: 'none',
        padding: '12px 14px',
        borderRadius: '12px',
        background: checked ? 'rgba(123, 63, 160, 0.06)' : 'rgba(255, 255, 255, 0.5)',
        border: checked ? '1px solid rgba(123, 63, 160, 0.3)' : '1px solid rgba(196, 181, 253, 0.3)',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          minWidth: '20px',
          borderRadius: '6px',
          border: checked ? '2px solid #7B3FA0' : '2px solid #a78bfa',
          background: checked ? 'linear-gradient(135deg, #7B3FA0, #5A1E7E)' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: '2px',
          transition: 'all 0.2s ease',
          boxShadow: checked ? '0 2px 8px rgba(123, 63, 160, 0.25)' : 'none',
        }}
      >
        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          fontSize: '0.82rem',
          color: '#3B1E54',
          lineHeight: 1.5,
          fontWeight: 500,
          fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
        }}
      >
        {label || 'I have read and acknowledge the Refund Policy and understand that digital products cannot be physically returned after delivery or download.'}
      </span>
    </label>
  );
}
