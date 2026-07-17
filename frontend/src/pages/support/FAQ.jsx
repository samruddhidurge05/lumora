import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQS = [
  { q: 'What file formats are included?', a: 'Products include Figma, React, Tailwind CSS, Adobe Illustrator, and PDF formats depending on the product. Each listing specifies compatibility.' },
  { q: 'Do I get lifetime access?', a: 'Yes! All purchases grant lifetime access. You can re-download updated versions anytime from your dashboard.' },
  { q: 'Can I use products for client work?', a: 'Yes. All purchases include a standard commercial license for client projects. Check individual listings for extended license options.' },
  { q: 'What is your refund policy?', a: 'We offer refunds on verified broken file downloads only. Due to the digital nature of products, we cannot accept refunds for change of mind.' },
  { q: 'How do I download my purchases?', a: 'Go to Dashboard → Downloads. All your purchased products will appear there with download buttons.' },
  { q: 'Can I become a creator/seller?', a: 'Absolutely! Register as a Vendor/Creator account and you can upload and sell your digital products on Lumora.' },
  { q: 'How do affiliate commissions work?', a: 'Affiliates earn 15–30% commission per sale through their referral links. Commissions are approved after order completion and paid out on request.' },
  { q: 'Is my payment information secure?', a: 'Yes. All transactions are processed through PCI-DSS compliant gateways. We never store your card details.' },
];

const AFFILIATE_FAQS = [
  { q: 'How do I generate my referral link?', a: 'Go to the Products tab in your Affiliate Dashboard. Browse or search for a product and click "Copy Link" to generate your unique referral URL.' },
  { q: 'How are commissions calculated?', a: 'Commissions are calculated as a percentage of the final sale price or a fixed amount per sale, depending on the vendor’s configuration for that product.' },
  { q: 'When do I receive payouts?', a: 'Payouts can be requested once your pending commissions clear the refund period and your balance reaches the minimum threshold.' },
  { q: 'Why is my commission pending?', a: 'To protect against fraud and refunds, all commissions are held in a pending state until the product\'s return window expires (typically 14-30 days).' },
  { q: 'Why aren\'t my referral clicks showing?', a: 'Make sure your customers are using the exact link provided in your dashboard. Clicks are updated periodically and require cookies to be enabled.' },
  { q: 'Why isn\'t a purchase being tracked?', a: 'Purchases won\'t track if the customer cleared their cookies, used ad-blockers that strip referral parameters, or purchased from a different device.' },
  { q: 'Can I promote multiple products?', a: 'Absolutely! You can generate and share unique referral links for any number of products available in the marketplace.' },
  { q: 'How do I monitor my performance?', a: 'Use the Earnings and Dashboard tabs to view real-time statistics on your clicks, conversions, pending earnings, and approved payouts.' },
];

export default function FAQ({ role }) {
  const [open, setOpen] = useState(null);
  const data = role === 'affiliate' ? AFFILIATE_FAQS : FAQS;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'clamp(2rem,5vw,5rem) clamp(1.5rem,5vw,2rem)' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', color: '#7B3FA0', textTransform: 'uppercase' }}>Help Center</span>
      <h2 className="text-editorial" style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 400, color: '#2D004D', marginTop: '8px', marginBottom: '40px' }}>Frequently Asked Questions</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((faq, i) => (
          <div key={i} className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(196,181,253,0.22)', transition: 'box-shadow 0.2s' }}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', fontFamily: 'var(--font-sans)', textAlign: 'left' }}
            >
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#2D004D' }}>{faq.q}</span>
              <span style={{ color: '#7B3FA0', flexShrink: 0 }}>
                {open === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </span>
            </button>
            {open === i && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid rgba(196,181,253,0.16)' }}>
                <p style={{ fontSize: '0.85rem', color: '#7B3FA0', lineHeight: 1.65, paddingTop: '16px', fontWeight: 500 }}>{faq.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
