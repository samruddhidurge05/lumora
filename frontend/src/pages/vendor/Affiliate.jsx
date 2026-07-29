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
    active: { cls: 'v-badge-green', label: 'Active' },
    enabled: { cls: 'v-badge-green', label: 'Enabled' },
    paid: { cls: 'v-badge-green', label: 'Paid' },
    completed: { cls: 'v-badge-green', label: 'Completed' },
    pending: { cls: 'v-badge-yellow', label: 'Pending' },
    'queued for razorpayx': { cls: 'v-badge-blue', label: 'Queued for RazorpayX' },
    'queued for razorpayx processing': { cls: 'v-badge-blue', label: 'Queued for RazorpayX' },
    processing: { cls: 'v-badge-blue', label: 'Processing' },
    approved: { cls: 'v-badge-blue', label: 'Approved' },
    'ready_for_payout': { cls: 'v-badge-blue', label: 'Approved' },
    'awaiting queue': { cls: 'v-badge-gray', label: 'Awaiting Queue' },
    paused: { cls: 'v-badge-gray', label: 'Paused' },
    disabled: { cls: 'v-badge-gray', label: 'Disabled' },
    draft: { cls: 'v-badge-gray', label: 'Draft' },
    cancelled: { cls: 'v-badge-red', label: 'Cancelled' },
    rejected: { cls: 'v-badge-red', label: 'Rejected' },
    reversed: { cls: 'v-badge-red', label: 'Reversed' },
  };
  const conf = map[s] || { cls: 'v-badge-gray', label: status || 'Unknown' };
  return (
    <span className={`v-badge ${conf.cls}`}>
      <span className="v-badge-dot" />
      {conf.label}
    </span>
  );
}

function Skeleton({ width = '100%', height = 18, radius = 6 }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(168,85,247,0.08) 25%, rgba(168,85,247,0.15) 50%, rgba(168,85,247,0.08) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonPulse 1.4s ease infinite',
    }} />
  );
}

// ─── Overview Cards ───────────────────────────────────────────────────────────

