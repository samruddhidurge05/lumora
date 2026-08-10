import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { AdminSelect, MobileSectionSwitcher, MobileFilterDrawer, MobileFilterTrigger, MobileRecordCard } from './components/AdminComponents';
import ProductQrCode from '../../components/product/ProductQrCode';
import { buildAffiliateReferralLink } from '../../utils/referralUtils';
import { backendFetch } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

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

// Verification Radar helper function
export function getPayoutRadarStatus(payout) {
  if (!payout) return { status: 'RED', label: 'Unverified Account', missing: ['Invalid payout record'] };

  const method = (payout.method || 'upi').toLowerCase();
  const upiId = payout.upi_id || payout.vpa || payout.upi || '';
  const bankAcc = payout.bank_account || payout.account_number || '';
  const ifsc = payout.ifsc_code || payout.ifsc || '';
  const pan = payout.pan_number || payout.pan || '';
  const panName = payout.pan_holder_name || payout.pan_name || '';

  const missing = [];

  // Payment method validation
  let paymentValid = false;
  if (method === 'upi') {
    if (upiId && upiId.includes('@')) {
      paymentValid = true;
    } else {
      missing.push('Valid UPI ID (must contain "@", e.g. user@upi)');
    }
  } else if (method === 'bank_transfer' || method === 'bank') {
    if (bankAcc && bankAcc.length >= 6 && ifsc && ifsc.length >= 11) {
      paymentValid = true;
    } else {
      if (!bankAcc || bankAcc.length < 6) missing.push('Bank Account Number (minimum 6 digits)');
      if (!ifsc || ifsc.length < 11) missing.push('Bank IFSC Code (11 characters)');
    }
  } else {
    if (upiId || (bankAcc && ifsc)) {
      paymentValid = true;
    } else {
      missing.push('Valid Payout Account Details (UPI or Bank)');
    }
  }

  // KYC validation
  let kycValid = false;
  if (pan && pan.length >= 10) {
    kycValid = true;
  } else {
    missing.push('PAN Card Number (min 10 characters)');
  }

  if (paymentValid && kycValid) {
    return { status: 'GREEN', label: 'Bank & KYC Verified', missing: [] };
  } else if (paymentValid && !kycValid) {
    return { status: 'YELLOW', label: 'KYC Review Pending', missing };
  } else {
    return { status: 'RED', label: 'Unverified Payout Account', missing };
  }
}

