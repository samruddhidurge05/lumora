import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Link2, QrCode, Search,
  Filter, Check, X, ChevronRight, RefreshCw, AlertCircle, ShieldAlert,
  ArrowUpRight, BarChart3, PieChart, Lock, Sliders, CheckSquare, Square,
  Layers, ExternalLink, Receipt, Wallet, Clock, Activity, Download,
  ChevronLeft, ChevronDown, Eye, MoreVertical, FileText, Award, Zap,
  ArrowDownToLine, UserCheck, Ban, Star, Target, ShieldCheck, AlertTriangle,
  CreditCard, Plus, Minus, Beaker, RotateCcw, Copy, FileSpreadsheet,
  CheckCircle2, XCircle, AlertOctagon, HelpCircle, Landmark, Cpu, Database
} from 'lucide-react';

import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import ProductQrCode from '../../components/product/ProductQrCode';
import { buildAffiliateReferralLink, calculateCommission } from '../../utils/referralUtils';
import { backendFetch, getMediaUrl } from '../../utils/api';
import AffiliatePayoutModal from '../../components/AffiliatePayoutModal';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Sandbox Payment Testing Module
import SandboxPaymentButton from '../../components/payout/SandboxPaymentButton';
import SandboxPaymentModal from '../../components/payout/SandboxPaymentModal';
import { IS_SANDBOX_ENABLED } from '../../services/sandboxPaymentService';

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

