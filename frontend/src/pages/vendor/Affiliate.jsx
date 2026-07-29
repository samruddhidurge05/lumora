import React, { useState, useCallback } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import {
  useVendorAffiliateSummary,
  useVendorAffiliateProducts,
  updateVendorProductAffiliateSettings,
  useVendorProductAffiliatePerformance,
  useVendorAffiliateList,
  useVendorAffiliateDetail,
} from '../../hooks/useVendorData';

import {
  Package,
  Users,
  Wallet,
  Coins,
  BadgeDollarSign,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Settings2,
  Clock3,
  CircleDollarSign,
  FileBarChart,
  Receipt,
  MoreVertical,
  Search,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Check,
  X,
  ChevronRight,
  Eye,
  Filter,
  DollarSign,
  Percent,
  Layers,
  ArrowRight
} from 'lucide-react';

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function fmtCurrency(val) {
  const n = Number(val) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return val; }
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const map = {
    active: { bg: 'rgba(16,185,129,0.08)', color: '#10B981', border: 'rgba(16,185,129,0.25)', label: 'Active', icon: CheckCircle2 },
    enabled: { bg: 'rgba(16,185,129,0.08)', color: '#10B981', border: 'rgba(16,185,129,0.25)', label: 'Enabled', icon: CheckCircle2 },
    paid: { bg: 'rgba(16,185,129,0.08)', color: '#10B981', border: 'rgba(16,185,129,0.25)', label: 'Paid', icon: CheckCircle2 },
    completed: { bg: 'rgba(16,185,129,0.08)', color: '#10B981', border: 'rgba(16,185,129,0.25)', label: 'Completed', icon: CheckCircle2 },
    pending: { bg: 'rgba(245,158,11,0.08)', color: '#F59E0B', border: 'rgba(245,158,11,0.25)', label: 'Pending', icon: Clock },
    'queued for razorpayx': { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Queued', icon: Layers },
    'queued for razorpayx processing': { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Processing', icon: RefreshCw },
    processing: { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Processing', icon: RefreshCw },
    approved: { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Approved', icon: CheckCircle2 },
    'ready_for_payout': { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: 'rgba(59,130,246,0.25)', label: 'Approved', icon: CheckCircle2 },
    'awaiting queue': { bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.22)', label: 'Awaiting', icon: Clock3 },
    paused: { bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.22)', label: 'Paused', icon: AlertCircle },
    disabled: { bg: 'rgba(239,68,68,0.08)', color: '#EF4444', border: 'rgba(239,68,68,0.25)', label: 'Disabled', icon: XCircle },
    draft: { bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.22)', label: 'Draft', icon: FileBarChart },
    cancelled: { bg: 'rgba(239,68,68,0.08)', color: '#EF4444', border: 'rgba(239,68,68,0.25)', label: 'Cancelled', icon: XCircle },
    rejected: { bg: 'rgba(239,68,68,0.08)', color: '#EF4444', border: 'rgba(239,68,68,0.25)', label: 'Rejected', icon: XCircle },
  };

  const conf = map[s] || { bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.22)', label: status || 'Unknown', icon: Clock3 };
  const IconC = conf.icon;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: conf.bg, color: conf.color, border: `1px solid ${conf.border}`,
      letterSpacing: '0.01em', whiteSpace: 'nowrap'
    }}>
      <IconC size={12} />
      {conf.label}
    </span>
  );
}

function Skeleton({ width = '100%', height = 18, radius = 8 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonPulse 1.5s ease infinite',
    }} />
  );
}

// ─── Mini Sparkline Graphic ───────────────────────────────────────────────────

