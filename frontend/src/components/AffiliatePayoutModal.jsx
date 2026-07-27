import React, { useState } from 'react';
import { X, CheckCircle2, Zap, Building2, Wallet, ArrowRight } from 'lucide-react';

export default function AffiliatePayoutModal({ payout, systemConfig, onClose, onConfirm, loading }) {
  const [developerMockOverride, setDeveloperMockOverride] = useState(false);

  if (!payout) return null;

  const isMockMode = (systemConfig?.payout_mode || 'mock').toLowerCase() === 'mock';
  const fmt = (val) => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (str) => {
    if (!str) return '—';
    try {
      return new Date(str).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return String(str);
    }
  };

  const handleInitiate = () => {
    onConfirm(payout.id, isMockMode && developerMockOverride);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border border-[#F3EAF8] w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#F3EAF8] flex items-center justify-between bg-gradient-to-r from-[#F8F3FB] to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#7B3FA0]/10 text-[#7B3FA0]">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2D004D]">Initiate Affiliate Payout Transfer</h3>
              <p className="text-[10px] text-[#7B3FA0]">Verify beneficiary routing details & confirm transfer dispatch</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1.5 rounded-full hover:bg-[#F3EAF8] text-stone-400 hover:text-stone-700 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Beneficiary Card */}
          <div className="bg-[#F8F3FB]/70 border border-[#F3EAF8] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B3FA0]">Beneficiary Information</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] border border-[#7B3FA0]/20">
                ID #{payout.affiliate_id}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-[#2D004D] text-sm">{payout.affiliate_name || 'Affiliate Partner'}</p>
                <p className="font-mono text-[10px] text-[#7B3FA0]">Code: {payout.affiliate_code || '—'}</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-500 block">Current Wallet Balance</span>
                <span className="font-bold text-[#7B3FA0]">{fmt(payout.pending_balance)}</span>
              </div>
            </div>
          </div>

          {/* Payment Routing & Account Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-stone-50 border border-stone-200/70 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-medium text-stone-500 block">Payout Method</span>
              <p className="font-bold text-[#2D004D] uppercase flex items-center gap-1.5">
                <Wallet size={14} className="text-[#7B3FA0]" /> {payout.method || 'UPI'}
              </p>
            </div>
            <div className="bg-stone-50 border border-stone-200/70 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-medium text-stone-500 block">Beneficiary VPA / Account</span>
              <p className="font-mono font-bold text-[#2D004D] truncate">
                {payout.upi_id || payout.bank_account || payout.account_number || '—'}
              </p>
            </div>
          </div>

          {payout.bank_name && (
            <div className="bg-stone-50 border border-stone-200/70 p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-[10px] text-stone-500 flex items-center gap-1">
                <Building2 size={13} className="text-[#7B3FA0]" /> Bank Name
              </span>
              <span className="font-bold text-[#2D004D]">{payout.bank_name}</span>
            </div>
          )}

          {/* System Mode & Environment Metadata */}
          <div className="bg-stone-50 border border-stone-200/80 p-3.5 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-stone-500">Active Gateway Provider</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isMockMode ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                {isMockMode ? '🔧 Mock Mode (Simulated)' : '⚡ Razorpay X (Production API)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Withdrawal Request Ref</span>
              <span className="font-mono text-stone-700 font-medium">#POUT-{payout.id}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-stone-500">Requested Timestamp</span>
              <span className="text-stone-700 font-medium">{fmtDate(payout.created_at)}</span>
            </div>

            {/* Developer Testing Checkbox (ONLY in Mock Mode) */}
            {isMockMode && (
              <div className="mt-2 pt-2 border-t border-stone-200 flex items-center gap-2 text-[11px] text-stone-700">
                <input
                  type="checkbox"
                  id="mockBypass"
                  checked={developerMockOverride}
                  onChange={(e) => setDeveloperMockOverride(e.target.checked)}
                  className="rounded border-stone-300 text-[#7B3FA0] focus:ring-[#7B3FA0]"
                />
                <label htmlFor="mockBypass" className="cursor-pointer font-medium text-amber-900">
                  Developer Testing: Bypass Razorpay X API (Simulated Immediate Transfer)
                </label>
              </div>
            )}
          </div>

          {/* Audit Timeline */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B3FA0]">Payout Event Timeline</span>
            <div className="bg-[#F8F3FB]/40 border border-[#F3EAF8] p-3 rounded-2xl space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2 text-stone-600">
                <CheckCircle2 size={12} className="text-emerald-600" />
                <span>Withdrawal Request Created on {fmtDate(payout.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-[#7B3FA0] font-medium">
                <ArrowRight size={12} />
                <span>Admin Initiating Transfer via {isMockMode ? 'Mock Engine' : 'Razorpay X'}</span>
              </div>
            </div>
          </div>

          {/* Payment Summary Box */}
          <div className="bg-stone-900 text-white p-4 rounded-2xl space-y-2">
            <div className="flex justify-between text-xs text-stone-400">
              <span>Disbursement Amount</span>
              <span>{fmt(payout.amount)}</span>
            </div>
            <div className="flex justify-between text-xs text-stone-400">
              <span>Platform Transfer Fee</span>
              <span>₹0.00</span>
            </div>
            <div className="pt-2 border-t border-stone-800 flex justify-between items-center">
              <span className="text-xs font-bold text-stone-200">Net Disbursement Amount</span>
              <span className="text-xl font-bold font-serif text-emerald-400">{fmt(payout.amount)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-stone-50 border-t border-[#F3EAF8] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-200/60 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleInitiate}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#7B3FA0] hover:bg-[#6A328C] text-white text-xs font-bold shadow-lg shadow-[#7B3FA0]/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Dispatched Transfer...
              </>
            ) : (
              <>
                <Zap size={14} />
                Initiate Transfer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