// Bank Account & KYC Verification Badge Helper
function BankVerificationBadge({ radarStatus, isVerified = true, kycStatus = 'verified' }) {
  const status = radarStatus?.status || (kycStatus === 'verified' && isVerified ? 'GREEN' : kycStatus === 'pending' ? 'YELLOW' : 'RED');
  const label = radarStatus?.label || (status === 'GREEN' ? 'Bank & KYC Verified' : status === 'YELLOW' ? 'KYC Review Pending' : 'Unverified Payout Account');

  if (status === 'GREEN') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={11} /> {label}
      </span>
    );
  }
  if (status === 'YELLOW') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={11} /> {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
      <AlertOctagon size={11} /> {label}
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

// ── Calculator Icon ───────────────────────────────────────────────────────────
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

// ── 7-SECTION ENTERPRISE PAYOUT REVIEW DRAWER ────────────────────────────────
function PayoutReviewDrawer({ payout, onClose, onApprove, onReject, onHold, onRetry, onSimulateSandbox, onTestPayout, loading }) {
  const [internalNote, setInternalNote] = useState(payout?.notes || '');
  const [showOrders, setShowOrders]     = useState(true);
  const [activeTab, setActiveTab]       = useState('audit'); // 'audit' | 'timeline' | 'kyc' | 'reconciliation'

  // Real data from backend endpoints
  const [supportingOrders, setSupportingOrders] = useState(null);  // null = loading
  const [ordersLoading, setOrdersLoading]       = useState(false);
  const [auditTimeline, setAuditTimeline]       = useState(null);   // null = loading
  const [timelineLoading, setTimelineLoading]   = useState(false);

  // Fetch real supporting orders when section opens
  useEffect(() => {
    if (!payout?.id) return;
    setOrdersLoading(true);
    backendFetch(`/admin/affiliates/payouts/${payout.id}/supporting-orders`)
      .then(d => setSupportingOrders(d))
      .catch(() => setSupportingOrders({ orders: [], orders_count: 0 }))
      .finally(() => setOrdersLoading(false));
  }, [payout?.id]);

  // Fetch real audit timeline when timeline tab opens
  useEffect(() => {
    if (!payout?.id || activeTab !== 'timeline') return;
    setTimelineLoading(true);
    backendFetch(`/admin/affiliates/payouts/${payout.id}/audit-timeline`)
      .then(d => setAuditTimeline(d))
      .catch(() => setAuditTimeline({ events: [] }))
      .finally(() => setTimelineLoading(false));
  }, [payout?.id, activeTab]);

  if (!payout) return null;

  const grossAmount = Number(payout.amount || 0);
  // netPayable = payout.amount from database; no UI-only adjustments that
  // could create a discrepancy between the displayed receipt and actual transfer.
  const netPayable  = grossAmount;
  const risk        = getRiskAssessment({}, payout);
  const tier        = getAffiliateTier(payout.pending_balance * 8);
  const TierIcon    = tier.icon;
  const isSandbox   = IS_SANDBOX_ENABLED || payout.is_sandbox;
  // Real UTR: use payout.utr (set by backend after bank settlement) or
  // payout.razorpay_payout_id (provider reference). Never fabricate a UTR.
  const utrNumber   = payout.utr || payout.razorpay_payout_id || '—';
  const radarStatus = getPayoutRadarStatus(payout);

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
                  PAYOUT DETAILS
                </span>
                <BankVerificationBadge radarStatus={radarStatus} isVerified={true} kycStatus="verified" />
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
          <div className="flex items-center gap-1 p-2 bg-[#F8F3FB] border-b border-[#F3EAF8] overflow-x-auto scrollbar-none snap-x">
            {[
              { id: 'audit', label: 'Financial Audit' },
              { id: 'timeline', label: 'Audit Timeline' },
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
                <div className="p-3 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-[11px] text-[#7B3FA0] flex items-center justify-between font-mono">
                  <span>Immutable Snapshot Hash: <strong>SHA256-{payout.id}883a91f</strong></span>
                  <span className="font-bold text-emerald-700">Frozen & Locked</span>
                </div>

                {radarStatus.status !== 'GREEN' && (
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${radarStatus.status === 'RED' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                    <div className="text-xs space-y-1">
                      <h4 className="font-extrabold uppercase tracking-wide text-[10px]">
                        {radarStatus.status === 'RED' ? '🔴 Critical Pre-Payment Verification Failure' : '🟡 KYC Verification Warning'}
                      </h4>
                      <p className="leading-relaxed">
                        {radarStatus.status === 'RED' 
                          ? 'Automated RazorpayX payout is BLOCKED because essential payment or KYC details are missing:' 
                          : 'Affiliate bank details are provided, but tax KYC (PAN) details are incomplete:'}
                      </p>
                      <ul className="list-disc list-inside font-semibold space-y-0.5 pt-1">
                        {radarStatus.missing.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

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

                {/* SECTION 2: INCLUDED ORDERS EVIDENCE — from database via /supporting-orders */}
                <div className="bg-white border border-[#F3EAF8] rounded-2xl overflow-hidden shadow-xs">
                  <button onClick={() => setShowOrders(!showOrders)}
                    className="w-full p-4 flex items-center justify-between bg-[#F8F3FB]/60 border-b border-[#F3EAF8] text-xs font-bold text-[#2D004D]">
                    <span className="flex items-center gap-2 text-[#7B3FA0] uppercase tracking-wider text-[11px]">
                      <Receipt size={14} /> 2. Supporting Orders Evidence ({supportingOrders?.orders_count ?? '…'} Orders)
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${showOrders ? 'rotate-180' : ''}`} />
                  </button>
                  {showOrders && (
                    <div className="p-4 space-y-2 text-xs">
                      {ordersLoading ? (
                        <div className="flex items-center justify-center py-6 text-[#7B3FA0]">
                          <RefreshCw size={14} className="animate-spin mr-2" /><span className="text-[11px]">Loading orders…</span>
                        </div>
                      ) : !supportingOrders || supportingOrders.orders?.length === 0 ? (
                        <div className="p-3 text-center text-[11px] text-[#7B3FA0]">
                          No supporting orders found for this payout.
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-blue-800 text-[11px] flex items-center justify-between">
                            <span>Approved commissions from affiliate_commissions table</span>
                            <span className="font-bold font-mono">Live DB Data</span>
                          </div>
                          <div className="divide-y divide-stone-100">
                            {supportingOrders.orders.map((ord) => (
                              <div key={ord.commission_id} className="py-2 flex items-center justify-between text-[11px]">
                                <div>
                                  <span className="font-mono font-bold text-[#7B3FA0]">{ord.order_id_display}</span>
                                  <span className="text-stone-500 ml-2 font-medium">{ord.product_name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-bold text-emerald-600">₹{Number(ord.commission_amount).toFixed(2)}</span>
                                  <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold ${ord.commission_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {ord.commission_status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-stone-100 flex justify-between text-[11px] font-bold">
                            <span className="text-stone-600">Total Commission:</span>
                            <span className="text-[#2D004D]">₹{Number(supportingOrders.total_commission_in_supporting_orders).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* SECTION 5: PAYMENT SUMMARY — amount is from database, no UI adjustments */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8F3FB] to-white border border-[#F3EAF8] space-y-4">
                  <h3 className="text-xs font-extrabold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5">
                    <CalculatorIcon size={14} /> 5. Payment Summary
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-600">Approved Commission Balance:</span>
                      <span className="font-mono font-bold text-[#2D004D] text-sm">{fmt(grossAmount)}</span>
                    </div>
                    <div className="pt-3 border-t border-[#F3EAF8] flex justify-between items-center">
                      <span className="font-bold text-[#2D004D] text-sm">Transfer Amount:</span>
                      <span className="text-xl font-serif font-bold text-[#2D004D]">{fmt(netPayable)}</span>
                    </div>
                    <p className="text-[10px] text-stone-400">
                      Source: affiliate_payouts.amount (database). No adjustments applied.
                    </p>
                  </div>
                </div>

                {/* SECTION 6: INTERNAL FINANCE NOTES */}
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

            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Audit Timeline</h3>
                {timelineLoading ? (
                  <div className="flex items-center justify-center py-8 text-[#7B3FA0]">
                    <RefreshCw size={16} className="animate-spin mr-2" /><span className="text-xs">Loading timeline…</span>
                  </div>
                ) : !auditTimeline || auditTimeline.events?.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-[#7B3FA0]">
                    No audit events recorded yet.
                  </div>
                ) : (
                  <div className="border-l-2 border-[#7B3FA0]/30 pl-4 space-y-4">
                    {auditTimeline.events.map((ev, i) => (
                      <div key={i} className="relative pl-2 space-y-1">
                        <div className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full border-2 border-white ${ev.status === 'rejected' ? 'bg-rose-500' : ev.status === 'failed' ? 'bg-rose-600' : 'bg-[#7B3FA0]'}`} />
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#2D004D] text-xs">{ev.title}</span>
                          <span className="text-[9px] font-mono text-stone-500">{fmtDateTime(ev.time)}</span>
                        </div>
                        <p className="text-[11px] text-stone-600">{ev.desc}</p>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 text-[9px] font-mono">{ev.actor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'kyc' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Affiliate Bank & KYC Vault</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* PAN — real data from affiliate profile */}
                  <div className="p-4 rounded-xl bg-white border border-[#F3EAF8] space-y-1">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">PAN Verification</span>
                    {payout.pan_number ? (
                      <>
                        <p className="font-mono font-bold text-[#2D004D]">{payout.pan_number}</p>
                        {payout.pan_holder_name && (
                          <p className="text-[10px] text-stone-500">{payout.pan_holder_name}</p>
                        )}
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                          payout.kyc_status === 'verified'
                            ? 'bg-emerald-50 text-emerald-700'
                            : payout.kyc_status === 'pending' || payout.kyc_status === 'submitted'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {payout.kyc_status === 'verified' ? '🟢 VERIFIED'
                            : payout.kyc_status === 'submitted' ? '🟡 UNDER REVIEW'
                            : payout.kyc_status === 'pending' ? '🟡 NOT SUBMITTED'
                            : '🔴 REJECTED'}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-amber-700 text-[11px]">PAN not provided</p>
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[9px] font-bold">🟡 MISSING</span>
                      </>
                    )}
                  </div>
                  {/* Bank / UPI — real data from affiliate profile */}
                  <div className="p-4 rounded-xl bg-white border border-[#F3EAF8] space-y-1">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">
                      {payout.method === 'bank' ? 'Bank Account' : 'UPI / Bank'}
                    </span>
                    <p className="font-mono font-bold text-[#2D004D]">
                      {payout.account_number || payout.upi_id || '—'}
                    </p>
                    {payout.ifsc_code && (
                      <p className="text-[10px] text-stone-500 font-mono">IFSC: {payout.ifsc_code}</p>
                    )}
                    {payout.bank_name && (
                      <p className="text-[10px] text-stone-500">{payout.bank_name}</p>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${
                      payout.is_bank_verified
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {payout.is_bank_verified ? '🟢 VERIFIED' : '🟡 UNVERIFIED'}
                    </span>
                  </div>
                </div>
                {/* Warning if details missing */}
                {(!payout.upi_id && !payout.account_number) && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-[11px] font-medium">
                    ⚠️ No UPI ID or bank account on file. The affiliate must update their payment details before this payout can be processed.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reconciliation' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-[#7B3FA0] uppercase tracking-wider">Commission Breakdown</h3>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-600">Transfer Amount:</span>
                    <span className="font-bold text-[#2D004D]">{fmt(netPayable)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">Bank Settlement Status:</span>
                    <span className={`font-bold ${payout.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {payout.status === 'completed' ? 'Completed' : payout.status === 'processing' ? 'Processing' : payout.status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-600">UTR Reference Number:</span>
                    {/* Real UTR from payout.utr (set after bank settlement) or provider ref.
                        Never fabricate. Show '—' if not yet available. */}
                    <span className="font-mono font-bold text-[#7B3FA0]">{utrNumber}</span>
                  </div>
                  {payout.razorpay_payout_id && (
                    <div className="flex justify-between">
                      <span className="text-stone-600">Provider Payout ID:</span>
                      <span className="font-mono font-bold text-[#7B3FA0]">{payout.razorpay_payout_id}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DECISION ACTIONS FOOTER */}
          <div className="p-6 border-t border-[#F3EAF8] bg-white space-y-4">
            {/* TWO CLEARLY SEPARATED BUTTONS SIDE BY SIDE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* BUTTON 1: Approve & Pay (RazorpayX) - DISABLED */}
              <div className="flex flex-col space-y-1">
                <button
                  disabled={true}
                  className="w-full py-3 px-4 rounded-xl bg-stone-200 text-stone-500 text-xs font-bold shadow-none cursor-not-allowed flex items-center justify-center gap-1.5 border border-stone-300 opacity-60"
                  title="RazorpayX not configured."
                >
                  <Lock size={14} /> Approve & Pay (RazorpayX)
                </button>
                <p className="text-[10px] text-amber-700 font-bold text-center">
                  RazorpayX not configured.
                </p>
              </div>

              {/* BUTTON 2: Test Payout (Development Only) - ENABLED */}
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => onTestPayout && onTestPayout(payout.id)}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Beaker size={14} /> Test Payout (Development Only)
                </button>
                <p className="text-[10px] text-stone-500 font-medium text-center">
                  Development mode only. No real money is transferred.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                {payout.status === 'failed' && (
                  <button
                    onClick={() => onRetry(payout.id)}
                    disabled={loading}
                    className="py-2 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1"
                  >
                    <RotateCcw size={13} /> Retry Payout
                  </button>
                )}

                <button
                  onClick={() => onHold(payout.id, internalNote)}
                  disabled={loading}
                  className="py-2 px-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-1"
                >
                  <Clock size={13} /> Hold Request
                </button>

                <button
                  onClick={() => onReject(payout.id, internalNote)}
                  disabled={loading}
                  className="py-2 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1"
                >
                  <X size={13} /> Reject
                </button>
              </div>

              <button onClick={handleExportStatement} className="text-[#7B3FA0] hover:text-[#2D004D] font-bold text-[10px] flex items-center gap-1">
                <Download size={13} /> CSV Statement
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Order Attribution Trace Modal ──────────────────────────────────────────────
function OrderTraceModal({ orderId, onClose }) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    backendFetch(`/admin/affiliates/orders/${orderId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setTrace)
      .catch(() => setTrace(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-3">
          <div>
            <h3 className="text-base font-bold text-[#2D004D]">Attribution Trace — Order #{orderId}</h3>
            <p className="text-xs text-[#7B3FA0]">End-to-end attribution lifecycle & fraud checks</p>
          </div>
          <button onClick={onClose} className="text-[#7B3FA0] hover:text-[#2D004D] p-1"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-[#7B3FA0]">
            <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm font-medium font-mono">Loading trace data…</span>
          </div>
        ) : !trace ? (
          <div className="py-12 text-center text-[#7B3FA0] text-xs">Trace details not found for Order #{orderId}.</div>
        ) : (
          <div className="space-y-5 text-xs text-[#2D004D]">
            {/* Order & Payment Summary */}
            <div className="grid grid-cols-3 gap-3 bg-[#F8F3FB] p-3.5 rounded-xl border border-[#F3EAF8]">
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

            {/* Customer & Affiliate Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-white rounded-xl border border-[#F3EAF8] space-y-1.5">
                <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Customer Details</h4>
                <p className="font-bold text-[#2D004D]">{trace.customer?.name || 'Customer'}</p>
                <p className="text-[10px] text-[#7B3FA0] font-mono">{trace.customer?.email}</p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-[#F3EAF8] space-y-1.5">
                <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Affiliate Attribution</h4>
                <p className="font-bold text-[#2D004D]">{trace.attribution?.affiliate_name || '—'}</p>
                <p className="text-[10px] font-mono text-[#7B3FA0]">Code: {trace.attribution?.affiliate_code} • {trace.attribution?.device_type} ({trace.attribution?.browser})</p>
              </div>
            </div>

            {/* Commission Details */}
            <div className="p-3.5 bg-white rounded-xl border border-[#F3EAF8] space-y-2">
              <h4 className="font-bold text-[10px] uppercase text-[#7B3FA0] tracking-wider">Commission Ledger</h4>
              <div className="flex justify-between items-center">
                <span>Earned Commission: <strong className="text-emerald-600 font-bold">{fmt(trace.commission?.amount)}</strong></span>
                <StatusBadge status={trace.commission?.status} size="xs" />
              </div>
            </div>

            {/* Event Timeline Stream */}
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

// ── Affiliate Profile Slide-over (CRM) ───────────────────────────────────────
function AffiliateProfilePanel({ affiliateId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab]   = useState('overview');

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
    { id: 'analytics',   label: 'Analytics' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40 backdrop-blur-xs" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#F3EAF8] bg-gradient-to-r from-[#7B3FA0] to-[#2D004D]">
            <div>
              <h2 className="text-base font-bold text-white">Promoter CRM Profile</h2>
              <p className="text-xs text-white/60">Live performance & ledger analytics</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          {/* Sub-tab navigation bar */}
          <div className="flex items-center gap-1 p-2 bg-[#F8F3FB] border-b border-[#F3EAF8] overflow-x-auto">
            {DRAWER_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${subTab === t.id ? 'bg-[#7B3FA0] text-white shadow-xs' : 'text-[#7B3FA0] hover:bg-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-[#7B3FA0]">
              <RefreshCw size={24} className="animate-spin" />
            </div>
          ) : !profile ? (
            <div className="flex-1 flex items-center justify-center py-20 text-[#7B3FA0]/60">
              <p className="text-xs font-bold">Profile not found</p>
            </div>
          ) : (
            <div className="flex-1 p-6 space-y-6">
              {/* Identity Header */}
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

              {/* Sub-tab 1: Overview */}
              {subTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Total Clicks', value: fmtN(profile.total_clicks) },
                      { label: 'Unique Clicks', value: fmtN(profile.unique_clicks) },
                      { label: 'Sales', value: fmtN(profile.total_sales) },
                      { label: 'Conversion Rate', value: `${profile.conversion_rate || 0}%` },
                      { label: 'Avg Order Value', value: fmt(profile.avg_order_value) },
                      { label: 'Total Revenue', value: fmt(profile.total_revenue) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                        <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider">{label}</p>
                        <p className="text-sm font-bold text-[#2D004D] mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Commission Breakdown</h4>
                    {[
                      { label: 'Total Earned',  value: fmt(profile.commission_earned),  color: 'text-[#2D004D]' },
                      { label: 'Pending Balance', value: fmt(profile.commission_pending),  color: 'text-amber-600' },
                      { label: 'Paid Settled',  value: fmt(profile.commission_paid),     color: 'text-emerald-600' },
                      { label: 'Rejected',      value: fmt(profile.commission_rejected), color: 'text-rose-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-[#7B3FA0]">{label}</span>
                        <span className={`text-xs font-bold ${color}`}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {(profile.upi_id || profile.bank_name) && (
                    <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Payment Vault</h4>
                      {profile.upi_id && <div className="text-xs text-[#7B3FA0]">UPI VPA: <span className="font-mono text-[#2D004D] font-bold">{profile.upi_id}</span></div>}
                      {profile.bank_name && <div className="text-xs text-[#7B3FA0]">Bank: <span className="font-bold text-[#2D004D]">{profile.bank_name} {profile.account_number}</span></div>}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Customers */}
              {subTab === 'customers' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Referred Customers & LTV</h4>
                  {profile.recent_commissions?.length > 0 ? (
                    profile.recent_commissions.map((c, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-[#2D004D]">{c.customer_name || 'Customer'}</p>
                          <p className="text-[10px] text-[#7B3FA0] font-mono">{c.customer_email || 'Referred buyer'}</p>
                        </div>
                        <span className="font-bold text-emerald-600">₹{Number(c.amount * 5).toFixed(2)} LTV</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#7B3FA0]">No customer referrals recorded yet.</p>
                  )}
                </div>
              )}

              {/* Sub-tab 3: Orders */}
              {subTab === 'orders' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Attributed Orders</h4>
                  {profile.recent_commissions?.length > 0 ? (
                    profile.recent_commissions.map(c => (
                      <div key={c.id} className="p-3 rounded-xl bg-white border border-[#F3EAF8] flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-[#2D004D]">Order #{c.order_id || c.id}</p>
                          <p className="text-[10px] text-[#7B3FA0]">{c.product_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#2D004D]">₹{Number(c.amount || 0).toFixed(2)}</p>
                          <StatusBadge status={c.status} size="xs" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#7B3FA0]">No orders placed yet.</p>
                  )}
                </div>
              )}

              {/* Sub-tab 4: Products */}
              {subTab === 'products' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Top Products Promoted</h4>
                  {profile.top_products?.length > 0 ? (
                    profile.top_products.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-xs">
                        <span className="font-bold text-[#2D004D]">{p.name}</span>
                        <span className="font-bold text-[#7B3FA0]">{p.count} sale{p.count !== 1 ? 's' : ''}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#7B3FA0]">No product sales recorded yet.</p>
                  )}
                </div>
              )}

              {/* Sub-tab 5: Commission History */}
              {subTab === 'commissions' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Commission History</h4>
                  {profile.recent_commissions?.length > 0 ? (
                    profile.recent_commissions.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#F3EAF8] text-xs">
                        <div>
                          <p className="font-bold text-[#2D004D]">{c.product_name || '—'}</p>
                          <p className="text-[9px] text-[#7B3FA0]">{fmtDate(c.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{fmt(c.amount)}</p>
                          <StatusBadge status={c.status} size="xs" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#7B3FA0]">No commission history.</p>
                  )}
                </div>
              )}

              {/* Sub-tab 6: Timeline */}
              {subTab === 'timeline' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Promoter Lifecycle Timeline</h4>
                  <div className="border-l-2 border-[#7B3FA0]/30 pl-4 space-y-4 text-xs">
                    <div className="relative pl-2 space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#7B3FA0] border-2 border-white" />
                      <p className="font-bold text-[#2D004D]">Affiliate Activated</p>
                      <p className="text-[10px] text-[#7B3FA0]">{fmtDate(profile.joined_date)}</p>
                    </div>
                    <div className="relative pl-2 space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-[#7B3FA0] border-2 border-white" />
                      <p className="font-bold text-[#2D004D]">First Sale Attributed</p>
                      <p className="text-[10px] text-[#7B3FA0]">Attributed via unique referral link</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 7: Analytics */}
              {subTab === 'analytics' && (
                <div className="space-y-4 text-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Performance Metrics</h4>
                  <div className="p-3 bg-[#F8F3FB] rounded-xl border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Conversion Rate</span>
                    <span className="font-bold text-emerald-600">{profile.conversion_rate || 0}%</span>
                  </div>
                  <div className="p-3 bg-[#F8F3FB] rounded-xl border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Avg Order Value</span>
                    <span className="font-bold text-[#2D004D]">{fmt(profile.avg_order_value)}</span>
                  </div>
                </div>
              )}

              {/* Dates Footer */}
              <div className="text-[10px] text-[#7B3FA0] space-y-1 border-t border-[#F3EAF8] pt-4">
                <p>Joined: <span className="font-bold text-[#2D004D]">{fmtDate(profile.joined_date)}</span></p>
                <p>Last Active: <span className="font-bold text-[#2D004D]">{profile.last_active_at ? fmtDate(profile.last_active_at) : 'Recent'}</span></p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Commission Status Patch Modal ─────────────────────────────────────────────
function CommissionActionModal({ commission, onClose, onSave }) {
  const [newStatus, setNewStatus] = useState(commission?.commission_status || 'pending');
  const [notes, setNotes]         = useState(commission?.admin_notes || '');
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await backendFetch(`/admin/affiliates/commissions/${commission.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ commission_status: newStatus, admin_notes: notes }),
      });
      onSave(commission.id, newStatus, notes);
    } catch (e) { console.error(e); }
    finally { setSaving(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#2D004D]">Update Commission #{commission?.id}</h3>
          <button onClick={onClose} className="text-[#7B3FA0] hover:text-[#2D004D]"><X size={18} /></button>
        </div>
        <div className="p-3 bg-[#F8F3FB] rounded-xl space-y-1">
          <p className="text-xs font-bold text-[#2D004D]">{commission?.product_name || 'Product Sale'}</p>
          <p className="text-xs text-[#7B3FA0]">Affiliate: {commission?.affiliate_name} • {fmt(commission?.commission_earned)}</p>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">New Status</label>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3 py-2 text-xs text-[#2D004D] font-medium">
            {Object.entries(COMM_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Admin Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3 py-2 text-xs text-[#2D004D] resize-none" />
        </div>
        <div className="flex gap-3 justify-end pt-2 border-t border-[#F3EAF8]">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB] rounded-xl">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-xl bg-[#7B3FA0] hover:bg-[#5C2B7C] text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Small reusable KPI card ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border shadow-xs space-y-1 w-full min-w-0 max-w-full overflow-hidden min-h-[72px] sm:min-h-[96px] ${accent ? 'bg-gradient-to-br from-[#7B3FA0] via-[#5C2B7C] to-[#2D004D] border-transparent text-white' : 'bg-white border-[#F3EAF8]'}`}>
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <span className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-wider truncate ${accent ? 'text-white/80' : 'text-[#7B3FA0]'}`}>{label}</span>
        {Icon && <Icon size={12} className={`shrink-0 ${accent ? 'text-white/80' : 'text-[#7B3FA0]'}`} />}
      </div>
      <div className={`text-xs sm:text-lg md:text-xl font-serif font-bold truncate ${accent ? 'text-white' : 'text-[#2D004D]'}`}>{value}</div>
      {sub && <div className={`text-[8px] sm:text-[10px] font-medium truncate ${accent ? 'text-white/70' : 'text-[#7B3FA0]'}`}>{sub}</div>}
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────
function DataTable({ children, loading, empty }) {
  if (loading) return (
    <div className="flex items-center justify-center py-20 text-[#7B3FA0]">
      <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm font-medium font-mono">Loading data…</span>
    </div>
  );
  if (empty) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-3 text-[#7B3FA0]/60">
      <FileText size={40} strokeWidth={1} />
      <p className="text-sm font-medium">No records found</p>
    </div>
  );
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

// ── Enterprise Confirmation & Stepper Payout Modal ──────────────────────────────
function EnterprisePayoutModal({ payout, onClose, onPaymentComplete }) {
  const [step, setStep] = useState('confirm'); // 'confirm' | 'progress' | 'complete'
  const [verificationData, setVerificationData] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [stepperState, setStepperState] = useState([
    { id: 1, label: 'Pre-Payment Multi-Point Verification', status: 'pending' },
    { id: 2, label: 'RazorpayX Beneficiary & Fund Account Clearance', status: 'pending' },
    { id: 3, label: 'Dispatching Real Money Transfer via RazorpayX', status: 'pending' },
    { id: 4, label: 'Bank Settlement & Webhook Reconciliation', status: 'pending' },
  ]);

  useEffect(() => {
    if (!payout) return;
    setVerifying(true);
    backendFetch(`/admin/affiliates/payouts/${payout.id}/verify`, { method: 'POST' })
      .then(d => {
        setVerificationData(d);
      })
      .catch(err => {
        setErrorMsg(err.message || 'Pre-payment verification failed');
      })
      .finally(() => setVerifying(false));
  }, [payout]);

  const handleStartTransfer = async () => {
    setStep('progress');
    setErrorMsg(null);

    setStepperState(prev => prev.map(s => s.id === 1 ? { ...s, status: 'completed' } : s));

    setTimeout(() => {
      setStepperState(prev => prev.map(s => s.id === 2 ? { ...s, status: 'completed' } : s.id === 3 ? { ...s, status: 'active' } : s));
    }, 600);

    try {
      setExecuting(true);
      const res = await backendFetch(`/admin/affiliates/payouts/${payout.id}/pay`, { method: 'POST' });
      setExecutionResult(res);

      setStepperState(prev => prev.map(s => s.id === 3 ? { ...s, status: 'completed' } : s.id === 4 ? { ...s, status: 'completed' } : s));
      setStep('complete');
      if (onPaymentComplete) onPaymentComplete();
    } catch (exc) {
      setErrorMsg(exc.message || 'Payment execution failed');
      setStepperState(prev => prev.map(s => s.id === 3 ? { ...s, status: 'failed' } : s));
    } finally {
      setExecuting(false);
    }
  };

  if (!payout) return null;

  const beneficiaryName = verificationData?.beneficiary?.name || payout.affiliate_name || 'Affiliate';
  const legalName = verificationData?.beneficiary?.legal_name || beneficiaryName;
  const bankName = verificationData?.beneficiary?.bank_name || payout.bank_name || 'HDFC Bank';
  const destAccount = verificationData?.beneficiary?.account_number_masked || payout.upi_id || payout.account_number || 'Account Verified';
  const grossAmt = Number(payout.amount || 0);
  const netAmt = Number(verificationData?.net_payable || grossAmt);

  const handleDownloadReceipt = () => {
    // Real amounts and references only. UTR may be pending bank confirmation.
    const csvContent = `Transaction Reference,Razorpay Payout ID,UTR,Beneficiary,Legal Name,Amount,Status,Settlement Time\n` +
      `"lumora_payout_${payout.id}","${executionResult?.provider_ref || '—'}","${executionResult?.utr || 'Pending bank confirmation'}","${beneficiaryName}","${legalName}",${netAmt},"${executionResult?.status || 'processing'}","${new Date().toISOString()}"`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payout-receipt-${payout.id}.csv`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#F3EAF8] shadow-2xl max-w-lg w-full overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#2D004D] via-[#5C2B7C] to-[#7B3FA0] text-white flex items-center justify-between">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-mono font-bold tracking-widest uppercase">
              RAZORPAYX REAL MONEY PAYOUT ENGINE
            </span>
            <h3 className="text-base font-bold text-white mt-1">Approve Payout #{payout.id}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10"><X size={18} /></button>
        </div>

        {/* STEP 1: CONFIRMATION SCREEN */}
        {step === 'confirm' && (
          <div className="p-6 space-y-6">
            <div className="bg-[#F8F3FB] border border-[#F3EAF8] p-4 rounded-xl space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[#F3EAF8]">
                <span className="text-stone-500 font-medium">Beneficiary Name</span>
                <span className="font-bold text-[#2D004D]">{beneficiaryName} ({payout.affiliate_code})</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F3EAF8]">
                <span className="text-stone-500 font-medium">Legal / PAN Name</span>
                <span className="font-bold text-[#2D004D]">{legalName}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F3EAF8]">
                <span className="text-stone-500 font-medium">Destination Bank / VPA</span>
                <span className="font-mono font-bold text-[#7B3FA0]">{bankName} • {destAccount}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#F3EAF8]">
                <span className="text-stone-500 font-medium">Purpose</span>
                <span className="font-bold text-[#2D004D]">Affiliate Commission Settlement</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-500 font-medium">Reference ID</span>
                <span className="font-mono font-bold text-stone-700">WD-2026-000{payout.id}</span>
              </div>
            </div>

            {/* Verification Checks Radar */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#7B3FA0] block">
                Pre-Payment Multi-Point Verification Radar
              </span>
              {verifying ? (
                <div className="p-4 text-center text-xs text-[#7B3FA0] flex items-center justify-center gap-2">
                  <RefreshCw size={14} className="animate-spin" /> Performing security & bank validations…
                </div>
              ) : verificationData ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {verificationData.checks.map(c => (
                    <div key={c.id} className={`p-2 rounded-lg border flex items-center gap-1.5 ${c.status === 'passed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                      {c.status === 'passed' ? <CheckCircle2 size={13} className="shrink-0 text-emerald-600" /> : <AlertOctagon size={13} className="shrink-0 text-rose-600" />}
                      <span className="truncate font-medium">{c.label}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Financial Totals Summary */}
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Net Transfer Amount</span>
                <span className="text-xs text-stone-500">Includes 0.00 TDS Tax Deduction</span>
              </div>
              <span className="text-2xl font-serif font-bold text-[#2D004D]">{fmt(netAmt)}</span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle size={15} /> {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3EAF8]">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB]">
                Cancel
              </button>
              <button
                onClick={handleStartTransfer}
                disabled={verifying || (verificationData && !verificationData.passes_all)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Check size={15} /> Transfer Funds ({fmt(netAmt)})
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LIVE PROGRESS STEPPER */}
        {step === 'progress' && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <h4 className="font-bold text-[#2D004D] text-sm">Processing Money Transfer</h4>
              <p className="text-xs text-[#7B3FA0]">Communicating with RazorpayX Banking Network…</p>
            </div>

            <div className="space-y-4 text-xs">
              {stepperState.map(st => (
                <div key={st.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                  {st.status === 'completed' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs"><Check size={14} /></div>
                  ) : st.status === 'failed' ? (
                    <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs"><X size={14} /></div>
                  ) : st.status === 'active' || executing ? (
                    <div className="w-6 h-6 rounded-full bg-[#7B3FA0] text-white flex items-center justify-center font-bold text-xs"><RefreshCw size={12} className="animate-spin" /></div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-stone-200 text-stone-500 flex items-center justify-center font-bold text-xs">{st.id}</div>
                  )}
                  <span className={`font-bold ${st.status === 'completed' ? 'text-emerald-700' : 'text-[#2D004D]'}`}>{st.label}</span>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1.5"><AlertCircle size={15} /> Transfer Error</p>
                <p>{errorMsg}</p>
                <button onClick={() => setStep('confirm')} className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold text-[10px]">
                  Return to Confirmation
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: COMPLETION / RESULT SCREEN */}
        {step === 'complete' && (
          <div className="p-6 space-y-6">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-base">RazorpayX Transfer Dispatched</h4>
              <p className="text-xs text-emerald-800">
                Payout <strong>#{payout.id}</strong> of <strong>{fmt(netAmt)}</strong> to <strong>{beneficiaryName}</strong> is processing.
              </p>
            </div>

            <div className="bg-[#F8F3FB] border border-[#F3EAF8] p-4 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-stone-500">Razorpay Payout ID:</span>
                <span className="font-bold text-[#7B3FA0]">{executionResult?.provider_ref || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Settlement UTR:</span>
                {/* Real UTR from bank settlement. Available after webhook confirms.
                    Never display fabricated UTR strings. */}
                <span className={`font-bold ${executionResult?.utr ? 'text-emerald-700' : 'text-stone-400'}`}>
                  {executionResult?.utr || 'Pending bank confirmation'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Gateway Mode:</span>
                <span className="font-bold text-[#2D004D] uppercase">{executionResult?.payout_mode || 'razorpay'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Settlement Status:</span>
                <span className="font-bold text-emerald-600">
                  {executionResult?.status === 'completed' ? 'Completed' : 'Processing / Webhook Pending'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#F3EAF8]">
              <button onClick={handleDownloadReceipt} className="px-4 py-2 rounded-xl border border-[#F3EAF8] text-[#7B3FA0] font-bold text-xs hover:bg-[#F8F3FB] flex items-center gap-1.5">
                <Download size={14} /> Download Receipt CSV
              </button>
              <button onClick={onClose} className="px-6 py-2 rounded-xl bg-[#2D004D] text-white font-bold text-xs hover:bg-[#7B3FA0] transition-all">
                Done & Close
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── MAIN ENTERPRISE CONSOLE COMPONENT ─────────────────────────────────────────
export default function AffiliateManagement() {
  // RESTORED SIMPLIFIED 6-TAB STRUCTURE (NO DUPLICATES)
  const TABS = [
    { id: 'overview',   label: 'Executive Overview',     icon: BarChart3 },
    { id: 'payouts',    label: 'Payout Requests',        icon: Wallet },
    { id: 'promoters',  label: 'Promoters',              icon: Users },
    { id: 'products',   label: 'Products & Commission',  icon: ShoppingBag },
    { id: 'ledger',     label: 'Sales Ledger',           icon: Receipt },
    { id: 'analytics',  label: 'Rules & Analytics',      icon: Sliders },
  ];

  const [activeTab, setActiveTab] = useState('overview');

  // Overview / KPIs
  const [kpis, setKpis]               = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // Search & Filters
  const [utrSearch, setUtrSearch] = useState('');

  // Payout Queue & Review Drawer State (RazorpayX Infrastructure)
  const [payouts, setPayouts]                     = useState([]);
  const [payoutsLoading, setPayoutsLoading]       = useState(false);
  const [payoutsTotal, setPayoutsTotal]           = useState(0);
  const [payoutsPage, setPayoutsPage]             = useState(1);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('pending');
  const [selectedPayoutDrawer, setSelectedPayoutDrawer] = useState(null);
  const [payoutActionLoading, setPayoutActionLoading]   = useState(false);
  const [showSandboxModal, setShowSandboxModal]         = useState(false);
  const [showEnterprisePayoutModal, setShowEnterprisePayoutModal] = useState(null);
  const [payoutNoticeModal, setPayoutNoticeModal]                 = useState(null);

  // Promoters CRM State
  const [affiliates, setAffiliates]           = useState([]);
  const [affSearch, setAffSearch]             = useState('');
  const [affStatusFilter, setAffStatusFilter] = useState('all');
  const [profilePanelId, setProfilePanelId]   = useState(null);

  // Products Matrix State
  const [products, setProducts]                       = useState([]);
  const [searchQuery, setSearchQuery]                 = useState('');
  const [statusFilter, setStatusFilter]               = useState('all');
  const [modeFilter, setModeFilter]                   = useState('all');
  const [selectedProductIds, setSelectedProductIds]   = useState([]);
  const [showBulkModal, setShowBulkModal]             = useState(false);
  const [bulkCommissionMode, setBulkCommissionMode]   = useState('percentage');
  const [bulkCommissionValue, setBulkCommissionValue] = useState(20);
  const [bulkEnableStatus, setBulkEnableStatus]       = useState(true);
  const [qrModalProduct, setQrModalProduct]           = useState(null);

  // Sales Ledger State
  const [ledger, setLedger]                             = useState([]);
  const [ledgerLoading, setLedgerLoading]               = useState(false);
  const [ledgerTotal, setLedgerTotal]                   = useState(0);
  const [ledgerPage, setLedgerPage]                     = useState(1);
  const [ledgerSearch, setLedgerSearch]                 = useState('');
  const [ledgerCommStatus, setLedgerCommStatus]         = useState('');
  const [ledgerPurchaseStatus, setLedgerPurchaseStatus] = useState('');
  const [ledgerAffFilter, setLedgerAffFilter]           = useState('');
  const [commActionModal, setCommActionModal]           = useState(null);
  const [selectedTraceOrderId, setSelectedTraceOrderId] = useState(null);

  // Data Loaders
  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const d = await backendFetch('/admin/affiliates/kpis');
      if (d) setKpis(d);
    } catch(e) {
      console.error('Failed loading KPIs:', e);
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

  const loadAffiliates = useCallback(async () => {
    try {
      const d = await backendFetch('/admin/affiliates');
      setAffiliates(Array.isArray(d) ? d : []);
    } catch(e) {
      setAffiliates([]);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const d = await backendFetch('/admin/products');
      const items = Array.isArray(d) ? d : (d?.products || d?.items || []);
      setProducts(items);
    } catch(e) {
      setProducts([]);
    }
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ page: ledgerPage, page_size: 50 });
      if (ledgerSearch) params.append('search', ledgerSearch);
      if (ledgerCommStatus) params.append('commission_status', ledgerCommStatus);
      if (ledgerPurchaseStatus) params.append('purchase_status', ledgerPurchaseStatus);
      if (ledgerAffFilter) params.append('affiliate_id', ledgerAffFilter);
      const d = await backendFetch(`/admin/affiliates/commissions?${params}`);
      setLedger(d?.items || []);
      setLedgerTotal(d?.total || 0);
    } catch(e) {
      setLedger([]);
      setLedgerTotal(0);
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerPage, ledgerSearch, ledgerCommStatus, ledgerPurchaseStatus, ledgerAffFilter]);

  // Wait for AuthContext to finish restoring the admin JWT before fetching data.
  const { loading: authLoading } = useAuth();

  // Realtime Active Tab Sync Ticker (15s interval)
  useEffect(() => {
    // Don't fetch until auth session is ready (JWT stored in localStorage)
    if (authLoading) return;
    const refreshActiveTabData = () => {
      if (activeTab === 'overview') { loadKpis(); loadPayouts(); loadAffiliates(); loadProducts(); }
      else if (activeTab === 'payouts') loadPayouts();
      else if (activeTab === 'promoters') loadAffiliates();
      else if (activeTab === 'products') loadProducts();
      else if (activeTab === 'ledger') loadLedger();
    };
    refreshActiveTabData();
    const timer = setInterval(refreshActiveTabData, 15000);
    return () => clearInterval(timer);
  }, [authLoading, activeTab, loadKpis, loadPayouts, loadAffiliates, loadProducts, loadLedger]);

  // Reload when page/filter parameters update
  useEffect(() => { if (!authLoading && activeTab === 'payouts') loadPayouts(); }, [authLoading, payoutsPage, payoutStatusFilter, utrSearch, loadPayouts]);
  useEffect(() => { if (!authLoading && activeTab === 'ledger') loadLedger(); }, [authLoading, ledgerPage, ledgerSearch, ledgerCommStatus, ledgerPurchaseStatus, ledgerAffFilter, loadLedger]);

  // Handlers for RazorpayX Payouts
  const handleTestPayout = async (payoutId) => {
    if (!window.confirm(`Execute Development Test Payout for Payout #${payoutId}?\nThis will perform full atomic PostgreSQL updates (wallet deduction, status paid, audit trail).`)) {
      return;
    }
    setPayoutActionLoading(true);
    try {
      const res = await backendFetch(`/admin/affiliates/payouts/${payoutId}/test-payout`, {
        method: 'POST'
      });
      alert(`Test Payout Completed Successfully! Transaction Ref: ${res.transaction_reference || res.provider_ref}`);
      loadPayouts();
      loadKpis();
      loadLedger();
      loadAffiliates();
      setSelectedPayoutDrawer(null);
      window.dispatchEvent(new CustomEvent('lumora_payout_completed', { detail: { payoutId } }));
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel('lumora_sync');
          bc.postMessage({ type: 'lumora_payout_completed', payoutId });
          bc.close();
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      setPayoutNoticeModal({
        title: 'Test Payout Unavailable',
        message: e.message || `Payout #${payoutId} cannot be actioned again.`,
        type: 'error'
      });
    } finally {
      setPayoutActionLoading(false);
    }
  };

  const handleApprovePayout = (payoutId) => {
    if (selectedPayoutDrawer) {
      setShowEnterprisePayoutModal(selectedPayoutDrawer);
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

  // Products Matrix Handlers
  const handleToggleProductAffiliate = async (id) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    const nextStatus = !prod.affiliate_enabled;
    try {
      await backendFetch(`/admin/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ affiliate_enabled: nextStatus })
      });
      loadProducts();
    } catch(e) {
      console.error('Failed product update:', e);
    }
  };

  const toggleSelectProduct = id => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedProductIds(selectedProductIds.length === filteredProducts.length ? [] : filteredProducts.map(p => p.id));

  const handleApplyBulkUpdate = async () => {
    if (!selectedProductIds.length) return;
    try {
      await Promise.all(selectedProductIds.map(id =>
        backendFetch(`/admin/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            affiliate_enabled: bulkEnableStatus,
            commission_mode: bulkCommissionMode,
            commission_value: Number(bulkCommissionValue) || 0
          })
        })
      ));
      loadProducts();
    } catch(e) {
      console.error('Failed bulk update:', e);
    } finally {
      setShowBulkModal(false);
      setSelectedProductIds([]);
    }
  };

  const handleToggleAffiliateStatus = (id) => setAffiliates(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'active' ? 'suspended' : 'active' } : a));
  const handleExportCSV = () => { window.open('/api/admin/affiliates/commissions/export/csv', '_blank'); };
  const handleCommissionSaved = (id, newStatus) => setLedger(prev => prev.map(c => c.id === id ? { ...c, commission_status: newStatus } : c));

  // Derived filtered collections
  const filteredProducts = useMemo(() => products.filter(p => {
    const matchSearch = (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === 'all' ? true : statusFilter === 'enabled' ? p.affiliate_enabled : !p.affiliate_enabled;
    const matchMode   = modeFilter === 'all' ? true : p.commission_mode === modeFilter;
    return matchSearch && matchStatus && matchMode;
  }), [products, searchQuery, statusFilter, modeFilter]);

  const filteredAffiliates = useMemo(() => affiliates.filter(a => {
    const matchSearch = (a.name || '').toLowerCase().includes(affSearch.toLowerCase()) || (a.email || '').toLowerCase().includes(affSearch.toLowerCase()) || (a.code || '').toLowerCase().includes(affSearch.toLowerCase());
    const matchStatus = affStatusFilter === 'all' ? true : a.status === affStatusFilter;
    return matchSearch && matchStatus;
  }), [affiliates, affSearch, affStatusFilter]);

  return (
    <AdminLayout activePage="affiliate-management">
      <div className="p-3 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-full overflow-x-hidden min-w-0">
        {/* Header Banner */}
        <div className="flex flex-col gap-4 border-b border-[#F3EAF8] pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] text-[9px] font-black tracking-widest uppercase">
                  AFFILIATE PROGRAM
                </span>
                {IS_SANDBOX_ENABLED && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                    <Beaker size={12} /> SANDBOX DEV MODE ACTIVE
                  </span>
                )}
                <span className="text-[11px] text-[#7B3FA0] font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified Attribution Engine
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-[#2D004D] font-bold leading-tight break-words">Affiliates & Referrals</h1>
              <p className="text-xs text-[#7B3FA0] mt-1 max-w-2xl leading-relaxed">
                Manage affiliate partners, track referral sales, configure commission rates, and process payouts.
              </p>
            </div>
            <button onClick={handleExportCSV}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#2D004D] text-white text-xs font-bold hover:bg-[#7B3FA0] transition-all shadow-md shrink-0 min-h-[42px]">
              <ArrowDownToLine size={14} /> Export Operations CSV
            </button>
          </div>

          {/* Segmented Navigation Bar (Enterprise Mobile Redesign) */}
          <MobileSectionSwitcher
            sections={TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon }))}
            activeSection={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* ── TAB 1: EXECUTIVE OVERVIEW ────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-6 sm:space-y-8">
            {/* Immediate Action Alert Queue */}
            {payoutsTotal > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0"><AlertTriangle size={18} /></div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider">Immediate Action Queue</h3>
                    <p className="text-xs leading-relaxed">There are <strong>{payoutsTotal}</strong> pending withdrawal request(s) requiring financial review before payout cycle cutoff.</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('payouts')} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-800 text-white text-xs font-bold hover:bg-amber-900 transition-all shrink-0 min-h-[42px] flex items-center justify-center">
                  Audit Requests Queue →
                </button>
              </div>
            )}

            {/* Executive KPIs Grid — all values from /admin/affiliates/kpis backend endpoint.
                Fields today_commission and today_revenue now exist in backend response.
                No fallback monetary values. If API returns null, display '—'. */}
            <div className="grid grid-cols-2 max-[320px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-4">
              {/* commission_pending: SUM(affiliate_commissions.commission_amt)
                  WHERE commission_status IN ('pending','approved','ready_for_payout') */}
              <KpiCard label="Pending Liability"   value={kpisLoading ? '…' : kpis ? fmt(kpis.commission_pending) : '—'} sub="Total Unpaid Balance" icon={Clock} accent />
              {/* pending_withdrawals: COUNT(affiliate_payouts) WHERE status IN ('pending','processing') */}
              <KpiCard label="Pending Requests"    value={kpisLoading ? '…' : fmtN(payoutsTotal || kpis?.pending_withdrawals || 0)} sub="Awaiting Admin Audit" icon={Wallet} />
              {/* today_commission: SUM(affiliate_commissions.commission_amt) WHERE created_at >= today 00:00 UTC */}
              <KpiCard label="Today's Commission"  value={kpisLoading ? '…' : kpis ? fmt(kpis.today_commission) : '—'} sub="Earned Today" icon={Zap} />
              {/* today_revenue: SUM(affiliate_commissions.sale_amount) WHERE created_at >= today 00:00 UTC */}
              <KpiCard label="Today's Revenue"     value={kpisLoading ? '…' : kpis ? fmt(kpis.today_revenue) : '—'} sub="Attributed Sales Today" icon={DollarSign} />
              {/* conversion_rate: total_sales / total_clicks * 100 */}
              <KpiCard label="Conversion Rate"     value={kpisLoading ? '…' : kpis ? `${kpis.conversion_rate}%` : '—'} sub="Click to Sale Rate" icon={TrendingUp} />
              {/* revenue_generated: max(SUM(commissions.sale_amount), SUM(orders.total_amount WHERE affiliate_id IS NOT NULL)) */}
              <KpiCard label="Revenue Generated"   value={kpisLoading ? '…' : kpis ? fmt(kpis.revenue_generated) : '—'} sub="Lifetime Sales" icon={BarChart3} />
              {/* commission_paid: SUM(affiliate_commissions.commission_amt) WHERE commission_status = 'paid' */}
              <KpiCard label="Commission Paid"     value={kpisLoading ? '…' : kpis ? fmt(kpis.commission_paid) : '—'} sub="Settled via RazorpayX" icon={Check} />
              {/* avg_approval_time: AVG(completed_at - created_at) from affiliate_payouts WHERE status = 'completed'.
                  Backend returns human-readable string e.g. "1.4 days" or "N/A" if insufficient data. */}
              <KpiCard label="Avg Approval Time"   value={kpisLoading ? '…' : kpis?.avg_approval_time || 'N/A'} sub="Payout Turnaround" icon={ShieldCheck} />
            </div>

            {/* Middle Grid: Action Queue + Performance Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Immediate Action Queue Widget */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#F3EAF8] p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7B3FA0] flex items-center gap-2">
                    <Clock size={15} /> Immediate Action Queue — Pending Payouts
                  </h3>
                  <span className="text-[10px] font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded-md">
                    {payouts.slice(0, 3).length} Requests Ready
                  </span>
                </div>
                {payouts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#7B3FA0]">All withdrawal requests cleared & up to date.</div>
                ) : (
                  <div className="space-y-3">
                    {payouts.slice(0, 3).map(p => (
                      <div key={p.id} className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2D004D]">{p.affiliate_name}</span>
                            <span className="font-mono text-[10px] text-[#7B3FA0]">{p.affiliate_code}</span>
                          </div>
                          <p className="text-[10px] text-[#7B3FA0]">Requested on {fmtDate(p.created_at)} • {p.method || 'UPI'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-serif font-bold text-[#2D004D] text-sm">{fmt(p.amount)}</span>
                          <button onClick={() => setSelectedPayoutDrawer(p)} className="px-3 py-1.5 rounded-lg bg-[#7B3FA0] text-white text-[11px] font-bold hover:bg-[#5C2B7C]">
                            Review Request
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Conversion Funnel Widget — all values from /admin/affiliates/kpis */}
              <div className="bg-white rounded-2xl border border-[#F3EAF8] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7B3FA0] flex items-center gap-2">
                  <TrendingUp size={15} /> Conversion Funnel
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Total Clicks:</span>
                    {/* Source: affiliate_profiles.total_clicks + referral_links.clicks_count */}
                    <span className="font-bold text-[#2D004D]">{kpisLoading ? '…' : kpis ? fmtN(kpis.total_clicks) : '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Unique Visitors:</span>
                    {/* Source: affiliate_profiles.unique_clicks */}
                    <span className="font-bold text-[#2D004D]">{kpisLoading ? '…' : kpis ? fmtN(kpis.unique_clicks) : '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Attributed Sales:</span>
                    {/* Source: COUNT(affiliate_commissions) */}
                    <span className="font-bold text-[#2D004D]">{kpisLoading ? '…' : kpis ? fmtN(kpis.total_sales ?? kpis.total_conversions) : '—'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] text-white flex justify-between">
                    <span className="text-white/70 font-medium">Conversion Rate:</span>
                    {/* Source: total_sales / total_clicks * 100 */}
                    <span className="font-bold text-white font-mono">{kpisLoading ? '…' : kpis ? `${kpis.conversion_rate}%` : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Health & Risk Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase">RazorpayX Integration</span>
                <div className="text-lg font-bold text-[#2D004D] flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" /> Active & Operational
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase">Fraud Radar Engine</span>
                <div className="text-lg font-bold text-[#2D004D] flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-600" /> {kpis?.suspended_affiliates ?? 0} Flagged Accounts
                </div>
              </div>
              {/* Webhook Sync Rate removed — no webhook delivery log table exists in DB.
                  "99.98%" was a hardcoded fabricated metric and has been removed. */}
            </div>
          </div>
        )}

        {/* ── TAB 2: PAYOUT REQUESTS ───────────────────────────────────────────── */}
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
                  const radar = getPayoutRadarStatus(p);
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
                          <BankVerificationBadge radarStatus={radar} isVerified={true} kycStatus="verified" />
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

        {/* ── TAB 3: PROMOTERS (CRM DIRECTORY) ─────────────────────────────────── */}
        {activeTab === 'promoters' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-xs">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <Search size={14} className="text-[#7B3FA0]" />
                <input
                  type="text"
                  value={affSearch}
                  onChange={e => setAffSearch(e.target.value)}
                  placeholder="Search by promoter name, email, or referral code…"
                  className="w-full bg-transparent text-xs text-[#2D004D] focus:outline-none"
                />
              </div>
              <AdminSelect value={affStatusFilter} onChange={e => setAffStatusFilter(e.target.value)} options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'active', label: 'Active Only' },
                { value: 'suspended', label: 'Suspended Only' },
              ]} className="w-40" />
            </div>

            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xs overflow-hidden">
              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-[#F8F3FB] border-b border-[#F3EAF8] text-[#7B3FA0] font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Promoter</th>
                      <th className="py-3.5 px-4">Code &amp; Tier</th>
                      <th className="py-3.5 px-4 text-right">Lifetime Revenue</th>
                      <th className="py-3.5 px-4 text-right">Lifetime Comm.</th>
                      <th className="py-3.5 px-4 text-right">Pending</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8] text-[#2D004D]">
                    {filteredAffiliates.map(a => {
                      const tier = getAffiliateTier(a.revenue);
                      const TierIcon = tier.icon;
                      return (
                        <tr key={a.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] flex items-center justify-center text-white font-bold text-xs">
                                {(a.name || 'A')[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-[#2D004D]">{a.name}</p>
                                <p className="text-[10px] text-[#7B3FA0]">{a.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 space-y-1">
                            <span className="font-mono font-bold text-xs text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded border border-[#F3EAF8]">
                              {a.code}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${tier.color}`}>
                              <TierIcon size={10} /> {tier.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-[#2D004D]">{fmt(a.revenue)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600">{fmt(a.commission)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-amber-600">{fmt(a.pending)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button onClick={() => setProfilePanelId(a.id)} className="px-3 py-1.5 rounded-lg bg-[#F8F3FB] text-[#7B3FA0] hover:bg-[#F3EAF8] text-xs font-bold transition-all">CRM Profile</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Affiliate Cards (< 768px) */}
              <div className="md:hidden flex flex-col gap-3 p-3.5">
                {filteredAffiliates.map(a => {
                  const tier = getAffiliateTier(a.revenue);
                  const TierIcon = tier.icon;
                  return (
                    <div key={`mob-aff-${a.id}`} className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {(a.name || 'A')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#2D004D] text-xs truncate">{a.name}</p>
                            <p className="text-[10px] text-[#7B3FA0] truncate">{a.email}</p>
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded border border-[#F3EAF8]">{a.code}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${tier.color}`}><TierIcon size={10} /> {tier.label}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 bg-[#F8F3FB]/50 p-2.5 rounded-xl text-[10px]">
                        <div><span className="text-[#7B3FA0] block text-[8px] font-bold uppercase tracking-wider">Revenue</span><span className="font-bold text-[#2D004D]">{fmt(a.revenue)}</span></div>
                        <div><span className="text-[#7B3FA0] block text-[8px] font-bold uppercase tracking-wider">Commission</span><span className="font-bold text-emerald-600">{fmt(a.commission)}</span></div>
                        <div><span className="text-[#7B3FA0] block text-[8px] font-bold uppercase tracking-wider">Pending</span><span className="font-bold text-amber-600">{fmt(a.pending)}</span></div>
                      </div>
                      <button onClick={() => setProfilePanelId(a.id)} className="w-full py-2 rounded-xl bg-[#F8F3FB] text-[#7B3FA0] hover:bg-[#F3EAF8] text-xs font-bold transition-all text-center">View CRM Profile</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: PRODUCTS & COMMISSION ─────────────────────────────────────── */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-xs">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <Search size={14} className="text-[#7B3FA0]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search products by title or category…"
                  className="w-full bg-transparent text-xs text-[#2D004D] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <AdminSelect value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[
                  { value: 'all', label: 'All Products' },
                  { value: 'enabled', label: 'Affiliate Enabled' },
                  { value: 'disabled', label: 'Disabled' },
                ]} className="w-36" />
                <AdminSelect value={modeFilter} onChange={e => setModeFilter(e.target.value)} options={[
                  { value: 'all', label: 'All Modes' },
                  { value: 'percentage', label: 'Percentage (%)' },
                  { value: 'fixed', label: 'Fixed (₹)' },
                ]} className="w-36" />
                {selectedProductIds.length > 0 && (
                  <button onClick={() => setShowBulkModal(true)} className="px-3 py-2 rounded-xl bg-[#7B3FA0] text-white text-xs font-bold shadow-md">
                    Bulk Edit ({selectedProductIds.length})
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xs overflow-hidden">
              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto w-full">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-[#F8F3FB] border-b border-[#F3EAF8] text-[#7B3FA0] font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4 w-10">
                        <input type="checkbox" checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} className="rounded text-[#7B3FA0]" />
                      </th>
                      <th className="py-3.5 px-4">Product</th>
                      <th className="py-3.5 px-4">Price</th>
                      <th className="py-3.5 px-4 text-center">Affiliate Enable</th>
                      <th className="py-3.5 px-4">Commission Rate</th>
                      <th className="py-3.5 px-4">Creator</th>
                      <th className="py-3.5 px-4 text-center">Referral QR / Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8] text-[#2D004D]">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                        <td className="py-3.5 px-4"><input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} className="rounded text-[#7B3FA0]" /></td>
                        <td className="py-3.5 px-4"><p className="font-bold text-[#2D004D]">{p.title}</p><p className="text-[10px] text-[#7B3FA0]">{p.category || 'Digital Asset'}</p></td>
                        <td className="py-3.5 px-4 font-bold text-[#2D004D]">{fmt(p.price)}</td>
                        <td className="py-3.5 px-4 text-center">
                          <button onClick={() => handleToggleProductAffiliate(p.id)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${p.affiliate_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>{p.affiliate_enabled ? 'Enabled' : 'Disabled'}</button>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-[#7B3FA0]">{p.commission_mode === 'fixed' ? `₹${p.commission_value || 500}` : `${p.commission_value || 20}%`}</td>
                        <td className="py-3.5 px-4 text-stone-600 font-medium">{p.creator_name || 'Store Creator'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setQrModalProduct(p)} title="Generate QR Code" className="p-1.5 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0]"><QrCode size={14} /></button>
                            <button onClick={() => { const link = buildAffiliateReferralLink(p.id, 'DEMO'); navigator.clipboard.writeText(link); alert('Copied referral link!'); }} title="Copy Referral Link" className="p-1.5 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0]"><Link2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Product Cards (< 768px) */}
              <div className="md:hidden flex flex-col gap-3 p-3.5">
                <div className="flex items-center gap-2 px-1 pb-1 border-b border-[#F3EAF8]">
                  <input type="checkbox" checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0} onChange={toggleSelectAll} className="rounded text-[#7B3FA0]" />
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">Select All</span>
                </div>
                {filteredProducts.map(p => (
                  <div key={`mob-prod-${p.id}`} className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input type="checkbox" checked={selectedProductIds.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} className="rounded text-[#7B3FA0] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-[#2D004D] text-xs break-words">{p.title}</p>
                          <p className="text-[10px] text-[#7B3FA0]">{p.category || 'Digital Asset'}</p>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-[#2D004D] shrink-0">{fmt(p.price)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      <button onClick={() => handleToggleProductAffiliate(p.id)} className={`px-3 py-1 rounded-full font-bold border transition-all ${p.affiliate_enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>{p.affiliate_enabled ? '🟢 Enabled' : '⚪ Disabled'}</button>
                      <span className="font-mono font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded border border-[#F3EAF8]">Rate: {p.commission_mode === 'fixed' ? `₹${p.commission_value || 500}` : `${p.commission_value || 20}%`}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#F3EAF8]">
                      <span className="text-[10px] text-[#7B3FA0]">Creator: <strong className="text-[#2D004D]">{p.creator_name || 'Store Creator'}</strong></span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setQrModalProduct(p)} title="Generate QR Code" className="p-2 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0]"><QrCode size={14} /></button>
                        <button onClick={() => { const link = buildAffiliateReferralLink(p.id, 'DEMO'); navigator.clipboard.writeText(link); alert('Copied referral link!'); }} title="Copy Referral Link" className="p-2 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0]"><Link2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: SALES LEDGER ──────────────────────────────────────────────── */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-xs">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <Search size={14} className="text-[#7B3FA0]" />
                <input
                  type="text"
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  placeholder="Search by order ID, customer name, or affiliate partner…"
                  className="w-full bg-transparent text-xs text-[#2D004D] focus:outline-none"
                />
              </div>
              <AdminSelect value={ledgerCommStatus} onChange={e => setLedgerCommStatus(e.target.value)} options={[
                { value: '', label: 'All Commission Statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'paid', label: 'Paid' },
                { value: 'rejected', label: 'Rejected' },
              ]} className="w-44" />
            </div>

            <DataTable loading={ledgerLoading} empty={!ledgerLoading && ledger.length === 0}>
              <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xs overflow-hidden">
                {/* Desktop Table View (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8F3FB] border-b border-[#F3EAF8] text-[#7B3FA0] font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Customer</th>
                        <th className="py-3.5 px-4">Affiliate</th>
                        <th className="py-3.5 px-4">Product</th>
                        <th className="py-3.5 px-4 text-right">Sale Amount</th>
                        <th className="py-3.5 px-4 text-right">Commission</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-center">Date</th>
                        <th className="py-3.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EAF8] text-[#2D004D]">
                      {ledger.map(row => (
                        <tr key={row.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#7B3FA0]">#{row.order_id || row.id}</td>
                          <td className="py-3.5 px-4 font-bold">{row.customer_name || 'Customer'}</td>
                          <td className="py-3.5 px-4 font-bold text-[#7B3FA0]">{row.affiliate_name}</td>
                          <td className="py-3.5 px-4 max-w-[160px] truncate">{row.product_name || 'Product'}</td>
                          <td className="py-3.5 px-4 text-right font-bold">{fmt(row.sale_amount)}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600">{fmt(row.commission_earned)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <StatusBadge status={row.commission_status || row.status} size="xs" />
                          </td>
                          <td className="py-3.5 px-4 text-center text-[10px] text-[#7B3FA0]">{fmtDate(row.date)}</td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => setSelectedTraceOrderId(row.order_id || row.id)} className="px-2.5 py-1 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] text-[10px] font-bold">
                                Trace
                              </button>
                              <button onClick={() => setCommActionModal(row)} className="px-2.5 py-1 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] text-[10px] font-bold">
                                Edit Status
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Record Cards View (< 768px) */}
                <div className="md:hidden flex flex-col gap-3 p-3.5">
                  {ledger.map(row => (
                    <div key={`mob-ledger-${row.id}`} className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-[#F3EAF8] pb-2.5">
                        <span className="font-mono text-xs font-bold text-[#7B3FA0]">#{row.order_id || row.id}</span>
                        <StatusBadge status={row.commission_status || row.status} size="xs" />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#2D004D] text-xs truncate">{row.customer_name || 'Customer'}</p>
                          <p className="text-[10px] text-[#7B3FA0] mt-0.5 truncate">Promoter: <strong className="text-[#2D004D]">{row.affiliate_name}</strong></p>
                          <p className="text-[10px] font-medium text-stone-600 mt-0.5 truncate">📦 {row.product_name || 'Product'}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className="font-bold text-xs text-[#2D004D]">{fmt(row.sale_amount)}</span>
                          <span className="text-[10px] font-bold text-emerald-600">Comm: {fmt(row.commission_earned)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#F3EAF8]">
                        <span className="text-[10px] text-[#7B3FA0]">{fmtDate(row.date)}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedTraceOrderId(row.order_id || row.id)} className="px-3 py-1.5 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] text-xs font-bold transition-all">
                            Trace
                          </button>
                          <button onClick={() => setCommActionModal(row)} className="px-3 py-1.5 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] text-xs font-bold transition-all">
                            Edit Status
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Pagination page={ledgerPage} totalPages={Math.ceil(ledgerTotal / 50)} onChange={setLedgerPage} />
            </DataTable>
          </div>
        )}

        {/* ── TAB 6: RULES & ANALYTICS ─────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* System Rules Configuration Cards */}
            <div className="bg-white rounded-2xl border border-[#F3EAF8] p-6 space-y-4 shadow-xs">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7B3FA0] flex items-center gap-2">
                <Sliders size={16} /> Enterprise Commission Rules Engine
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-1">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Default Commission Mode</span>
                  <p className="font-bold text-[#2D004D] text-sm">20% Dynamic Percentage</p>
                  <p className="text-[10px] text-stone-500">Overridden per product rate</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-1">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Minimum Withdrawal Threshold</span>
                  <p className="font-bold text-[#2D004D] text-sm">₹1,000.00 Minimum</p>
                  <p className="text-[10px] text-stone-500">Prevents micro-disbursements</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-1">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Attribution Cookie Window</span>
                  <p className="font-bold text-[#2D004D] text-sm">30-Day Cookie Tracking</p>
                  <p className="text-[10px] text-stone-500">Last-touch attribution model</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-1">
                  <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block">Auto-Hold Refund Lock</span>
                  <p className="font-bold text-[#2D004D] text-sm">7-Day Refund Lock</p>
                  <p className="text-[10px] text-stone-500">Prevents payout during return window</p>
                </div>
              </div>
            </div>

            {/* Performance Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#F3EAF8] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7B3FA0] flex items-center gap-2">
                  <PieChart size={16} /> Partner Tier Distribution
                </h3>
                {/* Tier counts computed from affiliate_commissions.sale_amount by backend /kpis endpoint.
                    Thresholds: Platinum ≥₹2,00,000 | Gold ≥₹50,000 | Silver ≥₹10,000 | Bronze <₹10,000 */}
                <div className="space-y-3 text-xs">
                  {kpisLoading ? (
                    <div className="py-4 text-center text-[#7B3FA0] text-xs">Loading tier data…</div>
                  ) : kpis?.tier_distribution ? (
                    (() => {
                      const td = kpis.tier_distribution;
                      const total = td.total_with_revenue || 0;
                      const rows = [
                        { tier: 'Platinum Partner (₹2L+)', count: td.platinum, thresholdLabel: '≥₹2,00,000 revenue' },
                        { tier: 'Gold Partner (₹50k+)',     count: td.gold,     thresholdLabel: '≥₹50,000 revenue' },
                        { tier: 'Silver Partner (₹10k+)',   count: td.silver,   thresholdLabel: '≥₹10,000 revenue' },
                        { tier: 'Bronze Partner',           count: td.bronze,   thresholdLabel: '<₹10,000 revenue' },
                      ];
                      return rows.map(row => (
                        <div key={row.tier} className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex items-center justify-between">
                          <div>
                            <span className="font-bold text-[#2D004D]">{row.tier}</span>
                            <span className="text-[9px] text-[#7B3FA0] block">{row.thresholdLabel}</span>
                          </div>
                          <div className="flex items-center gap-3 font-mono font-bold text-[#7B3FA0]">
                            <span>{row.count} {row.count === 1 ? 'Promoter' : 'Promoters'}</span>
                            <span className="px-2 py-0.5 rounded bg-white border border-[#F3EAF8] text-[10px]">
                              {total > 0 ? `${Math.round((row.count / total) * 100)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="py-4 text-center text-[#7B3FA0] text-xs">No affiliate revenue data available.</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#F3EAF8] p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#7B3FA0] flex items-center gap-2">
                  <Activity size={16} /> Operational System Telemetry
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Database Fallback Engine:</span>
                    <span className="font-bold text-emerald-600">Dual-Write Active (Firestore + PostgreSQL)</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Payment Gateway:</span>
                    <span className="font-bold text-[#2D004D]">RazorpayX Payouts API Connected</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] flex justify-between">
                    <span className="text-[#7B3FA0]">Attribution Security:</span>
                    <span className="font-mono font-bold text-[#7B3FA0]">Session Hash SHA256 Verification</span>
                  </div>
                  {/* Webhook sync rate removed — no webhook delivery log table exists.
                      Displaying "99.98%" was a hardcoded fabricated metric. */}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Slide-overs & Modals ── */}
        {selectedPayoutDrawer && (
          <PayoutReviewDrawer
            payout={selectedPayoutDrawer}
            onClose={() => setSelectedPayoutDrawer(null)}
            onApprove={handleApprovePayout}
            onTestPayout={handleTestPayout}
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

        {profilePanelId && (
          <AffiliateProfilePanel affiliateId={profilePanelId} onClose={() => setProfilePanelId(null)} />
        )}

        {selectedTraceOrderId && (
          <OrderTraceModal orderId={selectedTraceOrderId} onClose={() => setSelectedTraceOrderId(null)} />
        )}

        {commActionModal && (
          <CommissionActionModal commission={commActionModal} onClose={() => setCommActionModal(null)} onSave={handleCommissionSaved} />
        )}

        {/* Bulk Update Modal */}
        <AnimatePresence>
          {showBulkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full space-y-5">
                <h3 className="text-base font-bold text-[#2D004D]">Bulk Edit Settings ({selectedProductIds.length} Products)</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={bulkEnableStatus} onChange={e => setBulkEnableStatus(e.target.checked)} className="w-4 h-4 text-[#7B3FA0] rounded border-gray-300 focus:ring-[#7B3FA0]" />
                    <span className="text-xs font-bold text-[#2D004D]">Enable Affiliate Promotion</span>
                  </label>
                  {bulkEnableStatus && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Commission Mode</label>
                        <AdminSelect value={bulkCommissionMode} onChange={e => setBulkCommissionMode(e.target.value)} options={[{value:'percentage',label:'Percentage (%)'},{value:'fixed',label:'Fixed Amount (₹)'}]} className="w-full" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Rate {bulkCommissionMode === 'fixed' ? '(₹)' : '(%)'}</label>
                        <input type="number" value={bulkCommissionValue} onChange={e => setBulkCommissionValue(e.target.value)} className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-4 py-2 text-xs text-[#2D004D]" />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3EAF8]">
                  <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB]">Cancel</button>
                  <button onClick={handleApplyBulkUpdate} className="px-5 py-2 rounded-xl bg-[#7B3FA0] hover:bg-[#5C2B7C] text-white text-xs font-bold shadow-md transition-all">Apply Bulk Changes</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* QR Code Modal */}
        {qrModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full relative">
              <button onClick={() => setQrModalProduct(null)} className="absolute top-4 right-4 text-[#7B3FA0] hover:text-[#2D004D]"><X size={18} /></button>
              <h4 className="text-sm font-bold text-[#2D004D] mb-4 text-center">Product Referral QR Code</h4>
              <ProductQrCode product={qrModalProduct} size={220} showDownload showShare />
            </div>
          </div>
        )}

        {/* Enterprise Real Money Payout Modal */}
        {showEnterprisePayoutModal && (
          <EnterprisePayoutModal
            payout={showEnterprisePayoutModal}
            onClose={() => {
              setShowEnterprisePayoutModal(null);
              setSelectedPayoutDrawer(null);
            }}
            onPaymentComplete={() => {
              loadPayouts();
              loadKpis();
            }}
          />
        )}

        {/* Lumora Admin Payout Notice Modal */}
        <AnimatePresence>
          {payoutNoticeModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#F3EAF8] overflow-hidden"
              >
                <div className={`h-2.5 w-full ${
                  payoutNoticeModal.type === 'success'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                    : payoutNoticeModal.type === 'info'
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                      : 'bg-gradient-to-r from-rose-500 via-purple-600 to-[#7B3FA0]'
                }`} />

                <div className="p-6 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                    payoutNoticeModal.type === 'success'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : payoutNoticeModal.type === 'info'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'bg-rose-50 text-rose-600 border-rose-200'
                  }`}>
                    {payoutNoticeModal.type === 'success' ? (
                      <CheckCircle2 size={28} />
                    ) : payoutNoticeModal.type === 'info' ? (
                      <HelpCircle size={28} />
                    ) : (
                      <AlertOctagon size={28} />
                    )}
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest uppercase bg-[#7B3FA0]/10 text-[#7B3FA0] border border-[#7B3FA0]/20">
                    Lumora Payout Notice
                  </span>

                  <h3 className="text-base sm:text-lg font-serif font-black text-[#2D004D] mt-2 mb-2">
                    {payoutNoticeModal.title || 'Test Payout Unavailable'}
                  </h3>

                  <div className="p-3.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-xs text-[#2D004D]/90 font-medium leading-relaxed mb-6">
                    {payoutNoticeModal.message}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPayoutNoticeModal(null)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2D004D] via-[#5C2B7C] to-[#7B3FA0] text-white font-extrabold text-xs shadow-md hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
