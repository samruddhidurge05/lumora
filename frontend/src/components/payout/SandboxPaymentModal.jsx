import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Beaker, X, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { sandboxPaymentService, IS_SANDBOX_ENABLED } from '../../services/sandboxPaymentService';

/**
 * SandboxPaymentModal.jsx
 * Modal dialog for QA/Developers to test different payout scenarios:
 * - Success (200 OK)
 * - Insufficient Account Balance
 * - Bank Account / VPA Decline
 * - Gateway Timeout
 */
export default function SandboxPaymentModal({ payout, onClose, onSimulated }) {
  const [scenario, setScenario] = useState('success');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  if (!IS_SANDBOX_ENABLED || !payout) return null;

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await sandboxPaymentService.simulatePayout({
        payoutId: payout.id,
        netAmount: Number(payout.amount || 0),
        scenario,
        notes,
      });

      alert(res.message);
      onSimulated(res);
      onClose();
    } catch (err) {
      alert(`Sandbox Simulation Error: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl border-2 border-amber-300 shadow-2xl max-w-md w-full p-6 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-amber-100 pb-3">
          <div className="flex items-center gap-2">
            <Beaker className="text-amber-600 animate-pulse" size={20} />
            <div>
              <h3 className="text-sm font-extrabold text-[#2D004D]">Developer Sandbox Test Mode</h3>
              <p className="text-[10px] text-amber-700 font-medium">Isolated QA Payout Scenario Simulator</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-stone-400 hover:bg-stone-100"><X size={16} /></button>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-1">
          <p className="font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> Test Mode Notice</p>
          <p className="text-[11px]">No real money or live Razorpay credentials will be touched during this simulation.</p>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-extrabold uppercase text-[#7B3FA0] tracking-wider block">
            Select Test Scenario
          </label>
          <div className="space-y-2 text-xs font-semibold">
            {[
              { id: 'success', label: '🟢 Success — Instant Direct Transfer', desc: 'Simulates 200 OK webhook and settled balance.' },
              { id: 'insufficient_funds', label: '🔴 Failure — Insufficient Balance', desc: 'Simulates RazorpayX low balance exception.' },
              { id: 'bank_decline', label: '🔴 Failure — Bank Account Declined', desc: 'Simulates invalid VPA / Bank branch rejection.' },
              { id: 'gateway_timeout', label: '🟡 Timeout — Async Processing Hold', desc: 'Simulates delayed webhook callback.' },
            ].map(sc => (
              <label key={sc.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${scenario === sc.id ? 'bg-amber-50/80 border-amber-400 text-amber-900 shadow-xs' : 'border-stone-200 hover:bg-stone-50'}`}>
                <input type="radio" name="scenario" value={sc.id} checked={scenario === sc.id} onChange={() => setScenario(sc.id)} className="mt-0.5" />
                <div>
                  <div className="font-bold text-xs">{sc.label}</div>
                  <div className="text-[10px] text-stone-500 font-normal">{sc.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-extrabold uppercase text-[#7B3FA0] tracking-wider block mb-1">
            Audit Note Memo
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Reason or test case ID for QA log…"
            className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3 py-2 text-xs text-[#2D004D]"
          />
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-stone-500">Cancel</button>
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
            <span>Execute Test Simulation</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
