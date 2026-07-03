import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function HeroSection({ title, highlight, description, buttonText, onCTA }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)', textAlign: 'center' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 className="text-editorial" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, color: 'var(--color-espresso)', marginBottom: '24px' }}>
          {title} <span style={{ color: 'var(--color-latte)' }}>{highlight}</span>
        </h1>
        <p className="text-sans" style={{ fontSize: '1.1rem', color: 'var(--color-mocha)', marginBottom: '40px', lineHeight: 1.6 }}>
          {description}
        </p>
        <button onClick={onCTA} className="btn-premium btn-premium-solid" style={{ padding: '16px 32px', fontSize: '1rem' }}>
          {buttonText} <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

export function WhySection({ title, items }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2 className="text-editorial title-medium" style={{ textAlign: 'center', marginBottom: '48px' }}>{title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {items.map((item, i) => (
            <div key={i} className="glass-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', borderRadius: '16px' }}>
              <CheckCircle2 size={24} color="var(--color-latte)" />
              <span className="text-sans" style={{ fontWeight: 600, color: 'var(--color-espresso)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorksSection({ title, steps }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)', background: 'rgba(255,255,255,0.2)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2 className="text-editorial title-medium" style={{ marginBottom: '48px' }}>{title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
          {steps.map((step, i, arr) => (
            <React.Fragment key={i}>
              <div className="glass-card" style={{ padding: '16px 24px', borderRadius: '100px', fontWeight: 600, color: 'var(--color-espresso)' }}>
                {step}
              </div>
              {i < arr.length - 1 && <ArrowRight size={20} color="var(--color-latte)" style={{ opacity: 0.6 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BenefitsSection({ title, benefits }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h2 className="text-editorial title-medium" style={{ textAlign: 'center', marginBottom: '48px' }}>{title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {benefits.map((b, i) => (
            <div key={i} className="glass-card" style={{ padding: '32px', borderRadius: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(123, 63, 160, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', color: 'var(--color-latte)' }}>
                {b.icon}
              </div>
              <h3 className="text-editorial" style={{ fontSize: '1.2rem', color: 'var(--color-espresso)', marginBottom: '12px' }}>{b.title}</h3>
              <p className="text-sans" style={{ color: 'var(--color-mocha)', lineHeight: 1.6 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhoCanJoinSection({ title, roles }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)', background: 'rgba(255,255,255,0.2)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 className="text-editorial title-medium" style={{ marginBottom: '48px' }}>{title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px' }}>
          {roles.map((person, i) => (
            <span key={i} style={{ padding: '10px 20px', background: 'var(--color-latte)', color: '#fff', borderRadius: '100px', fontSize: '0.9rem', fontWeight: 600 }}>
              {person}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FAQSection({ title, faqs }) {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <section id="faq" style={{ padding: '80px clamp(1.5rem, 6vw, 7rem)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className="text-editorial title-medium" style={{ textAlign: 'center', marginBottom: '48px' }}>{title}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {faqs.map((faq, i) => (
            <div key={i} className="glass-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '18px' }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', outline: 'none', textAlign: 'left', gap: '16px', cursor: 'pointer' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-espresso)', lineHeight: 1.4 }}>{faq.q}</span>
                <ChevronDown size={18} style={{ color: 'var(--color-mocha)', flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }} />
              </button>
              <div style={{ maxHeight: openFaq === i ? '200px' : '0', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <p style={{ padding: '0 28px 22px', fontSize: '0.88rem', color: 'var(--color-mocha)', lineHeight: 1.7 }}>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTASection({ title, buttonText, onCTA }) {
  return (
    <section style={{ padding: '80px clamp(1.5rem, 6vw, 7rem) 120px' }}>
      <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '64px 32px', borderRadius: '32px' }}>
        <h2 className="text-editorial" style={{ fontSize: '2.5rem', color: 'var(--color-espresso)', marginBottom: '24px' }}>{title}</h2>
        <button onClick={onCTA} className="btn-premium btn-premium-solid" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
          {buttonText} <ArrowRight size={20} />
        </button>
      </div>
    </section>
  );
}