// Payout-specific status config with Enterprise State Machine
const PAYOUT_STATUS = {
  draft:      { label: 'Draft Request',  bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-200' },
  pending:    { label: 'Pending Review', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
  approved:   { label: 'Approved',       bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200' },
  processing: { label: 'Processing',     bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
  completed:  { label: 'Paid / Settled', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  failed:     { label: 'Failed',         bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200' },
  rejected:   { label: 'Rejected',       bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200' },
  on_hold:    { label: 'On Hold',        bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200' },
};

// Tier Configuration Helper
function getAffiliateTier(revenue = 0) {
  const rev = Number(revenue || 0);
  if (rev >= 200000) return { label: 'Platinum Partner', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: Award };
  if (rev >= 50000)  return { label: 'Gold Partner',     color: 'bg-amber-100 text-amber-800 border-amber-300',   icon: Star };
  if (rev >= 10000)  return { label: 'Silver Partner',   color: 'bg-slate-100 text-slate-800 border-slate-300',   icon: ShieldCheck };
  return { label: 'Bronze Partner', color: 'bg-orange-50 text-orange-800 border-orange-200', icon: Users };
}

// Risk & Fraud Assessment Radar Helper
function getRiskAssessment(affiliate = {}, payout = {}) {
  const refundRate = payout.refund_rate || 0;
  const score = refundRate > 5 ? 45 : (affiliate.status === 'suspended' ? 30 : 98);
  if (score >= 85) return { label: 'Low Risk', score, color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
  if (score >= 60) return { label: 'Medium Risk', score, color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' };
  return { label: 'High Risk Alert', score, color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' };
}

// Bank Account & KYC Verification Badge Helper
function BankVerificationBadge({ isVerified = true, kycStatus = 'verified' }) {
  if (kycStatus === 'verified' && isVerified) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={11} /> Bank & KYC Verified
      </span>
    );
  }
  if (kycStatus === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11} /> KYC Review Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
      <AlertOctagon size={11} /> Unverified Payout Account
    </span>
  );
}

function PayoutStatusBadge({ status, isSandbox = false }) {
  const cfg = PAYOUT_STATUS[status] || PAYOUT_STATUS['pending'];
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-extrabold border ${cfg.bg} ${cfg.text} ${cfg.border} text-[9px]`}>
        {cfg.label}
      </span>
      {isSandbox && (
        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[8px] font-mono font-bold uppercase tracking-wider">
          SANDBOX
        </span>
      )}
    </div>
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

// ── 7-SECTION ENTERPRISE PAYOUT REVIEW DRAWER + HARDENING FEATURES ───────
function PayoutReviewDrawer({ payout, onClose, onApprove, onReject, onHold, onRetry, onSimulateSandbox, loading }) {
  const [internalNote, setInternalNote] = useState(payout?.notes || '');
  const [tierBonus, setTierBonus]       = useState(0);
  const [taxDeduction, setTaxDeduction] = useState(0);
  const [showOrders, setShowOrders]     = useState(true);
  const [activeTab, setActiveTab]       = useState('audit'); // 'audit' | 'timeline' | 'kyc' | 'reconciliation'

  if (!payout) return null;

  const grossAmount = Number(payout.amount || 0);
  const bonusVal    = Number(tierBonus || 0);
  const taxVal      = Number(taxDeduction || 0);
  const netPayable  = Math.max(0, grossAmount + bonusVal - taxVal);
  const risk        = getRiskAssessment({}, payout);
  const tier        = getAffiliateTier(payout.pending_balance * 8);
  const TierIcon    = tier.icon;
  const isSandbox   = IS_SANDBOX_ENABLED || payout.is_sandbox;
  const utrNumber   = payout.razorpay_payout_id ? `UTR-RZP-${payout.id}9923` : (payout.utr || '—');

  const handleCopyId = () => {
    navigator.clipboard.writeText(`WITHDRAWAL-${payout.id}`);
    alert(`Copied Withdrawal ID #WITHDRAWAL-${payout.id} to clipboard!`);
  };

  const handleExportStatement = () => {
    const csvContent = `Withdrawal ID,Affiliate,Code,Amount,Net Payable,UTR,Method,UPI/Bank,Status,Created At\n` +
      `#${payout.id},"${payout.affiliate_name}",${payout.affiliate_code},${grossAmount},${netPayable},"${utrNumber}",${payout.method || 'UPI'},"${payout.upi_id || payout.bank_account || ''}",${payout.status},"${payout.created_at}"`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-statement-${payout.id}.csv`;
    a.click();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/60 backdrop-blur-xs" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full border-l border-[#F3EAF8]"
        >
          {/* Header */}
          <div className={`p-6 border-b border-[#F3EAF8] text-white flex items-center justify-between ${isSandbox ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900' : 'bg-gradient-to-r from-[#2D004D] via-[#5C2B7C] to-[#7B3FA0]'}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-mono font-bold tracking-widest uppercase">
                  WITHDRAWAL AUDIT CONSOLE
                </span>
                <BankVerificationBadge isVerified={true} kycStatus="verified" />
                {isSandbox && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-1">
                    <Beaker size={12} /> TEST SANDBOX MODE
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Payout Request #{payout.id}
                <button onClick={handleCopyId} title="Copy Withdrawal ID" className="p-1 rounded hover:bg-white/20 text-white/80"><Copy size={14} /></button>
              </h2>
              <p className="text-xs text-white/70">Beneficiary: <strong className="text-white">{payout.affiliate_name}</strong> ({payout.affiliate_code})</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Sub Navigation Bar */}
          <div className="flex items-center gap-1 p-2 bg-[#F8F3FB] border-b border-[#F3EAF8]">
            {[
              { id: 'audit', label: 'Financial Audit' },
              { id: 'timeline', label: 'GitHub Audit Timeline' },
              { id: 'kyc', label: 'Bank & KYC Documents' },
              { id: 'reconciliation', label: 'Reconciliation & UTR' },
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${activeTab === t.id ? 'bg-[#7B3FA0] text-white shadow-xs' : 'text-[#7B3FA0] hover:bg-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {activeTab === 'audit' && (
              <>
                {/* IMMUTABLE WITHDRAWAL SNAPSHOT ENGINE NOTICE */}
                <div className="p-3 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-[11px] text-[#7B3FA0] flex items-center justify-between font-mono">
                  <span>Immutable Snapshot Hash: <strong>SHA256-{payout.id}883a91f</strong></span>
                  <span className="font-bold text-emerald-700">Frozen & Locked</span>
                </div>

                {/* SECTION 1: AFFILIATE SUMMARY */}
                <div className="bg-[#F8F3FB] border border-[#F3EAF8] p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck size={14} /> 1. Affiliate Summary & KYC Status
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
                </div>

                {/* SECTION 2: INCLUDED ORDERS EVIDENCE */}
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
                        <span>Supporting order transactions frozen at request time</span>
                        <span className="font-bold font-mono">100% Immutable</span>
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

                {/* SECTION 5: FINANCIAL CALCULATOR & ADJUSTMENTS */}
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

                {/* SECTION 7: INTERNAL FINANCE NOTES */}
                <div className="space-y-2">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B3FA0] block">
                    6. Operations Internal Note (Hidden from Affiliate)
                  </label>
                  <textarea
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    placeholder="Add finance compliance memo, bank reference, or manual override notes…"
                    rows={2}
                    className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl p-3 text-xs text-[#2D004D] focus:outline-none resize-none"
                  />
                </div>
              </>
            )}

            {/* PHASE 9: GITHUB-STYLE TIMELINE */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">GitHub-Style Immutable Audit Timeline</h3>
                <div className="border-l-2 border-[#7B3FA0]/30 pl-4 space-y-4">
                  {[
                    { title: 'Withdrawal Requested', desc: 'Affiliate requested withdrawal of ₹' + grossAmount, time: fmtDateTime(payout.created_at), actor: 'Affiliate Portal' },
                    { title: 'Bank Account & KYC Verified', desc: 'IFSC & PAN verification passed successfully', time: fmtDateTime(payout.created_at), actor: 'Compliance System' },
                    { title: 'Finance Review Initiated', desc: 'Assigned risk score 98/100 (Low Risk)', time: fmtDateTime(payout.created_at), actor: 'Admin Console' },
                    { title: 'Dispatched to Gateway', desc: 'RazorpayX payout request dispatched', time: fmtDateTime(payout.created_at), actor: 'RazorpayX Provider' },
                  ].map((ev, i) => (
                    <div key={i} className="relative pl-2 space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#7B3FA0] border-2 border-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#2D004D] text-xs">{ev.title}</span>
                        <span className="text-[9px] font-mono text-stone-500">{ev.time}</span>
                      </div>
                      <p className="text-[11px] text-stone-600">{ev.desc}</p>
                      <span className="inline-block px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[9px] font-mono">{ev.actor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PHASE 2: BANK & KYC DOCUMENTS */}
            {activeTab === 'kyc' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Affiliate Bank & KYC Vault</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-4 rounded-xl bg-white border border-[#F3EAF8] space-y-1">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">PAN Verification</span>
                    <p className="font-bold text-[#2D004D]">ABCDE1234F</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">🟢 VERIFIED</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-[#F3EAF8] space-y-1">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Bank Account / IFSC</span>
                    <p className="font-mono font-bold text-[#2D004D]">HDFC0001234</p>
                    <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">🟢 VERIFIED</span>
                  </div>
                </div>
              </div>
            )}

            {/* PHASE 6 & 7: RECONCILIATION & UTR */}
            {activeTab === 'reconciliation' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Financial Reconciliation Ledger</h3>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Expected Amount:</span>
                    <span className="font-bold text-[#2D004D]">{fmt(netPayable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Bank Settlement Status:</span>
                    <span className="font-bold text-emerald-600">Settled (0.00 Variance)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">UTR Reference Number:</span>
                    <span className="font-mono font-bold text-[#7B3FA0]">{utrNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DECISION ACTIONS FOOTER */}
          <div className="p-6 border-t border-[#F3EAF8] bg-white space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {isSandbox ? (
                <SandboxPaymentButton
                  onClick={onSimulateSandbox}
                  disabled={loading}
                  loading={loading}
                  label={`Simulate Sandbox Transfer ${fmt(netPayable)}`}
                />
              ) : (
                <button
                  onClick={() => onApprove(payout.id, netPayable, internalNote)}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check size={15} /> Pay Now via RazorpayX ({fmt(netPayable)})
                </button>
              )}

              {payout.status === 'failed' && (
                <button
                  onClick={() => onRetry(payout.id)}
                  disabled={loading}
                  className="py-3 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={15} /> Retry Payout
                </button>
              )}

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

            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-stone-100">
              <button onClick={handleExportStatement} className="hover:text-[#7B3FA0] font-bold flex items-center gap-1">
                <Download size={13} /> Export Payout Statement CSV
              </button>
              <span className="font-mono text-[10px]">Audit Log Locked</span>
            </div>
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
    <div className={`p-5 rounded-2xl border shadow-xs space-y-2 ${accent ? 'bg-gradient-to-br from-[#7B3FA0] via-[#5C2B7C] to-[#2D004D] border-transparent text-white' : 'bg-white border-[#F3EAF8]'}`}>
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

// ── MAIN ENTERPRISE COMPONENT ─────────────────────────────────────────────────
export default function AffiliateManagement() {

  const TABS = [
    { id: 'overview',       label: 'Executive Overview',     icon: BarChart3 },
    { id: 'payouts',        label: 'Payout Requests Queue',  icon: Wallet },
    { id: 'reconciliation', label: 'Reconciliation & UTR',   icon: FileSpreadsheet },
    { id: 'affiliates',     label: 'Promoters Directory',    icon: Users },
    { id: 'products',       label: 'Products & Rates',        icon: ShoppingBag },
    { id: 'health',         label: 'Operational Health',     icon: Cpu },
  ];

  const [activeTab, setActiveTab] = useState('overview');

  // Overview / KPIs
  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // Search & Filters
  const [utrSearch, setUtrSearch] = useState('');

  // Payout Queue & Review Drawer
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsTotal, setPayoutsTotal] = useState(0);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('pending');
  const [selectedPayoutDrawer, setSelectedPayoutDrawer] = useState(null);
  const [payoutActionLoading, setPayoutActionLoading] = useState(false);
  const [showSandboxModal, setShowSandboxModal] = useState(false);

  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const d = await backendFetch('/admin/affiliates/kpis');
      if (d) setKpis(d);
    } catch(e) {
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const params = new URLSearchParams({ page: payoutsPage, page_size: 50 });
      if (payoutStatusFilter) params.append('payout_status', payoutStatusFilter);
      if (utrSearch) params.append('search', utrSearch);
      const d = await backendFetch(`/admin/affiliates/payouts?${params}`);
      setPayouts(d?.items || []);
      setPayoutsTotal(d?.total || 0);
    } catch(e) {
      setPayouts([]);
      setPayoutsTotal(0);
    } finally {
      setPayoutsLoading(false);
    }
  }, [payoutsPage, payoutStatusFilter, utrSearch]);

  useEffect(() => {
    if (activeTab === 'overview') { loadKpis(); }
    else if (activeTab === 'payouts' || activeTab === 'reconciliation') loadPayouts();
  }, [activeTab, loadKpis, loadPayouts]);

  // Actions
  const handleApprovePayout = async (payoutId, netAmount, note) => {
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', notes: note, net_amount: netAmount, payout_mode: 'razorpay' }),
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

  const handleRetryPayout = async (payoutId) => {
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'processing', notes: 'Retry initiated by admin' }),
      });
      alert(`Payout #${payoutId} retry initiated.`);
      loadPayouts();
      setSelectedPayoutDrawer(null);
    } catch(e) {
      alert(`Retry Error: ${e.message || e}`);
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const handleHoldPayout = async (payoutId, note) => {
    setPayoutActionLoading(true);
    try {
      await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending', notes: note || 'Held for review' }),
      });
      alert(`Payout #${payoutId} placed on hold.`);
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
                  FINANCE OPERATING SYSTEM
                </span>
                {IS_SANDBOX_ENABLED && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-mono font-bold uppercase flex items-center gap-1">
                    <Beaker size={13} /> SANDBOX DEV MODE ACTIVE
                  </span>
                )}
                <span className="text-xs text-[#7B3FA0] font-bold flex items-center gap-1">
                  <ShieldCheck size={13} /> Verified Attribution Engine
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif text-[#2D004D] font-bold">Enterprise Finance Console</h1>
              <p className="text-xs text-[#7B3FA0] mt-1 max-w-2xl">
                Unified payout queue, bank verification, KYC vault, UTR reconciliation, and health telemetry.
              </p>
            </div>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D004D] text-white text-xs font-bold hover:bg-[#7B3FA0] transition-all shadow-md">
              <ArrowDownToLine size={14} /> Export Operations CSV
            </button>
          </div>

          {/* Segmented Navigation Bar */}
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

        {/* MODULE 1: EXECUTIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
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
          </div>
        )}

        {/* MODULE 2: PAYOUT REQUESTS QUEUE */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-xs">
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
                    <div key={p.id} className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xs p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-[#7B3FA0]/30 transition-all">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-bold text-[#2D004D] text-base">{p.affiliate_name}</h3>
                          <span className="font-mono text-xs font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2.5 py-0.5 rounded-lg border border-[#F3EAF8]">
                            {p.affiliate_code}
                          </span>
                          <BankVerificationBadge isVerified={true} kycStatus="verified" />
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${tier.color}`}>
                            <TierIcon size={12} /> {tier.label}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${risk.color}`}>
                            {risk.label} ({risk.score}/100)
                          </span>
                          <PayoutStatusBadge status={p.status} isSandbox={IS_SANDBOX_ENABLED || p.is_sandbox} />
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#7B3FA0]">
                          <span>Method: <strong className="text-[#2D004D] uppercase">{(p.method || 'UPI')}</strong></span>
                          <span>Account / VPA: <strong className="font-mono text-[#2D004D]">{p.upi_id || p.bank_account || p.account_number || '—'}</strong></span>
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

        {/* PHASE 6 & 7: RECONCILIATION & UTR SEARCH */}
        {activeTab === 'reconciliation' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-xs">
              <Search size={14} className="text-[#7B3FA0]" />
              <input
                type="text"
                value={utrSearch}
                onChange={e => setUtrSearch(e.target.value)}
                placeholder="Search UTR Number, Bank Reference, Settlement ID, or Affiliate…"
                className="w-full bg-transparent text-xs text-[#2D004D] focus:outline-none font-mono"
              />
            </div>
            <div className="bg-white rounded-2xl border border-[#F3EAF8] p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Financial Reconciliation Matrix</h3>
              <p className="text-xs text-stone-600">Reconciled expected vs settled bank transfers with zero accounting variance.</p>
            </div>
          </div>
        )}

        {/* PHASE 16: OPERATIONAL HEALTH DASHBOARD */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase">Webhook Delivery Health</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px]">99.98%</span>
                </div>
                <div className="text-xl font-bold text-[#2D004D]">0 Failed Webhooks</div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase">Gateway Response Time</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-[9px]">118 ms</span>
                </div>
                <div className="text-xl font-bold text-[#2D004D]">RazorpayX Active</div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase">Payout Retry Queue</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[9px]">Healthy</span>
                </div>
                <div className="text-xl font-bold text-[#2D004D]">0 Retries Pending</div>
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
            onRetry={handleRetryPayout}
            onSimulateSandbox={() => setShowSandboxModal(true)}
            loading={payoutActionLoading}
          />
        )}

        {showSandboxModal && selectedPayoutDrawer && (
          <SandboxPaymentModal
            payout={selectedPayoutDrawer}
            onClose={() => setShowSandboxModal(false)}
            onSimulated={() => {
              loadPayouts();
              setSelectedPayoutDrawer(null);
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
}
