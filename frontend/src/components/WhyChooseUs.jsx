import React from 'react';
import { ShieldCheck, Award, Sparkles, Clock } from 'lucide-react';

const reasons = [
  {
    icon: <Award size={24} />,
    title: "Curated Excellence",
    description: "Every asset is handpicked and thoroughly vetted by our design guild to ensure it meets production-ready standards."
  },
  {
    icon: <ShieldCheck size={24} />,
    title: "Secure & Instant Delivery",
    description: "Get instant access to your source files right after payment. Fully encrypted secure downloads and verified licenses."
  },
  {
    icon: <Sparkles size={24} />,
    title: "Lifetime Free Revisions",
    description: "Download once, get updates forever. Receive automated notifications and access to newer versions at zero extra cost."
  },
  {
    icon: <Clock size={24} />,
    title: "24/7 Creator Support",
    description: "Direct access to creators and our support desk. We help you resolve layout, integration, and setup issues instantly."
  }
];

export default function WhyChooseUs() {
  return (
    <section 
      id="why-choose-us" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10, background: 'rgba(255, 255, 255, 0.25)' }}
    >
      <div className="container-wide">
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="caption-premium" style={{ marginBottom: '12px' }}>OUR GUARANTEE</div>
          <h2 className="text-editorial title-medium" style={{ fontWeight: 400, color: 'var(--color-espresso)' }}>
            Why World-Class Creators Choose Us
          </h2>
        </div>

        {/* Reasons Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px'
          }}
        >
          {reasons.map((item, i) => (
            <div
              key={i}
              className="glass-card"
              style={{
                padding: '32px',
                height: '240px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: '1px solid rgba(196, 181, 253, 0.25)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <div 
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(123, 63, 160, 0.1)',
                  border: '1px solid rgba(123, 63, 160, 0.25)',
                  color: '#7B3FA0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 4px 12px rgba(123, 63, 160, 0.08)'
                }}
              >
                {item.icon}
              </div>

              <div style={{ flex: 1 }}>
                <h3 
                  className="text-editorial"
                  style={{ 
                    fontSize: '1.35rem', 
                    fontWeight: 500, 
                    color: 'var(--color-espresso)',
                    marginBottom: '8px'
                  }}
                >
                  {item.title}
                </h3>
                <p 
                  className="text-sans"
                  style={{ 
                    fontSize: '0.82rem', 
                    color: 'var(--color-mocha)', 
                    lineHeight: 1.5,
                    fontWeight: 500
                  }}
                >
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
