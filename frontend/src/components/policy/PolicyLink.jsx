import React from 'react';
import { FileText } from 'lucide-react';

export default function PolicyLink({ onClick, label = "Read Refund Policy", style = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        color: '#7B3FA0',
        fontSize: '0.82rem',
        fontWeight: 600,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
        transition: 'color 0.2s ease',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
        ...style,
      }}
    >
      <FileText size={14} />
      <span>{label}</span>
    </button>
  );
}
