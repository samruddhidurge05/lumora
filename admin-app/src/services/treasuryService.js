/**
 * services/treasuryService.js
 * ----------------------------
 * Frontend API client for Platform Treasury endpoints.
 * All balance figures come exclusively from the backend — no frontend math.
 */

import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// ── REST API calls ─────────────────────────────────────────────────────────

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

// ── Firestore realtime subscription ───────────────────────────────────────────
// Listens to the `platform_treasury` Firestore doc for instant dashboard updates
// written by the backend after any financial event.

export const subscribeToTreasurySummary = (callback) => {
  try {
    const docRef = doc(db, 'platform_treasury', 'summary');
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) callback(snap.data());
      },
      (err) => {
        console.warn('[treasuryService] Firestore treasury listener error:', err);
      }
    );
  } catch (e) {
    console.warn('[treasuryService] Failed to set up Firestore treasury listener:', e);
    return () => {};
  }
};

// ── Formatters ──────────────────────────────────────────────────────────────

export const formatINR = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const STATUS_META = {
  pending:    { label: 'Pending',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved:   { label: 'Approved',   color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
  processing: { label: 'Processing', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  completed:  { label: 'Completed',  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  failed:     { label: 'Failed',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  rejected:   { label: 'Rejected',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};
