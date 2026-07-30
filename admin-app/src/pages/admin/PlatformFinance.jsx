/**
 * PlatformFinance.jsx
 * --------------------
 * Platform Finance & Treasury page — Phase 1.
 *
 * Tabs:
 *   Overview     — KPI summary cards + accounting equation visualisation
 *   Ledger       — Immutable double-entry ledger (read-only)
 *   Withdrawals  — Withdrawal history + detail drawer
 *
 * Phase 2 additions (deferred):
 *   - Withdrawal Request modal (POST)
 *   - Approve/Complete/Cancel actions
 *   - Destination account management
 *   - PDF receipt export
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import {
  fetchTreasurySummary,
  fetchLedgerEntries,
  fetchWithdrawalList,
  fetchWithdrawalDetail,
  subscribeToTreasurySummary,
  formatINR,
  STATUS_META,
} from '../../services/treasuryService';
import { useAdminContext } from '../../context/AdminContext';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const TABS = [
  { id: 'overview',     label: 'Overview' },
  { id: 'ledger',       label: 'Ledger' },
  { id: 'withdrawals',  label: 'Withdrawals' },
];

const LEDGER_TYPE_LABELS = {
  revenue_earned:      'Revenue Earned',
  refund:              'Refund',
  commission_expense:  'Affiliate Commission',
  affiliate_expense:   'Affiliate Payout',
  platform_withdrawal: 'Platform Withdrawal',
  chargeback:          'Chargeback',
  manual_adjustment:   'Manual Adjustment',
  vendor_adjustment:   'Vendor Adjustment',
};

const LEDGER_COLORS = {
  revenue_earned:      '#34d399',
  refund:              '#f87171',
  commission_expense:  '#fb923c',
  affiliate_expense:   '#f472b6',
  platform_withdrawal: '#60a5fa',
  chargeback:          '#ef4444',
  manual_adjustment:   '#a78bfa',
  vendor_adjustment:   '#fbbf24',
};

// ── Small building blocks ────────────────────────────────────────────────────
const TabBar = ({ active, onChange }) => (
  <div style={{
    display: 'flex', gap: '4px', padding: '4px',
    background: 'rgba(255,255,255,0.05)', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.1)', width: 'fit-content',
  }}>
    {TABS.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{
        padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em',
        background: active === t.id ? 'rgba(167,139,250,0.25)' : 'transparent',
        color: active === t.id ? '#a78bfa' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.2s',
        boxShadow: active === t.id ? '0 0 16px rgba(167,139,250,0.2)' : 'none',
      }}>
        {t.label}
      </button>
    ))}
  </div>
);

const Badge = ({ status }) => {
  const meta = STATUS_META[status] || { label: status, color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' };
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: '8px',
      color: meta.color, background: meta.bg,
      border: `1px solid ${meta.color}44`,
    }}>{meta.label}</span>
  );
};

const Pill = ({ type }) => {
  const color = LEDGER_COLORS[type] || '#9ca3af';
  const label = LEDGER_TYPE_LABELS[type] || type;
  return (
    <span style={{
      fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '8px',
      color, background: `${color}18`, border: `1px solid ${color}33`,
    }}>{label}</span>
  );
};

const Skeleton = ({ h = 20, w = '100%', mb = 12 }) => (
  <div style={{
    height: h, width: w, borderRadius: 8,
    background: 'rgba(255,255,255,0.07)',
    marginBottom: mb,
    animation: 'pulse 1.4s ease-in-out infinite',
  }} />
);

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ summary, loading, reload }) {
  if (loading) return (
    <div style={{ padding: '24px 0' }}>
      <Skeleton h={32} mb={16} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[...Array(6)].map((_, i) => <Skeleton key={i} h={120} mb={0} />)}
      </div>
    </div>
  );

  if (!summary) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.35)' }}>
      No treasury data available yet.
    </div>
  );

  const rows = [
    { label: 'Platform Revenue (Gross)',   value: summary.platform_revenue,      color: '#a78bfa', note: 'Immutable — never changes' },
    { label: 'Affiliate Liability (−)',    value: -summary.affiliate_liability,   color: '#fb923c', note: 'Approved commissions owed' },
    { label: 'Pending Withdrawals (−)',    value: -summary.pending_withdrawals,   color: '#fbbf24', note: 'In-flight transfers' },
    { label: 'Completed Withdrawals (−)',  value: -summary.completed_withdrawals, color: '#60a5fa', note: 'Already transferred out' },
  ];

  return (
    <div>
      {/* Accounting equation panel */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px', padding: '28px', marginBottom: '28px',
      }}>
        <h3 style={{ margin: '0 0 24px', fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>
          Balance Formula
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {rows.map((row, i) => (
            <div key={row.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 0',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{row.label}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{row.note}</div>
              </div>
              <span style={{
                fontSize: '18px', fontWeight: 700,
                color: row.value >= 0 ? row.color : '#f87171',
              }}>
                {row.value >= 0 ? '' : '−'}{formatINR(Math.abs(row.value))}
              </span>
            </div>
          ))}
          {/* Result */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 0 0', borderTop: '2px solid rgba(52,211,153,0.3)',
          }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#34d399' }}>Available Balance</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Net Withdrawable: {formatINR(summary.net_withdrawable)} (after ₹{(summary.minimum_reserve || 0).toLocaleString('en-IN')} reserve)
              </div>
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>
              {formatINR(summary.available_balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
        {[
          { label: "Today's Revenue",     value: summary.today_revenue,               color: '#34d399' },
          { label: 'Month Withdrawn',     value: summary.current_month_withdrawn,      color: '#60a5fa' },
          { label: 'Net Earnings',        value: summary.net_platform_earnings,        color: '#c084fc' },
          { label: 'Ledger Entries',      value: summary.ledger_entries,              color: '#fbbf24', isCnt: true },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.04)', borderRadius: '16px',
            padding: '20px', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>
              {s.isCnt ? (s.value || 0).toLocaleString() : formatINR(s.value)}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Last withdrawal */}
      {summary.last_withdrawal && (
        <div style={{
          marginTop: '20px', padding: '16px 20px',
          background: 'rgba(96,165,250,0.06)', borderRadius: '14px',
          border: '1px solid rgba(96,165,250,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Last Successful Withdrawal</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              {formatINR(summary.last_withdrawal.amount)}
              <span style={{ marginLeft: 10, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                {summary.last_withdrawal.withdrawal_number}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            {fmtDate(summary.last_withdrawal.completed_at)}
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
        Computed at: {summary._meta?.computed_at ? fmtDate(summary._meta.computed_at) : '—'}
      </div>
    </div>
  );
}

// ── Ledger Tab ────────────────────────────────────────────────────────────────
function LedgerTab() {
  const [data, setData]       = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchLedgerEntries(page, 50, typeFilter || null);
      setData(res);
    } catch (e) {
      console.warn('[LedgerTab]', e);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil((data.total || 0) / 50);

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          style={{
            padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
            fontSize: 13, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">All Types</option>
          {Object.entries(LEDGER_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
          {data.total.toLocaleString()} entries
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['#', 'Type', 'Amount', 'Running Balance', 'Reference', 'Description', 'By', 'Date'].map(h => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: 'left',
                  color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11,
                  textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(8)].map((_, i) => (
                  <tr key={i}><td colSpan={8} style={{ padding: '12px' }}><Skeleton h={18} mb={0} /></td></tr>
                ))
              : data.items.map(row => (
                  <tr key={row.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>#{row.id}</td>
                    <td style={{ padding: '12px' }}><Pill type={row.ledger_type} /></td>
                    <td style={{ padding: '12px', fontWeight: 700, color: row.amount >= 0 ? '#34d399' : '#f87171', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {row.amount >= 0 ? '+' : ''}{formatINR(row.amount)}
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {formatINR(row.running_balance)}
                    </td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                      {row.reference_id ? `${row.reference_type}#${row.reference_id}` : '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.description || '—'}
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                      {row.created_by_name}
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', fontSize: 11 }}>
                      {fmtDate(row.created_at)}
                    </td>
                  </tr>
                ))
            }
            {!loading && data.items.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                No ledger entries yet. They will appear as orders are processed.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginBtnStyle(page === 1)}>
            ← Prev
          </button>
          <span style={{ padding: '8px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginBtnStyle(page === totalPages)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Withdrawals Tab ───────────────────────────────────────────────────────────
function WithdrawalsTab() {
  const [data, setData]         = useState({ items: [], total: 0 });
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail]     = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithdrawalList(page, 20, statusFilter || null);
      setData(res);
    } catch (e) {
      console.warn('[WithdrawalsTab]', e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setSelected(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const d = await fetchWithdrawalDetail(id);
      setDetail(d);
    } catch (e) {
      console.warn('[WithdrawalsTab] detail error', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalPages = Math.ceil((data.total || 0) / 20);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 24 }}>
      {/* List */}
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
              fontSize: 13, outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">All Statuses</option>
            {Object.keys(STATUS_META).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 'auto' }}>
            {(data.total || 0).toLocaleString()} records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Reference', 'Amount', 'Status', 'Requested By', 'Destination', 'Requested At'].map(h => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: 'left',
                    color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i}><td colSpan={6} style={{ padding: 12 }}><Skeleton h={18} mb={0} /></td></tr>
                  ))
                : data.items.map(row => (
                    <tr key={row.id}
                      onClick={() => openDetail(row.id)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: selected === row.id ? 'rgba(167,139,250,0.08)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (selected !== row.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={e => { if (selected !== row.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#a78bfa', fontSize: 12 }}>
                        {row.withdrawal_number}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                        {formatINR(row.amount)}
                      </td>
                      <td style={{ padding: '12px' }}><Badge status={row.status} /></td>
                      <td style={{ padding: '12px', color: 'rgba(255,255,255,0.7)' }}>{row.requested_by_name}</td>
                      <td style={{ padding: '12px', color: 'rgba(255,255,255,0.45)' }}>{row.destination_label}</td>
                      <td style={{ padding: '12px', color: 'rgba(255,255,255,0.35)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {fmtDate(row.requested_at)}
                      </td>
                    </tr>
                  ))
              }
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                  No withdrawal records yet. Available in Phase 2 when live revenue is processed.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginBtnStyle(page === 1)}>← Prev</button>
            <span style={{ padding: '8px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginBtnStyle(page === totalPages)}>Next →</button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.1)', padding: 24,
          alignSelf: 'start', position: 'sticky', top: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff' }}>Withdrawal Detail</h4>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0,
            }}>✕</button>
          </div>

          {loadingDetail
            ? [...Array(6)].map((_, i) => <Skeleton key={i} h={20} mb={12} />)
            : detail ? (
              <>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#a78bfa', marginBottom: 16 }}>
                  {detail.withdrawal_number}
                </div>
                <Badge status={detail.status} />

                <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    ['Amount', formatINR(detail.amount), '#fff'],
                    ['Currency', detail.currency, 'rgba(255,255,255,0.6)'],
                    ['Destination', detail.destination_type, 'rgba(255,255,255,0.6)'],
                    ['Transaction Ref', detail.transaction_reference || '—', 'rgba(255,255,255,0.6)'],
                    ['Requested By', detail.requested_by?.name || '—', 'rgba(255,255,255,0.7)'],
                    ['Requested At', fmtDate(detail.requested_at), 'rgba(255,255,255,0.5)'],
                    ['Approved By', detail.approved_by?.name || '—', 'rgba(255,255,255,0.7)'],
                    ['Approved At', fmtDate(detail.approved_at), 'rgba(255,255,255,0.5)'],
                    ['Completed At', fmtDate(detail.completed_at), 'rgba(255,255,255,0.5)'],
                  ].map(([lbl, val, clr]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{lbl}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: clr, textAlign: 'right' }}>{val}</span>
                    </div>
                  ))}
                </div>

                {detail.notes && (
                  <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: 'rgba(255,255,255,0.4)' }}>Notes</div>
                    {detail.notes}
                  </div>
                )}

                {/* Audit trail */}
                {detail.audit_trail?.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Audit Trail
                    </div>
                    {detail.audit_trail.map((a, i) => (
                      <div key={i} style={{
                        padding: '10px 14px', borderRadius: 10, marginBottom: 6,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        fontSize: 12,
                      }}>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{a.action}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{fmtDate(a.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Failed to load detail.</div>
            )
          }
        </div>
      )}
    </div>
  );
}

// ── Shared style helper ───────────────────────────────────────────────────────
const paginBtnStyle = (disabled) => ({
  padding: '8px 18px', borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)', color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
  fontSize: 13, cursor: disabled ? 'default' : 'pointer', transition: 'all 0.2s',
});

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PlatformFinance() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('overview');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTreasurySummary();
      if (data) setSummary(data);
    } catch (e) {
      console.warn('[PlatformFinance]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    const unsub = subscribeToTreasurySummary(d => setSummary(prev => ({ ...prev, ...d })));
    return unsub;
  }, [loadSummary]);

  return (
    <AdminLayout activePage="finance">
      <div style={{ padding: '0 0 60px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <button onClick={() => navigate('/admin/dashboard')} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
                fontSize: 13, padding: 0,
              }}>← Dashboard</button>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Finance & Treasury</span>
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              Platform Finance
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              Treasury ledger, withdrawal history, and balance accounting
            </p>
          </div>

          {/* Hero balance badge */}
          {summary && !loading && (
            <div style={{
              padding: '12px 24px', borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))',
              border: '1px solid rgba(52,211,153,0.25)',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Available Balance</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#34d399', letterSpacing: '-0.02em' }}>
                {formatINR(summary.available_balance)}
              </span>
            </div>
          )}
        </div>

        {/* Phase notice */}
        <div style={{
          marginBottom: 24, padding: '12px 18px', borderRadius: 12,
          background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <span style={{ fontSize: 13, color: 'rgba(167,139,250,0.85)' }}>
            <strong>Phase 1 — Foundation Active.</strong> Treasury ledger, balance accounting, and withdrawal history are live.
            Withdrawal request workflow (POST/Approve/Execute) will be enabled in Phase 2 when live revenue is stable.
          </span>
        </div>

        {/* Tabs */}
        <div style={{ marginBottom: 28 }}>
          <TabBar active={tab} onChange={setTab} />
        </div>

        {/* Content */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.08)', padding: '28px 28px',
          backdropFilter: 'blur(20px)',
        }}>
          {tab === 'overview'    && <OverviewTab summary={summary} loading={loading} reload={loadSummary} />}
          {tab === 'ledger'      && <LedgerTab />}
          {tab === 'withdrawals' && <WithdrawalsTab />}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        select option { background: #1a0b2e; color: #fff; }
      `}</style>
    </AdminLayout>
  );
}
