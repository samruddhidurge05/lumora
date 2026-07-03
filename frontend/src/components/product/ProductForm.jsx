import React, { useState } from 'react';

export default function ProductForm({ onSubmit, initialData = {} }) {
  const [form, setForm] = useState({ title: '', category: '', price: '', description: '', ...initialData });
  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const s = { padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.3)', background: '#fff', fontSize: '0.83rem', fontFamily: 'var(--font-sans)', color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit && onSubmit(form); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[['title', 'Product Title', 'text'], ['category', 'Category', 'text'], ['price', 'Price (USD)', 'number']].map(([k, label, type]) => (
        <div key={k}>
          <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
          <input style={s} type={type} value={form[k]} onChange={e => update(k, e.target.value)} required />
        </div>
      ))}
      <div>
        <label style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--color-mocha)', display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
        <textarea style={{ ...s, minHeight: '100px', resize: 'vertical' }} value={form.description} onChange={e => update('description', e.target.value)} />
      </div>
      <button type="submit" className="btn-premium btn-premium-solid" style={{ alignSelf: 'flex-start', padding: '11px 24px', borderRadius: '10px' }}>
        {initialData.id ? 'Update Product' : 'Create Product'}
      </button>
    </form>
  );
}
