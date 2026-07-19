import React from 'react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { ShieldCheck, Info, FileText, CheckCircle2, AlertTriangle, HelpCircle, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function RefundPolicy() {
  const { navigateTo } = useApp();

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', background: '#FAF5FF' }}>
      <Navbar />

      {/* Hero Header */}
      <div
        style={{
          paddingTop: '130px',
          paddingBottom: '50px',
          background: 'linear-gradient(180deg, rgba(123,63,160,0.08) 0%, rgba(250,245,255,1) 100%)',
          textAlign: 'center',
          paddingLeft: '20px',
          paddingRight: '20px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '20px',
              background: 'rgba(123, 63, 160, 0.08)',
              border: '1px solid rgba(196, 181, 253, 0.3)',
              color: '#7B3FA0',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '16px',
            }}
          >
            <ShieldCheck size={16} />
            <span>Lumora Legal & Terms</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.2rem)',
              fontWeight: 800,
              color: '#2D004D',
              margin: '0 0 12px',
              letterSpacing: '-0.025em',
            }}
          >
            Refund Policy
          </h1>

          <p style={{ fontSize: '1.05rem', color: '#5A1E7E', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
            Customer rights, digital product delivery terms, and refund policy misuse guidelines.
          </p>
        </div>
      </div>

      {/* Content Container */}
      <div
        style={{
          maxWidth: '840px',
          margin: '0 auto 80px',
          padding: '0 24px',
        }}
      >
        <div
          style={{
            background: '#FFF',
            borderRadius: '24px',
            padding: 'clamp(24px, 5vw, 44px)',
            boxShadow: '0 15px 45px rgba(45, 0, 77, 0.06)',
            border: '1px solid rgba(196, 181, 253, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: '32px',
            fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
          }}
        >
          {/* Important Notice Callout */}
          <div
            style={{
              padding: '20px 24px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(123,63,160,0.06), rgba(196,181,253,0.1))',
              border: '1px solid rgba(196, 181, 253, 0.4)',
              display: 'flex',
              gap: '14px',
            }}
          >
            <Info size={22} style={{ color: '#7B3FA0', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 800, color: '#2D004D' }}>
                Key Takeaway for Customers
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4A2E65', lineHeight: 1.55 }}>
                Digital products cannot be physically returned after delivery or download. All refund requests are reviewed according to Lumora's Refund Policy.
              </p>
            </div>
          </div>

          {/* Section 1 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              1. Overview
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              Lumora is a marketplace dedicated to premium digital products, including software templates, design assets, educational guides, and downloadable media. Because digital items are delivered electronically and become immediately accessible upon purchase, their return process differs fundamentally from physical merchandise.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              2. Digital Product Nature
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              Digital products:
            </p>
            <ul style={{ margin: '8px 0 0 20px', padding: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              <li>Are delivered electronically</li>
              <li>May become immediately accessible after purchase</li>
              <li>Cannot be physically returned after delivery or download</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              3. Refund Eligibility
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              Refund requests are reviewed according to Lumora's applicable refund policy. Requests are evaluated individually based on verifiable technical issues, corrupted delivery files, or duplicate billing events. Automatic refunds are not guaranteed.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              4. Non-Returnable Digital Products
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              Once a digital product has been successfully delivered to your vault or downloaded to your local device, it cannot be physically returned. Simple change of mind after successful file retrieval does not constitute eligibility for a physical return.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              5. Refund Review Process
            </h3>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              When a customer submits a refund request, Lumora Customer Care reviews the transaction details, file delivery status, and purchase history. Requests are processed fairly to resolve genuine customer issues.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              6. Approved Refunds and Loss of Access
            </h3>
            <div
              style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'rgba(123, 63, 160, 0.05)',
                border: '1px solid rgba(196, 181, 253, 0.3)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#5A1E7E', lineHeight: 1.5 }}>
                If a refund is approved, access to the refunded digital product may be revoked, and download links will be invalidated.
              </p>
            </div>
          </section>

          {/* Section 7 & 8 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              7. Refund Abuse & Account Restrictions
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              Lumora distinguishes clearly between legitimate customer refund requests and intentional policy exploitation.
            </p>
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '14px',
                background: '#FAF5FF',
                border: '1px solid rgba(196, 181, 253, 0.3)',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#3B1E54', fontWeight: 600, lineHeight: 1.6 }}>
                Repeated abuse, fraudulent refund activity, or misuse of the refund policy may result in temporary or permanent account restrictions, including account termination, in accordance with Lumora's Terms of Service.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.15rem', fontWeight: 800, color: '#2D004D' }}>
              8. Contact Support
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.92rem', color: '#524B6B', lineHeight: 1.65 }}>
              If you experience technical difficulty with your purchased asset or have questions regarding your order, our dedicated support team is available to assist you.
            </p>
            <button
              onClick={() => navigateTo ? navigateTo('contact') : (window.location.href = '/contact')}
              style={{
                padding: '10px 22px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                color: '#FFF',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(123, 63, 160, 0.2)',
              }}
            >
              <span>Contact Support</span>
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
}