function OverviewCards({ summary, loading }) {
  const cards = [
    { label: 'Affiliate Products', value: loading ? null : String(summary?.affiliate_enabled_products ?? 0), icon: '🛍️', sub: `of ${summary?.total_products ?? 0} total` },
    { label: 'Total Affiliate Sales', value: loading ? null : String(summary?.total_affiliate_sales ?? 0), icon: '🛒', sub: 'Orders via affiliates' },
    { label: 'Pending Commission', value: loading ? null : fmtCurrency(summary?.pending_commission), icon: '⏳', sub: 'Awaiting payout' },
    { label: 'Approved Commission', value: loading ? null : fmtCurrency(summary?.approved_commission), icon: '✅', sub: 'Ready for queue' },
    { label: 'Paid Commission', value: loading ? null : fmtCurrency(summary?.paid_commission), icon: '💸', sub: 'Settled to affiliates' },
    { label: 'Active Affiliates', value: loading ? null : String(summary?.active_affiliates ?? 0), icon: '👥', sub: `${summary?.conversion_rate ?? 0}% conversion` },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
      {cards.map((c, i) => (
        <div key={i} className="v-card" style={{ padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <span className="v-stat-badge neutral" style={{ fontSize: 11 }}>{c.sub}</span>
          </div>
          {loading
            ? <Skeleton height={28} width="80%" style={{ marginBottom: 6 }} />
            : <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--v-dark)', letterSpacing: '-0.5px' }}>{c.value}</div>
          }
          <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 4 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Affiliate Settings Modal ─────────────────────────────────────────────────

function AffiliateSettingsModal({ product, onClose, onSaved }) {
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
        setError(res?.detail || 'Failed to save settings');
      }
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="v-card v-card-pad" style={{ width: '100%', maxWidth: 480, borderRadius: 24, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontFamily: 'var(--v-serif)', fontSize: 18, fontWeight: 600, color: 'var(--v-dark)' }}>Affiliate Settings</div>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--v-text3)', marginBottom: 22 }}>{product.title}</div>

        {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

        {/* Affiliate Enabled Toggle */}
        <div className="v-field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'rgba(168,85,247,0.05)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.12)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v-dark)' }}>Affiliate Program</div>
            <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>Allow affiliates to promote this product</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
            <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }}
              checked={form.affiliate_enabled}
              onChange={e => setForm(f => ({ ...f, affiliate_enabled: e.target.checked }))} />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 24, transition: '0.2s',
              background: form.affiliate_enabled ? 'linear-gradient(135deg,#A855F7,#7B3FA0)' : 'rgba(0,0,0,0.15)',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: form.affiliate_enabled ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: '0.2s',
              }} />
            </span>
          </label>
        </div>

        {/* Commission Type */}
        <div className="v-field" style={{ marginTop: 16 }}>
          <label className="v-label">Commission Type</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['percentage', 'fixed'].map(t => (
              <button key={t} type="button"
                style={{
                  padding: '10px', borderRadius: 10, border: '2px solid',
                  borderColor: form.commission_type === t ? '#A855F7' : 'rgba(0,0,0,0.1)',
                  background: form.commission_type === t ? 'rgba(168,85,247,0.08)' : 'transparent',
                  color: form.commission_type === t ? '#A855F7' : 'var(--v-text3)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: '0.15s',
                }}
                onClick={() => setForm(f => ({ ...f, commission_type: t }))}>
                {t === 'percentage' ? '% Percentage' : '₹ Fixed Amount'}
              </button>
            ))}
          </div>
        </div>

        {/* Commission Value */}
        <div className="v-field">
          <label className="v-label">
            Commission {form.commission_type === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
          </label>
          <input type="number" className="v-input" min="0" step="0.01"
            max={form.commission_type === 'percentage' ? 70 : undefined}
            value={form.commission_value}
            onChange={e => setForm(f => ({ ...f, commission_value: parseFloat(e.target.value) || 0 }))} />
          <div className="v-field-hint">
            {form.commission_type === 'percentage'
              ? `Affiliate earns ${form.commission_value}% of each sale (₹${((product.price || 0) * (form.commission_value / 100)).toFixed(2)} on a ₹${product.price || 0} product)`
              : `Affiliate earns ₹${form.commission_value} fixed per sale`}
          </div>
        </div>

        {/* Cookie Duration */}
        <div className="v-field">
          <label className="v-label">Cookie Duration (days)</label>
          <input type="number" className="v-input" min="1" max="365"
            value={form.affiliate_cookie_days}
            onChange={e => setForm(f => ({ ...f, affiliate_cookie_days: parseInt(e.target.value) || 30 }))} />
          <div className="v-field-hint">How long affiliate attribution persists after a click</div>
        </div>

        {/* Visibility */}
        <div className="v-field">
          <label className="v-label">Program Visibility</label>
          <select className="v-select" value={form.affiliate_visibility}
            onChange={e => setForm(f => ({ ...f, affiliate_visibility: e.target.value }))}>
            <option value="public">Public — Visible to all affiliates</option>
            <option value="private">Private — Invitation only</option>
          </select>
        </div>

        {/* Program Status */}
        <div className="v-field">
          <label className="v-label">Program Status</label>
          <select className="v-select" value={form.affiliate_program_status}
            onChange={e => setForm(f => ({ ...f, affiliate_program_status: e.target.value }))}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="v-btn v-btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button className="v-btn v-btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Performance Drawer ───────────────────────────────────────────────

function ProductPerformanceDrawer({ productId, onClose }) {
  const { data, loading, error } = useVendorProductAffiliatePerformance(productId);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, height: '100%', overflowY: 'auto', background: 'var(--v-bg, #faf9f5)', borderLeft: '1px solid rgba(168,85,247,0.15)', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--v-serif)', fontSize: 20, fontWeight: 600 }}>Product Performance</div>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--v-text3)' }}>Loading performance data...</div>}
        {error && <div style={{ color: '#dc2626', padding: 16, background: 'rgba(239,68,68,0.06)', borderRadius: 10 }}>{error}</div>}

        {data && !loading && (
          <>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--v-dark)', marginBottom: 18 }}>{data.title}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Affiliates', value: data.affiliates_count ?? 0 },
                { label: 'Total Clicks', value: data.total_clicks ?? 0 },
                { label: 'Conversions', value: data.sales ?? 0 },
                { label: 'Conversion Rate', value: `${data.avg_conversion_rate ?? 0}%` },
                { label: 'Revenue Generated', value: fmtCurrency(data.revenue_generated) },
                { label: 'Commission Owed', value: fmtCurrency(data.commission_owed) },
                { label: 'Commission Paid', value: fmtCurrency(data.commission_paid) },
                { label: 'Pending Commission', value: fmtCurrency(data.pending_commission) },
              ].map((m, i) => (
                <div key={i} style={{ padding: '14px 16px', background: 'rgba(168,85,247,0.04)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.1)' }}>
                  <div style={{ fontSize: 12, color: 'var(--v-text3)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v-dark)' }}>{m.value}</div>
                </div>
              ))}
            </div>

            {(data.top_affiliates || []).length > 0 && (
              <>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--v-dark)', marginBottom: 12 }}>Top Affiliates</div>
                <div className="v-table-wrap">
                  <table className="v-table">
                    <thead><tr><th>#</th><th>Affiliate</th><th>Sales</th><th>Commission</th></tr></thead>
                    <tbody>
                      {data.top_affiliates.map((a, i) => (
                        <tr key={i}>
                          <td style={{ color: 'var(--v-text3)', fontWeight: 600 }}>#{i + 1}</td>
                          <td style={{ fontWeight: 500 }}>{a.name}</td>
                          <td>{a.sales}</td>
                          <td style={{ color: '#16a34a', fontWeight: 600 }}>{fmtCurrency(a.commission_earned)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {(data.top_affiliates || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--v-text3)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
                No affiliate sales for this product yet.
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
      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="v-input" style={{ flex: 1, minWidth: 200, maxWidth: 340 }}
          placeholder="Search products..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="v-select" style={{ minWidth: 160 }} value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Affiliate Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select className="v-select" style={{ minWidth: 160 }} value={programFilter}
          onChange={e => { setProgramFilter(e.target.value); setPage(1); }}>
          <option value="">All Program Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="draft">Draft</option>
        </select>
        <button className="v-btn v-btn-secondary v-btn-sm" onClick={refresh}>↻ Refresh</button>
      </div>

      {error && <div style={{ color: '#dc2626', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="v-card">
        {loading ? (
          <div style={{ padding: '40px 24px' }}>
            {[...Array(5)].map((_, i) => <div key={i} style={{ marginBottom: 16 }}><Skeleton height={44} /></div>)}
          </div>
        ) : products.length === 0 ? (
          <div className="v-empty">
            <div className="v-empty-icon">🛍️</div>
            <div className="v-empty-title">No products found</div>
            <div className="v-empty-sub">Adjust your filters or publish products to manage their affiliate settings.</div>
          </div>
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Product</th>
                  <th>Price</th>
                  <th>Affiliate</th>
                  <th>Commission</th>
                  <th>Sales</th>
                  <th>Pending</th>
                  <th>Paid</th>
                  <th>Queue Status</th>
                  <th>Program</th>
                  <th>Actions</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {p.thumbnail && (
                            <img src={p.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v-dark)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--v-text3)' }}>{p.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{p.price}</td>
                      <td>
                        <span className={`v-badge ${aff ? 'v-badge-green' : 'v-badge-gray'}`}>
                          <span className="v-badge-dot" />{aff ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--v-deep)' }}>
                        {commType === 'percentage' ? `${commVal}%` : `₹${commVal}`}
                      </td>
                      <td style={{ textAlign: 'center' }}>{p.affiliate_sales}</td>
                      <td style={{ color: '#d97706', fontWeight: 600 }}>{fmtCurrency(p.pending_commission)}</td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>{fmtCurrency(p.paid_commission)}</td>
                      <td>
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
                          background: p.payout_queue_status === 'Paid' ? 'rgba(22,163,74,0.1)'
                            : p.payout_queue_status.includes('RazorpayX') ? 'rgba(59,130,246,0.1)'
                            : 'rgba(0,0,0,0.06)',
                          color: p.payout_queue_status === 'Paid' ? '#16a34a'
                            : p.payout_queue_status.includes('RazorpayX') ? '#2563eb'
                            : 'var(--v-text3)',
                        }}>
                          {p.payout_queue_status}
                        </span>
                      </td>
                      <td><StatusBadge status={progStatus} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="v-btn v-btn-ghost v-btn-sm"
                            onClick={() => setEditingProduct(p)}
                            title="Edit affiliate settings">⚙ Edit</button>
                          <button className="v-btn v-btn-ghost v-btn-sm"
                            onClick={() => setPerformanceProductId(p.id)}
                            title="View affiliate performance">📊</button>
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button className="v-btn v-btn-ghost v-btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--v-text3)' }}>Page {page} of {pages}</span>
            <button className="v-btn v-btn-ghost v-btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingProduct && (
        <AffiliateSettingsModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={handleSettingsSaved}
        />
      )}
      {performanceProductId && (
        <ProductPerformanceDrawer
          productId={performanceProductId}
          onClose={() => setPerformanceProductId(null)}
        />
      )}
    </div>
  );
}

// ─── Affiliate Detail Drawer ──────────────────────────────────────────────────

function AffiliateDetailDrawer({ affiliateId, affiliateName, onClose }) {
  const [activeSection, setActiveSection] = useState('overview');
  const { detail, orders, ledger, withdrawals, loading, error, refresh } = useVendorAffiliateDetail(affiliateId);

  const sections = [
    { key: 'overview', label: '👤 Overview' },
    { key: 'products', label: '🛍️ Products' },
    { key: 'orders', label: '🛒 Orders' },
    { key: 'ledger', label: '📒 Commission Ledger' },
    { key: 'withdrawals', label: '💳 Withdrawals' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)', zIndex: 2000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 680, height: '100%', overflowY: 'auto', background: 'var(--v-bg, #faf9f5)', borderLeft: '1px solid rgba(168,85,247,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: '1px solid rgba(0,0,0,0.08)', position: 'sticky', top: 0, background: 'var(--v-bg, #faf9f5)', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: 'var(--v-serif)', fontSize: 20, fontWeight: 600, color: 'var(--v-dark)' }}>{affiliateName}</div>
              {detail?.profile && <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>{detail.profile.email} · {detail.profile.referral_code}</div>}
            </div>
            <button className="v-btn v-btn-ghost v-btn-sm" onClick={onClose}>✕ Close</button>
          </div>

          {/* Section Nav */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {sections.map(s => (
              <button key={s.key}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                  borderColor: activeSection === s.key ? '#A855F7' : 'rgba(0,0,0,0.1)',
                  background: activeSection === s.key ? 'rgba(168,85,247,0.08)' : 'transparent',
                  color: activeSection === s.key ? '#A855F7' : 'var(--v-text3)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: '0.15s',
                }}
                onClick={() => setActiveSection(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {loading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--v-text3)' }}>Loading affiliate data...</div>}
          {error && <div style={{ color: '#dc2626', background: 'rgba(239,68,68,0.06)', borderRadius: 10, padding: '12px 16px', fontSize: 13 }}>{error}</div>}

          {!loading && detail && (
            <>
              {/* Overview Section */}
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
                      <div key={i} style={{ padding: '14px 16px', background: 'rgba(168,85,247,0.04)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.1)' }}>
                        <div style={{ fontSize: 11, color: 'var(--v-text3)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v-dark)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Queue Status */}
                  <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontSize: 28 }}>💳</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1d4ed8' }}>Payout Queue Status</div>
                      <div style={{ fontSize: 13, color: '#1d4ed8', marginTop: 2, opacity: 0.8 }}>{detail.queue_status}</div>
                      {detail.last_payout && <div style={{ fontSize: 11, color: 'var(--v-text3)', marginTop: 4 }}>Last payout: {fmtDate(detail.last_payout)}</div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Products Section */}
              {activeSection === 'products' && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Products Promoted ({(detail.promoted_products || []).length})</div>
                  {(detail.promoted_products || []).length === 0
                    ? <div style={{ textAlign: 'center', color: 'var(--v-text3)', padding: 32 }}>No products promoted yet.</div>
                    : (detail.promoted_products || []).map(p => (
                      <div key={p.product_id} style={{ display: 'flex', gap: 14, padding: '16px', marginBottom: 12, background: 'rgba(168,85,247,0.04)', borderRadius: 14, border: '1px solid rgba(168,85,247,0.1)', alignItems: 'center' }}>
                        {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v-dark)' }}>{p.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>
                            {p.commission_type === 'percentage' ? `${p.commission_value}% commission` : `₹${p.commission_value} fixed`}
                            {' · '}<StatusBadge status={p.program_status} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>{fmtCurrency(p.commission_generated)}</div>
                          <div style={{ fontSize: 11, color: 'var(--v-text3)', marginTop: 2 }}>{p.sales} sales · {fmtCurrency(p.revenue)} rev</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}

              {/* Orders Section */}
              {activeSection === 'orders' && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>
                    Orders Generated ({orders.totals?.total_orders || 0})
                  </div>
                  {(orders.orders || []).length === 0
                    ? <div style={{ textAlign: 'center', color: 'var(--v-text3)', padding: 32 }}>No orders generated yet.</div>
                    : (
                      <>
                        <div className="v-table-wrap" style={{ marginBottom: 16 }}>
                          <table className="v-table">
                            <thead>
                              <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Product</th>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Commission</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(orders.orders || []).map((o, i) => (
                                <tr key={i}>
                                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--v-text3)' }}>#{o.order_id || o.commission_id}</td>
                                  <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{o.customer_name}</td>
                                  <td style={{ fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.product_name}</td>
                                  <td style={{ fontSize: 11, color: 'var(--v-text3)', whiteSpace: 'nowrap' }}>{fmtDate(o.purchase_date)}</td>
                                  <td style={{ fontWeight: 600 }}>{fmtCurrency(o.price_paid)}</td>
                                  <td style={{ color: '#16a34a', fontWeight: 600 }}>{fmtCurrency(o.commission_generated)}</td>
                                  <td><StatusBadge status={o.commission_status} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                          {[
                            { label: 'Total Orders', value: orders.totals?.total_orders ?? 0, plain: true },
                            { label: 'Total Revenue', value: fmtCurrency(orders.totals?.total_revenue) },
                            { label: 'Total Commission', value: fmtCurrency(orders.totals?.total_commission) },
                          ].map((t, i) => (
                            <div key={i} style={{ padding: '14px', background: 'rgba(168,85,247,0.06)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.12)', textAlign: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--v-text3)', marginBottom: 4 }}>{t.label}</div>
                              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--v-dark)' }}>{t.plain ? t.value : t.value}</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                </div>
              )}

              {/* Commission Ledger */}
              {activeSection === 'ledger' && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Commission Ledger</div>
                  <div style={{ fontSize: 12, color: 'var(--v-text3)', marginBottom: 16 }}>Immutable record — values sourced directly from database. No editing or deleting.</div>
                  {(ledger || []).length === 0
                    ? <div style={{ textAlign: 'center', color: 'var(--v-text3)', padding: 32 }}>No commission records yet.</div>
                    : (
                      <div className="v-table-wrap">
                        <table className="v-table">
                          <thead>
                            <tr>
                              <th>Ledger ID</th>
                              <th>Date</th>
                              <th>Product</th>
                              <th>Sale</th>
                              <th>Rate</th>
                              <th>Commission</th>
                              <th>Refund</th>
                              <th>Net</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ledger || []).map((row, i) => (
                              <tr key={i}>
                                <td style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--v-text3)' }}>{row.ledger_id}</td>
                                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(row.timestamp)}</td>
                                <td style={{ fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product_name}</td>
                                <td style={{ fontWeight: 600 }}>{fmtCurrency(row.sale_amount)}</td>
                                <td style={{ fontSize: 12, color: 'var(--v-text3)' }}>
                                  {row.commission_type === 'percentage' ? `${row.commission_rate}%` : `₹${row.commission_rate}`}
                                </td>
                                <td style={{ color: '#2563eb', fontWeight: 600 }}>{fmtCurrency(row.commission_amount)}</td>
                                <td style={{ color: row.refund > 0 ? '#dc2626' : 'var(--v-text3)' }}>{row.refund > 0 ? `-${fmtCurrency(row.refund)}` : '—'}</td>
                                <td style={{ color: '#16a34a', fontWeight: 700 }}>{fmtCurrency(row.net_commission)}</td>
                                <td><StatusBadge status={row.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              )}

              {/* Withdrawals Section */}
              {activeSection === 'withdrawals' && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Withdrawal & Payout Queue</div>
                  <div style={{ fontSize: 12, color: 'var(--v-text3)', marginBottom: 16 }}>Read-only monitoring. Vendor cannot approve, reject, or trigger payouts.</div>
                  {(withdrawals || []).length === 0
                    ? <div style={{ textAlign: 'center', color: 'var(--v-text3)', padding: 32 }}>No withdrawal requests yet.</div>
                    : (withdrawals || []).map((w, i) => (
                      <div key={i} style={{ padding: '18px 20px', marginBottom: 14, borderRadius: 14, border: '1px solid rgba(168,85,247,0.12)', background: 'rgba(168,85,247,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--v-text3)' }}>{w.payout_id}</div>
                            <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--v-dark)', marginTop: 4 }}>{fmtCurrency(w.requested_amount)}</div>
                          </div>
                          <StatusBadge status={w.payout_queue_status} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12, color: 'var(--v-text3)' }}>
                          <span>Requested: {fmtDate(w.request_date)}</span>
                          <span>Net Amount: {fmtCurrency(w.net_amount)}</span>
                          <span>Queue Status: <strong style={{ color: 'var(--v-dark)' }}>{w.payout_queue_status}</strong></span>
                          <span>Queue Pos: #{w.estimated_queue_position || '—'}</span>
                          {w.utr && <span>UTR: <code style={{ fontSize: 11 }}>{w.utr}</code></span>}
                          {w.failure_reason && <span style={{ color: '#dc2626', gridColumn: '1/-1' }}>Failure: {w.failure_reason}</span>}
                        </div>
                      </div>
                    ))
                  }
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
      {/* Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input className="v-input" style={{ flex: 1, maxWidth: 360 }}
          placeholder="Search by name, email, or code..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <button className="v-btn v-btn-secondary v-btn-sm" onClick={refresh}>↻ Refresh</button>
        <span style={{ fontSize: 13, color: 'var(--v-text3)', whiteSpace: 'nowrap' }}>{total} affiliate{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div style={{ color: '#dc2626', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="v-card">
        {loading ? (
          <div style={{ padding: '40px 24px' }}>
            {[...Array(6)].map((_, i) => <div key={i} style={{ marginBottom: 16 }}><Skeleton height={44} /></div>)}
          </div>
        ) : affiliates.length === 0 ? (
          <div className="v-empty">
            <div className="v-empty-icon">👥</div>
            <div className="v-empty-title">No affiliates yet</div>
            <div className="v-empty-sub">Enable affiliate programs on your products. Once affiliates start generating sales, they will appear here.</div>
          </div>
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Affiliate</th>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map(a => (
                  <tr key={a.affiliate_id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAffiliate(a)}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--v-dark)' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--v-text3)' }}>{a.email}</div>
                    </td>
                    <td><StatusBadge status={a.status} /></td>
                    <td style={{ fontSize: 12, color: 'var(--v-text3)', whiteSpace: 'nowrap' }}>{fmtDate(a.joined_at)}</td>
                    <td style={{ textAlign: 'center' }}>{a.products_promoted}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{a.total_orders}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(a.gross_sales)}</td>
                    <td style={{ color: '#7c3aed', fontWeight: 700 }}>{fmtCurrency(a.commission_earned)}</td>
                    <td style={{ color: '#d97706', fontWeight: 600 }}>{fmtCurrency(a.pending_commission)}</td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{fmtCurrency(a.paid_commission)}</td>
                    <td style={{ fontSize: 11, color: 'var(--v-text3)', whiteSpace: 'nowrap' }}>{fmtDate(a.last_sale)}</td>
                    <td>
                      <StatusBadge status={a.withdrawal_status} />
                    </td>
                    <td>
                      <button className="v-btn v-btn-ghost v-btn-sm"
                        onClick={e => { e.stopPropagation(); setSelectedAffiliate(a); }}>
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button className="v-btn v-btn-ghost v-btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ fontSize: 13, color: 'var(--v-text3)' }}>Page {page} of {pages}</span>
            <button className="v-btn v-btn-ghost v-btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>

      {/* Affiliate Detail Drawer */}
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

// ─── Main Affiliate Page ──────────────────────────────────────────────────────

export default function Affiliate() {
  const [activeTab, setActiveTab] = useState('products');
  const { data: summary, loading: summaryLoading, error: summaryError, refresh: refreshSummary } = useVendorAffiliateSummary();

  return (
    <VendorLayout activePage="affiliate" title="Affiliate Management"
      subtitle="Manage affiliate programs, commissions, and monitor partner performance">

      <style>{`
        @keyframes skeletonPulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .v-badge-blue { background: rgba(59,130,246,0.1); color: #2563eb; border: 1px solid rgba(59,130,246,0.25); }
        .v-badge-blue .v-badge-dot { background: #2563eb; }
      `}</style>

      {summaryError && (
        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ Could not load summary: {summaryError}</span>
          <button className="v-btn v-btn-ghost v-btn-sm" onClick={refreshSummary}>Retry</button>
        </div>
      )}

      {/* Overview Cards */}
      <OverviewCards summary={summary} loading={summaryLoading} />

      {/* Tab Navigation */}
      <div className="v-tabs" style={{ marginBottom: 24 }}>
        {[
          { key: 'products', label: '🛍️ Products', desc: 'Manage affiliate settings per product' },
          { key: 'affiliates', label: '👥 Affiliates', desc: 'Monitor affiliate partners & commissions' },
        ].map(t => (
          <button key={t.key}
            className={`v-tab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            title={t.desc}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'products' && <ProductsTab />}
      {activeTab === 'affiliates' && <AffiliatesTab />}
    </VendorLayout>
  );
}