function Sparkline({ color = '#6C3CF0' }) {
  return (
    <svg width="60" height="24" viewBox="0 0 60 24" fill="none" style={{ opacity: 0.85 }}>
      <path d="M2 18 C 12 12, 18 20, 28 10 C 38 2, 46 14, 58 4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── 6 Premium KPI Summary Cards ──────────────────────────────────────────────

function SummaryCards({ summary, loading }) {
  const cards = [
    {
      label: 'Affiliate Products',
      value: loading ? null : String(summary?.affiliate_enabled_products ?? 0),
      icon: Package,
      sub: `${summary?.total_products ?? 0} total store products`,
      color: '#6C3CF0',
      bg: 'rgba(108,60,240,0.07)'
    },
    {
      label: 'Affiliate Orders',
      value: loading ? null : String(summary?.total_affiliate_sales ?? 0),
      icon: Coins,
      sub: 'Total orders attributed',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.07)'
    },
    {
      label: 'Gross Commission',
      value: loading ? null : fmtCurrency(summary?.total_commission),
      icon: BadgeDollarSign,
      sub: 'Total generated',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.07)'
    },
    {
      label: 'Pending Commission',
      value: loading ? null : fmtCurrency(summary?.pending_commission),
      icon: Clock3,
      sub: 'Awaiting settlement',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.07)'
    },
    {
      label: 'Paid Commission',
      value: loading ? null : fmtCurrency(summary?.paid_commission),
      icon: CircleDollarSign,
      sub: 'Settled to partners',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.07)'
    },
    {
      label: 'Active Affiliates',
      value: loading ? null : String(summary?.active_affiliates ?? 0),
      icon: Users,
      sub: `${summary?.conversion_rate ?? 0}% conv. rate`,
      color: '#6C3CF0',
      bg: 'rgba(108,60,240,0.07)'
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16, marginBottom: 32 }}>
      {cards.map((c, i) => {
        const IconComp = c.icon;
        return (
          <div key={i} className="luxury-card" style={{ padding: '22px 24px', transition: 'all 0.2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconComp size={20} />
              </div>
              <Sparkline color={c.color} />
            </div>
            {loading ? (
              <Skeleton height={32} width="70%" radius={8} />
            ) : (
              <div style={{ fontSize: 32, fontWeight: 700, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {c.value}
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 500, color: '#6B7280', marginTop: 8 }}>{c.label}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{c.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    affiliate_enabled: product.affiliate_enabled,
    commission_type: product.commission_type || 'percentage',
    commission_value: product.commission_value ?? 0,
    affiliate_cookie_days: product.affiliate_cookie_days ?? 30,
    affiliate_visibility: product.affiliate_visibility || 'public',
    affiliate_program_status: product.affiliate_program_status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateVendorProductAffiliateSettings(product.id, form);
      if (res && res.success !== false) {
        onSaved(res);
        onClose();
      } else {
        setError(res?.detail || 'Failed to save affiliate settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 480, borderRadius: 20, padding: 28, border: '1px solid #ECECEC', boxShadow: '0 20px 50px rgba(0,0,0,0.12)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Affiliate Program Settings</div>
          <button style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 4 }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 22 }}>{product.title}</div>

        {error && <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#EF4444', marginBottom: 16 }}>{error}</div>}

        {/* Affiliate Enabled Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: '#FAFAFB', borderRadius: 14, border: '1px solid #ECECEC', marginBottom: 18 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>Enable Affiliate Program</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Allow partners to promote this product</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
            <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }}
              checked={form.affiliate_enabled}
              onChange={e => setForm(f => ({ ...f, affiliate_enabled: e.target.checked }))} />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 24, transition: '0.2s',
              background: form.affiliate_enabled ? '#6C3CF0' : '#E5E7EB',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: form.affiliate_enabled ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#FFFFFF',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: '0.2s',
              }} />
            </span>
          </label>
        </div>

        {/* Commission Type */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Commission Structure</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['percentage', 'fixed'].map(t => (
              <button key={t} type="button"
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1.5px solid',
                  borderColor: form.commission_type === t ? '#6C3CF0' : '#ECECEC',
                  background: form.commission_type === t ? 'rgba(108,60,240,0.06)' : '#FFFFFF',
                  color: form.commission_type === t ? '#6C3CF0' : '#6B7280',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: '0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
                onClick={() => setForm(f => ({ ...f, commission_type: t }))}>
                {t === 'percentage' ? <Percent size={14} /> : <DollarSign size={14} />}
                {t === 'percentage' ? 'Percentage (%)' : 'Fixed Rate (₹)'}
              </button>
            ))}
          </div>
        </div>

        {/* Commission Value */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
            Commission {form.commission_type === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
          </label>
          <input type="number" className="luxury-input" min="0" step="0.01"
            value={form.commission_value}
            onChange={e => setForm(f => ({ ...f, commission_value: parseFloat(e.target.value) || 0 }))} />
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            {form.commission_type === 'percentage'
              ? `Partner earns ${form.commission_value}% per sale (₹${((product.price || 0) * (form.commission_value / 100)).toFixed(2)})`
              : `Partner earns ₹${form.commission_value} fixed per sale`}
          </div>
        </div>

        {/* Cookie Duration */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Attribution Cookie (days)</label>
          <input type="number" className="luxury-input" min="1" max="365"
            value={form.affiliate_cookie_days}
            onChange={e => setForm(f => ({ ...f, affiliate_cookie_days: parseInt(e.target.value) || 30 }))} />
        </div>

        {/* Program Status */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Program Status</label>
          <select className="luxury-select" value={form.affiliate_program_status}
            onChange={e => setForm(f => ({ ...f, affiliate_program_status: e.target.value }))}>
            <option value="active">Active — Accepting sales</option>
            <option value="paused">Paused — Temporarily suspended</option>
            <option value="draft">Draft — Internal configuration</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="luxury-btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button className="luxury-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Performance Drawer ───────────────────────────────────────────────

function ProductPerformanceDrawer({ productId, onClose }) {
  const { data, loading, error } = useVendorProductAffiliatePerformance(productId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 540, height: '100%', overflowY: 'auto', background: '#FFFFFF', borderLeft: '1px solid #ECECEC', padding: 32, boxShadow: '-10px 0 40px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>Performance Analytics</div>
          <button className="luxury-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onClose}><X size={16} /></button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>Loading performance data...</div>}
        {error && <div style={{ color: '#EF4444', padding: 16, background: 'rgba(239,68,68,0.06)', borderRadius: 12 }}>{error}</div>}

        {data && !loading && (
          <>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20 }}>{data.title}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Promoting Affiliates', value: data.affiliates_count ?? 0, icon: Users },
                { label: 'Total Clicks', value: data.total_clicks ?? 0, icon: TrendingUp },
                { label: 'Conversions', value: data.sales ?? 0, icon: Coins },
                { label: 'Conversion Rate', value: `${data.avg_conversion_rate ?? 0}%`, icon: Percent },
                { label: 'Gross Revenue', value: fmtCurrency(data.revenue_generated), icon: BadgeDollarSign },
                { label: 'Commission Owed', value: fmtCurrency(data.commission_owed), icon: Wallet },
                { label: 'Commission Paid', value: fmtCurrency(data.commission_paid), icon: CircleDollarSign },
                { label: 'Pending Payout', value: fmtCurrency(data.pending_commission), icon: Clock3 },
              ].map((m, i) => {
                const IconC = m.icon;
                return (
                  <div key={i} style={{ padding: '16px', background: '#FAFAFB', borderRadius: 14, border: '1px solid #ECECEC' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>{m.label}</span>
                      <IconC size={14} style={{ color: '#6C3CF0' }} />
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{m.value}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Top Partner Performers</div>
            {(data.top_affiliates || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: '#6B7280', background: '#FAFAFB', borderRadius: 14, border: '1px dashed #ECECEC' }}>
                <Users size={32} style={{ color: '#9CA3AF', marginBottom: 10 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>No affiliate sales for this product yet</div>
              </div>
            ) : (
              <div className="luxury-table-container">
                <table className="luxury-table">
                  <thead><tr><th>Rank</th><th>Affiliate</th><th>Sales</th><th>Earned</th></tr></thead>
                  <tbody>
                    {data.top_affiliates.map((a, i) => (
                      <tr key={i}>
                        <td style={{ color: '#6B7280', fontWeight: 600 }}>#{i + 1}</td>
                        <td style={{ fontWeight: 600, color: '#111827' }}>{a.name}</td>
                        <td>{a.sales}</td>
                        <td style={{ color: '#10B981', fontWeight: 700 }}>{fmtCurrency(a.commission_earned)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editingProduct, setEditingProduct] = useState(null);
  const [performanceProductId, setPerformanceProductId] = useState(null);
  const [productCache, setProductCache] = useState({});

  const { products, total, pages, loading, error, refresh } = useVendorAffiliateProducts({
    search, status: statusFilter, programStatus: programFilter, page, limit: 20
  });

  const handleSettingsSaved = useCallback((updatedSettings) => {
    setProductCache(prev => ({ ...prev, [updatedSettings.product_id]: updatedSettings }));
    refresh();
  }, [refresh]);

  return (
    <div>
      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input className="luxury-input" style={{ paddingLeft: 40 }}
            placeholder="Search products..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="luxury-select" style={{ minWidth: 160 }} value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Affiliate Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select className="luxury-select" style={{ minWidth: 160 }} value={programFilter}
          onChange={e => { setProgramFilter(e.target.value); setPage(1); }}>
          <option value="">All Program Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
        </select>
        <button className="luxury-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}
          onClick={() => { setSearch(''); setStatusFilter(''); setProgramFilter(''); setPage(1); }}>
          <SlidersHorizontal size={14} /> Reset
        </button>
      </div>

      {error && <div style={{ color: '#EF4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="luxury-card">
        {loading ? (
          <div style={{ padding: 24 }}>
            {[...Array(5)].map((_, i) => <div key={i} style={{ marginBottom: 16 }}><Skeleton height={48} /></div>)}
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Package size={48} style={{ color: '#D1D5DB', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>No affiliate products yet</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
              Enable affiliate marketing on a product to start receiving affiliate sales.
            </div>
          </div>
        ) : (
          <div className="luxury-table-container">
            <table className="luxury-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 240 }}>Product</th>
                  <th>Price</th>
                  <th>Affiliate</th>
                  <th>Commission</th>
                  <th>Sales</th>
                  <th>Pending</th>
                  <th>Paid</th>
                  <th>Queue Status</th>
                  <th>Program</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const cached = productCache[p.id] || {};
                  const aff = cached.affiliate_enabled ?? p.affiliate_enabled;
                  const commType = cached.commission_type || p.commission_type || 'percentage';
                  const commVal = cached.commission_value ?? p.commission_value ?? 0;
                  const progStatus = cached.affiliate_program_status || p.affiliate_program_status || 'active';
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {p.thumbnail ? (
                            <img src={p.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid #ECECEC' }} />
                          ) : (
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', flexShrink: 0 }}>
                              <Package size={18} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>{p.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{p.price}</td>
                      <td><StatusBadge status={aff ? 'enabled' : 'disabled'} /></td>
                      <td style={{ fontWeight: 700, color: '#6C3CF0' }}>
                        {commType === 'percentage' ? `${commVal}%` : `₹${commVal}`}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.affiliate_sales}</td>
                      <td style={{ color: '#F59E0B', fontWeight: 600 }}>{fmtCurrency(p.pending_commission)}</td>
                      <td style={{ color: '#10B981', fontWeight: 600 }}>{fmtCurrency(p.paid_commission)}</td>
                      <td><StatusBadge status={p.payout_queue_status} /></td>
                      <td><StatusBadge status={progStatus} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button className="luxury-icon-btn" onClick={() => setEditingProduct(p)} title="Affiliate Settings">
                            <Settings2 size={16} />
                          </button>
                          <button className="luxury-icon-btn" onClick={() => setPerformanceProductId(p.id)} title="View Performance">
                            <BarChart3 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid #ECECEC' }}>
            <button className="luxury-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Page {page} of {pages}</span>
            <button className="luxury-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {editingProduct && (
        <SettingsModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={handleSettingsSaved} />
      )}
      {performanceProductId && (
        <ProductPerformanceDrawer productId={performanceProductId} onClose={() => setPerformanceProductId(null)} />
      )}
    </div>
  );
}

// ─── Affiliate Detail Side Panel Drawer ───────────────────────────────────────

function AffiliateDetailDrawer({ affiliateId, affiliateName, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');
  const { detail, orders, ledger, withdrawals, loading, error } = useVendorAffiliateDetail(affiliateId);

  const sections = [
    { key: 'overview', label: 'Overview', icon: Users },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'orders', label: 'Orders', icon: Coins },
    { key: 'ledger', label: 'Ledger', icon: Receipt },
    { key: 'withdrawals', label: 'Withdrawals', icon: Wallet },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', backdropFilter: 'blur(6px)', zIndex: 3000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 700, height: '100%', overflowY: 'auto', background: '#FFFFFF', borderLeft: '1px solid #ECECEC', boxShadow: '-10px 0 40px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid #ECECEC', sticky: 'top', background: '#FFFFFF', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>{affiliateName}</div>
              {detail?.profile && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{detail.profile.email} · Ref Code: {detail.profile.referral_code}</div>}
            </div>
            <button className="luxury-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={onClose}><X size={16} /></button>
          </div>

          {/* Nav Tabs */}
          <div style={{ display: 'flex', gap: 8, marginTop: 18, overflowX: 'auto' }}>
            {sections.map(s => {
              const IconC = s.icon;
              const active = activeSection === s.key;
              return (
                <button key={s.key}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: active ? '#6C3CF0' : '#ECECEC',
                    background: active ? 'rgba(108,60,240,0.06)' : '#FFFFFF',
                    color: active ? '#6C3CF0' : '#6B7280',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.15s',
                    display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                  }}
                  onClick={() => setActiveSection(s.key)}>
                  <IconC size={13} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {loading && <div style={{ textAlign: 'center', padding: 48, color: '#6B7280' }}>Loading affiliate drawer...</div>}
          {error && <div style={{ color: '#EF4444', background: 'rgba(239,68,68,0.06)', borderRadius: 12, padding: '12px 16px', fontSize: 13 }}>{error}</div>}

          {!loading && detail && (
            <>
              {activeSection === 'overview' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                    {[
                      { label: 'Total Orders', value: detail.metrics?.total_orders ?? 0 },
                      { label: 'Products Promoted', value: detail.metrics?.total_promoted_products ?? 0 },
                      { label: 'Lifetime Revenue', value: fmtCurrency(detail.metrics?.lifetime_revenue) },
                      { label: 'Lifetime Commission', value: fmtCurrency(detail.metrics?.lifetime_commission) },
                      { label: 'Pending Commission', value: fmtCurrency(detail.metrics?.pending_commission) },
                      { label: 'Approved Commission', value: fmtCurrency(detail.metrics?.approved_commission) },
                      { label: 'Paid Commission', value: fmtCurrency(detail.metrics?.paid_commission) },
                      { label: 'Avg Order Value', value: fmtCurrency(detail.metrics?.avg_order_value) },
                    ].map((m, i) => (
                      <div key={i} style={{ padding: '16px', background: '#FAFAFB', borderRadius: 14, border: '1px solid #ECECEC' }}>
                        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Payment Queue Timeline Visual */}
                  <div style={{ padding: 20, borderRadius: 16, background: '#FAFAFB', border: '1px solid #ECECEC' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Settlement Pipeline Visual</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', position: 'relative' }}>
                      {[
                        { step: 'Pending', active: true },
                        { step: 'Approved', active: true },
                        { step: 'Queued', active: detail.queue_status.includes('RazorpayX') || detail.queue_status === 'Paid' },
                        { step: 'Processing', active: detail.queue_status.includes('RazorpayX') },
                        { step: 'Paid', active: detail.queue_status === 'Paid' },
                      ].map((st, i) => (
                        <React.Fragment key={i}>
                          <div style={{ textAlign: 'center', flex: 1, zIndex: 1 }}>
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%', margin: '0 auto 6px',
                              background: st.active ? '#6C3CF0' : '#E5E7EB', color: '#FFFFFF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700
                            }}>
                              {st.active ? '✓' : i + 1}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: st.active ? '#111827' : '#9CA3AF' }}>{st.step}</div>
                          </div>
                          {i < 4 && (
                            <div style={{ height: 2, flex: 1, background: st.active ? '#6C3CF0' : '#E5E7EB', marginTop: -14 }} />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'products' && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Products Promoted ({(detail.promoted_products || []).length})</div>
                  {(detail.promoted_products || []).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#6B7280', padding: 32 }}>No products promoted yet.</div>
                  ) : (
                    (detail.promoted_products || []).map(p => (
                      <div key={p.product_id} style={{ display: 'flex', gap: 14, padding: 16, marginBottom: 12, background: '#FAFAFB', borderRadius: 14, border: '1px solid #ECECEC', alignItems: 'center' }}>
                        {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{p.title}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {p.commission_type === 'percentage' ? `${p.commission_value}% commission` : `₹${p.commission_value} fixed`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#10B981', fontSize: 14 }}>{fmtCurrency(p.commission_generated)}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{p.sales} sales</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeSection === 'orders' && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Orders Generated ({orders.totals?.total_orders || 0})</div>
                  <div className="luxury-table-container" style={{ marginBottom: 16 }}>
                    <table className="luxury-table">
                      <thead>
                        <tr>
                          <th>Order ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Commission</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(orders.orders || []).map((o, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>#{o.order_id || o.commission_id}</td>
                            <td style={{ fontSize: 13, fontWeight: 500 }}>{o.customer_name}</td>
                            <td style={{ fontSize: 12 }}>{o.product_name}</td>
                            <td style={{ fontWeight: 600 }}>{fmtCurrency(o.price_paid)}</td>
                            <td style={{ color: '#10B981', fontWeight: 600 }}>{fmtCurrency(o.commission_generated)}</td>
                            <td><StatusBadge status={o.commission_status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Total Orders', val: orders.totals?.total_orders ?? 0 },
                      { label: 'Total Revenue', val: fmtCurrency(orders.totals?.total_revenue) },
                      { label: 'Total Commission', val: fmtCurrency(orders.totals?.total_commission) },
                    ].map((t, i) => (
                      <div key={i} style={{ padding: 14, background: '#FAFAFB', borderRadius: 12, border: '1px solid #ECECEC', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{t.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{t.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSection === 'ledger' && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Commission Ledger</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Immutable financial record sourced directly from database.</div>
                  <div className="luxury-table-container">
                    <table className="luxury-table">
                      <thead>
                        <tr>
                          <th>Ledger ID</th><th>Date</th><th>Product</th><th>Sale</th><th>Commission</th><th>Net</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ledger || []).map((row, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#6B7280' }}>{row.ledger_id}</td>
                            <td style={{ fontSize: 11 }}>{fmtDate(row.timestamp)}</td>
                            <td style={{ fontSize: 12 }}>{row.product_name}</td>
                            <td style={{ fontWeight: 600 }}>{fmtCurrency(row.sale_amount)}</td>
                            <td style={{ color: '#6C3CF0', fontWeight: 600 }}>{fmtCurrency(row.commission_amount)}</td>
                            <td style={{ color: '#10B981', fontWeight: 700 }}>{fmtCurrency(row.net_commission)}</td>
                            <td><StatusBadge status={row.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeSection === 'withdrawals' && (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Withdrawal Queue</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Read-only payout monitoring.</div>
                  {(withdrawals || []).map((w, i) => (
                    <div key={i} style={{ padding: 18, marginBottom: 12, borderRadius: 14, border: '1px solid #ECECEC', background: '#FAFAFB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{fmtCurrency(w.requested_amount)}</div>
                        <StatusBadge status={w.payout_queue_status} />
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <span>Requested: {fmtDate(w.request_date)}</span>
                        <span>UTR: {w.utr || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Affiliates Tab ───────────────────────────────────────────────────────────

function AffiliatesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);

  const { affiliates, total, pages, loading, error, refresh } = useVendorAffiliateList({ search, page, limit: 20 });

  return (
    <div>
      {/* Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input className="luxury-input" style={{ paddingLeft: 40 }}
            placeholder="Search affiliate name, email, or code..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button className="luxury-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={refresh}>
          <RefreshCw size={14} /> Refresh
        </button>
        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>{total} partner{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div style={{ color: '#EF4444', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="luxury-card">
        {loading ? (
          <div style={{ padding: 24 }}>
            {[...Array(6)].map((_, i) => <div key={i} style={{ marginBottom: 16 }}><Skeleton height={48} /></div>)}
          </div>
        ) : affiliates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <Users size={48} style={{ color: '#D1D5DB', marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>No affiliates found</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, maxWidth: 360, margin: '4px auto 0' }}>
              Enable affiliate marketing on products. Once partners start generating sales, they will appear here.
            </div>
          </div>
        ) : (
          <div className="luxury-table-container">
            <table className="luxury-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Affiliate</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Products</th>
                  <th>Orders</th>
                  <th>Gross Sales</th>
                  <th>Commission</th>
                  <th>Pending</th>
                  <th>Paid</th>
                  <th>Last Sale</th>
                  <th>Withdrawal</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.affiliate_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAffiliate(a)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(108,60,240,0.1)', color: '#6C3CF0', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {a.name[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{a.name}</div>
                          <div style={{ fontSize: 12, color: '#6B7280' }}>{a.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(a.joined_at)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.products_promoted}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.total_orders}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(a.gross_sales)}</td>
                    <td style={{ color: '#6C3CF0', fontWeight: 700 }}>{fmtCurrency(a.commission_earned)}</td>
                    <td style={{ color: '#F59E0B', fontWeight: 600 }}>{fmtCurrency(a.pending_commission)}</td>
                    <td style={{ color: '#10B981', fontWeight: 600 }}>{fmtCurrency(a.paid_commission)}</td>
                    <td style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(a.last_sale)}</td>
                    <td><StatusBadge status={a.withdrawal_status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="luxury-icon-btn" onClick={e => { e.stopPropagation(); setSelectedAffiliate(a); }}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '16px 24px', borderTop: '1px solid #ECECEC' }}>
            <button className="luxury-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>Page {page} of {pages}</span>
            <button className="luxury-btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {selectedAffiliate && (
        <AffiliateDetailDrawer
          affiliateId={selectedAffiliate.affiliate_id}
          affiliateName={selectedAffiliate.name}
          onClose={() => setSelectedAffiliate(null)}
        />
      )}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function Affiliate() {
  const [activeTab, setActiveTab] = useState('products');
  const { data: summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useVendorAffiliateSummary();

  const handleExport = () => {
    alert('Exporting Affiliate Data CSV...');
  };

  return (
    <VendorLayout activePage="affiliate">
      <style>{`
        body {
          background-color: #FAFAFB !important;
        }
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .luxury-card {
          background: #FFFFFF;
          border: 1px solid #ECECEC;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .luxury-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
        }
        .luxury-btn-primary {
          background: #6C3CF0;
          color: #FFFFFF;
          border: none;
          border-radius: 12px;
          padding: 10px 18px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .luxury-btn-primary:hover {
          background: #5b2ee0;
          box-shadow: 0 4px 14px rgba(108,60,240,0.25);
        }
        .luxury-btn-secondary {
          background: #FFFFFF;
          color: #111827;
          border: 1px solid #ECECEC;
          border-radius: 12px;
          padding: 10px 18px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .luxury-btn-secondary:hover {
          background: #FAFAFB;
          border-color: #D1D5DB;
        }
        .luxury-icon-btn {
          background: #FFFFFF;
          color: #6B7280;
          border: 1px solid #ECECEC;
          border-radius: 10px;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .luxury-icon-btn:hover {
          color: #6C3CF0;
          border-color: rgba(108,60,240,0.3);
          background: rgba(108,60,240,0.04);
        }
        .luxury-input, .luxury-select {
          width: 100%;
          background: #FFFFFF;
          border: 1px solid #ECECEC;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 14px;
          color: #111827;
          outline: none;
          transition: border-color 0.2s;
        }
        .luxury-input:focus, .luxury-select:focus {
          border-color: #6C3CF0;
          box-shadow: 0 0 0 3px rgba(108,60,240,0.1);
        }
        .luxury-table-container {
          overflow-x: auto;
        }
        .luxury-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .luxury-table th {
          padding: 14px 18px;
          font-size: 12px;
          font-weight: 700;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #ECECEC;
          background: #FAFAFB;
        }
        .luxury-table td {
          padding: 16px 18px;
          font-size: 14px;
          color: #111827;
          border-bottom: 1px solid #F3F4F6;
          transition: background 0.15s;
        }
        .luxury-table tr:hover td {
          background: #FAFAFB;
        }
        .segmented-btn {
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #6B7280;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .segmented-btn.active {
          background: #FFFFFF;
          color: #6C3CF0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
      `}</style>

      {/* --- TOP HEADER SECTION --- */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 48, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.05, margin: 0 }}>
              Affiliate Management
            </h1>
            <p style={{ fontSize: 16, color: '#6B7280', marginTop: 8, margin: '8px 0 0' }}>
              Configure product-level commission rates, track partner performance, and monitor payout settlements
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock3 size={14} /> Last synced just now
            </span>
            <button className="luxury-btn-secondary" onClick={refreshSummary}>
              <RefreshCw size={16} /> Refresh Data
            </button>
            <button className="luxury-btn-primary" onClick={handleExport}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {summaryError && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '14px 18px', marginBottom: 24, fontSize: 14, color: '#EF4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Could not refresh summary data: {summaryError}</span>
          <button className="luxury-btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={refreshSummary}>Retry</button>
        </div>
      )}

      {/* --- 6 PREMIUM KPI SUMMARY CARDS --- */}
      <SummaryCards summary={summary} loading={summaryLoading} />

      {/* --- MAIN CONTENT: SEGMENTED TAB CONTROLS --- */}
      <div style={{ background: '#F3F4F6', padding: 4, borderRadius: 12, display: 'inline-flex', gap: 4, marginBottom: 24 }}>
        <button className={`segmented-btn${activeTab === 'products' ? ' active' : ''}`} onClick={() => setActiveTab('products')}>
          <Package size={16} />
          Products Tab
        </button>
        <button className={`segmented-btn${activeTab === 'affiliates' ? ' active' : ''}`} onClick={() => setActiveTab('affiliates')}>
          <Users size={16} />
          Affiliates Tab
        </button>
      </div>

      {/* --- TAB CONTENT --- */}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'affiliates' && <AffiliatesTab />}
    </VendorLayout>
  );
}
