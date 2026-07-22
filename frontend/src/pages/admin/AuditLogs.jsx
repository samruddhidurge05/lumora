import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { backendFetch } from '../../utils/api';import { AdminSelect } from './components/AdminComponents';

// ─── Inline SVG icon system (matches Lumora admin design) ────────────────────
const Icon = ({ name, size = 16, className = '' }) => {
  const svgs = {
    ShieldAlert: (
      <g>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </g>
    ),
    RefreshCw: (
      <g>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </g>
    ),
    AlertTriangle: (
      <g>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </g>
    ),
    ClipboardList: (
      <g>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="11" y2="16" />
      </g>
    ),
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Filter: (
      <g>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </g>
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {svgs[name] || null}
    </svg>
  );
};

// ─── Action badge color mapping ───────────────────────────────────────────────
const ACTION_COLORS = {
  admin_login_success:                   { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  admin_login_failure:                   { bg: 'bg-red-100',     text: 'text-red-600'     },
  admin_logout:                          { bg: 'bg-stone-100',   text: 'text-stone-600'   },
  vendor_enable:                         { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  vendor_disable:                        { bg: 'bg-red-100',     text: 'text-red-600'     },
  vendor_restrict:                       { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  affiliate_enable:                      { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  affiliate_disable:                     { bg: 'bg-red-100',     text: 'text-red-600'     },
  platform_pause:                        { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  platform_resume:                       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  admin_referral_link_created:           { bg: 'bg-[#D8BFE3]/50', text: 'text-[#5A1E7E]' },
  admin_referral_link_deleted:           { bg: 'bg-red-100',     text: 'text-red-600'     },
  admin_referral_link_status_changed:    { bg: 'bg-[#D8BFE3]/50', text: 'text-[#5A1E7E]' },
  order_status_change:                   { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  order_refund:                          { bg: 'bg-orange-100',  text: 'text-orange-700'  },
  order_dispute:                         { bg: 'bg-red-100',     text: 'text-red-600'     },
  review_moderated:                      { bg: 'bg-purple-100',  text: 'text-purple-700'  },
  support_ticket_replied:                { bg: 'bg-teal-100',    text: 'text-teal-700'    },
  support_ticket_status_changed:         { bg: 'bg-cyan-100',    text: 'text-cyan-700'    },
  report_resolved:                       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  report_rejected:                       { bg: 'bg-red-100',     text: 'text-red-600'     },
  report_assigned:                       { bg: 'bg-yellow-100',  text: 'text-yellow-700'  },
};

const ACTION_OPTIONS = [
  'admin_login_success',
  'admin_login_failure',
  'admin_logout',
  'vendor_enable',
  'vendor_disable',
  'vendor_restrict',
  'affiliate_enable',
  'affiliate_disable',
  'platform_pause',
  'platform_resume',
  'admin_referral_link_created',
  'admin_referral_link_deleted',
  'admin_referral_link_status_changed',
  'order_status_change',
  'order_refund',
  'order_dispute',
  'review_moderated',
  'support_ticket_replied',
  'support_ticket_status_changed',
  'report_resolved',
  'report_rejected',
  'report_assigned',
];

const PAGE_SIZE = 50;

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async (currentPage, action) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: currentPage, page_size: PAGE_SIZE });
      if (action) params.append('action', action);
      const data = await backendFetch(`/admin/auth/audit-logs?${params}`);
      setLogs(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
    } catch (err) {
      console.error('[AuditLogs] Failed to load:', err);
      setError(err?.message || 'Failed to load audit logs. Please retry.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, actionFilter);
  }, [page, actionFilter]);

  const handleActionFilterChange = (value) => {
    setActionFilter(value);
    setPage(1);
  };

  const formatTimestamp = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const actionBadge = (action) => {
    const colors = ACTION_COLORS[action] || { bg: 'bg-stone-100', text: 'text-stone-600' };
    return (
      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${colors.bg} ${colors.text}`}>
        {action?.replace(/_/g, ' ') || '—'}
      </span>
    );
  };

  return (
    <AdminLayout activePage="audit-logs">
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* ── Page header ── */}
        <section className="mb-8">
          <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D8BFE3] to-[#B886D0] flex items-center justify-center text-[#2D004D] shadow-inner">
                <Icon name="ShieldAlert" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-serif font-black text-[#2D004D]">Audit Logs</h1>
                <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Admin Action History &bull; {total} total entries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {/* Action filter */}
              <AdminSelect
                value={actionFilter}
                onChange={(e) => handleActionFilterChange(e.target.value)}
                options={[
                  { value: '', label: 'All Actions' },
                  ...ACTION_OPTIONS.map((a) => ({ value: a, label: a.replace(/_/g, ' ') }))
                ]}
              />

              {/* Refresh */}
              <button
                onClick={() => fetchLogs(page, actionFilter)}
                className="p-2.5 rounded-xl bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                title="Refresh audit logs"
                aria-label="Refresh audit logs"
              >
                <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Error state ── */}
        <AnimatePresence>
          {error && (
            <motion.section
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <div className="glass-surface rounded-3xl p-6 border border-red-200/40 flex flex-col items-center justify-center gap-4 text-center py-10">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                  <Icon name="AlertTriangle" size={22} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-black text-[#2D004D] mb-1">Failed to Load Audit Logs</h3>
                  <p className="text-[10px] text-[#7B3FA0] max-w-sm">{error}</p>
                </div>
                <button
                  onClick={() => fetchLogs(page, actionFilter)}
                  className="mt-1 px-5 py-2.5 bg-[#2D004D] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#7B3FA0] transition-colors"
                >
                  <Icon name="RefreshCw" size={11} className="inline mr-1.5" />
                  Retry
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Table card ── */}
        <section className="glass-surface rounded-3xl border border-white/50 shadow-sm overflow-hidden">

          {/* Loading skeleton */}
          {loading ? (
            <div className="p-6 flex flex-col gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-[#F5E9DD]/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : !error && logs.length === 0 ? (
            /* Empty state */
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4 px-6">
              <div className="w-14 h-14 rounded-full bg-[#F5E9DD]/60 flex items-center justify-center">
                <Icon name="ClipboardList" size={24} className="text-[#7B3FA0]" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-black text-[#2D004D] mb-1">No audit logs yet</h3>
                <p className="text-[10px] text-[#7B3FA0]">
                  {actionFilter
                    ? `No entries found for action "${actionFilter.replace(/_/g, ' ')}"`
                    : 'Admin actions will appear here once they occur.'}
                </p>
              </div>
            </div>
          ) : !error ? (
            /* Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#F5E9DD]/80 bg-[#FAF5FF]/40">
                    {['ID', 'Timestamp', 'Action', 'Target Type', 'Target ID', 'Admin ID', 'IP Address'].map((col) => (
                      <th key={col} className="px-5 py-3.5 text-[8px] font-black uppercase tracking-widest text-[#7B3FA0] whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {logs.map((log, idx) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-[#F5E9DD]/40 hover:bg-[#F5E9DD]/20 transition-colors"
                      >
                        <td className="px-5 py-3 text-[9px] font-mono text-[#7B3FA0]">{log.id}</td>
                        <td className="px-5 py-3 text-[9px] text-[#2D004D] whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                        <td className="px-5 py-3">{actionBadge(log.action)}</td>
                        <td className="px-5 py-3 text-[9px] text-[#7B3FA0]">{log.target_type || '—'}</td>
                        <td className="px-5 py-3 text-[9px] font-mono text-[#7B3FA0] max-w-[120px] truncate" title={log.target_id}>{log.target_id || '—'}</td>
                        <td className="px-5 py-3 text-[9px] text-[#7B3FA0]">{log.admin_user_id || '—'}</td>
                        <td className="px-5 py-3 text-[9px] font-mono text-[#7B3FA0]">{log.ip_address || '—'}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : null}

          {/* ── Pagination ── */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#F5E9DD]/60">
              <span className="text-[9px] text-[#7B3FA0] font-bold">
                Page {page} of {totalPages} &nbsp;&bull;&nbsp; {total} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </section>
      </main>
    </AdminLayout>
  );
}
