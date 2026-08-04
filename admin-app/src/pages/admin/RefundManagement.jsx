import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw, CheckCircle, XCircle, Clock, AlertCircle,
  Search, ChevronLeft, ChevronRight, RefreshCw, Eye,
  Download, Shield, CreditCard, Calendar, User, Package,
  AlertTriangle, Filter, X, Loader2
} from 'lucide-react';
import AdminLayout from './components/AdminLayout';
import { fetchAllRefunds, approveRefund, rejectRefund } from '../../services/refundService';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING:      { label: 'Pending',       color: '#D97706', bg: 'rgba(234,179,8,0.10)',  border: 'rgba(234,179,8,0.25)',   icon: <Clock size={12} /> },
  UNDER_REVIEW: { label: 'Under Review',  color: '#2563EB', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)',  icon: <Eye size={12} /> },
  APPROVED:     { label: 'Approved',      color: '#16A34A', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',   icon: <CheckCircle size={12} /> },
  PROCESSING:   { label: 'Processing',    color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)',  icon: <RefreshCw size={12} /> },
  REFUNDED:     { label: 'Refunded',      color: '#059669', bg: 'rgba(5,150,105,0.10)',  border: 'rgba(5,150,105,0.25)',   icon: <CheckCircle size={12} /> },
  REJECTED:     { label: 'Rejected',      color: '#DC2626', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',   icon: <XCircle size={12} /> },
  FAILED:       { label: 'Failed',        color: '#DC2626', bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.25)',   icon: <AlertCircle size={12} /> },
  CANCELLED:    { label: 'Cancelled',     color: '#6B7280', bg: 'rgba(107,114,128,0.10)',border: 'rgba(107,114,128,0.25)', icon: <X size={12} /> },
};

const STATUS_TABS = ['ALL', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'REFUNDED', 'REJECTED'];

const CATEGORY_LABELS = {
  broken_file:      'Broken File',
  wrong_file:       'Wrong File',
  duplicate_charge: 'Duplicate Charge',
  other:            'Other',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px',
      borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function formatDate(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return dt; }
}

function formatCurrency(amount, currency = 'INR') {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RefundManagement() {
  const [refunds, setRefunds]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(null);
  const [activeTab, setActiveTab]       = useState('ALL');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 50;

  // Modal state
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [modalMode, setModalMode]           = useState(null); // 'detail' | 'approve' | 'reject'
  const [modalNotes, setModalNotes]         = useState('');
  const [actionLoading, setActionLoading]   = useState(false);
  const [actionError, setActionError]       = useState(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadRefunds = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    console.log(`[RefundManagement] Fetching refunds — tab: ${activeTab}, page: ${page}`);
    try {
      const status = activeTab === 'ALL' ? null : activeTab;
      const data = await fetchAllRefunds(status, page, PAGE_SIZE);
      setRefunds(data);
      console.log(`[RefundManagement] Fetched ${data.length} refund request(s)`);
    } catch (err) {
      console.error('[RefundManagement] Failed to fetch refunds:', err);
      setFetchError(err.message || 'Failed to load refund requests. Please try again.');
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => { loadRefunds(); }, [loadRefunds]);

  // Reset to page 1 when tab changes
  useEffect(() => { setPage(1); }, [activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openApprove = (refund) => {
    setSelectedRefund(refund);
    setModalNotes('');
    setActionError(null);
    setModalMode('approve');
  };

  const openReject = (refund) => {
    setSelectedRefund(refund);
    setModalNotes('');
    setActionError(null);
    setModalMode('reject');
  };

  const openDetail = (refund) => {
    setSelectedRefund(refund);
    setModalMode('detail');
    setActionError(null);
  };

  const closeModal = () => {
    setSelectedRefund(null);
    setModalMode(null);
    setModalNotes('');
    setActionError(null);
  };

  const handleApprove = async () => {
    if (!selectedRefund) return;
    setActionLoading(true);
    setActionError(null);
    console.log(`[RefundManagement] Approving refund TKT-${selectedRefund.id}`);
    try {
      await approveRefund(selectedRefund.id, modalNotes || null);
      console.log(`[RefundManagement] Refund TKT-${selectedRefund.id} approved successfully`);
      closeModal();
      loadRefunds();
    } catch (err) {
      console.error(`[RefundManagement] Approve failed for TKT-${selectedRefund.id}:`, err);
      setActionError(err.message || 'Failed to approve refund. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRefund) return;
    setActionLoading(true);
    setActionError(null);
    console.log(`[RefundManagement] Rejecting refund TKT-${selectedRefund.id}`);
    try {
      await rejectRefund(selectedRefund.id, modalNotes || null);
      console.log(`[RefundManagement] Refund TKT-${selectedRefund.id} rejected`);
      closeModal();
      loadRefunds();
    } catch (err) {
      console.error(`[RefundManagement] Reject failed for TKT-${selectedRefund.id}:`, err);
      setActionError(err.message || 'Failed to reject refund. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Search filter (client-side on fetched page) ────────────────────────────
  const filtered = refunds.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(r.id).includes(q) ||
      String(r.order_id).includes(q) ||
      (r.product_name || '').toLowerCase().includes(q) ||
      (r.reason_category || '').toLowerCase().includes(q) ||
      (r.details || '').toLowerCase().includes(q) ||
      (r.payment_id || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  });

  // ── Derived counts for tab badges ──────────────────────────────────────────
  const pendingCount = refunds.filter(r => r.status === 'PENDING').length;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardStyle = {
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)',
    borderRadius: '20px', border: '1px solid rgba(196,181,253,0.2)',
    boxShadow: '0 4px 24px rgba(90,30,126,0.04)',
  };

  const tableHeaderCell = {
    padding: '10px 14px', fontSize: '0.62rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E6AA8',
    borderBottom: '1px solid rgba(142,106,168,0.12)', whiteSpace: 'nowrap',
  };

  const tableCell = {
    padding: '12px 14px', fontSize: '0.78rem', color: '#2D004D',
    borderBottom: '1px solid rgba(142,106,168,0.07)', verticalAlign: 'middle',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout activePage="refunds">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em' }}>CUSTOMER REFUNDS</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 400, color: '#2D004D', marginTop: '2px', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              Refund Management
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#8E6AA8', marginTop: '4px' }}>
              Review, approve, or reject customer refund requests
            </p>
          </div>
          <button
            onClick={loadRefunds}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '12px', border: '1.5px solid rgba(123,63,160,0.2)',
              background: 'rgba(123,63,160,0.06)', color: '#7B3FA0',
              fontSize: '0.8rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1, transition: 'all 0.2s',
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* ── Status Tabs ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 700,
                background: activeTab === tab ? 'rgba(123,63,160,0.12)' : 'rgba(255,255,255,0.7)',
                color: activeTab === tab ? '#7B3FA0' : '#8E6AA8',
                border: activeTab === tab ? '1.5px solid rgba(123,63,160,0.25)' : '1.5px solid rgba(142,106,168,0.15)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {tab === 'ALL' ? 'All' : STATUS_CONFIG[tab]?.label || tab}
              {tab === 'PENDING' && pendingCount > 0 && activeTab === 'ALL' && (
                <span style={{ background: '#DC2626', color: '#fff', borderRadius: '999px', fontSize: '0.55rem', fontWeight: 800, padding: '1px 5px', lineHeight: 1.4 }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Search ── */}
        <div style={{ ...cardStyle, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search size={16} style={{ color: '#8E6AA8', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by ticket ID, order, product, reason, or payment ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: '0.82rem', color: '#2D004D',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8E6AA8' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Content ── */}
        <div style={cardStyle}>

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '60px 24px', color: '#8E6AA8', fontSize: '0.85rem' }}>
              <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              Loading refund requests...
            </div>
          )}

          {/* Error state — differentiated from empty */}
          {!loading && fetchError && (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <AlertTriangle size={32} style={{ color: '#DC2626', marginBottom: '12px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#DC2626', marginBottom: '8px' }}>Failed to Load Refund Requests</div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{fetchError}</div>
              <button
                onClick={loadRefunds}
                style={{ padding: '10px 24px', borderRadius: '12px', background: '#7B3FA0', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state — no refund requests (not an error) */}
          {!loading && !fetchError && filtered.length === 0 && (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(123,63,160,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <RotateCcw size={24} style={{ color: '#8E6AA8' }} />
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#2D004D', marginBottom: '8px' }}>
                {search ? 'No matching refund requests' : (activeTab === 'ALL' ? 'No refund requests yet' : `No ${STATUS_CONFIG[activeTab]?.label || activeTab} refunds`)}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#8E6AA8' }}>
                {search ? 'Try adjusting your search query.' : 'Customer refund requests will appear here when submitted.'}
              </div>
            </div>
          )}

          {/* Table */}
          {!loading && !fetchError && filtered.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                <thead>
                  <tr style={{ background: 'rgba(123,63,160,0.03)' }}>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Ticket</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Order</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Product</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Reason</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Status</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'left' }}>Submitted</th>
                    <th style={{ ...tableHeaderCell, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const canAct = ['PENDING', 'UNDER_REVIEW'].includes(r.status);
                    return (
                      <tr
                        key={r.id}
                        style={{ transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(123,63,160,0.025)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={tableCell}>
                          <span style={{ fontWeight: 700, color: '#7B3FA0', fontSize: '0.8rem' }}>TKT-{r.id}</span>
                        </td>
                        <td style={tableCell}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#4B5563' }}>
                            ORD-{r.order_id}
                          </span>
                        </td>
                        <td style={{ ...tableCell, maxWidth: '200px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 500, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.product_name || '—'}
                          </div>
                        </td>
                        <td style={tableCell}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7280', background: 'rgba(107,114,128,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                            {CATEGORY_LABELS[r.reason_category] || r.reason_category || '—'}
                          </span>
                        </td>
                        <td style={{ ...tableCell, textAlign: 'right', fontWeight: 700, color: '#2D004D' }}>
                          {formatCurrency(r.requested_amount, r.currency)}
                        </td>
                        <td style={tableCell}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td style={{ ...tableCell, fontSize: '0.72rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {formatDate(r.created_at)}
                        </td>
                        <td style={{ ...tableCell, textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <button
                              onClick={() => openDetail(r)}
                              title="View Details"
                              style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(142,106,168,0.2)', background: 'rgba(142,106,168,0.06)', color: '#7B3FA0', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={12} /> View
                            </button>
                            {canAct && (
                              <>
                                <button
                                  onClick={() => openApprove(r)}
                                  title="Approve Refund"
                                  style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.25)', background: 'rgba(22,163,74,0.08)', color: '#16A34A', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <CheckCircle size={12} /> Approve
                                </button>
                                <button
                                  onClick={() => openReject(r)}
                                  title="Reject Refund"
                                  style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.07)', color: '#DC2626', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <XCircle size={12} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {!loading && !fetchError && (refunds.length === PAGE_SIZE || page > 1) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid rgba(142,106,168,0.1)' }}>
              <span style={{ fontSize: '0.75rem', color: '#8E6AA8' }}>
                Page {page} — showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(142,106,168,0.2)', background: 'rgba(255,255,255,0.7)', color: page === 1 ? '#C4B5FD' : '#7B3FA0', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={refunds.length < PAGE_SIZE}
                  style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(142,106,168,0.2)', background: 'rgba(255,255,255,0.7)', color: refunds.length < PAGE_SIZE ? '#C4B5FD' : '#7B3FA0', cursor: refunds.length < PAGE_SIZE ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Detail / Approve / Reject Modal ── */}
        {selectedRefund && modalMode && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,0,30,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '620px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(45,0,77,0.2)', border: '1px solid rgba(196,181,253,0.3)' }}>

              {/* Modal header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(142,106,168,0.12)' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {modalMode === 'approve' ? 'Approve Refund' : modalMode === 'reject' ? 'Reject Refund' : 'Refund Details'}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D004D', marginTop: '2px' }}>
                    TKT-{selectedRefund.id} — ORD-{selectedRefund.order_id}
                  </div>
                </div>
                <button onClick={closeModal} style={{ background: 'rgba(142,106,168,0.08)', border: 'none', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7B3FA0' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Status + current state */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <StatusBadge status={selectedRefund.status} />
                  <span style={{ fontSize: '0.75rem', color: '#8E6AA8' }}>Submitted {formatDate(selectedRefund.created_at)}</span>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[
                    { icon: <Package size={14} />, label: 'Product', value: selectedRefund.product_name },
                    { icon: <CreditCard size={14} />, label: 'Amount Requested', value: formatCurrency(selectedRefund.requested_amount, selectedRefund.currency) },
                    { icon: <CreditCard size={14} />, label: 'Payment ID', value: selectedRefund.payment_id || '—' },
                    { icon: <Calendar size={14} />, label: 'Purchase Date', value: formatDate(selectedRefund.purchase_date) },
                    { icon: <Shield size={14} />, label: 'Downloaded', value: selectedRefund.is_downloaded ? `Yes (${selectedRefund.download_count}×)` : 'No' },
                    { icon: <AlertTriangle size={14} />, label: 'Reason', value: CATEGORY_LABELS[selectedRefund.reason_category] || selectedRefund.reason_category },
                  ].map(({ icon, label, value }) => (
                    <div key={label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.15)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8E6AA8', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        {icon} {label}
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D004D', wordBreak: 'break-all' }}>{value || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Customer details text */}
                {selectedRefund.details && (
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Customer Note</div>
                    <p style={{ fontSize: '0.82rem', color: '#2D004D', lineHeight: 1.6, margin: 0 }}>{selectedRefund.details}</p>
                  </div>
                )}

                {/* Existing admin notes (read-only in detail mode) */}
                {selectedRefund.admin_notes && (
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(123,63,160,0.05)', border: '1px solid rgba(123,63,160,0.15)' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Admin Notes</div>
                    <p style={{ fontSize: '0.82rem', color: '#2D004D', lineHeight: 1.6, margin: 0 }}>{selectedRefund.admin_notes}</p>
                  </div>
                )}

                {/* Notes input (approve / reject modes only) */}
                {(modalMode === 'approve' || modalMode === 'reject') && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2D004D', display: 'block', marginBottom: '8px' }}>
                      Admin Notes {modalMode === 'reject' ? '(recommended — reason for rejection)' : '(optional)'}
                    </label>
                    <textarea
                      value={modalNotes}
                      onChange={e => setModalNotes(e.target.value)}
                      rows={3}
                      placeholder={modalMode === 'reject' ? 'Explain why the refund is being rejected...' : 'Optional notes for the customer...'}
                      style={{ width: '100%', borderRadius: '12px', border: '1.5px solid rgba(142,106,168,0.2)', padding: '12px 14px', fontSize: '0.82rem', color: '#2D004D', background: 'rgba(255,255,255,0.9)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Action error */}
                {actionError && (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <AlertCircle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '0.8rem', color: '#DC2626' }}>{actionError}</span>
                  </div>
                )}

                {/* Modal action buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={closeModal}
                    disabled={actionLoading}
                    style={{ padding: '10px 20px', borderRadius: '12px', border: '1.5px solid rgba(142,106,168,0.2)', background: 'rgba(255,255,255,0.8)', color: '#7B3FA0', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                  >
                    {modalMode === 'detail' ? 'Close' : 'Cancel'}
                  </button>

                  {modalMode === 'approve' && (
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#16A34A', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: actionLoading ? 0.7 : 1 }}
                    >
                      {actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                      {actionLoading ? 'Approving…' : 'Approve Refund'}
                    </button>
                  )}

                  {modalMode === 'reject' && (
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      style={{ padding: '10px 24px', borderRadius: '12px', border: 'none', background: '#DC2626', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', opacity: actionLoading ? 0.7 : 1 }}
                    >
                      {actionLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <XCircle size={14} />}
                      {actionLoading ? 'Rejecting…' : 'Reject Refund'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  );
}
