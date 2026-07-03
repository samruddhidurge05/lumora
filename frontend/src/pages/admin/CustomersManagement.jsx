/**
 * CustomersManagement.jsx — Admin Customer Registry Console
 *
 * Displays all Firestore users with role="customer" or "Customer" in a table.
 * Includes real-time Firestore updates, dynamic statistics cards, search,
 * sorting, and a detailed side panel/modal.
 *
 * Styling matches the established Lumora Admin design system (glass-surface cards,
 * premium gradients, Outfit/serif font typography, and purple/gold color palette).
 */

import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from './components/AdminLayout';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { backendFetch } from '../../utils/api';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, FilterBar, TableContainer } from './components/AdminComponents';

// ── Icon System (Inline SVG matching existing admin layout pattern) ───────────
const Icon = ({ name, size = 16, className = '' }) => {
  const svgs = {
    Users:         <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></g>,
    User:          <g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g>,
    ShoppingBag:   <g><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></g>,
    DollarSign:    <g><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></g>,
    Search:        <g><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></g>,
    X:             <g><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></g>,
    RefreshCw:     <g><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></g>,
    Eye:           <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></g>,
    AlertTriangle: <g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>,
    Info:          <g><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></g>,
    Calendar:      <g><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>,
    Tag:           <g><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></g>,
    Lock:          <g><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></g>
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

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || 'active').toLowerCase();
  let bg = 'rgba(16,185,129,0.10)';
  let border = 'rgba(16,185,129,0.30)';
  let color = '#059669';
  let dot = '#10B981';
  let label = 'Active';

  if (s === 'restricted') {
    bg = 'rgba(245,158,11,0.10)';
    border = 'rgba(245,158,11,0.30)';
    color = '#B45309';
    dot = '#F59E0B';
    label = 'Restricted';
  } else if (s === 'disabled') {
    bg = 'rgba(220,38,38,0.08)';
    border = 'rgba(220,38,38,0.20)';
    color = '#DC2626';
    dot = '#EF4444';
    label = 'Disabled';
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

// ── Main Page Component ───────────────────────────────────────────────────────
export default function CustomersManagement() {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState(null);
  
  // Controls
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateSort, setDateSort] = useState('newest'); // 'newest' | 'oldest'
  const [orderSort, setOrderSort] = useState('none');  // 'none' | 'most' | 'least'
  
  // Details Modal Drawer
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // ── Real-time synchronization ──────────────────────────────────────────────
  useEffect(() => {
    setLoadingUsers(true);
    setError(null);

    const customerQuery = query(
      collection(db, 'users'), 
      where('role', 'in', ['customer', 'Customer'])
    );

    let usersFetched = false; // guard: REST fallback fires only once per mount

    const unsubUsers = onSnapshot(
      customerQuery,
      (snap) => {
        const list = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        setUsers(list);
        setLoadingUsers(false);
      },
      async (err) => {
        if (usersFetched) return;
        usersFetched = true;
        console.error('[CustomersManagement] Error loading users, falling back to REST:', err);
        try {
          const res = await backendFetch('/admin/customers/');
          setUsers(Array.isArray(res) ? res : []);
        } catch (fetchErr) {
          setError('Failed to fetch customer records.');
        } finally {
          setLoadingUsers(false);
        }
      }
    );

    return () => unsubUsers();
  }, []);

  useEffect(() => {
    setLoadingOrders(true);

    let ordersFetched = false; // guard: REST fallback fires only once per mount

    const unsubOrders = onSnapshot(
      collection(db, 'orders'),
      (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(list);
        setLoadingOrders(false);
      },
      async (err) => {
        if (ordersFetched) return;
        ordersFetched = true;
        console.error('[CustomersManagement] Error loading orders, falling back to REST:', err);
        try {
          const res = await backendFetch('/admin/orders/');
          setOrders(Array.isArray(res) ? res : []);
        } catch (fetchErr) {
          console.error(fetchErr);
        } finally {
          setLoadingOrders(false);
        }
      }
    );

    return () => unsubOrders();
  }, []);

  // ── Combine and derive stats per customer ────────────────────────────────────
  const processedCustomers = useMemo(() => {
    return users.map(user => {
      // Find orders matching this customer's UID or email
      const customerOrders = orders.filter(o => 
        o.customerId === user.uid || 
        (o.customerEmail && user.email && o.customerEmail.toLowerCase() === user.email.toLowerCase())
      );

      // Total orders
      const totalOrders = customerOrders.length;

      // Spent: Exclude refunded or failed orders
      const totalSpent = customerOrders
        .filter(o => o.status !== 'Refunded' && o.status !== 'failed' && o.status !== 'Refund')
        .reduce((sum, o) => sum + (o.price || o.total || 0), 0);

      // Sorted purchase log
      const recentPurchases = [...customerOrders].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.purchaseDate || 0);
        const dateB = new Date(b.createdAt || b.purchaseDate || 0);
        return dateB - dateA;
      });

      // Last Active date
      const lastActive = recentPurchases.length > 0 
        ? (recentPurchases[0].createdAt || recentPurchases[0].purchaseDate)
        : (user.updatedAt || user.createdAt || null);

      return {
        ...user,
        name: user.displayName || user.name || 'Unnamed Customer',
        totalOrders,
        totalSpent,
        recentPurchases,
        lastActive,
        joinedDate: user.createdAt || new Date().toISOString()
      };
    });
  }, [users, orders]);

  // ── Calculations for Overview Statistics Cards ─────────────────────────────
  const stats = useMemo(() => {
    const totalCount = processedCustomers.length;
    const activeCount = processedCustomers.filter(c => (c.status || 'active') === 'active').length;
    const totalOrdersCount = processedCustomers.reduce((sum, c) => sum + c.totalOrders, 0);
    const totalRevenue = processedCustomers.reduce((sum, c) => sum + c.totalSpent, 0);

    return [
      { label: 'Registered Customers', value: totalCount, icon: 'Users', color: '#7B3FA0' },
      { label: 'Active Customers', value: activeCount, icon: 'User', color: '#059669' },
      { label: 'Total Customer Orders', value: totalOrdersCount, icon: 'ShoppingBag', color: '#B886D0' },
      { label: 'Customer Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: 'DollarSign', color: '#9B2C5E' }
    ];
  }, [processedCustomers]);

  // ── Filtering & Sorting Pipelines ──────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    let result = [...processedCustomers];

    // Search query matches
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.email || '').toLowerCase().includes(q) || 
        c.uid.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(c => (c.status || 'active').toLowerCase() === statusFilter);
    }

    // Date sorting
    if (dateSort === 'newest') {
      result.sort((a, b) => new Date(b.joinedDate) - new Date(a.joinedDate));
    } else if (dateSort === 'oldest') {
      result.sort((a, b) => new Date(a.joinedDate) - new Date(b.joinedDate));
    }

    // Order count sorting
    if (orderSort === 'most') {
      result.sort((a, b) => b.totalOrders - a.totalOrders);
    } else if (orderSort === 'least') {
      result.sort((a, b) => a.totalOrders - b.totalOrders);
    }

    return result;
  }, [processedCustomers, search, statusFilter, dateSort, orderSort]);

  // Format Helper for joined dates
  const formatJoinedDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isPageLoading = loadingUsers || loadingOrders;

  // Render Page Content
  return (
    <AdminLayout activePage="customers">
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* ── Page Header ── */}
        <PageHeader
          title="Customer Registry"
          subtitle="View platform customers, trace order histories, verify spending metrics, and monitor account access logs."
          actions={
            <button
              onClick={() => {}}
              className="btn-admin-secondary flex items-center gap-2"
            >
              <Icon name="RefreshCw" size={13} />
              Sync Live
            </button>
          }
        />

        {/* ── Statistics Summary Grid ── */}
        <StatsGrid columns={4}>
          {stats.map(s => (
            <DashboardCard
              key={s.label}
              title={s.label}
              value={s.value}
              icon={<Icon name={s.icon} size={15} style={{ color: s.color }} />}
            />
          ))}
        </StatsGrid>

        {/* ── Search, Filters, and Table Controls ── */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, email, or UID..."
          filters={[
            // Status Select
            <div key="status" className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white/70 border border-[#F3EAF8] rounded-lg px-2.5 py-1.5 text-xs text-[#2D004D] focus:outline-none focus:border-[#B886D0]"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="restricted">Restricted</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>,
            // Date Sort Select
            <div key="date" className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">Joined:</span>
              <select
                value={dateSort}
                onChange={e => { setDateSort(e.target.value); setOrderSort('none'); }}
                className="bg-white/70 border border-[#F3EAF8] rounded-lg px-2.5 py-1.5 text-xs text-[#2D004D] focus:outline-none focus:border-[#B886D0]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>,
            // Order Sort Select
            <div key="orders" className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">Orders:</span>
              <select
                value={orderSort}
                onChange={e => { setOrderSort(e.target.value); setDateSort('none'); }}
                className="bg-white/70 border border-[#F3EAF8] rounded-lg px-2.5 py-1.5 text-xs text-[#2D004D] focus:outline-none focus:border-[#B886D0]"
              >
                <option value="none">Default</option>
                <option value="most">Most Orders</option>
                <option value="least">Least Orders</option>
              </select>
            </div>
          ]}
        />

        {/* ── Customer Ledger Table ── */}
        <TableContainer>
          <div className="px-6 py-4 border-b border-[#F3EAF8]/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D004D] tracking-wide flex items-center gap-2">
              <Icon name="Users" size={15} />
              Customer Database
            </h2>
            <span className="text-xs text-[#7B3FA0] bg-[#D8BFE3]/20 px-2.5 py-1 rounded-full font-medium">
              {filteredCustomers.length} displayed
            </span>
          </div>

          {/* Loading View */}
          {isPageLoading && (
            <div className="flex items-center justify-center py-24 gap-3 text-[#7B3FA0]">
              <div className="w-5 h-5 border-2 border-[#B886D0] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Fetching registry metrics…</span>
            </div>
          )}

          {/* Empty View */}
          {!isPageLoading && filteredCustomers.length === 0 && (
            <div className="text-center py-20 text-[#7B3FA0]">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-medium">No customers found.</p>
              <p className="text-xs opacity-60 mt-1">Try resetting your active filters or query inputs.</p>
            </div>
          )}

          {/* Table Data */}
          {!isPageLoading && filteredCustomers.length > 0 && (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(216,191,227,0.20)' }}>
                    {['Customer', 'Email', 'UID', 'Joined', 'Orders', 'Spent', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px',
                        textAlign: 'left',
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                        color: '#7B3FA0',
                        whiteSpace: 'nowrap'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer, idx) => (
                    <tr
                      key={customer.uid}
                      onClick={() => setSelectedCustomer(customer)}
                      style={{
                        borderBottom: idx < filteredCustomers.length - 1 ? '1px solid rgba(216,191,227,0.12)' : 'none',
                        background: 'transparent',
                        transition: 'background 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(216,191,227,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Customer Name / Avatar */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #D8BFE3, #B886D0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0
                          }}>
                            {customer.name[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#2D004D' }}>
                            {customer.name}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '12px', color: '#7B3FA0' }}>{customer.email}</span>
                      </td>

                      {/* UID */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#8E6AA8' }}>{customer.uid}</span>
                      </td>

                      {/* Joined Date */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '12px', color: '#7B3FA0' }}>
                          {formatJoinedDate(customer.joinedDate)}
                        </span>
                      </td>

                      {/* Orders Count */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '12px', color: '#2D004D', fontWeight: 600 }}>
                          {customer.totalOrders}
                        </span>
                      </td>

                      {/* Spent */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '12px', color: '#9B2C5E', fontWeight: 700 }}>
                          ₹{customer.totalSpent.toLocaleString()}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <StatusBadge status={customer.status || 'active'} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedCustomer(customer); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#7B3FA0]/30 bg-[#7B3FA0]/5 text-[#7B3FA0] text-[10px] font-bold uppercase tracking-wider hover:bg-[#7B3FA0]/10 transition"
                        >
                          <Icon name="Eye" size={11} />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableContainer>
      </main>

      {/* ── Details Side Drawer / Modal ── */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(45,0,77,0.40)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.3s ease-out'
        }} onClick={() => setSelectedCustomer(null)}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: 'radial-gradient(circle at 50% 0%, #FFFDF9 0%, #FAF5FD 100%)',
            height: '100vh',
            boxShadow: '-10px 0 40px rgba(45,0,77,0.15)',
            borderLeft: '1px solid rgba(142, 106, 168, 0.15)',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            overflowY: 'auto',
            animation: 'slideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyBetween: 'space-between', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#7B3FA0', letterSpacing: '1px', textTransform: 'uppercase' }}>CUSTOMER DETAILS</span>
                <h3 style={{ fontSize: '1.6rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: '#2D004D', marginTop: '4px' }}>
                  {selectedCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                style={{
                  background: 'rgba(123, 63, 160, 0.06)',
                  border: '1px solid rgba(123, 63, 160, 0.12)',
                  borderRadius: '50%',
                  width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7B3FA0', cursor: 'pointer'
                }}
              >
                <Icon name="X" size={14} />
              </button>
            </div>

            {/* Basic Info Section */}
            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(142,106,168,0.1)', borderRadius: '20px', padding: '20px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px' }}>Basic Profile</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Email Address</span>
                  <strong style={{ color: '#2D004D' }}>{selectedCustomer.email || '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Account Status</span>
                  <StatusBadge status={selectedCustomer.status || 'active'} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Customer UID</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#7B3FA0' }}>{selectedCustomer.uid}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Registered On</span>
                  <strong>{formatJoinedDate(selectedCustomer.joinedDate)}</strong>
                </div>
              </div>
            </div>

            {/* Purchases Info Section */}
            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(142,106,168,0.1)', borderRadius: '20px', padding: '20px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '14px' }}>Purchase Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Total Placed Orders</span>
                  <strong style={{ color: '#2D004D', fontSize: '13px' }}>{selectedCustomer.totalOrders}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Lifetime Expenditures</span>
                  <strong style={{ color: '#9B2C5E', fontSize: '13px' }}>₹{selectedCustomer.totalSpent.toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(45,0,77,0.6)' }}>Last Purchase</span>
                  <strong>
                    {selectedCustomer.recentPurchases.length > 0 
                      ? `${formatJoinedDate(selectedCustomer.recentPurchases[0].createdAt || selectedCustomer.recentPurchases[0].purchaseDate)} (${selectedCustomer.recentPurchases[0].productName || 'Product'})`
                      : 'Never Purchased'
                    }
                  </strong>
                </div>
              </div>
            </div>

            {/* Affiliate Referral Section */}
            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(142,106,168,0.1)', borderRadius: '20px', padding: '20px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Affiliate & Referral Tracking</h4>
              {selectedCustomer.recentPurchases.some(o => o.affiliateCode) ? (
                <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(45,0,77,0.6)' }}>Last Referral Code</span>
                    <strong style={{
                      color: '#7B3FA0',
                      background: 'rgba(123, 63, 160, 0.08)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {selectedCustomer.recentPurchases.find(o => o.affiliateCode)?.affiliateCode}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(45,0,77,0.6)' }}>Affiliate Marketer</span>
                    <strong>{selectedCustomer.recentPurchases.find(o => o.affiliateName)?.affiliateName || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(45,0,77,0.6)' }}>Referred Purchases</span>
                    <strong>
                      {selectedCustomer.recentPurchases.filter(o => o.affiliateCode).length} of {selectedCustomer.totalOrders}
                    </strong>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'rgba(45,0,77,0.5)', margin: 0 }}>No affiliate referral codes detected in client's order ledger.</p>
              )}
            </div>

            {/* Vendor Breakdown Section */}
            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid rgba(142,106,168,0.1)', borderRadius: '20px', padding: '20px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Vendor Breakdown</h4>
              {selectedCustomer.recentPurchases.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedCustomer.recentPurchases
                    .map(o => o.vendorName)
                    .filter((val, i, self) => val && self.indexOf(val) === i)
                    .map(v => (
                      <span key={v} style={{
                        fontSize: '11px',
                        background: 'rgba(184,134,208,0.12)',
                        border: '1px solid rgba(184,134,208,0.25)',
                        color: '#7B3FA0',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontWeight: 600
                      }}>🏪 {v}</span>
                    ))
                  }
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'rgba(45,0,77,0.5)', margin: 0 }}>No purchases found.</p>
              )}
            </div>

            {/* Purchase History Logs */}
            <div>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px' }}>Recent Purchases (Max 5)</h4>
              {selectedCustomer.recentPurchases.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedCustomer.recentPurchases.slice(0, 5).map(o => (
                    <div key={o.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(142,106,168,0.06)',
                      borderRadius: '12px', padding: '10px 14px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {o.productName || 'Product'}
                        </span>
                        <span style={{ fontSize: '9px', color: '#8E6AA8', fontFamily: 'monospace' }}>
                          ID: {o.id || o.orderId}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#9B2C5E' }}>
                          ₹{(o.price ?? o.total ?? 0).toLocaleString()}
                        </span>
                        <span style={{
                          fontSize: '8px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: o.status === 'completed' || o.status === 'Paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                          color: o.status === 'completed' || o.status === 'Paid' ? '#059669' : '#B45309'
                        }}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'rgba(45,0,77,0.5)', margin: 0 }}>No transaction logs available.</p>
              )}
            </div>

            {/* Future Administrative Actions Section (Placeholder) */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(142,106,168,0.1)', paddingTop: '20px' }}>
              <h4 style={{ fontSize: '10px', fontWeight: 800, color: '#8E6AA8', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="Lock" size={11} />
                Administrative Actions (Coming Soon)
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Disable Customer', 'Reset Password', 'Delete Account'].map(act => (
                  <button
                    key={act}
                    disabled
                    style={{
                      flex: '1 1 auto',
                      padding: '8px 12px',
                      background: 'rgba(142,106,168,0.06)',
                      border: '1px solid rgba(142,106,168,0.12)',
                      borderRadius: '10px',
                      color: 'rgba(45,0,77,0.40)',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      cursor: 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🔒</span>
                    {act}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Embedded slide-drawer and fade animation styles */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

    </AdminLayout>
  );
}
