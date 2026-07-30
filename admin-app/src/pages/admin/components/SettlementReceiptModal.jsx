/**
 * SettlementReceiptModal.jsx / WithdrawalReceiptModal
 * ----------------------------------------------------
 * Printable / downloadable withdrawal receipt.
 * Matches Lumora admin design system.
 *
 * Props:
 *   settlement  — full withdrawal detail object
 *   onClose     — close callback
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, CheckCircle } from 'lucide-react';
import { formatINR, fmtDate, STATUS_META } from '../../../services/treasuryService';

const Field = ({ label, value, mono = false }) => (
  <div className="flex justify-between items-start gap-4 py-2.5 border-b border-[#8E6AA8]/8 last:border-0">
    <span className="text-[11px] font-medium text-[#7B3FA0] shrink-0">{label}</span>
    <span className={`text-xs font-semibold text-[#2D004D] text-right break-all ${mono ? 'font-mono' : ''}`}>
      {value || '—'}
    </span>
  </div>
);

export default function SettlementReceiptModal({ settlement, onClose }) {
  if (!settlement) return null;

  const statusMeta = STATUS_META[settlement.status] || { label: settlement.status, bgClass: 'bg-stone-100', textClass: 'text-stone-600' };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="receipt-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] bg-[#2D004D]/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Panel */}
        <motion.div
          key="receipt-panel"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="w-full max-w-md bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#8E6AA8]/15 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          id="withdrawal-receipt-printable"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#8E6AA8]/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D8BFE3]/30 flex items-center justify-center text-[#7B3FA0]">
                <CheckCircle size={18} />
              </div>
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Treasury Receipt</p>
                <h3 className="text-sm font-serif font-black text-[#2D004D] leading-tight">Withdrawal Record</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#8E6AA8] hover:bg-[#D8BFE3]/20 hover:text-[#2D004D] transition-colors"
              aria-label="Close receipt"
            >
              <X size={18} />
            </button>
          </div>

          {/* Branding strip */}
          <div className="px-6 py-3 bg-[#2D004D] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[#D8BFE3] text-xs">✧</span>
              <span className="text-white font-bold text-sm tracking-tight">Lumora</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D8BFE3]/60 bg-white/10 px-2 py-0.5 rounded-full ml-1">
                Withdrawals
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusMeta.bgClass} ${statusMeta.textClass}`}>
              {statusMeta.label}
            </span>
          </div>

          {/* Amount hero */}
          <div className="px-6 py-5 text-center border-b border-[#8E6AA8]/10 bg-gradient-to-b from-[#D8BFE3]/10 to-transparent">
            <p className="text-[10px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Withdrawal Amount</p>
            <p className="text-3xl font-serif font-black text-[#2D004D] tracking-tight">
              {formatINR(settlement.amount)}
            </p>
            <p className="text-xs font-mono text-[#7B3FA0] mt-1">{settlement.withdrawal_number}</p>
          </div>

          {/* Fields */}
          <div className="px-6 py-2">
            <Field label="Withdrawal ID"       value={`#${settlement.id}`} mono />
            <Field label="Reference Number"    value={settlement.withdrawal_number} mono />
            <Field label="Currency"            value={settlement.currency || 'INR'} />
            <Field label="Destination Type"    value={settlement.destination_type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            {settlement.transaction_reference && (
              <Field label="Transaction Ref"   value={settlement.transaction_reference} mono />
            )}
            <Field label="Requested By"        value={settlement.requested_by?.name} />
            <Field label="Requested On"        value={fmtDate(settlement.requested_at)} />
            <Field label="Approved By"         value={settlement.approved_by?.name} />
            {settlement.approved_at && (
              <Field label="Approved On"       value={fmtDate(settlement.approved_at)} />
            )}
            {settlement.completed_at && (
              <Field label="Completed On"      value={fmtDate(settlement.completed_at)} />
            )}
            {settlement.notes && (
              <Field label="Notes"             value={settlement.notes} />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#8E6AA8]/10 bg-[#D8BFE3]/5">
            <p className="text-[9px] text-[#8E6AA8] text-center leading-relaxed mb-3">
              This is an internal platform withdrawal record generated by the Lumora Admin Console.
              All financial operations are subject to Lumora's financial policy.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2D004D] hover:bg-[#7B3FA0] text-white text-xs font-bold rounded-xl transition-colors"
              >
                <Printer size={14} />
                Print Receipt
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] text-xs font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
