import React from 'react';
import { Beaker, ShieldAlert } from 'lucide-react';
import { IS_SANDBOX_ENABLED } from '../../services/sandboxPaymentService';

/**
 * SandboxPaymentButton.jsx
 * Modular test button rendered ONLY when IS_SANDBOX_ENABLED is true.
 * In production mode, this component evaluates to null and renders nothing.
 */
export default function SandboxPaymentButton({ onClick, disabled, loading, label = 'Simulate Sandbox Payout' }) {
  if (!IS_SANDBOX_ENABLED) return null;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 border border-amber-300 disabled:opacity-50"
    >
      <Beaker size={15} className="animate-pulse" />
      <span>{loading ? 'Simulating…' : label}</span>
      <span className="px-1.5 py-0.5 rounded bg-black/20 text-[9px] uppercase tracking-wider font-mono">
        SANDBOX
      </span>
    </button>
  );
}
