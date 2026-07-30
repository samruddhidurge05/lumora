import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { backendFetch } from '../../utils/api';
import { AdminSelect } from './components/AdminComponents';

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
    ChevronUp: <polyline points="18 15 12 9 6 15" />,
    Filter: (
      <g>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </g>
    ),
    Search: (
      <g>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </g>
    ),
    User: (
      <g>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </g>
    ),
    Target: (
      <g>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </g>
    ),
    Info: (
      <g>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
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

// ─── Action badge color mapping (preserved exactly) ───────────────────────────
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
  product_created:                       { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  product_updated:                       { bg: 'bg-blue-100',    text: 'text-blue-700'    },
  product_deleted:                       { bg: 'bg-red-100',     text: 'text-red-600'     },
  product_status_patched:                { bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  auto_affiliate_enrollment:             { bg: 'bg-[#D8BFE3]/50', text: 'text-[#5A1E7E]' },
  'Commission Created':                  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  admin_deactivated:                     { bg: 'bg-red-100',     text: 'text-red-600'     },
  admin_role_changed:                    { bg: 'bg-amber-100',   text: 'text-amber-700'   },
  admin_invited:                         { bg: 'bg-[#D8BFE3]/50', text: 'text-[#5A1E7E]' },
};

// ─── Category badge colors ────────────────────────────────────────────────────
const CATEGORY_COLORS = {
  Security:   { bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-400'      },
  Product:    { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-400'     },
  Financial:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-400'  },
  Affiliate:  { bg: 'bg-purple-50',   text: 'text-purple-700',  dot: 'bg-purple-400'   },
  Vendor:     { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-400'    },
  Reports:    { bg: 'bg-orange-50',   text: 'text-orange-700',  dot: 'bg-orange-400'   },
  Support:    { bg: 'bg-teal-50',     text: 'text-teal-700',    dot: 'bg-teal-400'     },
  Content:    { bg: 'bg-indigo-50',   text: 'text-indigo-700',  dot: 'bg-indigo-400'   },
  System:     { bg: 'bg-stone-50',    text: 'text-stone-600',   dot: 'bg-stone-400'    },
  Referral:   { bg: 'bg-[#D8BFE3]/50', text: 'text-[#5A1E7E]', dot: 'bg-[#B886D0]'   },
};

const CATEGORY_OPTIONS = ['Security', 'Product', 'Financial', 'Affiliate', 'Vendor', 'Reports', 'Support', 'Content', 'System', 'Referral'];

const ACTION_OPTIONS = [
  'admin_login_success', 'admin_login_failure', 'admin_logout',
  'admin_invited', 'admin_deactivated', 'admin_role_changed', 'admin_invitation_revoked',
  'vendor_enable', 'vendor_disable', 'vendor_restrict',
  'affiliate_enable', 'affiliate_disable',
  'platform_pause', 'platform_resume',
  'admin_referral_link_created', 'admin_referral_link_deleted', 'admin_referral_link_status_changed',
  'order_status_change', 'order_refund', 'order_dispute',
  'review_moderated',
  'support_ticket_replied', 'support_ticket_status_changed',
  'report_resolved', 'report_rejected', 'report_assigned',
  'product_created', 'product_updated', 'product_deleted',
  'product_status_patched', 'product_featured_patched', 'product_affiliate_patched',
  'auto_affiliate_enrollment', 'Commission Created',
];

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return absoluteTime(iso);
  } catch { return iso; }
}

function absoluteTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

function actionBadge(action, actionLabel) {
  const colors = ACTION_COLORS[action] || { bg: 'bg-stone-100', text: 'text-stone-600' };
  const label = actionLabel || action?.replace(/_/g, ' ') || '—';
  return (
    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  );
}

function categoryBadge(category) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.System;
  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${c.bg} ${c.text}`}>
      <span className={`w-1 h-1 rounded-full ${c.dot}`} />
      {category || 'System'}
    </span>
  );
}

// ─── Expandable Detail Panel ──────────────────────────────────────────────────
function DetailPanel({ log }) {
  const meta = log.metadata_parsed || {};
  const ip   = log.ip_address;
  const rawId = log.id;
  const hasMeta = Object.keys(meta).length > 0;

  return (
    <div className="px-5 pb-3 pt-1 bg-[#FAF5FF]/60 border-t border-[#F5E9DD]/40 text-[9px] text-[#7B3FA0] space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
        <div><span className="font-black uppercase tracking-wider text-[#2D004D]">Log ID</span><br />#{rawId}</div>
        {ip && <div><span className="font-black uppercase tracking-wider text-[#2D004D]">IP Address</span><br /><span className="font-mono">{ip}</span></div>}
        {log.target?.type && <div><span className="font-black uppercase tracking-wider text-[#2D004D]">Target Type</span><br />{log.target.type}</div>}
        {log.target?.id   && <div><span className="font-black uppercase tracking-wider text-[#2D004D]">Target ID</span><br /><span className="font-mono">{log.target.id}</span></div>}
        {log.actor?.role  && <div><span className="font-black uppercase tracking-wider text-[#2D004D]">Actor Role</span><br />{log.actor.role}</div>}
        {log.actor?.id    && <div><span className="font-black uppercase tracking-wider text-[#2D004D]">Actor ID</span><br /><span className="font-mono">{log.actor.id}</span></div>}
      </div>
      {hasMeta && (
        <div>
          <span className="font-black uppercase tracking-wider text-[#2D004D]">Event Metadata</span>
          <pre className="mt-1 text-[8px] font-mono bg-white/60 rounded-xl p-2 overflow-x-auto whitespace-pre-wrap border border-[#F5E9DD]/60">
            {JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [actionFilter,   setActionFilter]   = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery,    setSearchQuery]     = useState('');
  const [dateFrom,       setDateFrom]        = useState('');
  const [dateTo,         setDateTo]          = useState('');

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState(new Set());

  const fetchLogs = useCallback(async (currentPage, filters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: currentPage, page_size: PAGE_SIZE });
      if (filters.action)   params.append('action',    filters.action);
      if (filters.category) params.append('category',  filters.category);
      if (filters.search)   params.append('search',    filters.search);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo)   params.append('date_to',   filters.dateTo);
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

  const getFilters = () => ({ action: actionFilter, category: categoryFilter, search: searchQuery, dateFrom, dateTo });

  useEffect(() => {
    fetchLogs(page, getFilters());
  }, [page, actionFilter, categoryFilter, searchQuery, dateFrom, dateTo]);

  const resetFilters = () => {
    setActionFilter('');
    setCategoryFilter('');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleFilter = (setter) => (val) => { setter(val); setPage(1); };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const hasFilters = actionFilter || categoryFilter || searchQuery || dateFrom || dateTo;

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
              {/* Search */}
              <div className="relative">
                <Icon name="Search" size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                <input
                  id="audit-search"
                  type="text"
                  placeholder="Search actor…"
                  value={searchQuery}
                  onChange={e => handleFilter(setSearchQuery)(e.target.value)}
                  className="pl-7 pr-3 py-2 text-[9px] rounded-xl border border-[#F5E9DD] bg-white/80 text-[#2D004D] placeholder-[#B886D0] focus:outline-none focus:ring-1 focus:ring-[#B886D0] w-36"
                />
              </div>

              {/* Category filter */}
              <AdminSelect
                value={categoryFilter}
                onChange={e => handleFilter(setCategoryFilter)(e.target.value)}
                options={[
                  { value: '', label: 'All Categories' },
                  ...CATEGORY_OPTIONS.map(c => ({ value: c, label: c })),
                ]}
              />

              {/* Action filter */}
              <AdminSelect
                value={actionFilter}
                onChange={e => handleFilter(setActionFilter)(e.target.value)}
                options={[
                  { value: '', label: 'All Actions' },
                  ...ACTION_OPTIONS.map(a => ({ value: a, label: a.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) })),
                ]}
              />

              {/* Date range */}
              <input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={e => handleFilter(setDateFrom)(e.target.value)}
                className="py-2 px-2.5 text-[9px] rounded-xl border border-[#F5E9DD] bg-white/80 text-[#2D004D] focus:outline-none focus:ring-1 focus:ring-[#B886D0]"
                title="From date"
              />
              <input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={e => handleFilter(setDateTo)(e.target.value)}
                className="py-2 px-2.5 text-[9px] rounded-xl border border-[#F5E9DD] bg-white/80 text-[#2D004D] focus:outline-none focus:ring-1 focus:ring-[#B886D0]"
                title="To date"
              />

              {/* Clear filters */}
              {hasFilters && (
                <button
                  onClick={resetFilters}
                  className="px-3 py-2 rounded-xl border border-red-200 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                  title="Clear all filters"
                >
                  Clear
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={() => fetchLogs(page, getFilters())}
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
                  onClick={() => fetchLogs(page, getFilters())}
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
                <div key={i} className="h-14 rounded-xl bg-[#F5E9DD]/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : !error && logs.length === 0 ? (
            /* Empty state */
            <div className="py-20 flex flex-col items-center justify-center text-center gap-4 px-6">
              <div className="w-14 h-14 rounded-full bg-[#F5E9DD]/60 flex items-center justify-center">
                <Icon name="ClipboardList" size={24} className="text-[#7B3FA0]" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-black text-[#2D004D] mb-1">No audit logs found</h3>
                <p className="text-[10px] text-[#7B3FA0]">
                  {hasFilters
                    ? 'No entries match the current filters. Try adjusting or clearing them.'
                    : 'Admin actions will appear here once they occur.'}
                </p>
                {hasFilters && (
                  <button onClick={resetFilters} className="mt-3 px-4 py-2 rounded-2xl bg-[#2D004D] text-white text-[9px] font-black uppercase tracking-widest hover:bg-[#7B3FA0] transition-colors">
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          ) : !error ? (
            <>
              {/* ── Desktop Table (>= 768px) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#F5E9DD]/80 bg-[#FAF5FF]/40">
                      {['Timestamp', 'Event', 'Category', 'Actor', 'Target', 'Details'].map(col => (
                        <th key={col} className="px-5 py-3.5 text-[8px] font-black uppercase tracking-widest text-[#7B3FA0] whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {logs.map((log, idx) => {
                        const expanded = expandedIds.has(log.id);
                        return (
                          <React.Fragment key={log.id}>
                            <motion.tr
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.015 }}
                              className={`border-b border-[#F5E9DD]/40 hover:bg-[#F5E9DD]/20 transition-colors cursor-pointer ${expanded ? 'bg-[#FAF5FF]/60' : ''}`}
                              onClick={() => toggleExpand(log.id)}
                            >
                              {/* Timestamp */}
                              <td className="px-5 py-3 whitespace-nowrap">
                                <div className="text-[9px] font-bold text-[#2D004D]">{relativeTime(log.created_at)}</div>
                                <div className="text-[8px] text-[#7B3FA0] mt-0.5">{absoluteTime(log.created_at)}</div>
                              </td>
                              {/* Event */}
                              <td className="px-5 py-3 max-w-[260px]">
                                <div className="mb-1">{actionBadge(log.action, log.action_label)}</div>
                                <p className="text-[9px] text-[#7B3FA0] leading-relaxed line-clamp-2">
                                  {log.description || '—'}
                                </p>
                              </td>
                              {/* Category */}
                              <td className="px-5 py-3">
                                {categoryBadge(log.category)}
                              </td>
                              {/* Actor */}
                              <td className="px-5 py-3">
                                <div className="flex items-start gap-1.5">
                                  <div className="w-5 h-5 rounded-full bg-[#D8BFE3]/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Icon name="User" size={10} className="text-[#7B3FA0]" />
                                  </div>
                                  <div>
                                    <div className="text-[9px] font-bold text-[#2D004D] leading-tight">
                                      {log.actor?.name || 'System'}
                                    </div>
                                    {log.actor?.email && (
                                      <div className="text-[8px] text-[#7B3FA0] leading-tight truncate max-w-[140px]">
                                        {log.actor.email}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {/* Target */}
                              <td className="px-5 py-3">
                                {log.target?.label || log.target?.type ? (
                                  <div>
                                    <div className="text-[9px] font-bold text-[#2D004D] truncate max-w-[160px]">
                                      {log.target.label || log.target.type}
                                    </div>
                                    {log.target.label && log.target.type && (
                                      <div className="text-[8px] text-[#7B3FA0] capitalize">{log.target.type}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-[#7B3FA0]">—</span>
                                )}
                              </td>
                              {/* Expand toggle */}
                              <td className="px-5 py-3">
                                <button
                                  onClick={e => { e.stopPropagation(); toggleExpand(log.id); }}
                                  className="p-1.5 rounded-lg hover:bg-[#D8BFE3]/30 text-[#7B3FA0] transition-colors"
                                  title={expanded ? 'Collapse details' : 'Expand details'}
                                >
                                  <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
                                </button>
                              </td>
                            </motion.tr>

                            {/* Expandable Detail Row */}
                            <AnimatePresence>
                              {expanded && (
                                <motion.tr
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  key={`expand-${log.id}`}
                                >
                                  <td colSpan={6} className="p-0">
                                    <DetailPanel log={log} />
                                  </td>
                                </motion.tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* ── Mobile Card Stack (< 768px) ── */}
              <div className="block md:hidden space-y-2.5 p-3 sm:p-4">
                <AnimatePresence>
                  {logs.map((log, idx) => {
                    const expanded = expandedIds.has(log.id);
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="bg-white rounded-2xl border border-[#E9DFF3]/60 shadow-sm overflow-hidden"
                      >
                        <div
                          className="p-3.5 space-y-2.5 cursor-pointer"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col gap-1">
                              {actionBadge(log.action, log.action_label)}
                              {categoryBadge(log.category)}
                            </div>
                            <div className="text-right">
                              <div className="text-[9px] font-bold text-[#2D004D]">{relativeTime(log.created_at)}</div>
                              <div className="text-[8px] text-[#7B3FA0]">{absoluteTime(log.created_at)}</div>
                            </div>
                          </div>
                          {log.description && (
                            <p className="text-[9px] text-[#7B3FA0] leading-relaxed">{log.description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-[#7B3FA0]">
                            <div>
                              <span className="font-bold uppercase tracking-wider text-[#2D004D]">Actor:</span>{' '}
                              {log.actor?.name || 'System'}
                            </div>
                            <div>
                              <span className="font-bold uppercase tracking-wider text-[#2D004D]">Target:</span>{' '}
                              {log.target?.label || log.target?.type || '—'}
                            </div>
                          </div>
                        </div>
                        <AnimatePresence>
                          {expanded && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <DetailPanel log={log} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </>
          ) : null}

          {/* ── Pagination ── */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#F5E9DD]/60">
              <span className="text-[9px] text-[#7B3FA0] font-bold">
                Page {page} of {totalPages} &nbsp;&bull;&nbsp; {total} entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
