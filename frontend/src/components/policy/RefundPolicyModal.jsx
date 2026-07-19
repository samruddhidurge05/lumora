import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

export default function RefundPolicyModal({ isOpen, onClose }) {
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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(45, 0, 77, 0.25)',
          border: '1px solid rgba(196, 181, 253, 0.4)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '22px 28px',
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
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#2D004D' }}>
                Lumora Refund Policy
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#7B5FA0', fontWeight: 500 }}>
                Customer Rights, Digital Asset Terms & Misuse Policies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(123, 63, 160, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#5A1E7E',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body - Scrollable */}
        <div
          style={{
            padding: '28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            color: '#3B1E54',
            fontSize: '0.88rem',
            lineHeight: 1.6,
          }}
        >
          {/* Section 1 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              1. Overview
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              Lumora is a marketplace dedicated to premium digital products, including software templates, design assets, educational guides, and downloadable media. Because digital items are delivered electronically and become accessible upon purchase, their return process differs fundamentally from physical merchandise.
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              2. Digital Product Nature
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              Digital products cannot be physically returned or restored once transmitted or downloaded. Upon completing a transaction, access tokens and download links are issued to your account vault.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              3. Refund Eligibility
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              All refund requests are individually reviewed by Lumora Support according to platform criteria. Eligibility requires that the request be submitted within the applicable review window and meet standard conditions such as uncorrupted delivery issues, incorrect product files, or duplicate billing.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              4. Non-Returnable Digital Products
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              Once a digital product has been successfully delivered or downloaded to your device, it cannot be physically returned. Simple change of mind after successful file retrieval does not constitute physical return eligibility.
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              5. Refund Review Process
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              Submitting a refund request initiates a review of the transaction logs, purchase details, and asset accessibility metrics. Requests are evaluated fairly to support genuine customer needs.
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              6. Approved Refunds and Loss of Access
            </h4>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(123, 63, 160, 0.06)',
                border: '1px solid rgba(196, 181, 253, 0.3)',
                marginTop: '4px',
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, color: '#5A1E7E' }}>
                If a refund is approved, access to the refunded digital product may be revoked immediately, and associated download licenses will be invalidated.
              </p>
            </div>
          </div>

          {/* Section 7 & 8 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              7. Refund Abuse & Account Restrictions
            </h4>
            <p style={{ margin: '0 0 8px', color: '#524B6B' }}>
              Lumora distinguishes between legitimate refund requests submitted in good faith and deliberate policy exploitation.
            </p>
            <p style={{ margin: 0, color: '#524B6B' }}>
              Repeated abuse, fraudulent refund activity, or misuse of the refund policy may result in temporary or permanent account restrictions, including account termination, in accordance with Lumora's Terms of Service.
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem', fontWeight: 700, color: '#2D004D' }}>
              8. Contact Support
            </h4>
            <p style={{ margin: 0, color: '#524B6B' }}>
              If you encounter technical issues with your purchased files, please reach out to Lumora Customer Care via the Support Center before requesting a refund. Our team is dedicated to assisting you.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '18px 28px',
            borderTop: '1px solid rgba(196, 181, 253, 0.25)',
            background: '#FAF5FF',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              color: '#FFF',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(123, 63, 160, 0.25)',
            }}
          >
            Close Policy Window
          </button>
        </div>
      </div>
    </div>
  );
}
