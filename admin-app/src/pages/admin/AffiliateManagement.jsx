import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Link2, QrCode, Search,
  Filter, Check, X, ChevronRight, RefreshCw, AlertCircle, ShieldAlert,
  ArrowUpRight, BarChart3, PieChart, Lock, Sliders, CheckSquare, Square,
  Layers, ExternalLink, Receipt, Wallet, Clock, Activity, Download,
  ChevronLeft, ChevronDown, Eye, MoreVertical, FileText, Award, Zap,
  ArrowDownToLine, UserCheck, Ban, Star, Target
} from 'lucide-react';

import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import ProductQrCode from '../../components/product/ProductQrCode';
import { buildAffiliateReferralLink, calculateCommission } from '../../utils/referralUtils';
import { backendFetch } from '../../utils/api';

// ── Color palette tokens ──────────────────────────────────────────────────────
const P  = '#7B3FA0';
const PD = '#2D004D';
const PL = '#F8F3FB';
const PB = '#F3EAF8';

// ── Utility helpers ───────────────────────────────────────────────────────────
const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

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

function StatusBadge({ status, size = 'sm' }) {
  const cfg = COMM_STATUS[status] || COMM_STATUS['pending'];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-bold border ${cfg.bg} ${cfg.text} ${cfg.border} ${size === 'xs' ? 'text-[9px]' : 'text-[10px]'}`}>
      {cfg.label}
    </span>
  );
}

// Mock data fallback for when backend is offline / empty
const MOCK_AFFILIATES = [
  { id: 1, name: 'Apex Media Studio', email: 'affiliate@apexmedia.com', code: 'AFF-0001', status: 'active', clicks: 1240, sales: 88, revenue: 142000, commission: 28400, pending: 4200, joined: '2026-01-15' },
  { id: 2, name: 'Digital Craft Reviews', email: 'contact@digitalcraft.io', code: 'AFF-0002', status: 'active', clicks: 890, sales: 45, revenue: 89000, commission: 17800, pending: 1200, joined: '2026-02-01' },
  { id: 3, name: 'UI/UX Hub India', email: 'partner@uiuxhub.in', code: 'AFF-0003', status: 'active', clicks: 2150, sales: 162, revenue: 295000, commission: 59000, pending: 8500, joined: '2025-11-20' },
  { id: 4, name: 'Creative Stack Labs', email: 'promo@creativestack.com', code: 'AFF-0004', status: 'suspended', clicks: 310, sales: 8, revenue: 12000, commission: 2400, pending: 0, joined: '2026-03-10' },
];

const MOCK_PRODUCTS = [
  { id: 1, title: 'Lumora Pro UI Kit', category: 'Graphics & UI', price: 999, status: 'published', affiliate_enabled: true, commission_mode: 'percentage', commission_value: 20, affiliate_cookie_days: 30, clicks: 420, sales: 34 },
  { id: 2, title: 'Atmospheric Shaders V2', category: '3D & Shaders', price: 1499, status: 'published', affiliate_enabled: true, commission_mode: 'percentage', commission_value: 25, affiliate_cookie_days: 30, clicks: 680, sales: 52 },
  { id: 3, title: 'Neumorphic Dashboard', category: 'Web Templates', price: 2499, status: 'published', affiliate_enabled: false, commission_mode: 'percentage', commission_value: 15, affiliate_cookie_days: 30, clicks: 0, sales: 0 },
  { id: 4, title: 'Cyberpunk Asset Pack', category: 'Game Assets', price: 799, status: 'published', affiliate_enabled: true, commission_mode: 'fixed', commission_value: 200, affiliate_cookie_days: 30, clicks: 150, sales: 12 },
];

// ── Small reusable KPI card ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`p-5 rounded-2xl border shadow-sm space-y-2 ${accent ? 'bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] border-transparent text-white' : 'bg-white border-[#F3EAF8]'}`}>
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
      <RefreshCw size={20} className="animate-spin mr-2" /><span className="text-sm font-medium">Loading…</span>
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

// ── Affiliate Profile Slide-over ──────────────────────────────────────────────
function AffiliateProfilePanel({ affiliateId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!affiliateId) return;
    setLoading(true);
    backendFetch(`/admin/affiliates/${affiliateId}/profile`)
      .then(r => r.json()).then(setProfile).catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [affiliateId]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#F3EAF8] bg-gradient-to-r from-[#7B3FA0] to-[#2D004D]">
            <div>
              <h2 className="text-base font-bold text-white">Affiliate Profile</h2>
              <p className="text-xs text-white/60">Full commission & engagement details</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw size={24} className="animate-spin text-[#7B3FA0]" />
            </div>
          ) : !profile ? (
            <div className="flex-1 flex items-center justify-center text-[#7B3FA0]/60">
              <p>Profile not found</p>
            </div>
          ) : (
            <div className="flex-1 p-6 space-y-6">
              {/* Identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] flex items-center justify-center text-white font-bold text-xl">
                  {(profile.name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-[#2D004D] text-base">{profile.name}</h3>
                  <p className="text-xs text-[#7B3FA0]">{profile.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded-lg">{profile.affiliate_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${profile.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      {profile.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
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

              {/* Earnings Breakdown */}
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Commission Breakdown</h4>
                {[
                  { label: 'Total Earned',  value: fmt(profile.commission_earned),  color: 'text-[#2D004D]' },
                  { label: 'Pending',       value: fmt(profile.commission_pending),  color: 'text-amber-600' },
                  { label: 'Paid',          value: fmt(profile.commission_paid),     color: 'text-emerald-600' },
                  { label: 'Rejected',      value: fmt(profile.commission_rejected), color: 'text-rose-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-[#7B3FA0]">{label}</span>
                    <span className={`text-xs font-bold ${color}`}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Payment Details */}
              {(profile.upi_id || profile.bank_name) && (
                <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Payment Details</h4>
                  {profile.upi_id && <div className="text-xs text-[#7B3FA0]">UPI: <span className="font-mono text-[#2D004D] font-bold">{profile.upi_id}</span></div>}
                  {profile.bank_name && <div className="text-xs text-[#7B3FA0]">Bank: <span className="font-bold text-[#2D004D]">{profile.bank_name} {profile.account_number}</span></div>}
                </div>
              )}

              {/* Top Products */}
              {profile.top_products?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Top Products Sold</h4>
                  {profile.top_products.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                      <span className="text-xs font-medium text-[#2D004D] truncate max-w-[180px]">{p.name}</span>
                      <span className="text-[10px] font-bold text-[#7B3FA0]">{p.count} sale{p.count !== 1 ? 's' : ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Commissions */}
              {profile.recent_commissions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Recent Commissions</h4>
                  {profile.recent_commissions.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[#F3EAF8]">
                      <div>
                        <p className="text-[10px] font-bold text-[#2D004D] truncate max-w-[150px]">{c.product_name || '—'}</p>
                        <p className="text-[9px] text-[#7B3FA0]">{fmtDate(c.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-600">{fmt(c.amount)}</p>
                        <StatusBadge status={c.status} size="xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dates */}
              <div className="text-[10px] text-[#7B3FA0] space-y-1 border-t border-[#F3EAF8] pt-4">
                <p>Joined: <span className="font-bold text-[#2D004D]">{fmtDate(profile.joined_date)}</span></p>
                <p>Last Active: <span className="font-bold text-[#2D004D]">{profile.last_active_at ? fmtDate(profile.last_active_at) : 'Never'}</span></p>
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
  const [notes, setNotes] = useState(commission?.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await backendFetch(`/admin/affiliates/commissions/${commission.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ commission_status: newStatus, admin_notes: notes }),
      });
      if (res.ok) onSave(commission.id, newStatus, notes);
    } catch (e) { console.error(e); }
    finally { setSaving(false); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#2D004D]">Update Commission #{commission?.id}</h3>
          <button onClick={onClose} className="text-[#7B3FA0] hover:text-[#2D004D]"><X size={18} /></button>
        </div>
        <div className="p-3 bg-[#F8F3FB] rounded-xl space-y-1">
          <p className="text-xs font-bold text-[#2D004D]">{commission?.product_name}</p>
          <p className="text-xs text-[#7B3FA0]">Affiliate: {commission?.affiliate_name} · {fmt(commission?.commission_earned)}</p>
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

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function AffiliateManagement() {
  const categories = ['Graphics & UI', 'Typography', 'Video Assets', 'Sound Design', '3D Artifacts'];

  // Active tab
  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview / KPIs ──────────────────────────────────────────────────────
  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // ── Products Matrix state ────────────────────────────────────────────────
  const [products, setProducts] = useState(MOCK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCommissionMode, setBulkCommissionMode] = useState('percentage');
  const [bulkCommissionValue, setBulkCommissionValue] = useState(20);
  const [bulkEnableStatus, setBulkEnableStatus] = useState(true);
  const [qrModalProduct, setQrModalProduct] = useState(null);

  // ── Promoters Table state ────────────────────────────────────────────────
  const [affiliates, setAffiliates] = useState(MOCK_AFFILIATES);
  const [affSearch, setAffSearch] = useState('');
  const [affStatusFilter, setAffStatusFilter] = useState('all');
  const [profilePanelId, setProfilePanelId] = useState(null);

  // ── Sales Ledger state ───────────────────────────────────────────────────
  const [ledger, setLedger] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerCommStatus, setLedgerCommStatus] = useState('');
  const [ledgerPurchaseStatus, setLedgerPurchaseStatus] = useState('');
  const [ledgerAffFilter, setLedgerAffFilter] = useState('');
  const [commActionModal, setCommActionModal] = useState(null);
  const PAGE_SIZE = 50;

  // ── Payout Queue state ───────────────────────────────────────────────────
  const [payouts, setPayouts] = useState([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutsTotal, setPayoutsTotal] = useState(0);
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('pending');

  // ── Product Performance state ────────────────────────────────────────────
  const [perfData, setPerfData] = useState([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfTotal, setPerfTotal] = useState(0);
  const [perfPage, setPerfPage] = useState(1);

  // ── Activity Timeline state ──────────────────────────────────────────────
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelinePage, setTimelinePage] = useState(1);

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const r = await backendFetch('/admin/affiliates/kpis');
      if (r.ok) setKpis(await r.json());
    } catch(e) {}
    finally { setKpisLoading(false); }
  }, []);

  const loadAffiliates = useCallback(async () => {
    try {
      const r = await backendFetch('/admin/affiliates/');
      if (r.ok) {
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) setAffiliates(d);
      }
    } catch(e) {}
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const r = await backendFetch('/admin/products');
      if (r.ok) {
        const d = await r.json();
        const items = Array.isArray(d) ? d : (d.products || d.items || []);
        if (items.length > 0) setProducts(items);
      }
    } catch(e) {}
  }, []);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({ page: ledgerPage, page_size: PAGE_SIZE });
      if (ledgerSearch) params.append('search', ledgerSearch);
      if (ledgerCommStatus) params.append('commission_status', ledgerCommStatus);
      if (ledgerPurchaseStatus) params.append('purchase_status', ledgerPurchaseStatus);
      if (ledgerAffFilter) params.append('affiliate_id', ledgerAffFilter);
      const r = await backendFetch(`/admin/affiliates/commissions?${params}`);
      if (r.ok) { const d = await r.json(); setLedger(d.items || []); setLedgerTotal(d.total || 0); }
    } catch(e) {}
    finally { setLedgerLoading(false); }
  }, [ledgerPage, ledgerSearch, ledgerCommStatus, ledgerPurchaseStatus, ledgerAffFilter]);

  const loadPayouts = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const params = new URLSearchParams({ page: payoutsPage, page_size: 50 });
      if (payoutStatusFilter) params.append('payout_status', payoutStatusFilter);
      const r = await backendFetch(`/admin/affiliates/payouts?${params}`);
      if (r.ok) { const d = await r.json(); setPayouts(d.items || []); setPayoutsTotal(d.total || 0); }
    } catch(e) {}
    finally { setPayoutsLoading(false); }
  }, [payoutsPage, payoutStatusFilter]);

  const loadPerf = useCallback(async () => {
    setPerfLoading(true);
    try {
      const r = await backendFetch(`/admin/affiliates/products/performance?page=${perfPage}&page_size=50`);
      if (r.ok) { const d = await r.json(); setPerfData(d.items || []); setPerfTotal(d.total || 0); }
    } catch(e) {}
    finally { setPerfLoading(false); }
  }, [perfPage]);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const r = await backendFetch(`/admin/affiliates/activity?page=${timelinePage}&page_size=50`);
      if (r.ok) { const d = await r.json(); setTimeline(d.items || []); setTimelineTotal(d.total || 0); }
    } catch(e) {}
    finally { setTimelineLoading(false); }
  }, [timelinePage]);

  // Tab-driven data loading
  useEffect(() => {
    if (activeTab === 'overview') { loadKpis(); loadAffiliates(); loadProducts(); }
    else if (activeTab === 'affiliates') loadAffiliates();
    else if (activeTab === 'products') loadProducts();
    else if (activeTab === 'ledger') loadLedger();
    else if (activeTab === 'payouts') loadPayouts();
    else if (activeTab === 'performance') loadPerf();
    else if (activeTab === 'timeline') loadTimeline();
  }, [activeTab, loadKpis, loadAffiliates, loadProducts, loadLedger, loadPayouts, loadPerf, loadTimeline]);

  // Re-load ledger when filters change
  useEffect(() => { if (activeTab === 'ledger') loadLedger(); }, [ledgerPage, ledgerSearch, ledgerCommStatus, ledgerPurchaseStatus, ledgerAffFilter]);
  useEffect(() => { if (activeTab === 'payouts') loadPayouts(); }, [payoutsPage, payoutStatusFilter]);
  useEffect(() => { if (activeTab === 'performance') loadPerf(); }, [perfPage]);
  useEffect(() => { if (activeTab === 'timeline') loadTimeline(); }, [timelinePage]);

  // ── Derived / computed ─────────────────────────────────────────────────────
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

  const mockStats = useMemo(() => {
    const activeAffs = affiliates.filter(a => a.status === 'active');
    const enabledProds = products.filter(p => p.affiliate_enabled);
    const totalRev = affiliates.reduce((a, x) => a + x.revenue, 0);
    const totalComm = affiliates.reduce((a, x) => a + x.commission, 0);
    const pendingComm = affiliates.reduce((a, x) => a + x.pending, 0);
    const totalClicks = affiliates.reduce((a, x) => a + x.clicks, 0);
    const totalSales = affiliates.reduce((a, x) => a + x.sales, 0);
    return { enabledProductsCount: enabledProds.length, totalProductsCount: products.length, activeAffiliatesCount: activeAffs.length, totalRevenue: totalRev, totalCommission: totalComm, pendingCommission: pendingComm, totalClicks, totalSales, ctr: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : '0.0' };
  }, [products, affiliates]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggleProductAffiliate = id => setProducts(prev => prev.map(p => p.id === id ? { ...p, affiliate_enabled: !p.affiliate_enabled } : p));
  const toggleSelectProduct = id => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedProductIds(selectedProductIds.length === filteredProducts.length ? [] : filteredProducts.map(p => p.id));
  const handleApplyBulkUpdate = () => {
    if (!selectedProductIds.length) return;
    setProducts(prev => prev.map(p => selectedProductIds.includes(p.id) ? { ...p, affiliate_enabled: bulkEnableStatus, commission_mode: bulkCommissionMode, commission_value: Number(bulkCommissionValue) || 0 } : p));
    setShowBulkModal(false); setSelectedProductIds([]);
  };
  const handleToggleAffiliateStatus = id => setAffiliates(prev => prev.map(a => a.id === id ? { ...a, status: a.status === 'active' ? 'suspended' : 'active' } : a));
  const handleExportCSV = () => { window.open('/api/admin/affiliates/commissions/export/csv', '_blank'); };
  const handleCommissionSaved = (id, newStatus) => setLedger(prev => prev.map(c => c.id === id ? { ...c, commission_status: newStatus } : c));
  const handlePayoutAction = async (payoutId, newStatus) => {
    try {
      const r = await backendFetch(`/admin/affiliates/payouts/${payoutId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      if (r.ok) loadPayouts();
    } catch(e) {}
  };

  // ── Customer Attribution (LTV) state ──────────────────────────────────────
  const [custAttrs, setCustAttrs] = useState([]);
  const [custAttrsLoading, setCustAttrsLoading] = useState(false);
  const [custAttrsTotal, setCustAttrsTotal] = useState(0);
  const [custAttrsPage, setCustAttrsPage] = useState(1);
  const [custAttrsSearch, setCustAttrsSearch] = useState('');
  const [selectedTraceOrderId, setSelectedTraceOrderId] = useState(null);

  const loadCustAttrs = useCallback(async () => {
    setCustAttrsLoading(true);
    try {
      const q = new URLSearchParams({ page: custAttrsPage, page_size: 50 });
      if (custAttrsSearch) q.append('search', custAttrsSearch);
      const r = await backendFetch(`/admin/affiliates/customer-attributions?${q}`);
      if (r.ok) {
        const d = await r.json();
        setCustAttrs(d.items || []);
        setCustAttrsTotal(d.total || 0);
      }
    } catch(e) {}
    finally { setCustAttrsLoading(false); }
  }, [custAttrsPage, custAttrsSearch]);

  const handleExportCustAttrsCSV = () => {
    window.open('/api/admin/affiliates/customer-attributions/export/csv', '_blank');
  };

  // ── Tab definitions ────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',             label: 'Overview',              icon: BarChart3 },
    { id: 'products',             label: 'Products',              icon: ShoppingBag },
    { id: 'affiliates',           label: 'Promoters',             icon: Users },
    { id: 'customer-attribution', label: 'Customer Attribution',  icon: UserCheck },
    { id: 'orders-attribution',   label: 'Orders Attribution',    icon: ShoppingBag },
    { id: 'ledger',               label: 'Sales Ledger',          icon: Receipt },
    { id: 'payouts',              label: 'Payout Queue',          icon: Wallet },
    { id: 'performance',          label: 'Product Perf.',         icon: Target },
    { id: 'timeline',             label: 'Activity',              icon: Activity },
    { id: 'rules',                label: 'Rules',                 icon: Sliders },
    { id: 'analytics',            label: 'Analytics',             icon: PieChart },
  ];

  return (
    <AdminLayout activePage="affiliate-management">
      <div className="p-6 md:p-10 space-y-8 max-w-screen-2xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex flex-col gap-4 border-b border-[#F3EAF8] pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] text-[10px] font-black tracking-widest uppercase">ENTERPRISE SYSTEM</span>
                <span className="text-xs text-[#7B3FA0] font-medium">Affiliate Operations Console</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-serif text-[#2D004D] font-bold">Affiliate Management</h1>
              <p className="text-xs text-[#7B3FA0] mt-1 max-w-2xl">Product-level affiliate promotion, commission lifecycle, payout queue, sales ledger, and product performance — all in one console.</p>
            </div>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D004D] text-white text-xs font-bold hover:bg-[#7B3FA0] transition-all shadow-md">
              <ArrowDownToLine size={14} /> Export CSV
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[#F8F3FB] border border-[#F3EAF8] overflow-x-auto">
            {TABS.map(tab => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap ${isActive ? 'bg-gradient-to-r from-[#7B3FA0] to-[#5C2B7C] text-white shadow-md' : 'text-[#7B3FA0] hover:bg-white/60'}`}>
                  <IconComp size={13} /><span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1: OVERVIEW
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {kpisLoading ? (
              <div className="flex items-center gap-2 text-[#7B3FA0]"><RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading KPIs…</span></div>
            ) : (
              <>
                {/* 10-card KPI grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <KpiCard label="Total Affiliates"     value={fmtN(kpis?.total_affiliates   ?? mockStats.activeAffiliatesCount)} icon={Users} />
                  <KpiCard label="Approved"             value={fmtN(kpis?.approved_affiliates ?? mockStats.activeAffiliatesCount)} sub="Active promoters" icon={UserCheck} />
                  <KpiCard label="Suspended"            value={fmtN(kpis?.suspended_affiliates ?? 0)} sub="Disabled accounts" icon={Ban} />
                  <KpiCard label="Affiliate Products"   value={fmtN(kpis?.enabled_products ?? mockStats.enabledProductsCount)} sub={`of ${mockStats.totalProductsCount} total`} icon={ShoppingBag} />
                  <KpiCard label="Total Clicks"         value={fmtN(kpis?.total_clicks ?? mockStats.totalClicks)} sub={`${fmtN(kpis?.unique_clicks ?? 0)} unique`} icon={ArrowUpRight} />
                  <KpiCard label="Conversions"          value={fmtN(kpis?.total_conversions ?? mockStats.totalSales)} sub={`${kpis?.conversion_rate ?? mockStats.ctr}% rate`} icon={Target} accent />
                  <KpiCard label="Revenue Generated"    value={fmt(kpis?.revenue_generated ?? mockStats.totalRevenue)} sub="Total affiliate-driven" icon={TrendingUp} />
                  <KpiCard label="Commission Pending"   value={fmt(kpis?.commission_pending ?? mockStats.pendingCommission)} sub="Awaiting approval/payout" icon={Clock} />
                  <KpiCard label="Commission Paid"      value={fmt(kpis?.commission_paid ?? mockStats.totalCommission)} sub={`Avg: ${fmt(kpis?.avg_commission ?? 0)}`} icon={DollarSign} />
                  <KpiCard label="Avg EPC"              value={`₹${kpis?.avg_epc ?? '0'}`} sub="Earnings per click" icon={Zap} />
                </div>

                {/* Top performers */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D] mb-4">Ecosystem Conversion Funnel</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Total Clicks',    value: fmtN(kpis?.total_clicks ?? mockStats.totalClicks) },
                        { label: 'Conversions',     value: fmtN(kpis?.total_conversions ?? mockStats.totalSales) },
                        { label: 'Conversion Rate', value: `${kpis?.conversion_rate ?? mockStats.ctr}%`, green: true },
                      ].map(({ label, value, green }) => (
                        <div key={label} className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-center">
                          <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">{label}</span>
                          <span className={`text-xl font-bold ${green ? 'text-emerald-600' : 'text-[#2D004D]'}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] text-white space-y-4 shadow-lg">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#D8BFE3]">Top Performers</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/70">Top Affiliate</span>
                        <span className="text-xs font-bold text-emerald-300">{kpis?.top_affiliate ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/70">Top Product</span>
                        <span className="text-xs font-bold text-emerald-300 truncate max-w-[130px]">{kpis?.top_product ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/70">Highest EPC</span>
                        <span className="text-xs font-bold text-emerald-300">₹{kpis?.avg_epc ?? 0}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs font-bold text-emerald-300">
                      <span>Backend Query Isolation</span><Check size={14} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2: PRODUCTS MATRIX (existing, preserved)
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
              {selectedProductIds.length > 0 && (
                <button onClick={() => setShowBulkModal(true)} className="px-4 py-2 rounded-xl bg-[#7B3FA0] text-white text-xs font-bold flex items-center gap-2 shadow-md hover:bg-[#5C2B7C] transition-all">
                  <Sliders size={14} /><span>Bulk Edit ({selectedProductIds.length})</span>
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4 w-10"><button onClick={toggleSelectAll}>{selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={16} className="text-[#7B3FA0]" /> : <Square size={16} className="text-[#7B3FA0]/40" />}</button></th>
                    <th className="p-4">Product</th><th className="p-4">Price</th><th className="p-4">Affiliate</th>
                    <th className="p-4">Commission</th><th className="p-4">Est. Earnings</th><th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {filteredProducts.map(prod => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    const est = calculateCommission(prod.price, prod.commission_mode, prod.commission_value);
                    return (
                      <tr key={prod.id} className={`hover:bg-[#F8F3FB]/50 transition-colors ${isSelected ? 'bg-[#F8F3FB]' : ''}`}>
                        <td className="p-4"><button onClick={() => toggleSelectProduct(prod.id)}>{isSelected ? <CheckSquare size={16} className="text-[#7B3FA0]" /> : <Square size={16} className="text-[#7B3FA0]/40" />}</button></td>
                        <td className="p-4 font-bold">{prod.title}<span className="block text-[10px] text-[#7B3FA0] font-normal">{prod.category}</span></td>
                        <td className="p-4 font-semibold">₹{prod.price}</td>
                        <td className="p-4">{prod.affiliate_enabled ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🟢 Enabled</span> : <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">⚪ Disabled</span>}</td>
                        <td className="p-4 font-medium">{prod.affiliate_enabled ? (prod.commission_mode === 'fixed' ? `Fixed ₹${prod.commission_value}` : `${prod.commission_value}%`) : <span className="text-gray-400">—</span>}</td>
                        <td className="p-4 font-bold text-emerald-600">{prod.affiliate_enabled ? `₹${est.toFixed(2)}` : '—'}</td>
                        <td className="p-4 text-right space-x-2">
                          <button onClick={() => handleToggleProductAffiliate(prod.id)} className="px-3 py-1.5 rounded-lg border border-[#F3EAF8] hover:bg-white text-[11px] font-bold text-[#7B3FA0] transition-all">{prod.affiliate_enabled ? 'Disable' : 'Enable'}</button>
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
            TAB 3: PROMOTERS TABLE (existing + clickable profile slide-over)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                <input type="text" value={affSearch} onChange={e => setAffSearch(e.target.value)} placeholder="Search name, email, code…"
                  className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]" />
              </div>
              <AdminSelect value={affStatusFilter} onChange={e => setAffStatusFilter(e.target.value)} options={[{value:'all',label:'All Statuses'},{value:'active',label:'Active'},{value:'suspended',label:'Suspended'}]} className="w-36" />
            </div>
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4">Promoter / Email</th><th className="p-4">Code</th><th className="p-4">Status</th>
                    <th className="p-4">Clicks</th><th className="p-4">Sales</th><th className="p-4">Commission</th>
                    <th className="p-4">Pending</th><th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {filteredAffiliates.map(aff => (
                    <tr key={aff.id} className="hover:bg-[#F8F3FB]/50 transition-colors cursor-pointer" onClick={() => setProfilePanelId(aff.id)}>
                      <td className="p-4 font-bold">{aff.name}<span className="block text-[10px] text-[#7B3FA0] font-normal">{aff.email}</span></td>
                      <td className="p-4 font-mono font-bold text-[#7B3FA0]">{aff.code || aff.affiliateCode}</td>
                      <td className="p-4">{aff.status === 'active' ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span> : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Suspended</span>}</td>
                      <td className="p-4 font-medium">{fmtN(aff.clicks || aff.totalClicks)}</td>
                      <td className="p-4 font-medium">{fmtN(aff.sales || aff.totalConversions)}</td>
                      <td className="p-4 font-bold text-emerald-600">{fmt(aff.commission || aff.totalCommission)}</td>
                      <td className="p-4 font-semibold text-[#7B3FA0]">{fmt(aff.pending || 0)}</td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleToggleAffiliateStatus(aff.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${aff.status === 'active' ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                          {aff.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-3 border-t border-[#F3EAF8] text-[10px] text-[#7B3FA0]">Click a row to view full affiliate profile →</div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4: SALES LEDGER (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="relative min-w-[200px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                <input type="text" value={ledgerSearch} onChange={e => { setLedgerSearch(e.target.value); setLedgerPage(1); }} placeholder="Search order, product, affiliate, tx…"
                  className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]" />
              </div>
              <AdminSelect value={ledgerCommStatus} onChange={e => { setLedgerCommStatus(e.target.value); setLedgerPage(1); }} className="w-40" options={[
                {value:'',label:'All Statuses'},{value:'pending',label:'Pending'},{value:'approved',label:'Approved'},
                {value:'ready_for_payout',label:'Ready for Payout'},{value:'paid',label:'Paid'},
                {value:'reversed',label:'Reversed'},{value:'rejected',label:'Rejected'},
              ]} />
              <AdminSelect value={ledgerPurchaseStatus} onChange={e => { setLedgerPurchaseStatus(e.target.value); setLedgerPage(1); }} className="w-36" options={[
                {value:'',label:'All Purchases'},{value:'completed',label:'Completed'},{value:'refunded',label:'Refunded'},{value:'cancelled',label:'Cancelled'},
              ]} />
              <span className="text-xs text-[#7B3FA0] font-bold ml-auto">{fmtN(ledgerTotal)} records</span>
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <DataTable loading={ledgerLoading} empty={!ledgerLoading && ledger.length === 0}>
                <table className="w-full text-left text-xs text-[#2D004D] min-w-[1100px]">
                  <thead className="bg-[#F8F3FB] text-[9px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                    <tr>
                      <th className="p-3">Order</th><th className="p-3">Date</th><th className="p-3">Product</th>
                      <th className="p-3">Customer</th><th className="p-3">Affiliate</th><th className="p-3">Code</th>
                      <th className="p-3">Price</th><th className="p-3">Rate</th><th className="p-3">Commission</th>
                      <th className="p-3">Platform Rev.</th><th className="p-3">Comm. Status</th>
                      <th className="p-3">Purchase</th><th className="p-3">Refund</th><th className="p-3">TX ID</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8]">
                    {ledger.map(row => (
                      <tr key={row.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-[#7B3FA0]">#{row.order_id || row.id}</td>
                        <td className="p-3 whitespace-nowrap">{fmtDate(row.order_date)}</td>
                        <td className="p-3 font-medium max-w-[140px]"><span className="truncate block">{row.product_name}</span><span className="text-[9px] text-[#7B3FA0]">ID: {row.product_id}</span></td>
                        <td className="p-3">{row.customer_name}<span className="block text-[9px] text-[#7B3FA0]">{row.customer_email_masked}</span></td>
                        <td className="p-3 font-medium">{row.affiliate_name}</td>
                        <td className="p-3 font-mono text-[#7B3FA0] text-[10px]">{row.affiliate_code}</td>
                        <td className="p-3 font-semibold">{fmt(row.product_price)}</td>
                        <td className="p-3">{row.commission_type === 'fixed' ? `₹${row.commission_rate}` : `${row.commission_rate}%`}</td>
                        <td className="p-3 font-bold text-emerald-600">{fmt(row.commission_earned)}</td>
                        <td className="p-3 font-medium text-[#7B3FA0]">{fmt(row.platform_revenue)}</td>
                        <td className="p-3"><StatusBadge status={row.commission_status} /></td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${row.purchase_status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{row.purchase_status}</span></td>
                        <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${row.refund_status === 'none' ? 'bg-gray-50 text-gray-500 border-gray-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>{row.refund_status}</span></td>
                        <td className="p-3 font-mono text-[9px] text-[#7B3FA0] max-w-[100px]"><span className="truncate block" title={row.gateway_tx_id}>{row.gateway_tx_id || '—'}</span></td>
                        <td className="p-3 text-center">
                          <button onClick={() => setCommActionModal(row)} className="p-1.5 rounded-lg border border-[#F3EAF8] hover:bg-[#F8F3FB] text-[#7B3FA0]" title="Update Status"><MoreVertical size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              <div className="p-4 border-t border-[#F3EAF8]">
                <Pagination page={ledgerPage} totalPages={Math.ceil(ledgerTotal / PAGE_SIZE)} onChange={setLedgerPage} />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 5: PAYOUT QUEUE (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <AdminSelect value={payoutStatusFilter} onChange={e => { setPayoutStatusFilter(e.target.value); setPayoutsPage(1); }} className="w-40" options={[{value:'',label:'All Payouts'},{value:'pending',label:'Pending'},{value:'completed',label:'Completed'},{value:'rejected',label:'Rejected'}]} />
              <span className="text-xs text-[#7B3FA0] font-bold ml-auto">{fmtN(payoutsTotal)} payout requests</span>
            </div>
            <div className="space-y-4">
              <DataTable loading={payoutsLoading} empty={!payoutsLoading && payouts.length === 0}>
                {payouts.map(p => (
                  <div key={p.id} className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#2D004D] text-sm">{p.affiliate_name}</h3>
                        <span className="font-mono text-[10px] font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded-lg">{p.affiliate_code}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${p.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : p.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{p.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-[#7B3FA0]">
                        <span>Method: <strong className="text-[#2D004D]">{(p.method || 'UPI').toUpperCase()}</strong></span>
                        {p.upi_id && <span>UPI: <strong className="text-[#2D004D]">{p.upi_id}</strong></span>}
                        {p.bank_name && <span>Bank: <strong className="text-[#2D004D]">{p.bank_name}</strong></span>}
                        <span>Balance: <strong className="text-[#7B3FA0]">{fmt(p.pending_balance)}</strong></span>
                        <span>Requested: <strong className="text-[#2D004D]">{fmtDate(p.created_at)}</strong></span>
                      </div>
                      {p.notes && <p className="text-[10px] text-[#7B3FA0] italic">Note: {p.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xl font-serif font-bold text-[#2D004D]">{fmt(p.amount)}</p>
                      {p.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handlePayoutAction(p.id, 'completed')} className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition-all"><Check size={12} className="inline mr-1" />Mark Paid</button>
                          <button onClick={() => handlePayoutAction(p.id, 'rejected')} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 transition-all"><X size={12} className="inline mr-1" />Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </DataTable>
              <Pagination page={payoutsPage} totalPages={Math.ceil(payoutsTotal / 50)} onChange={setPayoutsPage} />
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 6: PRODUCT PERFORMANCE (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Affiliate-Enabled Products — Performance</h3>
              <span className="text-xs text-[#7B3FA0] font-bold">{fmtN(perfTotal)} products</span>
            </div>
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-x-auto">
              <DataTable loading={perfLoading} empty={!perfLoading && perfData.length === 0}>
                <table className="w-full text-left text-xs text-[#2D004D] min-w-[900px]">
                  <thead className="bg-[#F8F3FB] text-[9px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                    <tr>
                      <th className="p-4">Product</th><th className="p-4">Creator</th><th className="p-4">Price</th>
                      <th className="p-4">Commission</th><th className="p-4">Affiliates</th><th className="p-4">Clicks</th>
                      <th className="p-4">Conv.</th><th className="p-4">Conv. Rate</th><th className="p-4">Revenue</th>
                      <th className="p-4">Comm. Paid</th><th className="p-4">Comm. Pending</th><th className="p-4">Avg EPC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8]">
                    {perfData.map(p => (
                      <tr key={p.product_id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {p.thumbnail && <img src={p.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover border border-[#F3EAF8]" onError={e => e.target.style.display='none'} />}
                            <div><p className="font-bold text-[#2D004D] max-w-[140px] truncate">{p.product_name}</p><p className="text-[9px] text-[#7B3FA0]">ID: {p.product_id}</p></div>
                          </div>
                        </td>
                        <td className="p-4 text-[#7B3FA0]">{p.creator}</td>
                        <td className="p-4 font-semibold">{fmt(p.price)}</td>
                        <td className="p-4">{p.commission_mode === 'fixed' ? `₹${p.commission_value}` : `${p.commission_value}%`}</td>
                        <td className="p-4 font-bold text-[#7B3FA0]">{fmtN(p.affiliate_count)}</td>
                        <td className="p-4 font-medium">{fmtN(p.clicks)}</td>
                        <td className="p-4 font-medium">{fmtN(p.conversions)}</td>
                        <td className="p-4 font-bold text-emerald-600">{p.conversion_rate}%</td>
                        <td className="p-4 font-bold text-[#2D004D]">{fmt(p.revenue_generated)}</td>
                        <td className="p-4 font-bold text-emerald-600">{fmt(p.commission_paid)}</td>
                        <td className="p-4 font-semibold text-amber-600">{fmt(p.commission_pending)}</td>
                        <td className="p-4 font-bold text-[#7B3FA0]">₹{p.avg_epc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTable>
              <div className="p-4 border-t border-[#F3EAF8]">
                <Pagination page={perfPage} totalPages={Math.ceil(perfTotal / 50)} onChange={setPerfPage} />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 7: ACTIVITY TIMELINE (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Affiliate Activity Timeline</h3>
              <button onClick={loadTimeline} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F3EAF8] text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB]">
                <RefreshCw size={12} />Refresh
              </button>
            </div>
            <DataTable loading={timelineLoading} empty={!timelineLoading && timeline.length === 0}>
              <div className="space-y-2">
                {timeline.map((item, idx) => {
                  const actionIcons = { affiliate_enable: UserCheck, affiliate_disable: Ban, commission_approved: Check, commission_paid: DollarSign, commission_reversed: RefreshCw, payout_completed: Wallet, affiliate_commission_created: Receipt };
                  const IconComp = actionIcons[item.action] || Activity;
                  const colors = { affiliate_enable: 'bg-emerald-100 text-emerald-700', affiliate_disable: 'bg-rose-100 text-rose-700', commission_approved: 'bg-blue-100 text-blue-700', commission_paid: 'bg-emerald-100 text-emerald-700', commission_reversed: 'bg-amber-100 text-amber-700', payout_completed: 'bg-purple-100 text-purple-700', affiliate_commission_created: 'bg-indigo-100 text-indigo-700' };
                  return (
                    <div key={item.id} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-[#F3EAF8] shadow-sm hover:border-[#7B3FA0]/20 transition-colors">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[item.action] || 'bg-gray-100 text-gray-600'}`}>
                        <IconComp size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#2D004D]">{item.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                          <span className="text-[9px] text-[#7B3FA0] whitespace-nowrap">{fmtDateTime(item.created_at)}</span>
                        </div>
                        <p className="text-[10px] text-[#7B3FA0] mt-0.5">
                          {item.actor_name && <span className="font-medium text-[#2D004D]">{item.actor_name}</span>}
                          {item.target_type && <span> · {item.target_type} #{item.target_id}</span>}
                        </p>
                        {item.metadata && <p className="text-[9px] text-[#7B3FA0]/70 mt-0.5 font-mono truncate">{item.metadata}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataTable>
            <Pagination page={timelinePage} totalPages={Math.ceil(timelineTotal / 50)} onChange={setTimelinePage} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 8: COMMISSION RULES (existing, preserved)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'rules' && (
          <div className="bg-white p-8 rounded-2xl border border-[#F3EAF8] shadow-sm space-y-6 max-w-3xl">
            <h3 className="text-base font-bold uppercase tracking-wider text-[#2D004D] border-b border-[#F3EAF8] pb-3">Default System Commission Policies</h3>
            <div className="space-y-4 text-xs text-[#2D004D]">
              {[
                { title: 'Global Fallback Commission Rate: 20%', desc: 'When an affiliate-enabled product does not specify a custom rate, the promoter receives 20% of sale value.' },
                { title: 'Default Cookie Attribution Window: 30 Days', desc: 'Referral parameters (?ref=AFF-XXXX) are preserved in session and local browser state for up to 30 days prior to purchase.' },
                { title: 'Idempotency & Self-Referral Shield', desc: 'Affiliates purchasing products using their own referral code will have commission creation automatically suppressed by backend order validation.' },
                { title: 'Commission Lifecycle: Pending → Approved → Ready for Payout → Paid → Archived', desc: 'Admin can approve, reject, reverse or mark any commission paid via the Sales Ledger tab. All actions are audit logged.' },
                { title: 'Refund Protection', desc: 'If an order is refunded, the linked commission is automatically marked for reversal. Admin must confirm via the Sales Ledger → Update Status → Reversed.' },
              ].map(({ title, desc }) => (
                <div key={title} className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                  <span className="font-bold block mb-1">{title}</span>
                  <p className="text-[#7B3FA0]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 9: ANALYTICS (existing, preserved)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">Top Converting Products</h3>
              <div className="space-y-3">
                {products.slice(0, 4).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3FB]">
                    <span className="font-bold text-xs">{p.title}</span>
                    <span className="text-xs font-bold text-emerald-600">{p.sales || 0} sales</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">Top Performing Promoters</h3>
              <div className="space-y-3">
                {affiliates.slice(0, 4).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3FB]">
                    <span className="font-bold text-xs">{a.name} <span className="font-mono text-[10px] text-[#7B3FA0]">({a.code})</span></span>
                    <span className="text-xs font-bold text-emerald-600">{fmt(a.commission)} earned</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* ═══════════════════════════════════════════════════════════════════
            TAB 10: CUSTOMER ATTRIBUTION (LTV) (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'customer-attribution' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-2.5 text-[#7B3FA0]/60" />
                <input type="text" value={custAttrsSearch} onChange={e => setCustAttrsSearch(e.target.value)} placeholder="Search customer, email, code..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-[#2D004D] focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30" />
              </div>
              <button onClick={handleExportCustAttrsCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D004D] text-white text-xs font-bold hover:bg-[#7B3FA0] transition-all">
                <ArrowDownToLine size={13} /> Export LTV CSV
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden">
              <DataTable loading={custAttrsLoading} empty={custAttrs.length === 0}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8F3FB] border-b border-[#F3EAF8] text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Referred By Affiliate</th>
                        <th className="py-3 px-4">Referral Code</th>
                        <th className="py-3 px-4 text-center">Orders</th>
                        <th className="py-3 px-4 text-right">Customer LTV</th>
                        <th className="py-3 px-4">First Purchase</th>
                        <th className="py-3 px-4">Device / Browser</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EAF8] text-xs font-medium text-[#2D004D]">
                      {custAttrs.map(item => (
                        <tr key={item.attribution_id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                          <td className="py-3 px-4 font-bold">
                            <p>{item.customer_name}</p>
                            <p className="text-[10px] text-[#7B3FA0] font-mono">{item.customer_email}</p>
                          </td>
                          <td className="py-3 px-4 font-bold text-[#7B3FA0]">{item.affiliate_name}</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[10px] font-bold bg-[#F8F3FB] text-[#7B3FA0] px-2 py-0.5 rounded border border-[#F3EAF8]">
                              {item.affiliate_code}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{item.order_count}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">₹{item.customer_ltv?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-[10px] text-[#7B3FA0]">{fmtDate(item.first_purchase_date)}</td>
                          <td className="py-3 px-4 text-[10px] font-mono text-[#7B3FA0]">{item.device} • {item.browser}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={item.status === 'attributed' ? 'approved' : item.status} size="xs" />
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button onClick={() => setSelectedTraceOrderId(item.order_id)} className="p-1.5 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] font-bold text-[10px]">
                              View Trace
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTable>
            </div>
            <Pagination page={custAttrsPage} totalPages={Math.ceil(custAttrsTotal / 50)} onChange={setCustAttrsPage} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 11: ORDERS ATTRIBUTION (NEW)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'orders-attribution' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden">
              <DataTable loading={ledgerLoading} empty={ledger.length === 0}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8F3FB] border-b border-[#F3EAF8] text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Affiliate</th>
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4 text-right">Order Value</th>
                        <th className="py-3 px-4 text-right">Commission</th>
                        <th className="py-3 px-4 text-center">Commission Status</th>
                        <th className="py-3 px-4 text-center">Date</th>
                        <th className="py-3 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3EAF8] text-xs font-medium text-[#2D004D]">
                      {ledger.map(row => (
                        <tr key={row.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#7B3FA0]">#{row.order_id || row.id}</td>
                          <td className="py-3 px-4 font-bold">{row.customer_name || 'Customer'}</td>
                          <td className="py-3 px-4 font-bold text-[#7B3FA0]">{row.affiliate_name}</td>
                          <td className="py-3 px-4 max-w-[160px] truncate">{row.product_name || 'Product'}</td>
                          <td className="py-3 px-4 text-right font-bold">₹{row.sale_amount?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600">₹{row.commission_earned?.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <StatusBadge status={row.commission_status || row.status} size="xs" />
                          </td>
                          <td className="py-3 px-4 text-center text-[10px] text-[#7B3FA0]">{fmtDate(row.date)}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => setSelectedTraceOrderId(row.order_id || row.id)} className="px-2 py-1 rounded-lg bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] text-[10px] font-bold">
                                Trace
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DataTable>
            </div>
            <Pagination page={ledgerPage} totalPages={Math.ceil(ledgerTotal / 50)} onChange={setLedgerPage} />
          </div>
        )}

        {/* ── Order Trace Modal ── */}
        <AnimatePresence>
          {selectedTraceOrderId && <OrderTraceModal orderId={selectedTraceOrderId} onClose={() => setSelectedTraceOrderId(null)} />}
        </AnimatePresence>

        {/* ── Bulk Update Modal ── */}
        <AnimatePresence>
          {showBulkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full space-y-5">
                <h3 className="text-base font-bold text-[#2D004D]">Bulk Edit Affiliate Settings ({selectedProductIds.length} Products)</h3>
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

        {/* ── QR Code Modal ── */}
        {qrModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full relative">
              <button onClick={() => setQrModalProduct(null)} className="absolute top-4 right-4 text-[#7B3FA0] hover:text-[#2D004D]"><X size={18} /></button>
              <h4 className="text-sm font-bold text-[#2D004D] mb-4 text-center">Product Referral QR Code</h4>
              <ProductQrCode product={qrModalProduct} size={220} showDownload showShare />
            </div>
          </div>
        )}

        {/* ── Commission Action Modal ── */}
        <AnimatePresence>
          {commActionModal && <CommissionActionModal commission={commActionModal} onClose={() => setCommActionModal(null)} onSave={handleCommissionSaved} />}
        </AnimatePresence>

        {/* ── Affiliate Profile Slide-over ── */}
        {profilePanelId && <AffiliateProfilePanel affiliateId={profilePanelId} onClose={() => setProfilePanelId(null)} />}

      </div>
    </AdminLayout>
  );
}
