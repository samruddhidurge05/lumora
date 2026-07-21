/**
 * Vendors.jsx — Admin Vendor Management Board
 *
 * Fetches all Firestore users with role="Vendor" or "Affiliate" and displays them
 * in a table. Admin can approve, reject, suspend, and unsuspend vendors/affiliates.
 *
 * All actions write directly to Firestore via vendorService.js.
 * No mock data. No REST API.
 *
 * Styling follows the existing admin dashboard design system:
 *  - glass-surface card class
 *  - var(--color-*) CSS variables
 *  - Navbar component
 *  - Same font, color palette, and layout as Dashboard.jsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './components/AdminLayout';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { backendFetch } from '../../utils/api';
import { PageHeader, StatsGrid, DashboardCard, TableContainer } from './components/AdminComponents';
import {
  approveVendor,
  rejectVendor,
  suspendVendor,
  restrictVendor,
  approveAffiliate,
  disableAffiliate,
  suspendAffiliate,
  restrictAffiliate,
} from '../../services/vendorService';

// ── Inline SVG icon system (matches Dashboard/ProductsManagement pattern) ─────
const Icon = ({ name, size = 16, className = '' }) => {
  const svgs = {
    Users:       <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></g>,
    Check:       <polyline points="20 6 9 17 4 12"/>,
    X:           <g><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></g>,
    Pause:       <g><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></g>,
    Play:        <polygon points="5 3 19 12 5 21 5 3"/>,
    RefreshCw:   <g><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></g>,
    AlertTriangle:<g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>,
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      {svgs[name] || null}
    </svg>
  );
};

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ label, statusType }) {
  let bg = 'rgba(123,63,160,0.10)';
  let border = 'rgba(184,134,208,0.30)';
  let color = '#7B3FA0';
  let dot = '#B886D0';

  if (statusType === 'restricted') {
    bg = 'rgba(245,158,11,0.10)';
    border = 'rgba(245,158,11,0.30)';
    color = '#B45309';
    dot = '#F59E0B';
  } else if (statusType === 'disabled') {
    bg = 'rgba(220,38,38,0.08)';
    border = 'rgba(220,38,38,0.20)';
    color = '#DC2626';
    dot = '#EF4444';
  } else if (statusType === 'active') {
    bg = 'rgba(16,185,129,0.10)';
    border = 'rgba(16,185,129,0.30)';
    color = '#059669';
    dot = '#10B981';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      background: bg,
      border: `1px solid ${border}`,
      color: color,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dot,
        flexShrink: 0,
      }} />
      {label}
    </span>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Vendors() {
  const [activeTab, setActiveTab] = useState('vendors'); // 'vendors' | 'affiliates'
  const [vendors, setVendors]     = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [actionLoading, setActionLoading] = useState({}); // { [uid]: true/false }
  const [notification, setNotification]   = useState(null);

  // ── Sort helper ─────────────────────────────────────────────────────────────
  const sortByStatus = useCallback((arr) => {
    return [...arr].sort((a, b) => {
      if (a.status !== 'active' && b.status === 'active') return -1;
      if (a.status === 'active' && b.status !== 'active') return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, []);

  // ── REST fallback fetch ──────────────────────────────────────────────────
  // Token refresh is handled by AuthContext — no need to reacquire here.
  const fetchVendorsRest = useCallback(async () => {
    try {
      const data = await backendFetch('/admin/vendors/');
      setVendors(sortByStatus(Array.isArray(data) ? data : []));
    } catch (err) {
      setError('Failed to load vendors. Check backend connection.');
    }
  }, [sortByStatus]);

  const fetchAffiliatesRest = useCallback(async () => {
    try {
      const data = await backendFetch('/admin/affiliates/');
      setAffiliates(sortByStatus(Array.isArray(data) ? data : []));
    } catch (err) {
      console.warn('[Vendors] REST affiliates fallback failed:', err.message);
    }
  }, [sortByStatus]);

  // ── Real-time listeners ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    const vendorQuery    = query(collection(db, 'users'), where('role', 'in', ['vendor', 'Vendor']));
    const affiliateQuery = query(collection(db, 'users'), where('role', 'in', ['affiliate', 'Affiliate']));

    let vendorFetched = false;    // guard: call REST fallback only once
    let affiliateFetched = false; // guard: call REST fallback only once

    let unsubVendors;
    unsubVendors = onSnapshot(
      vendorQuery,
      (snap) => {
        const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setVendors(sortByStatus(data));
        setLoading(false);
      },
      async (err) => {
        if (unsubVendors) unsubVendors();
        if (vendorFetched) return;
        vendorFetched = true;
        console.warn('[Vendors] Firestore vendor read error, falling back to REST API:', err.message);
        await fetchVendorsRest();
        setLoading(false);
      }
    );

    let unsubAffiliates;
    unsubAffiliates = onSnapshot(
      affiliateQuery,
      (snap) => {
        const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setAffiliates(sortByStatus(data));
        setLoading(false);
      },
      async (err) => {
        if (unsubAffiliates) unsubAffiliates();
        if (affiliateFetched) return;
        affiliateFetched = true;
        console.warn('[Vendors] Firestore affiliate read error, falling back to REST API:', err.message);
        await fetchAffiliatesRest();
        setLoading(false);
      }
    );

    return () => { unsubVendors(); unsubAffiliates(); };
  }, [fetchVendorsRest, fetchAffiliatesRest, sortByStatus]);

  // ── Notification helper ────────────────────────────────────────────────────
  const notify = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // ── Generic action runner ──────────────────────────────────────────────────
  // Token refresh is handled by AuthContext's proactive refresh interval.
  const runAction = useCallback(async (uid, actionFn, successMsg) => {
    setActionLoading(prev => ({ ...prev, [uid]: true }));

    const applyOptimistic = (fn) => {
      if (activeTab === 'vendors') {
        setVendors(prev => prev.map(v => {
          if (v.uid !== uid && v.id !== uid) return v;
          if (fn === approveVendor)  return { ...v, status: 'active' };
          if (fn === restrictVendor) return { ...v, status: 'restricted' };
          if (fn === suspendVendor)  return { ...v, status: 'disabled' };
          if (fn === rejectVendor)   return { ...v, status: 'disabled' };
          return v;
        }));
      } else {
        setAffiliates(prev => prev.map(a => {
          if (a.uid !== uid && a.id !== uid) return a;
          if (fn === approveAffiliate)  return { ...a, status: 'active' };
          if (fn === restrictAffiliate) return { ...a, status: 'restricted' };
          if (fn === disableAffiliate)  return { ...a, status: 'disabled' };
          if (fn === suspendAffiliate)  return { ...a, status: 'disabled' };
          return a;
        }));
      }
    };

    try {
      await actionFn(uid);
      applyOptimistic(actionFn);
      notify(successMsg);
      // Background REST refresh
      if (activeTab === 'vendors') {
        fetchVendorsRest();
      } else {
        fetchAffiliatesRest();
      }
    } catch (err) {
      notify(err.message || 'Action failed. Please try again.', 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [uid]: false }));
    }
  }, [activeTab, fetchVendorsRest, fetchAffiliatesRest]);



  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalVendors    = vendors.length;
  const approvedCount   = vendors.filter(v => v.status === 'active').length;
  const pendingCount    = vendors.filter(v => v.status === 'restricted').length;
  const suspendedCount  = vendors.filter(v => v.status === 'disabled').length;

  const totalAffiliates = affiliates.length;
  const totalClicks     = affiliates.reduce((sum, a) => sum + (a.totalClicks || 0), 0);
  const totalCommission = affiliates.reduce((sum, a) => sum + (a.totalCommission || 0), 0);
  const suspendedAffs   = affiliates.filter(a => a.status === 'disabled').length;

  const stats = activeTab === 'vendors' 
    ? [
        { label: 'Total Vendors',  value: totalVendors,   color: '#7B3FA0' },
        { label: 'Active (Full)',  value: approvedCount,  color: '#059669' },
        { label: 'Restricted',     value: pendingCount,   color: '#B45309' },
        { label: 'Disabled',       value: suspendedCount, color: '#DC2626' },
      ]
    : [
        { label: 'Total Affiliates', value: totalAffiliates, color: '#7B3FA0' },
        { label: 'Total Clicks',     value: totalClicks,     color: '#B886D0' },
        { label: 'Network Earnings', value: `₹${totalCommission.toLocaleString()}`, color: '#9B2C5E' },
        { label: 'Disabled',        value: suspendedAffs,   color: '#DC2626' },
      ];

  const tableHeaders = activeTab === 'vendors'
    ? ['Name', 'Email', 'Status', 'Joined', 'Actions']
    : ['Name', 'Email', 'Code', 'Clicks', 'Conversions', 'Earnings', 'Status', 'Actions'];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout activePage="vendors">

      {/* Toast notification */}
      {notification && (
        <div className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl backdrop-blur-xl border shadow-lg transition-all ${
          notification.type === 'error'
            ? 'bg-red-50/80 border-red-200 text-red-700'
            : notification.type === 'info'
            ? 'bg-blue-50/80 border-blue-200 text-blue-700'
            : 'bg-white/70 border-white/40 text-[#2D004D]'
        }`}>
          <div className={`w-3 h-3 rounded-full ${
            notification.type === 'error' ? 'bg-red-400' :
            notification.type === 'info'  ? 'bg-blue-400' :
            'bg-[#B886D0] shadow-[0_0_8px_#B886D0]'
          }`} />
          <span className="text-xs font-semibold uppercase tracking-wider">{notification.text}</span>
        </div>
      )}

      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* ── Page header ── */}
        <PageHeader
          title="Merchant Control Board"
          subtitle="Approve applications, manage permissions, and control access levels for both vendors and affiliates."
          actions={
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                const sortByStatus = (arr) => [...arr].sort((a, b) => {
                  if (a.status !== 'active' && b.status === 'active') return -1;
                  if (a.status === 'active' && b.status !== 'active') return 1;
                  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                });
                await Promise.all([
                  fetchVendorsRest(sortByStatus),
                  fetchAffiliatesRest(sortByStatus),
                ]);
                setLoading(false);
                notify('Synced from backend');
              }}
              className="btn-admin-secondary flex items-center gap-2"
            >
              <Icon name="RefreshCw" size={13} />
              Sync Live
            </button>
          }
        />

        {/* ── Directory Selector Tab ── */}
        <section className="mb-8 flex gap-2 p-1.5 bg-[#D8BFE3]/15 backdrop-blur-md rounded-2xl border border-white/40 max-w-md">
          <button
            onClick={() => setActiveTab('vendors')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'vendors'
                ? 'bg-white text-[#7B3FA0] shadow-md shadow-[#7B3FA0]/5'
                : 'text-[#7B3FA0]/70 hover:text-[#7B3FA0] hover:bg-white/30'
            }`}
          >
            🏪 Vendor Registry
          </button>
          <button
            onClick={() => setActiveTab('affiliates')}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === 'affiliates'
                ? 'bg-white text-[#7B3FA0] shadow-md shadow-[#7B3FA0]/5'
                : 'text-[#7B3FA0]/70 hover:text-[#7B3FA0] hover:bg-white/30'
            }`}
          >
            🔗 Affiliate Network
          </button>
        </section>

        {/* ── Stat cards ── */}
        <StatsGrid columns={4}>
          {stats.map(s => (
            <DashboardCard
              key={s.label}
              title={s.label}
              value={s.value}
              icon={<span style={{ color: s.color }}>●</span>}
            />
          ))}
        </StatsGrid>

        {/* ── Data table ── */}
        <TableContainer>
          {/* Table header */}
          <div className="px-6 py-4 border-b border-[#F3EAF8]/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D004D] tracking-wide flex items-center gap-2">
              <Icon name="Users" size={15} />
              {activeTab === 'vendors' ? 'All Vendors' : 'All Affiliates'}
            </h2>
            <span className="text-xs text-[#7B3FA0] bg-[#D8BFE3]/20 px-2.5 py-1 rounded-full font-medium">
              {(activeTab === 'vendors' ? totalVendors : totalAffiliates)} total
            </span>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3 text-[#7B3FA0]">
              <div className="w-5 h-5 border-2 border-[#B886D0] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading records from Firestore…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex items-center gap-3 mx-6 my-6 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              <Icon name="AlertTriangle" size={16} />
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && (activeTab === 'vendors' ? vendors.length === 0 : affiliates.length === 0) && (
            <div className="text-center py-20 text-[#7B3FA0]">
              <p className="text-4xl mb-3">{activeTab === 'vendors' ? '🏪' : '🔗'}</p>
              <p className="text-sm font-medium">
                {activeTab === 'vendors' ? 'No vendors registered yet.' : 'No affiliates registered yet.'}
              </p>
              <p className="text-xs opacity-60 mt-1">
                {activeTab === 'vendors'
                  ? 'Vendors will appear here after completing registration.'
                  : 'Affiliates will appear here once profiles are created.'}
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && (activeTab === 'vendors' ? vendors.length > 0 : affiliates.length > 0) && (
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(216,191,227,0.20)' }}>
                      {tableHeaders.map(h => (
                        <th key={h} style={{
                          padding: '12px 20px',
                          textAlign: 'left',
                          fontSize: '9px',
                          fontWeight: 700,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          color: '#7B3FA0',
                          whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'vendors'
                      ? vendors.map((vendor, idx) => {
                          const uid = vendor.uid || vendor.id;
                          const busy = !!actionLoading[uid];
                          const rawCreatedAt = vendor.createdAt;
                          const joinedDate = (() => {
                            if (!rawCreatedAt) return '—';
                            // Firestore Timestamp object
                            if (rawCreatedAt?.toDate) return rawCreatedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            if (rawCreatedAt?.seconds) return new Date(rawCreatedAt.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            // ISO string or plain date string
                            const d = new Date(rawCreatedAt);
                            if (isNaN(d.getTime())) return '—';
                            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                          })();

                          return (
                            <tr
                              key={uid}
                              style={{
                                borderBottom: idx < vendors.length - 1 ? '1px solid rgba(216,191,227,0.12)' : 'none',
                                background: vendor.status === 'disabled' ? 'rgba(155,44,94,0.03)' : 'transparent',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(216,191,227,0.06)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = vendor.status === 'disabled' ? 'rgba(155,44,94,0.03)' : 'transparent'; }}
                            >
                              {/* Name */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #D8BFE3, #B886D0)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                  }}>
                                    {(vendor.name || 'V')[0].toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#2D004D' }}>
                                    {vendor.name || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* Email */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '12px', color: '#7B3FA0', fontWeight: 300 }}>
                                  {vendor.email || '—'}
                                </span>
                              </td>

                              {/* Status */}
                              <td style={{ padding: '14px 20px' }}>
                                <StatusBadge label={vendor.status || 'active'} statusType={vendor.status || 'active'} />
                              </td>

                              {/* Joined */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '11px', color: '#7B3FA0', fontWeight: 300 }}>
                                  {joinedDate}
                                </span>
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>

                                  {/* Enable button */}
                                  {vendor.status !== 'active' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, approveVendor, `"${vendor.name}" enabled (Active)`)}
                                      title="Enable vendor"
                                      style={btnStyle('#059669', busy)}
                                    >
                                      <Icon name="Play" size={12} />
                                      Enable
                                    </button>
                                  )}

                                  {/* Restrict button */}
                                  {vendor.status !== 'restricted' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, restrictVendor, `"${vendor.name}" status restricted`)}
                                      title="Restrict vendor"
                                      style={btnStyle('#B45309', busy)}
                                    >
                                      <Icon name="AlertTriangle" size={12} />
                                      Restrict
                                    </button>
                                  )}

                                  {/* Disable button */}
                                  {vendor.status !== 'disabled' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, suspendVendor, `"${vendor.name}" disabled`)}
                                      title="Disable vendor"
                                      style={btnStyle('#DC2626', busy)}
                                    >
                                      <Icon name="Pause" size={12} />
                                      Disable
                                    </button>
                                  )}

                                  {/* Loading indicator */}
                                  {busy && (
                                    <div style={{
                                      width: 16, height: 16,
                                      border: '2px solid #D8BFE3',
                                      borderTopColor: '#7B3FA0',
                                      borderRadius: '50%',
                                      animation: 'spin 0.7s linear infinite',
                                      alignSelf: 'center',
                                    }} />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      : affiliates.map((affiliate, idx) => {
                          const uid = affiliate.uid || affiliate.id;
                          const busy = !!actionLoading[uid];
                          const earnings = affiliate.totalCommission !== undefined
                            ? `₹${affiliate.totalCommission.toLocaleString()}`
                            : '₹0';

                          return (
                            <tr
                              key={uid}
                              style={{
                                borderBottom: idx < affiliates.length - 1 ? '1px solid rgba(216,191,227,0.12)' : 'none',
                                background: affiliate.status === 'disabled' ? 'rgba(155,44,94,0.03)' : 'transparent',
                                transition: 'background 0.2s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(216,191,227,0.06)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = affiliate.status === 'disabled' ? 'rgba(155,44,94,0.03)' : 'transparent'; }}
                            >
                              {/* Name */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #B886D0, #7B3FA0)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                  }}>
                                    {(affiliate.name || 'A')[0].toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#2D004D' }}>
                                    {affiliate.name || '—'}
                                  </span>
                                </div>
                              </td>

                              {/* Email */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '12px', color: '#7B3FA0', fontWeight: 300 }}>
                                  {affiliate.email || '—'}
                                </span>
                              </td>

                              {/* Code */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  color: '#7B3FA0',
                                  background: 'rgba(123, 63, 160, 0.08)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(123, 63, 160, 0.15)'
                                }}>
                                  {affiliate.affiliateCode || '—'}
                                </span>
                              </td>

                              {/* Clicks */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '12px', color: '#2D004D', fontWeight: 600 }}>
                                  {affiliate.totalClicks || 0}
                                </span>
                              </td>

                              {/* Conversions */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '12px', color: '#2D004D', fontWeight: 600 }}>
                                  {affiliate.totalConversions || 0}
                                </span>
                              </td>

                              {/* Earnings */}
                              <td style={{ padding: '14px 20px' }}>
                                <span style={{ fontSize: '12px', color: '#9B2C5E', fontWeight: 700 }}>
                                  {earnings}
                                </span>
                              </td>

                              {/* Status */}
                              <td style={{ padding: '14px 20px' }}>
                                <StatusBadge label={affiliate.status || 'active'} statusType={affiliate.status || 'active'} />
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>

                                  {/* Enable button */}
                                  {affiliate.status !== 'active' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, approveAffiliate, `"${affiliate.name}" enabled (Active)`)}
                                      title="Enable affiliate"
                                      style={btnStyle('#059669', busy)}
                                    >
                                      <Icon name="Play" size={12} />
                                      Enable
                                    </button>
                                  )}

                                  {/* Restrict button */}
                                  {affiliate.status !== 'restricted' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, restrictAffiliate, `"${affiliate.name}" status restricted`)}
                                      title="Restrict affiliate"
                                      style={btnStyle('#B45309', busy)}
                                    >
                                      <Icon name="AlertTriangle" size={12} />
                                      Restrict
                                    </button>
                                  )}

                                  {/* Disable button */}
                                  {affiliate.status !== 'disabled' && (
                                    <button
                                      disabled={busy}
                                      onClick={() => runAction(uid, disableAffiliate, `"${affiliate.name}" disabled`)}
                                      title="Disable affiliate"
                                      style={btnStyle('#DC2626', busy)}
                                    >
                                      <Icon name="Pause" size={12} />
                                      Disable
                                    </button>
                                  )}

                                  {/* Loading indicator */}
                                  {busy && (
                                    <div style={{
                                      width: 16, height: 16,
                                      border: '2px solid #D8BFE3',
                                      borderTopColor: '#7B3FA0',
                                      borderRadius: '50%',
                                      animation: 'spin 0.7s linear infinite',
                                      alignSelf: 'center',
                                    }} />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </TableContainer>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AdminLayout>
  );
}

// ── Button style helper ────────────────────────────────────────────────────────
function btnStyle(color, disabled) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 10px',
    borderRadius: '8px',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.4px',
    border: `1px solid ${color}40`,
    background: `${color}10`,
    color: color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s',
    whiteSpace: 'nowrap',
  };
}
