import React from 'react';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function CartItem({ item }) {
  const { removeFromCart, updateQuantity, formatPrice } = useApp();
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid rgba(196,181,253,0.12)' }}>
      <img src={item.preview} alt={item.title} style={{ width: '56px', height: '56px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{formatPrice(item.price)}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><Minus size={10} /></button>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>{item.quantity || 1}</span>
        <button onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}><Plus size={10} /></button>
      </div>
      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,38,38,0.55)', padding: '4px' }}><Trash2 size={13} /></button>
    </div>
  );
}
