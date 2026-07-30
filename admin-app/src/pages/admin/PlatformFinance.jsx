/**
 * PlatformFinance.jsx — Phase 2 Complete Redesign
 * -------------------------------------------------
 * Lumora Platform Finance & Treasury page.
 * Matches the premium Lumora Admin design system exactly.
 *
 * Tabs: Overview | Ledger | Settlements | Timeline
 *
 * Design tokens:
 *   bg-[#FFFDF9]       page background
 *   glass-surface      frosted glass cards (AdminComponents.css)
 *   text-[#2D004D]     primary text
 *   text-[#7B3FA0]     accent / labels
 *   bg-[#D8BFE3]       highlight / hover
 *   border-white/50    card borders
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, Landmark, ArrowDownCircle,
  CheckCircle2, Clock, AlertTriangle, RefreshCw, Download, FileText,
  ChevronRight, ChevronLeft, X, Plus, Eye, Check, Ban, Printer,
  ArrowUpRight, Wallet, Activity, BarChart3, List, Info, Shield
} from 'lucide-react';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, FilterBar, TableContainer, EmptyState, AdminSelect } from './components/AdminComponents';
import SettlementReceiptModal from './components/SettlementReceiptModal';
import { useAdminContext } from '../../context/AdminContext';
import {
  fetchTreasurySummary,
  fetchLedgerEntries,
  fetchWithdrawalList,
  fetchWithdrawalDetail,
  fetchTreasuryTimeline,
  requestSettlement,
  approveSettlement,
  completeSettlement,
  cancelSettlement,
  formatINR,
  fmtDate,
  fmtDateShort,
  STATUS_META,
  LEDGER_TYPE_LABELS,
  LEDGER_TYPE_COLORS,
  DESTINATION_TYPES,
} from '../../services/treasuryService';

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, bgClass: 'bg-stone-100', textClass: 'text-stone-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${meta.bgClass} ${meta.textClass}`}>
      {meta.label}
    </span>
  );
};

const LedgerTypeBadge = ({ type }) => {
  const label = LEDGER_TYPE_LABELS[type] || type;
  const colors = LEDGER_TYPE_COLORS[type] || { bgClass: 'bg-stone-100', textClass: 'text-stone-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${colors.bgClass} ${colors.textClass}`}>
      {label}
    </span>
  );
};

const AmountCell = ({ amount }) => {
  const isPositive = amount >= 0;
  return (
    <span className={`font-mono text-xs font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositive ? '+' : ''}{formatINR(amount)}
    </span>
  );
};

// Inline SVG sparkline
const Sparkline = ({ data = [], color = '#7B3FA0', height = 20 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 80, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" className="overflow-visible">
      <polyline points={pts} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// Action button
const ActionBtn = ({ onClick, label, icon: Icon, variant = 'primary', disabled = false, small = false }) => {
  const base = `inline-flex items-center gap-1.5 font-bold rounded-xl transition-all ${small ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'} focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30`;
  const variants = {
    primary:  'bg-[#2D004D] hover:bg-[#7B3FA0] text-white shadow-sm disabled:opacity-40',
    ghost:    'border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] disabled:opacity-40',
    danger:   'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 disabled:opacity-40',
    success:  'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 disabled:opacity-40',
    approve:  'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-40',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {Icon && <Icon size={small ? 11 : 13} />}
      {label}
    </button>
  );
};

// Pagination row
const Pagination = ({ page, total, pageSize, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[#7B3FA0]">
        {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
      </span>
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="p-1.5 rounded-lg border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#7B3FA0]">
        <ChevronLeft size={13} />
      </button>
      <span className="text-[11px] font-bold text-[#2D004D]">{page}/{totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        className="p-1.5 rounded-lg border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#7B3FA0]">
        <ChevronRight size={13} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Settlement Request Modal
// ─────────────────────────────────────────────────────────────────────────────
function SettlementRequestModal({ summary, onClose, onSuccess }) {
  const [amount, setAmount]       = useState('');
  const [destType, setDestType]   = useState('bank_account');
  const [bankName, setBankName]   = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc]           = useState('');
  const [upiId, setUpiId]         = useState('');
  const [notes, setNotes]         = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const available    = summary?.available_balance     || 0;
  const netWithdrawable = summary?.net_withdrawable   || 0;
  const reserve      = summary?.minimum_reserve       || 5000;
  const parsed       = parseFloat(amount) || 0;
  const remaining    = Math.max(0, available - parsed);
  const overLimit    = parsed > netWithdrawable;
  const underMin     = parsed > 0 && parsed < 500;

  const buildDestAccount = () => {
    if (destType === 'bank_account') return { bank_name: bankName, account_number: accountNo, ifsc_code: ifsc };
    if (destType === 'upi')          return { upi_id: upiId };
    return {};
  };

  const handleSubmit = async () => {
    setError('');
    if (!parsed || parsed <= 0) { setError('Enter a valid amount.'); return; }
    if (underMin)               { setError('Minimum settlement amount is ₹500.'); return; }
    if (overLimit)              { setError(`Amount exceeds net withdrawable balance of ${formatINR(netWithdrawable)}.`); return; }
    if (!confirmed)             { setError('Please confirm the settlement declaration.'); return; }

    setLoading(true);
    try {
      const res = await requestSettlement({
        amount:              parsed,
        destination_type:    destType,
        destination_account: buildDestAccount(),
        notes,
      });
      if (res?.success) {
        onSuccess(res.updated_summary);
      } else {
        setError(res?.detail || 'Settlement request failed.');
      }
    } catch (e) {
      setError(e?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="modal-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-[#2D004D]/40 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          key="modal-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="w-full max-w-lg my-8 bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#8E6AA8]/15 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#8E6AA8]/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#D8BFE3]/30 flex items-center justify-center text-[#7B3FA0]">
                <Landmark size={18} />
              </div>
              <div>
                <p className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Treasury Operation</p>
                <h3 className="text-sm font-serif font-black text-[#2D004D] leading-tight">Request Settlement</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-[#8E6AA8] hover:bg-[#D8BFE3]/20 hover:text-[#2D004D] transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Balance info */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Available', val: available,     color: 'text-[#2D004D]' },
                { label: 'Reserve',   val: reserve,       color: 'text-amber-600' },
                { label: 'Withdrawable', val: netWithdrawable, color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="glass-surface rounded-xl p-3 border border-white/50 text-center">
                  <p className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">{s.label}</p>
                  <p className={`text-sm font-serif font-black mt-0.5 ${s.color}`}>{formatINR(s.val)}</p>
                </div>
              ))}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1.5">
                Settlement Amount (INR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B3FA0] font-bold text-sm">₹</span>
                <input
                  type="number" min="500" step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full pl-8 pr-3.5 h-[42px] glass-input rounded-xl text-sm font-semibold"
                />
              </div>
              {parsed > 0 && (
                <div className={`mt-1.5 text-[11px] font-medium ${overLimit ? 'text-red-500' : underMin ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {overLimit ? `⚠ Exceeds net withdrawable ${formatINR(netWithdrawable)}` : underMin ? '⚠ Minimum is ₹500' : `✓ Remaining balance after: ${formatINR(remaining)}`}
                </div>
              )}
            </div>

            {/* Destination type */}
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1.5">
                Destination *
              </label>
              <AdminSelect
                value={destType}
                onChange={e => setDestType(e.target.value)}
                options={DESTINATION_TYPES}
                id="dest-type-select"
              />
            </div>

            {/* Destination fields */}
            {destType === 'bank_account' && (
              <div className="space-y-2.5">
                <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank Name"
                  className="w-full px-3.5 h-[40px] glass-input rounded-xl text-xs" />
                <input value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Account Number"
                  className="w-full px-3.5 h-[40px] glass-input rounded-xl text-xs font-mono" />
                <input value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="IFSC Code"
                  className="w-full px-3.5 h-[40px] glass-input rounded-xl text-xs font-mono uppercase" />
              </div>
            )}
            {destType === 'upi' && (
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="UPI ID (e.g. name@bank)"
                className="w-full px-3.5 h-[40px] glass-input rounded-xl text-xs font-mono" />
            )}

            {/* Notes */}
            <div>
              <label className="block text-[10px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1.5">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Optional reference notes..."
                className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs resize-none" />
            </div>

            {/* Risk warning */}
            <div className="flex gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                This will create an internal settlement request requiring Finance approval. Platform Revenue is unaffected — only Available Balance is reduced.
              </p>
            </div>

            {/* Confirm */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 accent-[#7B3FA0] w-4 h-4 rounded" />
              <span className="text-[11px] text-[#7B3FA0] leading-relaxed">
                I confirm this settlement is accurate, authorised, and that the platform maintains the minimum reserve of {formatINR(reserve)}.
              </span>
            </label>

            {/* Remaining preview */}
            {parsed > 0 && !overLimit && !underMin && (
              <div className="glass-surface rounded-xl p-3 border border-white/50">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#7B3FA0]">Balance after settlement</span>
                  <span className="font-bold text-[#2D004D]">{formatINR(remaining)}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] text-xs font-bold rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !parsed || overLimit || underMin || !confirmed}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#2D004D] hover:bg-[#7B3FA0] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
            >
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Landmark size={13} />}
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Confirmation Modal (approve / complete / cancel)
// ─────────────────────────────────────────────────────────────────────────────
function ActionModal({ action, settlement, onClose, onSuccess }) {
  const [txRef, setTxRef]   = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const CONFIGS = {
    approve: {
      title: 'Approve Settlement',
      desc:  `Approve settlement ${settlement?.withdrawal_number} for ${formatINR(settlement?.amount)}? This moves it to Finance Processing.`,
      icon:  Check, iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700',
      label: 'Approve', btnVariant: 'approve',
    },
    complete: {
      title: 'Mark as Completed',
      desc:  `Confirm that ${formatINR(settlement?.amount)} has been transferred. Enter the bank transaction reference.`,
      icon:  CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700',
      label: 'Mark Completed', btnVariant: 'success',
      extra: (
        <input value={txRef} onChange={e => setTxRef(e.target.value)} placeholder="Bank UTR / Transaction Reference *"
          className="w-full px-3.5 h-[40px] glass-input rounded-xl text-xs font-mono" />
      ),
    },
    cancel: {
      title: 'Cancel Settlement',
      desc:  `Cancel settlement ${settlement?.withdrawal_number}? The amount will be restored to Available Balance.`,
      icon:  Ban, iconBg: 'bg-red-100', iconColor: 'text-red-600',
      label: 'Cancel Settlement', btnVariant: 'danger',
      extra: (
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
          placeholder="Reason for cancellation (optional)"
          className="w-full px-3.5 py-2.5 glass-input rounded-xl text-xs resize-none" />
      ),
    },
  };

  const cfg = CONFIGS[action];
  if (!cfg) return null;
  const IconCmp = cfg.icon;

  const handleConfirm = async () => {
    setError('');
    if (action === 'complete' && !txRef.trim()) {
      setError('Transaction reference is required.');
      return;
    }
    setLoading(true);
    try {
      let res;
      if (action === 'approve') res = await approveSettlement(settlement.id);
      else if (action === 'complete') res = await completeSettlement(settlement.id, txRef.trim());
      else if (action === 'cancel')   res = await cancelSettlement(settlement.id, reason);
      if (res?.success) onSuccess(res.updated_summary);
      else setError(res?.detail || 'Operation failed.');
    } catch (e) {
      setError(e?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-[#2D004D]/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="w-full max-w-sm bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#8E6AA8]/15 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-5 text-center">
            <div className={`w-12 h-12 rounded-2xl ${cfg.iconBg} flex items-center justify-center mx-auto mb-3`}>
              <IconCmp size={22} className={cfg.iconColor} />
            </div>
            <h3 className="text-base font-serif font-black text-[#2D004D] mb-1">{cfg.title}</h3>
            <p className="text-[12px] text-[#7B3FA0] leading-relaxed mb-4">{cfg.desc}</p>
            {cfg.extra && <div className="mb-3">{cfg.extra}</div>}
            {error && (
              <div className="flex gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 mb-3 text-left">
                <AlertTriangle size={12} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] text-xs font-bold rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={loading}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors
                  ${action === 'approve' ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : action === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-500 hover:bg-red-600 text-white'} disabled:opacity-40`}>
                {loading ? <RefreshCw size={12} className="animate-spin" /> : <IconCmp size={12} />}
                {loading ? 'Processing…' : cfg.label}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Export helper
// ─────────────────────────────────────────────────────────────────────────────
function exportLedgerCSV(items) {
  const header = 'ID,Type,Amount,Running Balance,Reference,Description,Created By,Date';
  const rows   = items.map(r =>
    [r.id, r.ledger_type, r.amount, r.running_balance,
     `${r.reference_type || ''}${r.reference_id ? '#' + r.reference_id : ''}`,
     `"${(r.description || '').replace(/"/g, '""')}"`,
     r.created_by_name, r.created_at].join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `lumora-ledger-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ summary, loading }) {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-[#381347]/5 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-[#381347]/5 rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (!summary) return (
    <EmptyState title="No treasury data" description="Treasury data will appear once orders are processed." />
  );

  const rows = [
    { label: 'Platform Revenue',      value: summary.platform_revenue,      color: 'text-[#2D004D]',   note: 'Gross lifetime earnings — immutable',   badge: 'IMMUTABLE' },
    { label: '− Affiliate Liability', value: summary.affiliate_liability,    color: 'text-orange-600',  note: 'Approved commissions owed to affiliates' },
    { label: '− Pending Settlements', value: summary.pending_withdrawals,    color: 'text-amber-600',   note: 'In-flight transfers (pending/approved)' },
    { label: '− Completed Payouts',   value: summary.completed_withdrawals,  color: 'text-blue-600',    note: 'Fully transferred out' },
  ];

  return (
    <div className="space-y-5">
      {/* Accounting formula panel */}
      <GlassCard title="Balance Formula" subtitle="TREASURY ACCOUNTING ENGINE">
        <div className="space-y-0">
          {rows.map((r, i) => (
            <div key={r.label} className={`flex items-center justify-between py-3.5 ${i < rows.length - 1 ? 'border-b border-[#8E6AA8]/8' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#2D004D]">{r.label}</span>
                  {r.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-widest bg-[#D8BFE3]/40 text-[#7B3FA0] uppercase">
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8E6AA8] mt-0.5">{r.note}</p>
              </div>
              <span className={`text-base font-mono font-bold ${r.color}`}>
                {formatINR(r.value)}
              </span>
            </div>
          ))}

          {/* Result */}
          <div className="flex items-center justify-between pt-4 mt-1 border-t-2 border-[#7B3FA0]/20">
            <div>
              <span className="text-base font-serif font-black text-[#2D004D]">Available Balance</span>
              <p className="text-[11px] text-[#8E6AA8] mt-0.5">
                Net withdrawable: {formatINR(summary.net_withdrawable)} (after {formatINR(summary.minimum_reserve)} reserve)
              </p>
            </div>
            <span className="text-2xl font-mono font-black text-[#7B3FA0]">{formatINR(summary.available_balance)}</span>
          </div>
        </div>
      </GlassCard>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's Revenue",   value: formatINR(summary.today_revenue),            icon: TrendingUp },
          { label: 'Month Withdrawn',   value: formatINR(summary.current_month_withdrawn),   icon: ArrowDownCircle },
          { label: 'Net Earnings',      value: formatINR(summary.net_platform_earnings),     icon: Wallet },
          { label: 'Ledger Entries',    value: (summary.ledger_entries || 0).toLocaleString(), icon: FileText },
        ].map(s => (
          <div key={s.label} className="glass-surface rounded-2xl p-4 border border-white/50 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icon size={13} className="text-[#7B3FA0]" />
              <span className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">{s.label}</span>
            </div>
            <p className="text-base font-serif font-black text-[#2D004D]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Settlement counts */}
      <GlassCard title="Settlement Status" subtitle="CURRENT PIPELINE">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending', count: summary.settlement_counts?.pending || 0, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Approved', count: summary.settlement_counts?.approved || 0, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
            { label: 'Completed', count: summary.settlement_counts?.completed || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-serif font-black ${s.color}`}>{s.count}</p>
              <p className="text-[10px] font-bold text-[#7B3FA0] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
        {summary.last_withdrawal && (
          <div className="mt-3 pt-3 border-t border-[#8E6AA8]/10 flex justify-between items-center">
            <span className="text-[11px] text-[#8E6AA8]">Last completed settlement</span>
            <div className="text-right">
              <p className="text-xs font-bold text-[#2D004D]">{formatINR(summary.last_withdrawal.amount)}</p>
              <p className="text-[10px] text-[#8E6AA8] font-mono">{summary.last_withdrawal.withdrawal_number}</p>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Ledger
// ─────────────────────────────────────────────────────────────────────────────
function LedgerTab() {
  const [data, setData]         = useState({ items: [], total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [typeFilter, setType]   = useState('');
  const [search, setSearch]     = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLedgerEntries(page, 50, typeFilter || null);
      setData(res);
    } catch (e) { console.warn('[LedgerTab]', e); }
    finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const typeOptions = [
    { value: '', label: 'All Types' },
    ...Object.entries(LEDGER_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ];

  const filtered = search
    ? data.items.filter(r =>
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.ledger_type?.toLowerCase().includes(search.toLowerCase()) ||
        r.reference_id?.toLowerCase().includes(search.toLowerCase())
      )
    : data.items;

  const headers = [
    { label: '#' },
    { label: 'Type' },
    { label: 'Amount', style: { textAlign: 'right' } },
    { label: 'Balance After', style: { textAlign: 'right' } },
    { label: 'Reference' },
    { label: 'Description' },
    { label: 'By' },
    { label: 'Date' },
  ];

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        onSearchChange={v => { setSearch(v); }}
        searchPlaceholder="Search ledger entries…"
        filters={[
          <AdminSelect
            key="ledger-type"
            value={typeFilter}
            onChange={e => { setType(e.target.value); setPage(1); }}
            options={typeOptions}
            id="ledger-type-filter"
          />,
        ]}
        actions={
          <ActionBtn
            onClick={() => exportLedgerCSV(data.items)}
            label="Export CSV"
            icon={Download}
            variant="ghost"
            small
          />
        }
      />

      <TableContainer
        headers={headers}
        isLoading={loading}
        isEmpty={!loading && filtered.length === 0}
        emptyTitle="No ledger entries yet"
        emptyDesc="Ledger entries appear as orders are processed and settlements are made."
        pagination={
          <div className="flex items-center justify-between w-full py-1">
            <span className="text-[11px] text-[#7B3FA0]">{data.total.toLocaleString()} total entries</span>
            <Pagination page={page} total={data.total} pageSize={50} onChange={setPage} />
          </div>
        }
      >
        {filtered.map(row => (
          <tr key={row.id} className="border-b border-[#8E6AA8]/5 hover:bg-[#D8BFE3]/8 transition-colors">
            <td className="px-3.5 py-2.5 text-[11px] font-mono text-[#8E6AA8]">#{row.id}</td>
            <td className="px-3.5 py-2.5"><LedgerTypeBadge type={row.ledger_type} /></td>
            <td className="px-3.5 py-2.5 text-right"><AmountCell amount={row.amount} /></td>
            <td className="px-3.5 py-2.5 text-right text-[11px] font-mono text-[#7B3FA0]">{formatINR(row.running_balance)}</td>
            <td className="px-3.5 py-2.5 text-[11px] font-mono text-[#8E6AA8] max-w-[100px] truncate">
              {row.reference_id ? `${row.reference_type || ''}#${row.reference_id}` : '—'}
            </td>
            <td className="px-3.5 py-2.5 text-[11px] text-[#7B3FA0] max-w-[200px] truncate">{row.description || '—'}</td>
            <td className="px-3.5 py-2.5 text-[11px] text-[#8E6AA8]">{row.created_by_name}</td>
            <td className="px-3.5 py-2.5 text-[10px] text-[#8E6AA8] whitespace-nowrap">{fmtDateShort(row.created_at)}</td>
          </tr>
        ))}
      </TableContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Settlements
// ─────────────────────────────────────────────────────────────────────────────
function SettlementsTab({ summary, roleLevel, onSummaryUpdate }) {
  const [data, setData]           = useState({ items: [], total: 0 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [statusFilter, setStatus] = useState('');
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showRequest, setShowRequest]     = useState(false);
  const [actionModal, setActionModal]     = useState(null); // { action, settlement }
  const [receipt, setReceipt]             = useState(null);
  const [toast, setToast]                 = useState('');

  const canRequest = roleLevel === 'super_admin';
  const canApprove = ['super_admin', 'finance'].includes(roleLevel);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithdrawalList(page, 20, statusFilter || null);
      setData(res);
    } catch (e) { console.warn('[SettlementsTab]', e); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setSelected(id);
    setDetail(null);
    setLoadingDetail(true);
    try { const d = await fetchWithdrawalDetail(id); setDetail(d); }
    catch (e) { console.warn(e); }
    finally { setLoadingDetail(false); }
  };

  const handleActionSuccess = (updatedSummary) => {
    setActionModal(null);
    showToast('Operation completed successfully.');
    load();
    if (selected) openDetail(selected);
    if (updatedSummary) onSummaryUpdate(updatedSummary);
  };

  const handleRequestSuccess = (updatedSummary) => {
    setShowRequest(false);
    showToast('Settlement request submitted.');
    load();
    if (updatedSummary) onSummaryUpdate(updatedSummary);
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label })),
  ];

  const headers = [
    { label: 'Reference' },
    { label: 'Amount', style: { textAlign: 'right' } },
    { label: 'Status' },
    { label: 'Requested By' },
    { label: 'Destination' },
    { label: 'Date' },
    { label: 'Actions' },
  ];

  return (
    <>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-4 right-4 z-[80] px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl shadow-md flex items-center gap-2"
          >
            <CheckCircle2 size={13} className="text-emerald-600" /> {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <FilterBar
          filters={[
            <AdminSelect
              key="status-filter"
              value={statusFilter}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              options={statusOptions}
              id="settlement-status-filter"
            />,
          ]}
          actions={
            canRequest ? (
              <ActionBtn
                onClick={() => setShowRequest(true)}
                label="Request Settlement"
                icon={Plus}
                variant="primary"
                small
              />
            ) : null
          }
        />

        {/* Phase 1/2 info banner */}
        <div className="flex gap-2.5 p-3 rounded-xl bg-[#D8BFE3]/15 border border-[#8E6AA8]/15">
          <Info size={14} className="text-[#7B3FA0] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#7B3FA0] leading-relaxed">
            <strong>Internal settlement workflow.</strong> Platform Revenue is never modified.
            Settlements reduce Available Balance only. Every action creates an audit log and ledger entry.
          </p>
        </div>

        <div className={`grid gap-5 ${selected ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
          {/* Table */}
          <div>
            <TableContainer
              headers={headers}
              isLoading={loading}
              isEmpty={!loading && data.items.length === 0}
              emptyTitle="No settlements yet"
              emptyDesc="Settlement records will appear here once a Super Admin requests one."
              emptyAction={canRequest ? (
                <ActionBtn onClick={() => setShowRequest(true)} label="Request Settlement" icon={Plus} variant="primary" />
              ) : null}
              pagination={
                <div className="flex items-center justify-between w-full py-1">
                  <span className="text-[11px] text-[#7B3FA0]">{data.total.toLocaleString()} records</span>
                  <Pagination page={page} total={data.total} pageSize={20} onChange={setPage} />
                </div>
              }
            >
              {data.items.map(row => (
                <tr key={row.id}
                  onClick={() => openDetail(row.id)}
                  className={`border-b border-[#8E6AA8]/5 cursor-pointer transition-colors
                    ${selected === row.id ? 'bg-[#D8BFE3]/15' : 'hover:bg-[#D8BFE3]/8'}`}
                >
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#7B3FA0]">{row.withdrawal_number}</td>
                  <td className="px-3.5 py-2.5 text-right text-xs font-bold text-[#2D004D] whitespace-nowrap">{formatINR(row.amount)}</td>
                  <td className="px-3.5 py-2.5"><StatusBadge status={row.status} /></td>
                  <td className="px-3.5 py-2.5 text-[11px] text-[#7B3FA0]">{row.requested_by_name}</td>
                  <td className="px-3.5 py-2.5 text-[11px] text-[#8E6AA8]">
                    {row.destination_label?.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3.5 py-2.5 text-[10px] text-[#8E6AA8] whitespace-nowrap">{fmtDateShort(row.requested_at)}</td>
                  <td className="px-3.5 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {canApprove && row.status === 'pending' && (
                        <ActionBtn onClick={() => setActionModal({ action: 'approve', settlement: row })} label="Approve" variant="approve" small />
                      )}
                      {canApprove && ['approved', 'processing'].includes(row.status) && (
                        <ActionBtn onClick={() => setActionModal({ action: 'complete', settlement: row })} label="Complete" variant="success" small />
                      )}
                      {canRequest && ['pending', 'approved'].includes(row.status) && (
                        <ActionBtn onClick={() => setActionModal({ action: 'cancel', settlement: row })} label="Cancel" variant="danger" small />
                      )}
                      {row.status === 'completed' && (
                        <ActionBtn
                          onClick={async () => { const d = await fetchWithdrawalDetail(row.id); setReceipt(d); }}
                          label="Receipt" icon={Printer} variant="ghost" small
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </TableContainer>
          </div>

          {/* Detail drawer */}
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="glass-surface rounded-2xl border border-white/50 shadow-sm p-5 self-start sticky top-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-serif font-black text-[#2D004D]">Settlement Detail</h4>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-[#D8BFE3]/20 text-[#8E6AA8] transition-colors">
                    <X size={14} />
                  </button>
                </div>

                {loadingDetail ? (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(7)].map((_, i) => <div key={i} className="h-4 bg-[#381347]/10 rounded" />)}
                  </div>
                ) : detail ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-[#8E6AA8] mb-2">{detail.withdrawal_number}</p>
                    <StatusBadge status={detail.status} />
                    <div className="mt-3 space-y-0">
                      {[
                        ['Amount',       formatINR(detail.amount)],
                        ['Destination',  detail.destination_type?.replace(/_/g, ' ')],
                        ['Tx Ref',       detail.transaction_reference],
                        ['Requested By', detail.requested_by?.name],
                        ['Requested',    fmtDate(detail.requested_at)],
                        ['Approved By',  detail.approved_by?.name],
                        ['Approved',     fmtDate(detail.approved_at)],
                        ['Completed',    fmtDate(detail.completed_at)],
                      ].map(([lbl, val]) => val ? (
                        <div key={lbl} className="flex justify-between py-2 border-b border-[#8E6AA8]/8 last:border-0 gap-3">
                          <span className="text-[10px] text-[#8E6AA8] shrink-0">{lbl}</span>
                          <span className="text-[11px] font-semibold text-[#2D004D] text-right">{val}</span>
                        </div>
                      ) : null)}
                    </div>

                    {detail.notes && (
                      <div className="mt-3 p-2.5 bg-[#D8BFE3]/15 rounded-xl">
                        <p className="text-[10px] text-[#8E6AA8] font-semibold mb-1">Notes</p>
                        <p className="text-[11px] text-[#7B3FA0]">{detail.notes}</p>
                      </div>
                    )}

                    {detail.audit_trail?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-2">Audit Trail</p>
                        <div className="space-y-1.5">
                          {detail.audit_trail.map((a, i) => (
                            <div key={i} className="p-2 bg-[#D8BFE3]/10 rounded-lg">
                              <p className="text-[10px] font-semibold text-[#2D004D]">{a.action.replace(/_/g, ' ')}</p>
                              <p className="text-[9px] text-[#8E6AA8]">{fmtDate(a.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.status === 'completed' && (
                      <button
                        onClick={() => setReceipt(detail)}
                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] text-[11px] font-bold rounded-xl transition-colors"
                      >
                        <Printer size={12} /> Print Receipt
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#8E6AA8]">Failed to load detail.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Modals */}
      {showRequest && (
        <SettlementRequestModal
          summary={summary}
          onClose={() => setShowRequest(false)}
          onSuccess={handleRequestSuccess}
        />
      )}
      {actionModal && (
        <ActionModal
          action={actionModal.action}
          settlement={actionModal.settlement}
          onClose={() => setActionModal(null)}
          onSuccess={handleActionSuccess}
        />
      )}
      {receipt && (
        <SettlementReceiptModal settlement={receipt} onClose={() => setReceipt(null)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab: Timeline
// ─────────────────────────────────────────────────────────────────────────────
function TimelineTab() {
  const [data, setData]       = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTreasuryTimeline(page, 40);
      setData(res);
    } catch (e) { console.warn('[TimelineTab]', e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const COLOR_CLASSES = {
    emerald: { dot: 'bg-emerald-400', ring: 'ring-emerald-200', amt: 'text-emerald-600' },
    red:     { dot: 'bg-red-400',     ring: 'ring-red-200',     amt: 'text-red-500' },
    orange:  { dot: 'bg-orange-400',  ring: 'ring-orange-200',  amt: 'text-orange-600' },
    pink:    { dot: 'bg-pink-400',    ring: 'ring-pink-200',    amt: 'text-pink-600' },
    blue:    { dot: 'bg-blue-400',    ring: 'ring-blue-200',    amt: 'text-blue-600' },
    amber:   { dot: 'bg-amber-400',   ring: 'ring-amber-200',   amt: 'text-amber-600' },
    purple:  { dot: 'bg-[#7B3FA0]',   ring: 'ring-[#D8BFE3]',  amt: 'text-[#7B3FA0]' },
  };

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-[#381347]/5 rounded-xl" />)}
    </div>
  );

  if (data.items.length === 0) return (
    <EmptyState title="No timeline events" description="Financial events will appear here as orders are processed and settlements are made." />
  );

  return (
    <div>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-[#8E6AA8]/10" />

        <div className="space-y-0">
          {data.items.map((item, idx) => {
            const clr = COLOR_CLASSES[item.color] || COLOR_CLASSES.purple;
            const isPositive = item.amount >= 0;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                className="flex gap-4 pb-4 relative"
              >
                {/* Dot */}
                <div className="relative z-10 shrink-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base ring-2 ${clr.dot} ${clr.ring} bg-opacity-20`}>
                    {item.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="glass-surface flex-1 rounded-xl border border-white/50 px-4 py-3 shadow-sm min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-[#2D004D] truncate">{item.title}</p>
                      {item.description && (
                        <p className="text-[10px] text-[#7B3FA0] mt-0.5 truncate">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {item.reference && (
                          <span className="text-[9px] font-mono text-[#8E6AA8] bg-[#D8BFE3]/20 px-1.5 py-0.5 rounded">
                            {item.reference}
                          </span>
                        )}
                        <span className="text-[9px] text-[#8E6AA8]">{item.actor}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-mono font-bold ${isPositive ? clr.amt : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{formatINR(item.amount)}
                      </p>
                      <p className="text-[9px] text-[#8E6AA8] mt-0.5 whitespace-nowrap">{fmtDate(item.created_at)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#8E6AA8]/10">
        <span className="text-[11px] text-[#7B3FA0]">{data.total.toLocaleString()} events</span>
        <Pagination page={page} total={data.total} pageSize={40} onChange={setPage} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Cards — 6 cards using Lumora DashboardCard
// ─────────────────────────────────────────────────────────────────────────────
function TreasuryKPICards({ summary, loading }) {
  const CARDS = [
    {
      title:      'Platform Revenue',
      value:      loading ? '…' : formatINR(summary?.platform_revenue),
      icon:       DollarSign,
      trend:      '+∞',
      trendLabel: 'immutable',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,18 L20,14 L40,12 L60,8 L80,6 L100,3" fill="none" stroke="#7B3FA0" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title:      'Available Balance',
      value:      loading ? '…' : formatINR(summary?.available_balance),
      icon:       Wallet,
      trend:      loading ? '…' : formatINR(summary?.net_withdrawable),
      trendLabel: 'net withdrawable',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,12 L25,10 L50,8 L75,6 L100,5" fill="none" stroke="#059669" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title:      'Net Earnings',
      value:      loading ? '…' : formatINR(summary?.net_platform_earnings),
      icon:       TrendingUp,
      trend:      loading ? '…' : `−${formatINR(summary?.affiliate_liability)} aff.`,
      trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,16 L30,13 L60,10 L80,8 L100,5" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title:      'Affiliate Liability',
      value:      loading ? '…' : formatINR(summary?.affiliate_liability),
      icon:       ArrowUpRight,
      trend:      'owed',
      trendLabel: 'to affiliates',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,8 L30,10 L60,12 L80,10 L100,11" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title:      'Pending Settlement',
      value:      loading ? '…' : formatINR(summary?.pending_withdrawals),
      icon:       Clock,
      trend:      loading ? '…' : `${summary?.settlement_counts?.pending || 0} pending`,
      trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,10 L50,10 L50,8 L100,8" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title:      'Completed Payouts',
      value:      loading ? '…' : formatINR(summary?.completed_withdrawals),
      icon:       CheckCircle2,
      trend:      loading ? '…' : `${summary?.settlement_counts?.completed || 0} done`,
      trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,15 L25,12 L50,10 L75,7 L100,5" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
  ];

  return (
    <StatsGrid columns={6}>
      {CARDS.map(c => (
        <DashboardCard key={c.title} isLoading={loading} {...c} />
      ))}
    </StatsGrid>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Bar
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart3 },
  { id: 'ledger',       label: 'Ledger',       icon: List },
  { id: 'settlements',  label: 'Settlements',  icon: Landmark },
  { id: 'timeline',     label: 'Timeline',     icon: Activity },
];

function TabBar({ active, onChange }) {
  return (
    <div className="flex gap-1 p-1 glass-surface rounded-xl border border-white/50 shadow-sm w-fit overflow-x-auto">
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap
            ${active === t.id
              ? 'bg-[#2D004D] text-white shadow-sm'
              : 'text-[#7B3FA0] hover:bg-[#D8BFE3]/20'}`}
        >
          <t.icon size={12} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function PlatformFinance() {
  const navigate = useNavigate();
  const { adminProfile } = useAdminContext();

  const [tab, setTab]           = useState('overview');
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const pollRef                 = useRef(null);

  const roleLevel = adminProfile?.role_level || 'admin';

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchTreasurySummary();
      if (data) { setSummary(data); setError(null); }
    } catch (e) {
      setError('Treasury data unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    // Poll every 30s for realtime-like updates (Firestore listener replaced by polling for Phase 2)
    pollRef.current = setInterval(loadSummary, 30_000);
    return () => clearInterval(pollRef.current);
  }, [loadSummary]);

  const handleSummaryUpdate = (updatedSummary) => {
    if (updatedSummary) setSummary(prev => ({ ...prev, ...updatedSummary }));
  };

  return (
    <AdminLayout activePage="finance">
      <div className="space-y-5 pb-12">

        {/* Page Header */}
        <PageHeader
          title="Finance & Treasury"
          subtitle="Platform treasury ledger, settlement workflow, and immutable revenue accounting"
          actions={
            <div className="flex items-center gap-2.5">
              {!loading && summary && (
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Available Balance</span>
                  <span className="text-lg font-serif font-black text-[#7B3FA0] leading-tight">
                    {formatINR(summary.available_balance)}
                  </span>
                </div>
              )}
              <button
                onClick={loadSummary}
                className="p-2 rounded-xl border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          }
        />

        {/* Phase 2 banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-[#D8BFE3]/15 border border-[#8E6AA8]/15">
          <Shield size={14} className="text-[#7B3FA0] shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold text-[#2D004D]">Phase 2 — Settlement Workflow Active</p>
            <p className="text-[11px] text-[#7B3FA0]">
              Internal settlement requests, approval workflow, ledger with CSV export, and treasury timeline are live.
              Revenue is immutable. Every operation creates an audit log.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-600">{error}
              <button onClick={loadSummary} className="ml-2 underline font-semibold">Retry</button>
            </p>
          </div>
        )}

        {/* KPI Cards */}
        <TreasuryKPICards summary={summary} loading={loading} />

        {/* Tab Bar */}
        <TabBar active={tab} onChange={setTab} />

        {/* Tab Content */}
        <div className="min-h-[300px]">
          {tab === 'overview'    && <OverviewTab summary={summary} loading={loading} />}
          {tab === 'ledger'      && <LedgerTab />}
          {tab === 'settlements' && (
            <SettlementsTab
              summary={summary}
              roleLevel={roleLevel}
              onSummaryUpdate={handleSummaryUpdate}
            />
          )}
          {tab === 'timeline'    && <TimelineTab />}
        </div>

        {/* Footer timestamp */}
        {summary?._meta?.computed_at && (
          <p className="text-[10px] text-[#8E6AA8] text-right">
            Last computed: {fmtDate(summary._meta.computed_at)} · Auto-refreshes every 30s
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
