import React from 'react';
import { Download, ShoppingBag, CreditCard, RefreshCw, Shield, MessageSquare } from 'lucide-react';

const TOPICS = [
  { icon: <Download size={20} />, title: 'Downloading Products', body: 'After purchase, go to Dashboard → Downloads. Click "Download" next to any owned product. Files are served via secure CDN.' },
  { icon: <ShoppingBag size={20} />, title: 'Placing an Order', body: 'Add products to your cart, proceed to checkout, fill billing details, and complete payment. You\'ll receive instant access.' },
  { icon: <CreditCard size={20} />, title: 'Payment Methods', body: 'We accept UPI (GPay, PhonePe, Paytm), Credit/Debit Cards (Visa, Mastercard, RuPay), and Net Banking.' },
  { icon: <RefreshCw size={20} />, title: 'Product Updates', body: 'When creators publish updates, go to Dashboard → Product Updates. Select a product and download the latest version.' },
  { icon: <Shield size={20} />, title: 'License & Usage', body: 'Standard license covers personal and client projects. Extended license covers SaaS products and resale. Check product pages for details.' },
  { icon: <MessageSquare size={20} />, title: 'Contacting Creators', body: 'Visit a product page and click "Message Creator". You can ask pre-sale questions or request customizations.' },
];

export default function Help() {
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(2rem,5vw,5rem) clamp(1.5rem,5vw,2rem)' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', color: '#7B3FA0', textTransform: 'uppercase' }}>Documentation</span>
      <h2 className="text-editorial" style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 400, color: '#2D004D', marginTop: '8px', marginBottom: '40px' }}>Help Center</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '20px' }}>
        {TOPICS.map((t, i) => (
          <div key={i} className="glass-card" style={{ padding: '28px', border: '1px solid rgba(196,181,253,0.22)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(123,63,160,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0', marginBottom: '16px' }}>
              {t.icon}
            </div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2D004D', marginBottom: '8px' }}>{t.title}</h3>
            <p style={{ fontSize: '0.82rem', color: '#7B3FA0', lineHeight: 1.6, fontWeight: 500 }}>{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
