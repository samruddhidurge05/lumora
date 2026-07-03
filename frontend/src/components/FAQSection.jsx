import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

const FAQS = [
  { q: 'How do I download my purchase?', a: 'After completing payment, you\'ll receive an instant download link via email and in your dashboard under "My Downloads". Files are available immediately — no waiting.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards, UPI, net banking, and wallets via Razorpay. All transactions are secured with bank-grade encryption.' },
  { q: 'What is your refund policy?', a: 'Due to the digital nature of our products, we offer refunds within 48 hours of purchase if the file is corrupted or significantly different from the description. Contact support@lumora.io.' },
  { q: 'Can I use these assets in commercial projects?', a: 'Yes. All products include a commercial license. You can use them in client work, products you sell, and social media. Reselling the raw files is not permitted.' },
  { q: 'Do I get updates to products I\'ve purchased?', a: 'Absolutely. All future updates to a product you\'ve purchased are included at no extra cost. You\'ll be notified when updates are available in your dashboard.' },
  { q: 'What formats are the files delivered in?', a: 'Formats vary by product type — Figma files, React/Next.js code, ZIP archives, PDF guides, MP4 video presets, and more. Each product page lists exact file formats.' },
  { q: 'Is there a subscription or is it one-time payment?', a: 'All products are one-time purchases with lifetime access. We also offer a Pro Membership for unlimited downloads — check the pricing page for details.' },
];

export default function FAQSection() {
  const [open, setOpen] = useState(null);

  return (
    <section className="section-padding" id="faq" style={{ position: 'relative', zIndex: 10 }}>
      <div className="container-wide" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="caption-premium" style={{ marginBottom: '12px' }}>
            <HelpCircle size={12} style={{ display: 'inline', marginRight: '6px' }} />
            Got Questions?
          </div>
          <h2 className="text-editorial title-medium" style={{ fontWeight: 400 }}>Frequently Asked</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="glass-card"
              style={{ padding: 0, overflow: 'hidden', borderRadius: '18px' }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: '100%', padding: '22px 28px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'transparent', border: 'none', outline: 'none',
                  textAlign: 'left', gap: '16px'
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-espresso)', lineHeight: 1.4 }}>
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  style={{
                    color: 'var(--color-mocha)', flexShrink: 0,
                    transform: open === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                />
              </button>

              <div style={{
                maxHeight: open === i ? '200px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}>
                <p style={{
                  padding: '0 28px 22px',
                  fontSize: '0.88rem', color: 'var(--color-mocha)', lineHeight: 1.7
                }}>
                  {faq.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
