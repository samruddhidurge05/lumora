import React from 'react';
import { ShoppingBag, CheckCircle, X } from 'lucide-react';

export default function PurchaseConfirmationDialog({ isOpen, onClose, onConfirm, productName, productPrice }) {
  if (!isOpen) return null;

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
        zIndex: 999999,
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
          maxWidth: '500px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(45, 0, 77, 0.3)',
          border: '1px solid rgba(196, 181, 253, 0.4)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 26px 18px',
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
                background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                boxShadow: '0 4px 12px rgba(123, 63, 160, 0.2)',
              }}
            >
              <ShoppingBag size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#2D004D' }}>
              Confirm Purchase
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

        {/* Dialog Content */}
        <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {productName && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(123, 63, 160, 0.04)',
                border: '1px solid rgba(196, 181, 253, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#2D004D' }}>
                {productName}
              </span>
              {productPrice && (
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#7B3FA0' }}>
                  {productPrice}
                </span>
              )}
            </div>
          )}

          <p style={{ margin: 0, fontSize: '0.86rem', color: '#4A2E65', lineHeight: 1.5 }}>
            You are purchasing a downloadable digital product.
          </p>

          <p style={{ margin: 0, fontSize: '0.86rem', color: '#4A2E65', lineHeight: 1.5 }}>
            This product cannot be physically returned once delivered or downloaded.
          </p>

          <p style={{ margin: 0, fontSize: '0.86rem', color: '#4A2E65', lineHeight: 1.5 }}>
            Refund requests are reviewed according to Lumora's Refund Policy. Repeated abuse or fraudulent misuse of the refund policy may result in account restrictions in accordance with Lumora's Terms of Service.
          </p>

          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#2D004D', fontWeight: 700 }}>
            Please confirm that you understand the applicable purchase policies before completing your purchase.
          </p>
        </div>

        {/* Buttons */}
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
            onClick={onConfirm}
            style={{
              padding: '11px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              color: '#FFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(123, 63, 160, 0.25)',
            }}
          >
            <CheckCircle size={15} />
            <span>Confirm Purchase</span>
          </button>
        </div>
      </div>
    </div>
  );
}
