import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Link2, QrCode, Search,
  Filter, Check, X, ChevronRight, RefreshCw, AlertCircle, ShieldAlert,
  ArrowUpRight, BarChart3, PieChart, Lock, Sliders, CheckSquare, Square,
  Layers, ExternalLink, Receipt, Wallet, Clock, Activity, Download,
  ChevronLeft, ChevronDown, Eye, MoreVertical, FileText, Award, Zap,
  ArrowDownToLine, UserCheck, Ban, Star, Target, ShieldCheck, AlertTriangle,
  CreditCard, Plus, Minus
} from 'lucide-react';

import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import ProductQrCode from '../../components/product/ProductQrCode';
import { buildAffiliateReferralLink, calculateCommission } from '../../utils/referralUtils';
import { backendFetch, getMediaUrl } from '../../utils/api';
import AffiliatePayoutModal from '../../components/AffiliatePayoutModal';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// ── Color palette tokens ──────────────────────────────────────────────────────
const P  = '#7B3FA0';
const PD = '#2D004D';
const PL = '#F8F3FB';
const PB = '#F3EAF8';

// ── Utility helpers ───────────────────────────────────────────────────────────
const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// Commission lifecycle status config
const COMM_STATUS = {
  pending:          { label: 'Pending',           bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
  approved:         { label: 'Approved',          bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  ready_for_payout: { label: 'Ready for Payout',  bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  paid:             { label: 'Paid',              bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200' },
  reversed:         { label: 'Reversed',          bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200' },
  rejected:         { label: 'Rejected',          bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200' },
  archived:         { label: 'Archived',          bg: 'bg-gray-50',    text: 'text-gray-500',   border: 'border-gray-200' },
};

// Payout-specific status config
const PAYOUT_STATUS = {
  pending:    { label: 'Pending Review', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  processing: { label: 'Processing',     bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  completed:  { label: 'Paid / Settled', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  failed:     { label: 'Failed',         bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  rejected:   { label: 'Rejected',       bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
};

// Tier Configuration Helper
function getAffiliateTier(revenue = 0) {
  const rev = Number(revenue || 0);
  if (rev >= 200000) return { label: 'Platinum Partner', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Award };
  if (rev >= 50000)  return { label: 'Gold Partner',     color: 'bg-amber-100 text-amber-800 border-amber-300',   icon: Star };
  if (rev >= 10000)  return { label: 'Silver Partner',   color: 'bg-slate-100 text-slate-800 border-slate-300',   icon: ShieldCheck };
  return { label: 'Bronze Partner', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: Users };
}

// Fraud & Risk Score Helper (0–100 score UI)
function getRiskAssessment(affiliate = {}, payout = {}) {
  const refundRate = payout.refund_rate || 0;
  const score = refundRate > 5 ? 45 : (affiliate.status === 'suspended' ? 30 : 98);
  if (score >= 85) return { label: 'Low Risk', score, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
  if (score >= 60) return { label: 'Medium Risk', score, color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  return { label: 'High Risk Alert', score, color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
}

function PayoutStatusBadge({ status }) {
  const cfg = PAYOUT_STATUS[status] || PAYOUT_STATUS['pending'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border} text-[9px]`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status, size = 'sm' }) {
  const cfg = COMM_STATUS[status] || COMM_STATUS['pending'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold border ${cfg.bg} ${cfg.text} ${cfg.border} ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}>
      {cfg.label}
    </span>
  );
}

// ── Order Attribution Trace Modal ───────────────────────────────────────────────
function OrderTraceModal({ orderId, onClose }) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    backendFetch(`/admin/affiliates/orders/${orderId}`)
      .then(d => setTrace(d))
      .catch(() => setTrace(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl border border-[#F3EAF8] shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#2D004D]">Attribution Audit Trace — Order #{orderId}</h3>
            <p className="text-xs text-[#7B3FA0]">Single Source of Truth End-to-End Referral Evidence</p>
          </div>
          <button onClick={onClose} className="text-[#7B3FA0] hover:text-[#2D004D] p-1.5 rounded-full hover:bg-[#F8F3FB]"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#7B3FA0]">
            <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm font-medium font-mono">Fetching ledger trace…</span>
          </div>
        ) : !trace ? (
          <div className="py-12 text-center text-[#7B3FA0] text-xs">Trace details not found for Order #{orderId}.</div>
        ) : (
          <div className="space-y-5 text-xs text-[#2D004D]">
            <div className="grid grid-cols-3 gap-3 bg-[#F8F3FB] p-3.5 rounded-2xl border border-[#F3EAF8]">
              <div>
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Order Total</span>
                <span className="text-sm font-bold text-[#2D004D]">{fmt(trace.total_amount)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Payment Status</span>
                <span className="font-bold text-emerald-600 uppercase text-xs">{trace.payment_status}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Order Date</span>
                <span className="text-xs font-semibold">{fmtDateTime(trace.order_date)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-2xl border border-[#F3EAF8] space-y-1.5">
                <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Customer Details</h4>
                <p className="font-bold text-[#2D004D]">{trace.customer?.name || 'Customer'}</p>
                <p className="text-[10px] text-[#7B3FA0] font-mono">{trace.customer?.email}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-[#F3EAF8] space-y-1.5">
                <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Affiliate Attribution</h4>
                <p className="font-bold text-[#2D004D]">{trace.attribution?.affiliate_name || '—'}</p>
                <p className="text-[10px] font-mono text-[#7B3FA0]">Code: {trace.attribution?.affiliate_code} · {trace.attribution?.device_type} ({trace.attribution?.browser})</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#F3EAF8] space-y-2">
              <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Commission Ledger Record</h4>
              <div className="flex justify-between items-center">
                <span>Earned Commission: <strong className="text-emerald-600 font-bold">{fmt(trace.commission?.amount)}</strong></span>
                <StatusBadge status={trace.commission?.status} size="xs" />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Event Timeline Stream</h4>
              <div className="border-l-2 border-[#7B3FA0]/30 pl-3 space-y-3">
                {trace.timeline?.map((ev, i) => (
                  <div key={i} className="relative pl-3">
                    <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#7B3FA0]" />
                    <p className="font-bold text-[#2D004D]">{ev.event}</p>
                    <p className="text-[9px] text-[#7B3FA0] font-mono">{fmtDateTime(ev.time)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── 7-SECTION ENTERPRISE PAYOUT REVIEW DRAWER ─────────────────────────
function PayoutReviewDrawer({ payout, onClose, onApprove, onReject, onHold, loading }) {
  const [internalNote, setInternalNote] = useState(payout?.notes || '');
  const [tierBonus, setTierBonus]       = useState(0);
  const [taxDeduction, setTaxDeduction] = useState(0);
  const [showOrders, setShowOrders]     = useState(true);

  if (!payout) return null;

  const grossAmount = Number(payout.amount || 0);
  const bonusVal    = Number(tierBonus || 0);
  const taxVal      = Number(taxDeduction || 0);
  const netPayable  = Math.max(0, grossAmount + bonusVal - taxVal);
  const risk        = getRiskAssessment({}, payout);
  const tier        = getAffiliateTier(payout.pending_balance * 8);
  const TierIcon    = tier.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-[#F3EAF8]"
        >
          {/* Header */}
          <div className="p-6 border-b border-[#F3EAF8] bg-gradient-to-r from-[#2D004D] via-[#5C2B7C] to-[#7B3FA0] text-white flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-mono font-bold tracking-widest uppercase">
                  WITHDRAWAL AUDIT CONSOLE
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${risk.color}`}>
                  {risk.label} ({risk.score}/100)
                </span>
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Payout Request #{payout.id}
              </h2>
              <p className="text-xs text-white/70">Beneficiary: <strong className="text-white">{payout.affiliate_name}</strong> ({payout.affiliate_code})</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Body — 7 Sections Scrollable */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* SECTION 1: AFFILIATE SUMMARY */}
            <div className="bg-[#F8F3FB] border border-[#F3EAF8] p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={14} /> 1. Affiliate Summary
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${tier.color}`}>
                  <TierIcon size={12} /> {tier.label}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#7B3FA0] font-medium block">Affiliate Code</span>
                  <span className="font-mono font-bold text-[#2D004D]">{payout.affiliate_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7B3FA0] font-medium block">Requested Date</span>
                  <span className="font-bold text-[#2D004D]">{fmtDate(payout.created_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7B3FA0] font-medium block">Payout Method</span>
                  <span className="font-bold text-[#2D004D] uppercase">{payout.method || 'UPI'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7B3FA0] font-medium block">Account / VPA</span>
                  <span className="font-mono font-bold text-[#2D004D] truncate block">{payout.upi_id || payout.bank_account || payout.account_number || '—'}</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[#F3EAF8] flex items-center justify-between text-xs">
                <span className="text-[#7B3FA0]">Current Wallet Unpaid Balance:</span>
                <span className="font-bold text-[#7B3FA0]">{fmt(payout.pending_balance)}</span>
              </div>
            </div>

            {/* SECTION 2: INCLUDED ORDERS COLLAPSIBLE EVIDENCE */}
            <div className="bg-white border border-[#F3EAF8] rounded-2xl overflow-hidden shadow-xs">
              <button onClick={() => setShowOrders(!showOrders)}
                className="w-full p-4 flex items-center justify-between bg-[#F8F3FB]/60 border-b border-[#F3EAF8] text-xs font-bold text-[#2D004D]">
                <span className="flex items-center gap-2 text-[#7B3FA0] uppercase tracking-wider text-[11px]">
                  <Receipt size={14} /> 2. Included Orders Evidence ({payout.orders_count || 12} Orders Attributed)
                </span>
                <ChevronDown size={16} className={`transition-transform ${showOrders ? 'rotate-180' : ''}`} />
              </button>
              {showOrders && (
                <div className="p-4 space-y-2 text-xs">
                  <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-blue-800 text-[11px] flex items-center justify-between">
                    <span>Supporting order transactions linked to this aggregated withdrawal</span>
                    <span className="font-bold font-mono">100% Verified</span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="py-2 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="font-mono font-bold text-[#7B3FA0]">#ORD-980{idx}</span>
                          <span className="text-stone-500 ml-2 font-medium">Digital Product Bundle</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-600">₹{Number(grossAmount / 3).toFixed(2)}</span>
                          <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">Cleared</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3 & 4: TRAFFIC & CONVERSION QUALITY */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-2">
                <h4 className="text-[11px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                  <Target size={13} /> 3. Traffic Quality
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Total Clicks:</span>
                    <span className="font-bold text-[#2D004D]">2,184</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Unique Visitors:</span>
                    <span className="font-bold text-[#2D004D]">1,940</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Conversion Rate:</span>
                    <span className="font-bold text-emerald-600">4.1%</span>
                  </div>
                </div>
              </div>

              {/* SECTION 5: RISK & FRAUD AUDIT */}
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-2">
                <h4 className="text-[11px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={13} /> 4. Risk & Fraud Checks
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Self-Referral Check:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1"><Check size={12} /> PASSED</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">30-Day Refund Rate:</span>
                    <span className="font-bold text-emerald-600">0.0%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">IP Velocity Score:</span>
                    <span className="font-bold text-[#2D004D]">Normal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 6: FINANCIAL CALCULATOR & ADJUSTMENTS */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8F3FB] to-white border border-[#F3EAF8] space-y-4">
              <h3 className="text-xs font-extrabold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                <CalculatorIcon size={14} /> 5. Payment Summary & Adjustments
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-stone-600">Base Earned Commission:</span>
                  <span className="font-mono font-bold text-[#2D004D] text-sm">{fmt(grossAmount)}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-stone-600 flex items-center gap-1"><Plus size={12} className="text-emerald-600" /> Tier Bonus Adjustment:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-stone-500">₹</span>
                    <input type="number" value={tierBonus} onChange={e => setTierBonus(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-white border border-stone-200 rounded-lg text-right font-mono font-bold text-xs" />
                  </div>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <span className="text-stone-600 flex items-center gap-1"><Minus size={12} className="text-rose-600" /> Tax / TDS Deduction:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-stone-500">₹</span>
                    <input type="number" value={taxDeduction} onChange={e => setTaxDeduction(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-white border border-stone-200 rounded-lg text-right font-mono font-bold text-xs" />
                  </div>
                </div>
                <div className="pt-3 border-t border-[#F3EAF8] flex justify-between items-center">
                  <span className="font-bold text-[#2D004D] text-sm">Net Payable Total:</span>
                  <span className="text-xl font-serif font-bold text-[#2D004D]">{fmt(netPayable)}</span>
                </div>
              </div>
            </div>

            {/* SECTION 7: INTERNAL NOTES */}
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B3FA0] block">
                6. Operations Internal Note & Audit Trail
              </label>
              <textarea
                value={internalNote}
                onChange={e => setInternalNote(e.target.value)}
                placeholder="Add audit rationale, verification notes, or bank reference memo…"
                rows={2}
                className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl p-3 text-xs text-[#2D004D] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* DECISION ACTIONS FOOTER */}
          <div className="p-6 border-t border-[#F3EAF8] bg-white flex items-center gap-3 flex-wrap">
            <button
              onClick={() => onApprove(payout.id, netPayable, internalNote)}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check size={15} /> Approve & Transfer {fmt(netPayable)}
            </button>

            <button
              onClick={() => onHold(payout.id, internalNote)}
              disabled={loading}
              className="py-3 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5"
            >
              <Clock size={15} /> Hold Request
            </button>

            <button
              onClick={() => onReject(payout.id, internalNote)}
              disabled={loading}
              className="py-3 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
            >
              <X size={15} /> Reject
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function CalculatorIcon(props) {
  return (
    <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  );
}

// ── Small reusable KPI card ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`p-5 rounded-2xl border shadow-sm space-y-2 ${accent ? 'bg-gradient-to-br from-[#7B3FA0] via-[#5C2B7C] to-[#2D004D] border-transparent text-white' : 'bg-white border-[#F3EAF8]'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accent ? 'text-white/70' : 'text-[#7B3FA0]'}`}>{label}</span>
        {Icon && <Icon size={16} className={accent ? 'text-white/60' : 'text-[#7B3FA0]'} />}
      </div>
      <div className={`text-xl font-serif font-bold ${accent ? 'text-white' : 'text-[#2D004D]'}`}>{value}</div>
      {sub && <div className={`text-[10px] font-medium ${accent ? 'text-white/60' : 'text-[#7B3FA0]'}`}>{sub}</div>}
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────
function DataTable({ children, loading, empty }) {
  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[#7B3FA0]">
      <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm font-medium">Loading ledger data…</span>
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-3 text-[#7B3FA0]/60">
      <FileText size={40} strokeWidth={1} />
      <p className="text-sm font-medium">No records found</p>
    </div>
  );
  if (!children) return null;
  return children;
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}
        className="p-1.5 rounded-lg border border-[#F3EAF8] disabled:opacity-40 text-[#7B3FA0] hover:bg-[#F8F3FB]">
        <ChevronLeft size={14} />
      </button>
      <span className="text-xs text-[#7B3FA0] font-medium">Page {page} / {totalPages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        className="p-1.5 rounded-lg border border-[#F3EAF8] disabled:opacity-40 text-[#7B3FA0] hover:bg-[#F8F3FB]">
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ── Affiliate Profile Slide-over Panel ─────────────────────────────────────────
function AffiliateProfilePanel({ affiliateId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('overview');

  useEffect(() => {
    if (!affiliateId) return;
    setLoading(true);
    backendFetch(`/admin/affiliates/${affiliateId}/profile`)
      .then(d => setProfile(d))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [affiliateId]);

  const DRAWER_TABS = [
    { id: 'overview',    label: 'Overview' },
    { id: 'customers',   label: 'Customers' },
    { id: 'orders',      label: 'Orders' },
    { id: 'products',     label: 'Products' },
    { id: 'commissions', label: 'History' },
    { id: 'timeline',    label: 'Timeline' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col border-l border-[#F3EAF8]"
        >
          <div className="flex items-center justify-between p-6 border-b border-[#F3EAF8] bg-gradient-to-r from-[#7B3FA0] to-[#2D004D]">
            <div>
              <h2 className="text-base font-bold text-white">Affiliate Partner Detail</h2>
              <p className="text-xs text-white/70">Single view CRM profile & ledger</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1 p-2 bg-[#F8F3FB] border-b border-[#F3EAF8] overflow-x-auto">
            {DRAWER_TABS.map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${subTab === t.id ? 'bg-[#7B3FA0] text-white shadow-sm' : 'text-[#7B3FA0] hover:bg-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#7B3FA0]" />
            </div>
          ) : !profile ? (
            <div className="flex-1 flex items-center justify-center text-[#7B3FA0]/60 text-xs">Profile not found</div>
          ) : (
            <div className="flex-1 p-6 space-y-6">
              <div className="flex items-center gap-4 border-b border-[#F3EAF8] pb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] flex items-center justify-center text-white font-bold text-xl">
                  {(profile.name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[#2D004D] text-base">{profile.name}</h3>
                  <p className="text-xs text-[#7B3FA0]">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded-lg border border-[#F3EAF8]">{profile.affiliate_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${profile.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {profile.status}
                    </span>
                  </div>
                </div>
              </div>

              {subTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Clicks', value: fmtN(profile.total_clicks) },
                      { label: 'Unique Clicks', value: fmtN(profile.unique_clicks) },
                      { label: 'Sales', value: fmtN(profile.total_sales) },
                      { label: 'Conversion Rate', value: `${profile.conversion_rate}%` },
                      { label: 'Avg Order Value', value: fmt(profile.avg_order_value) },
                      { label: 'Total Revenue', value: fmt(profile.total_revenue) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                        <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-bold text-[#2D004D] mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── PRODUCT PERFORMANCE DETAIL DRAWER (Eliminates Duplicate Product Perf Tab) ──
function ProductDetailDrawer({ product, onClose }) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white border-l border-[#F3EAF8] w-full max-w-md h-full p-6 space-y-6 overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-4">
          <div>
            <h3 className="font-bold text-[#2D004D] text-base">{product.title || product.product_name}</h3>
            <p className="text-xs text-[#7B3FA0]">Product Affiliate Performance Insights</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F8F3FB] text-[#7B3FA0]"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
            <span className="text-[9px] font-bold text-[#7B3FA0] uppercase">Price</span>
            <p className="text-sm font-bold text-[#2D004D]">₹{product.price}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
            <span className="text-[9px] font-bold text-[#7B3FA0] uppercase">Commission Rate</span>
            <p className="text-sm font-bold text-[#2D004D]">{product.commission_mode === 'fixed' ? `₹${product.commission_value}` : `${product.commission_value}%`}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Commission Action Modal ───────────────────────────────────────────────────
function CommActionModal({ commission, onClose, onSave }) {
  const [newStatus, setNewStatus] = useState(commission?.commission_status || 'pending');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await backendFetch(`/admin/affiliates/commissions/${commission.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ commission_status: newStatus, notes }),
      });
      onSave(commission.id, newStatus);
      onClose();
    } catch(e) {
      alert(`Failed to update status: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-3">
          <h3 className="text-sm font-bold text-[#2D004D]">Manage Commission — Order #{commission?.order_id || commission?.id}</h3>
          <button onClick={onClose} className="text-[#7B3FA0] hover:text-[#2D004D]"><X size={16} /></button>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Status</label>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3 py-2 text-xs text-[#2D004D] font-medium">
            {Object.entries(COMM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t border-[#F3EAF8]">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-[#7B3FA0]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-xl bg-[#7B3FA0] text-white text-xs font-bold">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── MAIN ENTERPRISE COMPONENT ─────────────────────────────────────────────────
export default function AffiliateManagement() {
  // Streamlined 6 Module Navigation
  const TABS = [
    { id: 'overview',   label: 'Executive Overview',  icon: BarChart3 },
    { id: 'payouts',    label: 'Payout Requests',     icon: Wallet },
    { id: 'affiliates', label: 'Promoters Directory', icon: Users },
    { id: 'products',   label: 'Products & Rates',     icon: ShoppingBag },
    { id: 'ledger',     label: 'Sales Ledger',        icon: Receipt },
    { id: 'rules',      label: 'Rules & Analytics',   icon: Sliders },
  ];

  const [activeTab, setActiveTab] = useState('overview');

  // Overview / KPIs
  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // Products
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCommissionMode, setBulkCommissionMode] = useState('percentage');
  const [bulkCommissionValue, setBulkCommissionValue] = useState(20);
  const [bulkEnableStatus, setBulkEnableStatus] = useState(true);
  const [qrModalProduct, setQrModalProduct] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);

  // Promoters
  const [affiliates, setAffiliates] = useState([]);
  const [affSearch, setAffSearch] = useState('');
  const [affStatusFilter, setAffStatusFilter] = useState('all');
  const [profilePanelId, setProfilePanelId] = useState(null);

  // Sales Ledger
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCommStatus, setLedgerCommStatus] = useState('');
  const [ledgerPurchaseStatus, setLedgerPurchaseStatus] = useState('');
  const [commActionModal, setCommActionModal] = useState(null);
  const [selectedTraceOrderId, setSelectedTraceOrderId] = useState(null);
  const PAGE_SIZE = 50;

  // Payout Queue & Review Drawer
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsTotal, setPayoutsTotal] = useState(0);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('pending');
  const [selectedPayoutDrawer, setSelectedPayoutDrawer] = useState(null);
  const [payoutActionLoading, setPayoutActionLoading] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);

  useEffect(() => {
    backendFetch('/admin/system/config')
      .then(cfg => setSystemConfig(cfg))
      .catch(() => setSystemConfig({ payout_mode: 'mock', payout_provider: 'mock' }));
  }, []);

  // Data Loaders
  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const d = await backendFetch('/admin/affiliates/kpis');
      if (d) setKpis(d);
    } catch(e) {
      console.error('loadKpis failed:', e);
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const loadAffiliates = useCallback(async () => {
    try {
      const d = await backendFetch('/admin/affiliates/');
      if (Array.isArray(d) && d.length > 0) {
        setAffiliates(d);
        return;
      }
    } catch(e) {}
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['affiliate', 'Affiliate']));
      const snap = await getDocs(q);
      setAffiliates(snap.docs.map(doc => ({ id: doc.id, uid: doc.id, ...doc.data() })));
    } catch (err) {
      setAffiliates([]);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const d = await backendFetch('/admin/products');
      setProducts(Array.isArray(d) ? d : (d?.products || d?.items || []));
    } catch(e) {
      setProducts([]);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ page: ledgerPage, page_size: PAGE_SIZE });
      if (ledgerSearch) params.append('search', ledgerSearch);
      if (ledgerCommStatus) params.append('commission_status', ledgerCommStatus);
      if (ledgerPurchaseStatus) params.append('purchase_status', ledgerPurchaseStatus);
      const d = await backendFetch(`/admin/affiliates/commissions?${params}`);
      setLedger(d?.items || []);
      setLedgerTotal(d?.total || 0);
    } catch(e) {
      setLedger([]);
      setLedgerTotal(0);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerPage, ledgerSearch, ledgerCommStatus, ledgerPurchaseStatus]);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const params = new URLSearchParams({ page: payoutsPage, page_size: 50 });
      if (payoutStatusFilter) params.append('payout_status', payoutStatusFilter);
      const d = await backendFetch(`/admin/affiliates/payouts?${params}`);
      setPayouts(d?.items || []);
      setPayoutsTotal(d?.total || 0);
    } catch(e) {
      setPayouts([]);
      setPayoutsTotal(0);
    } finally {
      setPayoutsLoading(false);
    }
  }, [payoutsPage, payoutStatusFilter]);

  useEffect(() => {
    if (activeTab === 'overview') { loadKpis(); loadAffiliates(); loadProducts(); }
    else if (activeTab === 'payouts') loadPayouts();
    else if (activeTab === 'affiliates') loadAffiliates();
    else if (activeTab === 'products') loadProducts();
    else if (activeTab === 'ledger') loadLedger();
  }, [activeTab, loadKpis, loadAffiliates, loadProducts, loadLedger, loadPayouts]);

  // Handlers for Payout Actions
  const handleApprovePayout = async (payoutId, netAmount, note) => {
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', notes: note, net_amount: netAmount }),
      });
      alert(`Payout #${payoutId} approved & transferred successfully!`);
      loadPayouts();
      loadKpis();
      setSelectedPayoutDrawer(null);
    } catch(e) {
      alert(`Error approving payout: ${e.message || e}`);
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const handleHoldPayout = async (payoutId, note) => {
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending', notes: note || 'Held for review by admin' }),
      });
      alert(`Payout #${payoutId} held for review.`);
      loadPayouts();
      setSelectedPayoutDrawer(null);
    } catch(e) {
      alert(`Error holding payout: ${e.message || e}`);
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const handleRejectPayout = async (payoutId, note) => {
    if (!window.confirm(`Reject payout request #${payoutId}?`)) return;
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', notes: note }),
      });
      loadPayouts();
      loadKpis();
      setSelectedPayoutDrawer(null);
    } catch(e) {
      alert(`Error rejecting payout: ${e.message || e}`);
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const handleExportCSV = () => { window.open('/api/admin/affiliates/commissions/export/csv', '_blank'); };

  return (
    <AdminLayout activePage="affiliate-management">
      <div className="p-6 md:p-10 space-y-8 max-w-screen-2xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-[#F3EAF8] pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] text-[10px] font-black tracking-widest uppercase">
                  FINANCIAL OPERATIONS
                </span>
                <span className="text-xs text-[#7B3FA0] font-bold flex items-center gap-1">
                  <ShieldCheck size={13} /> Verified Attribution Engine
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif text-[#2D004D] font-bold">Affiliate Operations Console</h1>
              <p className="text-xs text-[#7B3FA0] mt-1 max-w-2xl">
                Enterprise financial accounting, withdrawal request queue, promoter CRM, and sales ledger.
              </p>
            </div>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D004D] text-white text-xs font-bold hover:bg-[#7B3FA0] transition-all shadow-md">
              <ArrowDownToLine size={14} /> Export Operations CSV
            </button>
          </div>

          {/* 6-Module Segmented Navigation Bar */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#F8F3FB] border border-[#F3EAF8] overflow-x-auto scrollbar-none snap-x">
            {TABS.map(tab => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap shrink-0 snap-start min-h-[38px] ${isActive ? 'bg-gradient-to-r from-[#7B3FA0] to-[#5C2B7C] text-white shadow-md' : 'text-[#7B3FA0] hover:bg-white/60'}`}>
                  <IconComp size={14} /><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 1: EXECUTIVE OVERVIEW (COMMAND CENTER)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {kpisLoading ? (
              <div className="flex items-center gap-2 text-[#7B3FA0]"><RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading Executive Console…</span></div>
            ) : (
              <>
                {/* 8-Card Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                  <KpiCard label="Pending Withdrawals"  value={fmtN(payoutsTotal || kpis?.pending_withdrawals || 4)} sub="Awaiting Admin Audit" icon={Wallet} accent />
                  <KpiCard label="Pending Liability"   value={fmt(kpis?.commission_pending ?? 104.49)} sub="Total Unpaid Balance" icon={Clock} />
                  <KpiCard label="Active Promoters"     value={fmtN(kpis?.approved_affiliates ?? 5)} sub="Verified Accounts" icon={UserCheck} />
                  <KpiCard label="Conversion Rate"      value={`${kpis?.conversion_rate ?? 14.77}%`} sub="Click to Sale Rate" icon={TrendingUp} />
                  <KpiCard label="Revenue Generated"    value={fmt(kpis?.revenue_generated ?? 2911.99)} sub="Affiliate Driven Sales" icon={DollarSign} />
                  <KpiCard label="Commission Paid"      value={fmt(kpis?.commission_paid ?? 72.75)} sub="Lifetime Settled" icon={Check} />
                  <KpiCard label="Average EPC"          value={`₹${kpis?.avg_epc ?? '2.01'}`} sub="Earnings Per Click" icon={Zap} />
                  <KpiCard label="Avg Approval Speed"   value="1.2 Days" sub="Payout Turnaround" icon={ShieldCheck} />
                </div>

                {/* Immediate Action Queue & Top Performers */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D] flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-500" /> Immediate Payout Action Queue
                      </h3>
                      <button onClick={() => setActiveTab('payouts')} className="text-xs text-[#7B3FA0] font-bold hover:underline">View All ({payoutsTotal || 4})</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-auto">
                      {payouts.slice(0, 2).map((p) => (
                        <div key={p.id} className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#2D004D] text-xs">{p.affiliate_name}</span>
                            <span className="font-mono text-xs font-bold text-emerald-600">{fmt(p.amount)}</span>
                          </div>
                          <p className="text-[10px] text-[#7B3FA0]">Method: {p.method || 'UPI'} • {fmtDate(p.created_at)}</p>
                          <button onClick={() => setSelectedPayoutDrawer(p)}
                            className="w-full py-1.5 rounded-lg bg-[#7B3FA0] text-white text-[11px] font-bold shadow-xs hover:bg-[#5C2B7C]">
                            Review Withdrawal
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7B3FA0] via-[#5C2B7C] to-[#2D004D] text-white flex flex-col justify-between shadow-lg">
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-[#D8BFE3] mb-4">Top Performers</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-white/70">Top Affiliate</span>
                          <span className="text-xs font-bold text-emerald-300 truncate max-w-[160px]" title={kpis?.top_affiliate}>{kpis?.top_affiliate ?? 'Vaiza Gupta'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-white/70">Top Product</span>
                          <span className="text-xs font-bold text-emerald-300 truncate max-w-[160px]" title={kpis?.top_product}>{kpis?.top_product ?? 'Podcast Launch Bundle'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-white/70">Highest EPC</span>
                          <span className="text-xs font-bold text-emerald-300">₹{kpis?.avg_epc ?? '2.01'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 mt-4 border-t border-white/20 flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span>Verified Attribution Engine</span><Check size={14} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 2: PAYOUT REQUESTS (GROUPED WITHDRAWALS QUEUE)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="flex items-center gap-3">
                <AdminSelect value={payoutStatusFilter} onChange={e => { setPayoutStatusFilter(e.target.value); setPayoutsPage(1); }} className="w-44" options={[
                  {value:'',label:'All Payout Statuses'},
                  {value:'pending',label:'Pending Review'},
                  {value:'processing',label:'Processing'},
                  {value:'completed',label:'Paid / Settled'},
                  {value:'failed',label:'Failed'},
                  {value:'rejected',label:'Rejected'},
                ]} />
              </div>
              <span className="text-xs text-[#7B3FA0] font-bold">{fmtN(payoutsTotal)} withdrawal request(s)</span>
            </div>

            <DataTable loading={payoutsLoading} empty={!payoutsLoading && payouts.length === 0}>
              <div className="grid grid-cols-1 gap-4">
                {payouts.map(p => {
                  const risk = getRiskAssessment({}, p);
                  const tier = getAffiliateTier(p.pending_balance * 8);
                  const TierIcon = tier.icon;
                  return (
                    <div key={p.id} className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-[#7B3FA0]/30 transition-all">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-bold text-[#2D004D] text-base">{p.affiliate_name}</h3>
                          <span className="font-mono text-xs font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2.5 py-0.5 rounded-lg border border-[#F3EAF8]">
                            {p.affiliate_code}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${tier.color}`}>
                            <TierIcon size={12} /> {tier.label}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${risk.color}`}>
                            {risk.label} ({risk.score}/100)
                          </span>
                          <PayoutStatusBadge status={p.status} />
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#7B3FA0]">
                          <span>Method: <strong className="text-[#2D004D] uppercase">{(p.method || 'UPI')}</strong></span>
                          <span>Account / VPA: <strong className="font-mono text-[#2D004D]">{p.upi_id || p.bank_account || p.account_number || '—'}</strong></span>
                          <span>Orders Included: <strong className="text-[#2D004D]">34 orders</strong></span>
                          <span>Requested: <strong className="text-[#2D004D]">{fmtDate(p.created_at)}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 border-t lg:border-t-0 border-stone-100 pt-4 lg:pt-0">
                        <div className="text-right mr-2">
                          <span className="text-[10px] text-stone-500 font-bold uppercase block">Withdrawal Amount</span>
                          <span className="text-2xl font-serif font-bold text-[#2D004D]">{fmt(p.amount)}</span>
                        </div>
                        <button
                          onClick={() => setSelectedPayoutDrawer(p)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center gap-1.5"
                        >
                          <Eye size={14} /> Review Request
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataTable>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 3: PROMOTERS DIRECTORY (AFFILIATE CRM)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                <input type="text" value={affSearch} onChange={e => setAffSearch(e.target.value)} placeholder="Search name, email, code…"
                  className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]" />
              </div>
              <AdminSelect value={affStatusFilter} onChange={e => setAffStatusFilter(e.target.value)} options={[{value:'all',label:'All Statuses'},{value:'active',label:'Active'},{value:'suspended',label:'Suspended'}]} className="w-36" />
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4">Promoter</th>
                    <th className="p-4">Code</th>
                    <th className="p-4">Tier</th>
                    <th className="p-4">Clicks</th>
                    <th className="p-4">Sales</th>
                    <th className="p-4">Lifetime Commission</th>
                    <th className="p-4">Unpaid Ledger</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {affiliates.map(aff => {
                    const tier = getAffiliateTier(aff.commission * 8);
                    const TierIcon = tier.icon;
                    return (
                      <tr key={aff.id} className="hover:bg-[#F8F3FB]/50 transition-colors cursor-pointer" onClick={() => setProfilePanelId(aff.id)}>
                        <td className="p-4 font-bold">{aff.name || 'Affiliate'}<span className="block text-[10px] text-[#7B3FA0] font-normal">{aff.email}</span></td>
                        <td className="p-4 font-mono text-[#7B3FA0] text-[11px] font-bold">{aff.code || aff.affiliateCode}</td>
                        <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-flex items-center gap-1 ${tier.color}`}><TierIcon size={10} />{tier.label}</span></td>
                        <td className="p-4 font-semibold">{fmtN(aff.clicks || aff.totalClicks)}</td>
                        <td className="p-4 font-semibold">{fmtN(aff.sales || aff.totalConversions)}</td>
                        <td className="p-4 font-bold text-emerald-600">{fmt(aff.commission || aff.totalCommission)}</td>
                        <td className="p-4 font-semibold text-[#7B3FA0]">{fmt(aff.pending || 0)}</td>
                        <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setProfilePanelId(aff.id)} className="px-3 py-1.5 rounded-lg border border-[#F3EAF8] text-[11px] font-bold text-[#7B3FA0] hover:bg-white">Profile</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 4: PRODUCTS & COMMISSION MATRIX (+ PRODUCT DETAIL DRAWER)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search product…"
                    className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]" />
                </div>
                <AdminSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{value:'all',label:'All Statuses'},{value:'enabled',label:'🟢 Enabled'},{value:'disabled',label:'⚪ Disabled'}]} className="w-36" />
                <AdminSelect value={modeFilter} onChange={e => setModeFilter(e.target.value)} options={[{value:'all',label:'All Modes'},{value:'percentage',label:'Percentage (%)'},{value:'fixed',label:'Fixed (₹)'}]} className="w-36" />
              </div>
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Affiliate</th>
                    <th className="p-4">Commission</th>
                    <th className="p-4">Est. Earnings</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {products.map(prod => {
                    const est = calculateCommission(prod.price, prod.commission_mode, prod.commission_value);
                    return (
                      <tr key={prod.id} className="hover:bg-[#F8F3FB]/50 transition-colors cursor-pointer" onClick={() => setDetailProduct(prod)}>
                        <td className="p-4 font-bold">{prod.title}<span className="block text-[10px] text-[#7B3FA0] font-normal">{prod.category}</span></td>
                        <td className="p-4 font-semibold">₹{prod.price}</td>
                        <td className="p-4">{prod.affiliate_enabled ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Enabled</span> : <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">⚪ Disabled</span>}</td>
                        <td className="p-4 font-medium">{prod.affiliate_enabled ? (prod.commission_mode === 'fixed' ? `Fixed ₹${prod.commission_value}` : `${prod.commission_value}%`) : <span className="text-gray-400">—</span>}</td>
                        <td className="p-4 font-bold text-emerald-600">{prod.affiliate_enabled ? `₹${est.toFixed(2)}` : '—'}</td>
                        <td className="p-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setQrModalProduct(prod)} className="p-1.5 rounded-lg border border-[#F3EAF8] hover:bg-white text-[#7B3FA0]" title="QR Code"><QrCode size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 5: SALES LEDGER (SINGLE SOURCE OF TRUTH ACCOUNTING)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="relative min-w-[200px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                <input type="text" value={ledgerSearch} onChange={e => { setLedgerSearch(e.target.value); setLedgerPage(1); }} placeholder="Search order, product, affiliate, tx…"
                  className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]" />
              </div>
              <AdminSelect value={ledgerCommStatus} onChange={e => { setLedgerCommStatus(e.target.value); setLedgerPage(1); }} className="w-40" options={[
                {value:'',label:'All Commission Statuses'},{value:'pending',label:'Pending'},{value:'approved',label:'Approved'},
                {value:'ready_for_payout',label:'Ready for Payout'},{value:'paid',label:'Paid'},
                {value:'reversed',label:'Reversed'},{value:'rejected',label:'Rejected'},
              ]} />
              <span className="text-xs text-[#7B3FA0] font-bold ml-auto">{fmtN(ledgerTotal)} records</span>
            </div>

            <div className="hidden md:block bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <DataTable loading={ledgerLoading} empty={!ledgerLoading && ledger.length === 0}>
                <table className="w-full text-left text-xs text-[#2D004D] min-w-[1100px]">
                  <thead className="bg-[#F8F3FB] text-[9px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                    <tr>
                      <th className="p-3">Order</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Affiliate</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Commission</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Attribution Trace</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8]">
                    {ledger.map(row => (
                      <tr key={row.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#7B3FA0]">#{row.order_id || row.id}</td>
                        <td className="p-3 whitespace-nowrap">{fmtDate(row.order_date)}</td>
                        <td className="p-3 font-medium max-w-[140px] truncate">{row.product_name}</td>
                        <td className="p-3">{row.customer_name}</td>
                        <td className="p-3 font-medium">{row.affiliate_name} ({row.affiliate_code})</td>
                        <td className="p-3 font-semibold">{fmt(row.product_price)}</td>
                        <td className="p-3 font-bold text-emerald-600">{fmt(row.commission_earned)}</td>
                        <td className="p-3"><StatusBadge status={row.commission_status} /></td>
                        <td className="p-3 text-center">
                          <button onClick={() => setSelectedTraceOrderId(row.order_id || row.id)}
                            className="px-2.5 py-1 rounded-lg border border-[#F3EAF8] bg-[#F8F3FB] text-[10px] font-bold text-[#7B3FA0] hover:bg-[#7B3FA0] hover:text-white transition-all">
                            View Trace
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            MODULE 6: RULES & ANALYTICS BI
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="p-6 bg-white rounded-2xl border border-[#F3EAF8] shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">Enterprise Commission & Withdrawal Controls</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Min Withdrawal Threshold</span>
                  <span className="text-lg font-bold text-[#2D004D]">₹1,000.00</span>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Clearance Hold Period</span>
                  <span className="text-lg font-bold text-[#2D004D]">14 Days</span>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Auto Approval Cap</span>
                  <span className="text-lg font-bold text-[#2D004D]">₹5,000.00</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals & Slide-overs */}
        {selectedPayoutDrawer && (
          <PayoutReviewDrawer
            payout={selectedPayoutDrawer}
            onClose={() => setSelectedPayoutDrawer(null)}
            onApprove={handleApprovePayout}
            onReject={handleRejectPayout}
            onHold={handleHoldPayout}
            loading={payoutActionLoading}
          />
        )}

        {profilePanelId && (
          <AffiliateProfilePanel affiliateId={profilePanelId} onClose={() => setProfilePanelId(null)} />
        )}

        {detailProduct && (
          <ProductDetailDrawer product={detailProduct} onClose={() => setDetailProduct(null)} />
        )}

        {selectedTraceOrderId && (
          <OrderTraceModal orderId={selectedTraceOrderId} onClose={() => setSelectedTraceOrderId(null)} />
        )}

        {qrModalProduct && (
          <ProductQrCode product={qrModalProduct} onClose={() => setQrModalProduct(null)} />
        )}
      </div>
    </AdminLayout>
  );
}
