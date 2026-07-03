import React from 'react';
import { X } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, title, children }) {
  return (
    <>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,0,77,0.30)', backdropFilter: 'blur(8px)', zIndex: 998 }}
          onClick={onClose} />
      )}
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
        width: '360px', maxWidth: '90vw',
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(32px) saturate(180%)',
        WebkitBackdropFilter: 'blur(32px) saturate(180%)',
        borderLeft: '1.5px solid rgba(255, 255, 255, 0.45)',
        boxShadow: '-8px 0 40px rgba(45, 0, 96, 0.10)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid rgba(196,181,253,0.16)' }}>
          {title && <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--color-espresso)' }}>{title}</h3>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'none', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="custom-scrollbar">
          {children}
        </div>
      </aside>
    </>
  );
}
