/**
 * Payments.jsx — Admin Payments & Financial Control Dashboard
 *
 * Real-time payment telemetry, transaction log, vendor payout matrix,
 * and refund monitoring. Follows the existing Lumora glassmorphism UI.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, TableContainer } from './components/AdminComponents';
import {
  subscribeToPaymentsTelemetry,
  calculatePaymentOverview,
  calculateVendorPayouts,
  getRefundMonitorList
} from '../../services/paymentService';
import { 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  AlertTriangle,
  User,
  CreditCard,
  TrendingUp,
  FileText
} from 'lucide-react';

export default function Payments() {
  // ─── FIRESTORE STATE ──────────────────────────────────────────────────────
  const [telemetry, setTelemetry] = useState({ orders: [], vendors: [], loading: true });
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // ─── FILTER / SEARCH STATE ────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Success' | 'Pending' | 'Failed' | 'Refunded'
  const [dateFilter, setDateFilter] = useState('30days'); // 'today' | '7days' | '30days' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // ─── TAB STATE FOR REFUNDS ────────────────────────────────────────────────
  const [refundTab, setRefundTab] = useState('Pending'); // 'Pending' | 'Approved' | 'Rejected'

  // ─── PAGINATION STATE (M6) ────────────────────────────────────────────────
  const [txnPage, setTxnPage] = useState(1);
  const TXN_PAGE_SIZE = 50;

  // ─── UI SYSTEM STATE ──────────────────────────────────────────────────────




  // ─── FIRESTORE REAL-TIME LISTENER ─────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToPaymentsTelemetry((data) => {
      setTelemetry(data);
      setLastRefreshed(new Date());
      if (data && !data.loading) setError(null);
    });
    return () => unsubscribe();
  }, []);

  // ─── TELEMETRY COMPUTATIONS ───────────────────────────────────────────────
  const overviewStats = useMemo(() => {
    return calculatePaymentOverview(telemetry.orders);
  }, [telemetry.orders]);

  const vendorPayouts = useMemo(() => {
    return calculateVendorPayouts(telemetry.orders, telemetry.vendors);
  }, [telemetry.orders, telemetry.vendors]);

  const refundList = useMemo(() => {
    return getRefundMonitorList(telemetry.orders);
  }, [telemetry.orders]);

  // ─── FILTER / SEARCH PIPELINE ─────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let list = [...telemetry.orders];

    // 1. Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => 
        (o.id || '').toLowerCase().includes(q) ||
        (o.orderId || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q)
      );
    }

    // 2. Status Badge Filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'Success') {
        list = list.filter(o => o.paymentStatus === 'Paid');
      } else if (statusFilter === 'Pending') {
        list = list.filter(o => o.status === 'Pending' || o.status === 'Processing');
      } else if (statusFilter === 'Failed') {
        list = list.filter(o => o.paymentStatus === 'Failed' || o.status === 'Failed');
      } else if (statusFilter === 'Refunded') {
        list = list.filter(o => o.status === 'Refunded' || o.paymentStatus === 'Refunded');
      }
    }

    // 3. Date Timeframe Filter
    const now = new Date();
    if (dateFilter === 'today') {
      const todayStr = now.toISOString().slice(0, 10);
      list = list.filter(o => o.createdAt && o.createdAt.slice(0, 10) === todayStr);
    } else if (dateFilter === '7days') {
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 7);
      list = list.filter(o => o.createdAt && new Date(o.createdAt) >= cutoff);
    } else if (dateFilter === '30days') {
      const cutoff = new Date();
      cutoff.setDate(now.getDate() - 30);
      list = list.filter(o => o.createdAt && new Date(o.createdAt) >= cutoff);
    } else if (dateFilter === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        list = list.filter(o => o.createdAt && new Date(o.createdAt) >= start);
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999); // include full last day
        list = list.filter(o => o.createdAt && new Date(o.createdAt) <= end);
      }
    }

    return list;
  }, [telemetry.orders, searchQuery, statusFilter, dateFilter, customStartDate, customEndDate]);

  // Pagination slice for transaction list (M6)
  const txnTotalPages = Math.max(1, Math.ceil(filteredOrders.length / TXN_PAGE_SIZE));
  const pagedOrders = filteredOrders.slice((txnPage - 1) * TXN_PAGE_SIZE, txnPage * TXN_PAGE_SIZE);

  // Filter refund requests, approved, rejected
  const filteredRefunds = useMemo(() => {
    return refundList.filter(r => r.status === refundTab);
  }, [refundList, refundTab]);

  return (
    <AdminLayout activePage="payments">
      {/* Container */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* Hero Header */}
        <PageHeader
          title="Financial Control Center"
          subtitle={telemetry.loading ? 'Synchronizing metrics...' : `Real-time updates active. Last sync: ${lastRefreshed.toLocaleTimeString()}`}
          actions={
            !telemetry.loading && (
              <button 
                onClick={() => {
                  setTelemetry(prev => ({ ...prev, loading: true }));
                  setTimeout(() => setTelemetry(prev => ({ ...prev, loading: false })), 300);
                }}
                className="btn-admin-secondary flex items-center gap-2"
              >
                <RefreshCw size={13} className="animate-spin" style={{ animationDuration: '4s' }} />
                Refresh Telemetry
              </button>
            )
          }
        />

        {/* Loading Indicator */}
        {telemetry.loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-[#D8BFE3] border-t-[#7B3FA0] animate-spin" />
            <p className="text-xs font-bold text-[#7B3FA0] uppercase tracking-widest">Loading ledger assets...</p>
          </div>
        )}

        {!telemetry.loading && (
          <>
            {/* Overview Stat Cards */}
            <StatsGrid columns={6} className="mb-12">
              
              {/* Card 1: Total Revenue */}
              <DashboardCard
                title="Total Revenue"
                value={`₹${overviewStats.totalRevenue.toLocaleString()}`}
                icon={<DollarSign size={12} />}
                trend="Gross paid orders"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,15 L20,12 L40,16 L60,8 L80,10 L100,5" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

              {/* Card 2: Pending Revenue */}
              <DashboardCard
                title="Pending Revenue"
                value={`₹${overviewStats.pendingRevenue.toLocaleString()}`}
                icon={<Clock size={12} />}
                trend="Pipeline orders"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,18 L25,15 L50,14 L75,10 L100,8" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

              {/* Card 3: Refunded Amount */}
              <DashboardCard
                title="Refunded Amount"
                value={`₹${overviewStats.refundedAmount.toLocaleString()}`}
                icon={<XCircle size={12} />}
                trend="Returned capital"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,5 L30,6 L60,8 L100,15" fill="none" stroke="#B886D0" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

              {/* Card 4: Successful Payments */}
              <DashboardCard
                title="Success Count"
                value={overviewStats.successfulPayments}
                icon={<CheckCircle2 size={12} />}
                trend="Paid settlements"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,10 L30,12 L60,8 L100,6" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

              {/* Card 5: Failed Payments */}
              <DashboardCard
                title="Failed Count"
                value={overviewStats.failedPayments}
                icon={<AlertTriangle size={12} />}
                trend="Blocked transfers"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,5 L35,12 L70,8 L100,10" fill="none" stroke="#B886D0" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

              {/* Card 6: Total Transactions */}
              <DashboardCard
                title="Transactions"
                value={overviewStats.totalTransactions}
                icon={<TrendingUp size={12} />}
                trend="Cumulative ledger"
                trendLabel=""
                chart={
                  <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                    <path d="M0,15 L50,10 L100,5" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                }
              />

            </StatsGrid>

            {/* Layout Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
              
              {/* Left Panel: Transaction Ledger (60%) */}
              <div className="lg:col-span-6 flex flex-col gap-6">

                {/* Filter and Search Bar */}
                <div className="glass-surface rounded-3xl p-5 border border-white/50 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    
                    {/* Search */}
                    <div className="w-full md:w-72 relative">
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search order, customer, trans ID..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/50 focus:bg-white rounded-2xl border border-stone-200 focus:outline-none focus:border-[#D8BFE3] text-xs transition-all duration-300 placeholder:text-stone-400"
                      />
                      <div className="absolute left-3.5 top-3.5 text-[#7B3FA0]">
                        <Search size={13} />
                      </div>
                    </div>

                    {/* Date filter dropdown */}
                    <div className="w-full md:w-auto flex items-center gap-3 self-end md:self-auto">
                      <span className="text-[10px] font-bold text-[#7B3FA0] tracking-wider uppercase">Timeframe:</span>
                      <div className="relative">
                        <select
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                          className="appearance-none bg-white/60 border border-stone-200 hover:border-[#D8BFE3] px-4 py-2 pr-8 rounded-xl text-xs font-bold text-[#2D004D] focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="today">Today</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                          <option value="custom">Custom Range</option>
                        </select>
                        <div className="absolute right-3 top-2.5 pointer-events-none text-[#7B3FA0]">
                          <ChevronDown size={10} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custom Range Inputs */}
                  {dateFilter === 'custom' && (
                    <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-stone-100/40">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase text-[#7B3FA0]">Start:</span>
                        <input 
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="bg-white/60 border border-stone-200 rounded-lg p-1 text-xs focus:outline-none focus:border-[#D8BFE3]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase text-[#7B3FA0]">End:</span>
                        <input 
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="bg-white/60 border border-stone-200 rounded-lg p-1 text-xs focus:outline-none focus:border-[#D8BFE3]"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status Filters */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100">
                    {['All', 'Success', 'Pending', 'Failed', 'Refunded'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-colors ${
                          statusFilter === status 
                            ? 'bg-[#2D004D] text-white' 
                            : 'bg-stone-100/50 text-[#7B3FA0] hover:bg-stone-100 hover:text-[#2D004D]'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                </div>

                {/* Transaction Ledger Table */}
                <TableContainer>
                  <div className="px-6 py-4 border-b border-[#F3EAF8]/60 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#2D004D] tracking-wide flex items-center gap-2">
                      <CreditCard size={15} />
                      Transaction Ledger
                    </h2>
                    <span className="text-xs text-[#7B3FA0] bg-[#D8BFE3]/20 px-2.5 py-1 rounded-full font-medium">
                      {filteredOrders.length} transactions
                    </span>
                  </div>

                  {/* Loading skeleton */}
                  {telemetry.loading && (
                    <div className="p-4 flex flex-col gap-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 rounded-xl bg-[#F5E9DD]/40 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                      ))}
                    </div>
                  )}

                  {/* Error state */}
                  {!telemetry.loading && error && (
                    <div className="py-12 flex flex-col items-center gap-3 text-center">
                      <p className="text-sm font-bold text-red-400">{error}</p>
                      <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#2D004D] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#7B3FA0] transition-colors">Retry</button>
                    </div>
                  )}

                  <div className="overflow-x-auto w-full">
                    {!telemetry.loading && !error && pagedOrders.length > 0 ? (
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-stone-100/40 border-b border-stone-200/50">
                            {['Transaction ID', 'Order ID', 'Customer', 'Amount', 'Method', 'Payment', 'Order Status', 'Date'].map(h => (
                              <th key={h} className="py-4 px-4 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase white-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedOrders.map((o) => {
                            const paymentStyles = {
                              Paid: 'bg-[#B886D0]/40 text-[#5A1E7E] border-[#B886D0]/80 shadow-[0_0_8px_rgba(184,134,208,0.3)]',
                              Unpaid: 'bg-[#D8BFE3]/40 text-[#7a5940] border-[#D8BFE3]/80',
                              Failed: 'bg-red-500/10 text-red-700 border-red-200',
                              Refunded: 'bg-stone-100 text-stone-500 border-stone-200'
                            };

                            const orderStyles = {
                              Completed: 'bg-[#B886D0]/40 text-[#5A1E7E]',
                              Processing: 'bg-[#D8BFE3]/40 text-[#47607a]',
                              Pending: 'bg-[#D8BFE3]/40 text-[#7a5940]',
                              Failed: 'bg-red-500/10 text-red-700',
                              Refunded: 'bg-stone-100 text-stone-500'
                            };

                            return (
                              <tr 
                                key={o.id}
                                className="border-b border-stone-200/40 hover:bg-white/65 transition-colors"
                              >
                                <td className="py-4 px-4 font-mono text-[10px] text-[#2D004D] font-bold">
                                  {o.id.slice(0, 10)}...
                                </td>
                                <td className="py-4 px-4 font-mono text-[10px] text-[#2D004D]">
                                  {o.orderId || '—'}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#2D004D]">{o.customerName || 'Customer'}</span>
                                    <span className="text-[9px] text-[#7B3FA0] mt-0.5">{o.customerEmail}</span>
                                  </div>
                                </td>
                                <td className="py-4 px-4 font-black text-xs text-[#2D004D]">
                                  ₹{(o.total ?? o.price ?? 0).toLocaleString()}
                                </td>
                                <td className="py-4 px-4 text-xs font-bold text-[#7B3FA0] uppercase">
                                  {o.paymentMethod || 'card'}
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[8px] font-extrabold uppercase tracking-widest ${paymentStyles[o.paymentStatus] || 'bg-stone-100'}`}>
                                    {o.paymentStatus || 'Unpaid'}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-widest ${orderStyles[o.status] || 'bg-stone-100'}`}>
                                    {o.status || 'Pending'}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-[10px] text-[#7B3FA0]">
                                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : !telemetry.loading && !error ? (
                      <div className="py-12 text-center text-[#7B3FA0]">
                        <p className="text-2xl mb-2">💸</p>
                        <p className="text-xs font-bold uppercase tracking-widest">No transactions found</p>
                      </div>
                    ) : null}
                  </div>

                  {/* Pagination controls */}
                  {!telemetry.loading && !error && txnTotalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-[#F5E9DD]/60">
                      <span className="text-[9px] text-[#7B3FA0] font-bold">
                        Page {txnPage} of {txnTotalPages} &bull; {filteredOrders.length} transactions
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                          disabled={txnPage === 1}
                          className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setTxnPage(p => Math.min(txnTotalPages, p + 1))}
                          disabled={txnPage === txnTotalPages}
                          className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </TableContainer>

              </div>

              {/* Right Panel: Payouts & Refunds (40%) */}
              <div className="lg:col-span-4 flex flex-col gap-8">
                
                {/* Vendor Payout Summary */}
                <TableContainer>
                  <div className="px-6 py-4 border-b border-[#F3EAF8]/60 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#2D004D] tracking-wide flex items-center gap-2">
                      <User size={15} />
                      Vendor Payout Summary
                    </h2>
                  </div>

                  <div className="overflow-x-auto w-full">
                    {vendorPayouts.length > 0 ? (
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-stone-100/40 border-b border-stone-200/50">
                            {['Vendor', 'Sales', 'Comm. (5%)', 'Paid', 'Pending'].map(h => (
                              <th key={h} className="py-3.5 px-4 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vendorPayouts.map((v) => (
                            <tr key={v.vendorId} className="border-b border-stone-200/40 hover:bg-white/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-xs text-[#2D004D]">
                                {v.vendorName}
                              </td>
                              <td className="py-3 px-4 font-black text-xs text-[#2D004D]">
                                ₹{v.totalSales.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-xs text-[#7B3FA0]">
                                ₹{v.commission.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-xs text-[#5A1E7E] font-medium">
                                ₹{v.paidPayout.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-xs font-bold text-[#9B2C5E]">
                                ₹{v.pendingPayout.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-8 text-center text-[#7B3FA0]">
                        <p className="text-xs font-bold uppercase tracking-widest">No vendor accounts verified</p>
                      </div>
                    )}
                  </div>
                </TableContainer>

                {/* Refund Monitoring */}
                <TableContainer>
                  <div className="px-6 py-4 border-b border-[#F3EAF8]/60 flex flex-col gap-2">
                    <h2 className="text-sm font-semibold text-[#2D004D] tracking-wide flex items-center gap-2">
                      <FileText size={15} />
                      Refund Monitoring
                    </h2>
                    
                    {/* Refund status tabs */}
                    <div className="flex gap-2 mt-2">
                      {['Pending', 'Approved', 'Rejected'].map(t => (
                        <button
                          key={t}
                          onClick={() => setRefundTab(t)}
                          className={`flex-1 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition ${
                            refundTab === t 
                              ? 'bg-[#B886D0]/30 text-[#5A1E7E] font-extrabold border border-[#B886D0]/50'
                              : 'bg-stone-50 text-stone-500 border border-transparent'
                          }`}
                        >
                          {t} ({refundList.filter(r => r.status === t).length})
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-[300px]">
                    {filteredRefunds.length > 0 ? (
                      <div className="divide-y divide-stone-100">
                        {filteredRefunds.map((ref) => (
                          <div key={ref.id} className="p-4 hover:bg-white/50 transition-colors flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-[9px] font-bold text-[#2D004D]">{ref.orderId}</span>
                              <span className="font-black text-xs text-[#2D004D]">₹{ref.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-[#7B3FA0] font-medium">{ref.customerName}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                                ref.status === 'Approved' ? 'bg-[#B886D0]/30 text-[#5A1E7E]' :
                                ref.status === 'Pending' ? 'bg-[#D8BFE3]/40 text-[#7a5940]' :
                                'bg-red-500/10 text-red-700'
                              }`}>
                                {ref.status}
                              </span>
                            </div>
                            <div className="bg-stone-100/50 p-2 rounded-lg text-[9px] text-stone-600 font-light italic leading-relaxed">
                              "{ref.refundReason}"
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-[#7B3FA0]">
                        <p className="text-[10px] font-bold uppercase tracking-widest">No {refundTab.toLowerCase()} refunds logged</p>
                      </div>
                    )}
                  </div>
                </TableContainer>

              </div>

            </section>
          </>
        )}

      </main>
    </AdminLayout>
  );
}
