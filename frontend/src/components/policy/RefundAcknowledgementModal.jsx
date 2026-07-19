import React, { useState } from 'react';
import { X, ShieldAlert, ArrowRight, FileText } from 'lucide-react';
import PolicyAcknowledgementCheckbox from './PolicyAcknowledgementCheckbox';
import PolicyLink from './PolicyLink';

export default function RefundAcknowledgementModal({ isOpen, onClose, onContinue, onOpenFullPolicy }) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleContinue = () => {
    if (!acknowledged) return;
    onContinue();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 10, 22, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: '24px',
          maxWidth: '560px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(45, 0, 77, 0.28)',
          border: '1px solid rgba(196, 181, 253, 0.4)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '22px 26px',
            borderBottom: '1px solid rgba(196, 181, 253, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #FAF5FF 0%, #FFF 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(123, 63, 160, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#7B3FA0',
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#2D004D' }}>
              Important Purchase Policies
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(123, 63, 160, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5A1E7E',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#4A2E65', lineHeight: 1.55 }}>
            You are purchasing a digital product that will be delivered electronically.
          </p>

          <p style={{ margin: 0, fontSize: '0.88rem', color: '#4A2E65', lineHeight: 1.55 }}>
            Digital products cannot be physically returned after delivery or download.
          </p>

          <p style={{ margin: 0, fontSize: '0.88rem', color: '#4A2E65', lineHeight: 1.55 }}>
            Refund requests are reviewed according to Lumora's Refund Policy. If a refund is approved, access to the refunded digital product may be revoked.
          </p>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(123, 63, 160, 0.05)',
              border: '1px solid rgba(196, 181, 253, 0.3)',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#3B1E54', lineHeight: 1.55, fontWeight: 500 }}>
              Repeated abuse, fraudulent refund activity, or misuse of the refund policy may result in temporary or permanent account restrictions, including account termination, in accordance with Lumora's Terms of Service.
            </p>
          </div>

          {onOpenFullPolicy && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <PolicyLink onClick={onOpenFullPolicy} label="Read Full Refund Policy" />
            </div>
          )}

          <div style={{ marginTop: '8px' }}>
            <PolicyAcknowledgementCheckbox
              checked={acknowledged}
              onChange={setAcknowledged}
              id="modal-policy-ack-check"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: '18px 26px',
            borderTop: '1px solid rgba(196, 181, 253, 0.25)',
            background: '#FAF5FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(196, 181, 253, 0.4)',
              background: '#FFF',
              color: '#5A1E7E',
              fontSize: '0.86rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!acknowledged}
            style={{
              padding: '11px 24px',
              borderRadius: '12px',
              border: 'none',
              background: acknowledged
                ? 'linear-gradient(135deg, #7B3FA0, #5A1E7E)'
                : 'rgba(123, 63, 160, 0.3)',
              color: '#FFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: acknowledged ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: acknowledged ? '0 4px 14px rgba(123, 63, 160, 0.25)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <span>Continue to Purchase</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
