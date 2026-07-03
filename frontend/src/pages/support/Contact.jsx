import React, { useState } from 'react';
import { Send, Mail, MessageSquare } from 'lucide-react';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { padding: '11px 16px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.3)', background: '#fff', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'clamp(2rem,5vw,5rem) clamp(1.5rem,5vw,2rem)' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', color: '#7B3FA0', textTransform: 'uppercase' }}>Get in Touch</span>
      <h2 className="text-editorial" style={{ fontSize: 'clamp(2rem,5vw,3rem)', fontWeight: 400, color: '#2D004D', marginTop: '8px', marginBottom: '8px' }}>Contact Us</h2>
      <p style={{ color: '#7B3FA0', fontSize: '1rem', marginBottom: '40px' }}>We're here to help. Send us a message and we'll respond within 24 hours.</p>

      {sent && <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a', fontSize: '0.85rem', fontWeight: 700, marginBottom: '24px' }}>✓ Message sent! We'll get back to you soon.</div>}

      <div className="glass-card" style={{ padding: '36px', background: 'rgba(255,253,249,0.80)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7B3FA0', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Name</label><input style={inputStyle} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your name" required /></div>
            <div><label style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7B3FA0', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</label><input style={inputStyle} type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" required /></div>
          </div>
          <div><label style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7B3FA0', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Subject</label><input style={inputStyle} value={form.subject} onChange={e => update('subject', e.target.value)} placeholder="How can we help?" required /></div>
          <div><label style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7B3FA0', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Message</label><textarea style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} value={form.message} onChange={e => update('message', e.target.value)} placeholder="Describe your issue or question…" required /></div>
          <button type="submit" className="btn-premium btn-premium-solid" style={{ alignSelf: 'flex-start', padding: '12px 28px', fontSize: '0.88rem', borderRadius: '12px' }}>
            <Send size={15} /> Send Message
          </button>
        </form>
      </div>
    </div>
  );
}
