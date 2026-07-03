import React from 'react';
import { useApp } from '../../context/AppContext';

export default function CheckoutForm({ onSubmit }) {
  const { checkoutForm, setCheckoutForm } = useApp();
  const update = (k, v) => setCheckoutForm(p => ({ ...p, [k]: v }));
  const s = { padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.3)', background: '#fff', fontSize: '0.83rem', fontFamily: 'var(--font-sans)', color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' };
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {[['name','Full Name','text'],['email','Email','email'],['phone','Phone','tel'],['city','City','text'],['state','State','text'],['country','Country','text']].map(([k, label, type]) => (
        <div key={k}>
          <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
          <input style={s} type={type} value={checkoutForm[k] || ''} onChange={e => update(k, e.target.value)} placeholder={label} required />
        </div>
      ))}
      <button type="submit" className="btn-premium btn-premium-solid" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.88rem', borderRadius: '12px', marginTop: '8px' }}>
        Continue to Payment
      </button>
    </form>
  );
}
