/**
 * services/treasuryService.js
 * ----------------------------
 * Frontend API client for Platform Treasury.
 * Phase 1 (preserved) + Phase 2 (settlement workflow) calls.
 * All balance figures come from the backend — no frontend math.
 */

import { backendFetch } from '../utils/api';

// ── Phase 1 — Read endpoints ──────────────────────────────────────────────────

export const fetchTreasurySummary = async () => {
  const res = await backendFetch('/admin/treasury/summary');
  return res?.data || null;
};

export const fetchWithdrawalList = async (page = 1, pageSize = 20, status = null) => {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status) params.set('status', status);
  const res = await backendFetch(`/admin/treasury/withdrawals?${params}`);
  return res || { items: [], total: 0 };
};

export const fetchWithdrawalDetail = async (id) => {
  const res = await backendFetch(`/admin/treasury/withdrawals/${id}`);
  return res?.data || null;
};

export const fetchLedgerEntries = async (page = 1, pageSize = 50, ledgerType = null) => {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (ledgerType) params.set('ledger_type', ledgerType);
  const res = await backendFetch(`/admin/treasury/ledger?${params}`);
  return res || { items: [], total: 0 };
};

// ── Phase 2 — Timeline ────────────────────────────────────────────────────────

export const fetchTreasuryTimeline = async (page = 1, pageSize = 40) => {
  const params = new URLSearchParams({ page, page_size: pageSize });
  const res = await backendFetch(`/admin/treasury/timeline?${params}`);
  return res || { items: [], total: 0 };
};

// ── Phase 2 — Settlement mutations ────────────────────────────────────────────

export const requestSettlement = async (payload) => {
  const res = await backendFetch('/admin/treasury/settlement/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res;
};

export const approveSettlement = async (id) => {
  const res = await backendFetch(`/admin/treasury/settlement/${id}/approve`, {
    method: 'POST',
  });
  return res;
};

export const completeSettlement = async (id, transactionReference) => {
  const res = await backendFetch(`/admin/treasury/settlement/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ transaction_reference: transactionReference }),
  });
  return res;
};

export const cancelSettlement = async (id, reason = '') => {
  const res = await backendFetch(`/admin/treasury/settlement/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res;
};

// ── Formatters ────────────────────────────────────────────────────────────────

export const formatINR = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

export const fmtDateShort = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const STATUS_META = {
  pending:    { label: 'Pending',    bgClass: 'bg-amber-100',   textClass: 'text-amber-700' },
  approved:   { label: 'Approved',   bgClass: 'bg-indigo-100',  textClass: 'text-indigo-700' },
  processing: { label: 'Processing', bgClass: 'bg-blue-100',    textClass: 'text-blue-700' },
  completed:  { label: 'Completed',  bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' },
  failed:     { label: 'Failed',     bgClass: 'bg-red-100',     textClass: 'text-red-700' },
  cancelled:  { label: 'Cancelled',  bgClass: 'bg-stone-100',   textClass: 'text-stone-600' },
  rejected:   { label: 'Rejected',   bgClass: 'bg-red-100',     textClass: 'text-red-700' },
};

export const LEDGER_TYPE_LABELS = {
  revenue_earned:      'Revenue Earned',
  refund:              'Refund',
  commission_expense:  'Affiliate Commission',
  affiliate_expense:   'Affiliate Payout',
  platform_withdrawal: 'Settlement',
  chargeback:          'Chargeback',
  manual_adjustment:   'Manual Adjustment',
  vendor_adjustment:   'Vendor Adjustment',
};

export const LEDGER_TYPE_COLORS = {
  revenue_earned:      { bgClass: 'bg-emerald-100', textClass: 'text-emerald-700' },
  refund:              { bgClass: 'bg-red-100',     textClass: 'text-red-600' },
  commission_expense:  { bgClass: 'bg-orange-100',  textClass: 'text-orange-700' },
  affiliate_expense:   { bgClass: 'bg-pink-100',    textClass: 'text-pink-700' },
  platform_withdrawal: { bgClass: 'bg-blue-100',    textClass: 'text-blue-700' },
  chargeback:          { bgClass: 'bg-red-100',     textClass: 'text-red-600' },
  manual_adjustment:   { bgClass: 'bg-[#D8BFE3]/50',textClass: 'text-[#5A1E7E]' },
  vendor_adjustment:   { bgClass: 'bg-amber-100',   textClass: 'text-amber-700' },
};

export const DESTINATION_TYPES = [
  { value: 'bank_account', label: 'Bank Account (NEFT/RTGS)' },
  { value: 'upi',          label: 'UPI Transfer' },
  { value: 'internal',     label: 'Internal Account' },
  { value: 'other',        label: 'Other' },
];
