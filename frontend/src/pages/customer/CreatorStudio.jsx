import React from 'react';
import { Sliders, Sparkles, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function CreatorStudio() {
  const { navigateTo } = useApp();

  const features = [
    { icon: '🎨', title: 'Design Toolkit', desc: 'Upload and showcase your own digital products with a premium creator storefront.' },
    { icon: '📊', title: 'Analytics', desc: 'Track impressions, clicks, and conversion rates across all your published assets.' },
    { icon: '💰', title: 'Revenue Dashboard', desc: 'Monitor earnings, payouts, and affiliate commissions in real-time.' },
    { icon: '⚡', title: 'Instant Publishing', desc: 'Go live within minutes — automated review pipeline with CDN delivery.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fade-in 0.8s ease' }}>
      {/* Header */}
      <div>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>CREATOR HUB</span>
        <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>
          Creator Studio
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-mocha)', marginTop: '6px', lineHeight: 1.5 }}>
          Launch your creative business on Lumora. Sell digital products, templates, UI kits, and AI tools to a global audience.
        </p>
      </div>

      {/* Feature grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {features.map((f, i) => (
          <div key={i} className="glass-card" style={{ padding: '28px', border: '1px solid rgba(123, 63, 160, 0.18)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '14px' }}>{f.icon}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '8px' }}>{f.title}</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-mocha)', lineHeight: 1.5, fontWeight: 500 }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="glass-card" style={{ padding: '36px', textAlign: 'center', background: 'rgba(123, 63, 160, 0.03)', border: '1px solid rgba(123, 63, 160, 0.15)' }}>
        <Sparkles size={28} style={{ color: '#7B3FA0', marginBottom: '12px' }} />
        <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '8px' }}>
          Ready to start selling?
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--color-mocha)', marginBottom: '20px', fontWeight: 500 }}>
          Apply for a creator account and unlock your storefront today.
        </p>
        <button
          onClick={() => navigateTo('marketplace')}
          className="btn-premium btn-premium-solid"
          style={{ padding: '12px 28px', fontSize: '0.85rem', borderRadius: '30px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Sliders size={14} /> Become a Creator <ArrowUpRight size={14} />
        </button>
      </div>
    </div>
  );
}
