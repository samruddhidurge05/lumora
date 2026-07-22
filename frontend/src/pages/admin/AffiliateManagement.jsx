import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShoppingBag, DollarSign, TrendingUp, Link2, QrCode, Search,
  Filter, Check, X, ChevronRight, RefreshCw, AlertCircle, ShieldAlert,
  ArrowUpRight, BarChart3, PieChart, Lock, Sliders, CheckSquare, Square,
  Layers, ExternalLink
} from 'lucide-react';

import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import ProductQrCode from '../../components/product/ProductQrCode';
import { buildAffiliateReferralLink, calculateCommission } from '../../utils/referralUtils';
import { backendFetch } from '../../utils/api';

// Mock initial data if backend API is loading or offline
const MOCK_AFFILIATES = [
  { id: 1, name: 'Apex Media Studio', email: 'affiliate@apexmedia.com', code: 'AFF-0001', status: 'active', clicks: 1240, sales: 88, revenue: 142000, commission: 28400, pending: 4200, joined: '2026-01-15' },
  { id: 2, name: 'Digital Craft Reviews', email: 'contact@digitalcraft.io', code: 'AFF-0002', status: 'active', clicks: 890, sales: 45, revenue: 89000, commission: 17800, pending: 1200, joined: '2026-02-01' },
  { id: 3, name: 'UI/UX Hub India', email: 'partner@uiuxhub.in', code: 'AFF-0003', status: 'active', clicks: 2150, sales: 162, revenue: 295000, commission: 59000, pending: 8500, joined: '2025-11-20' },
  { id: 4, name: 'Creative Stack Labs', email: 'promo@creativestack.com', code: 'AFF-0004', status: 'suspended', clicks: 310, sales: 8, revenue: 12000, commission: 2400, pending: 0, joined: '2026-03-10' },
];

export default function AffiliateManagement() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');

  // Selected products for bulk operations
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCommissionMode, setBulkCommissionMode] = useState('percentage');
  const [bulkCommissionValue, setBulkCommissionValue] = useState(20);
  const [bulkEnableStatus, setBulkEnableStatus] = useState(true);

  // QR Modal State
  const [qrModalProduct, setQrModalProduct] = useState(null);

  // State for products (synced from API or mock)
  const [products, setProducts] = useState([
    { id: 1, title: 'Lumora Pro UI Kit', category: 'Graphics & UI', price: 999, status: 'published', affiliate_enabled: true, commission_mode: 'percentage', commission_value: 20, affiliate_cookie_days: 30, clicks: 420, sales: 34 },
    { id: 2, title: 'Atmospheric Shaders V2', category: '3D & Shaders', price: 1499, status: 'published', affiliate_enabled: true, commission_mode: 'percentage', commission_value: 25, affiliate_cookie_days: 30, clicks: 680, sales: 52 },
    { id: 3, title: 'Neumorphic Dashboard System', category: 'Web Templates', price: 2499, status: 'published', affiliate_enabled: false, commission_mode: 'percentage', commission_value: 15, affiliate_cookie_days: 30, clicks: 0, sales: 0 },
    { id: 4, title: 'Cyberpunk Asset Pack', category: 'Game Assets', price: 799, status: 'published', affiliate_enabled: true, commission_mode: 'fixed', commission_value: 200, affiliate_cookie_days: 30, clicks: 150, sales: 12 },
  ]);

  const [affiliates, setAffiliates] = useState(MOCK_AFFILIATES);

  useEffect(() => {
    // Load live affiliates
    backendFetch('/admin/affiliates/')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAffiliates(data);
        }
      })
      .catch(() => {});

    // Load live products
    backendFetch('/admin/products')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          const items = Array.isArray(data) ? data : (data.products || data.items || []);
          if (items.length > 0) setProducts(items);
        }
      })
      .catch(() => {});
  }, []);

  // Statistics summaries
  const stats = useMemo(() => {
    const enabledProds = products.filter(p => p.affiliate_enabled);
    const activeAffs = affiliates.filter(a => a.status === 'active');
    const totalRev = affiliates.reduce((acc, a) => acc + a.revenue, 0);
    const totalComm = affiliates.reduce((acc, a) => acc + a.commission, 0);
    const pendingComm = affiliates.reduce((acc, a) => acc + a.pending, 0);
    const totalClicks = affiliates.reduce((acc, a) => acc + a.clicks, 0);
    const totalSales = affiliates.reduce((acc, a) => acc + a.sales, 0);

    return {
      enabledProductsCount: enabledProds.length,
      totalProductsCount: products.length,
      activeAffiliatesCount: activeAffs.length,
      totalRevenue: totalRev,
      totalCommission: totalComm,
      pendingCommission: pendingComm,
      totalClicks,
      totalSales,
      ctr: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : '0.0'
    };
  }, [products, affiliates]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = (p.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.category || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === 'all' ? true : statusFilter === 'enabled' ? p.affiliate_enabled : !p.affiliate_enabled;
      const matchMode = modeFilter === 'all' ? true : p.commission_mode === modeFilter;
      return matchSearch && matchStatus && matchMode;
    });
  }, [products, searchQuery, statusFilter, modeFilter]);

  // Toggle single product affiliate state
  const handleToggleProductAffiliate = (productId) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, affiliate_enabled: !p.affiliate_enabled };
      }
      return p;
    }));
  };

  // Select / Deselect for bulk operations
  const toggleSelectProduct = (id) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  // Bulk Apply
  const handleApplyBulkUpdate = () => {
    if (selectedProductIds.length === 0) return;
    setProducts(prev => prev.map(p => {
      if (selectedProductIds.includes(p.id)) {
        return {
          ...p,
          affiliate_enabled: bulkEnableStatus,
          commission_mode: bulkCommissionMode,
          commission_value: Number(bulkCommissionValue) || 0
        };
      }
      return p;
    }));
    setShowBulkModal(false);
    setSelectedProductIds([]);
  };

  // Toggle Affiliate Status (Suspend/Activate)
  const handleToggleAffiliateStatus = (affId) => {
    setAffiliates(prev => prev.map(a => {
      if (a.id === affId) {
        return { ...a, status: a.status === 'active' ? 'suspended' : 'active' };
      }
      return a;
    }));
  };

  const [referralAnalytics, setReferralAnalytics] = useState(null);

  useEffect(() => {
    backendFetch('/affiliate/referrals/admin-analytics')
      .then(res => setReferralAnalytics(res))
      .catch(() => {});
  }, []);

  return (
    <AdminLayout activePage="affiliate-management">
      <div className="p-6 md:p-10 space-y-8 max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F3EAF8] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] text-[10px] font-black tracking-widest uppercase">
                ENTERPRISE SYSTEM
              </span>
              <span className="text-xs text-[#7B3FA0] font-medium">AFF-XXXX Architecture</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#2D004D] font-bold">
              Affiliate Management Console
            </h1>
            <p className="text-xs text-[#7B3FA0] mt-1 max-w-xl">
              Configure product-level affiliate promotion policies, review promoter conversion metrics, manage commission rules, and inspect realtime ecosystem performance.
            </p>
          </div>

          {/* Tab Navigation Pill Header */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#F8F3FB] border border-[#F3EAF8] overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'referrals', label: 'Referral Lifecycle', icon: Link2 },
              { id: 'products', label: 'Products Matrix', icon: ShoppingBag },
              { id: 'affiliates', label: 'Promoters Table', icon: Users },
              { id: 'rules', label: 'Commission Rules', icon: Sliders },
              { id: 'analytics', label: 'Analytics', icon: PieChart },
            ].map(tab => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#7B3FA0] to-[#5C2B7C] text-white shadow-md'
                      : 'text-[#7B3FA0] hover:bg-white/60'
                  }`}
                >
                  <IconComp size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[#7B3FA0]">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Active Promoters</span>
                  <Users size={18} />
                </div>
                <div className="text-2xl font-serif font-bold text-[#2D004D]">{stats.activeAffiliatesCount}</div>
                <div className="text-[10px] text-emerald-600 font-bold">Total registered affiliates in ecosystem</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[#7B3FA0]">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Affiliate Eligible Products</span>
                  <ShoppingBag size={18} />
                </div>
                <div className="text-2xl font-serif font-bold text-[#2D004D]">
                  {stats.enabledProductsCount} <span className="text-xs text-[#7B3FA0] font-normal">/ {stats.totalProductsCount}</span>
                </div>
                <div className="text-[10px] text-[#7B3FA0] font-medium">Products with affiliate promotion enabled</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[#7B3FA0]">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Referred Revenue</span>
                  <TrendingUp size={18} />
                </div>
                <div className="text-2xl font-serif font-bold text-[#2D004D]">₹{stats.totalRevenue.toLocaleString()}</div>
                <div className="text-[10px] text-emerald-600 font-bold">Total sales generated through AFF links</div>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
                <div className="flex items-center justify-between text-[#7B3FA0]">
                  <span className="text-[10px] font-bold uppercase tracking-widest">Commission Paid</span>
                  <DollarSign size={18} />
                </div>
                <div className="text-2xl font-serif font-bold text-[#2D004D]">₹{stats.totalCommission.toLocaleString()}</div>
                <div className="text-[10px] text-[#7B3FA0] font-medium">Pending payout: ₹{stats.pendingCommission.toLocaleString()}</div>
              </div>
            </div>

            {/* Program Health & Recent Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">
                  Ecosystem Conversion Funnel
                </h3>
                <div className="grid grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-center">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Total Clicks</span>
                    <span className="text-xl font-bold text-[#2D004D]">{stats.totalClicks}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-center">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Total Orders</span>
                    <span className="text-xl font-bold text-[#2D004D]">{stats.totalSales}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8] text-center">
                    <span className="text-[10px] font-bold text-[#7B3FA0] uppercase block mb-1">Conversion Rate</span>
                    <span className="text-xl font-bold text-emerald-600">{stats.ctr}%</span>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#7B3FA0] to-[#2D004D] text-white space-y-4 shadow-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#D8BFE3]">
                  System Architecture Status
                </h3>
                <p className="text-xs text-white/80 leading-relaxed">
                  Product-level affiliate eligibility is enforced directly at the SQL database layer. Disabling a product instantly suppresses it from affiliate promotion dashboards.
                </p>
                <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>Backend Query Isolation</span>
                  <Check size={16} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: REFERRAL LIFECYCLE ── */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider block">Total Referral Clicks</span>
                <div className="text-xl font-bold text-[#2D004D] mt-1">{referralAnalytics?.summary?.total_clicks || 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider block">Authenticated Visitors</span>
                <div className="text-xl font-bold text-[#2D004D] mt-1">{referralAnalytics?.summary?.authenticated_visitors || 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider block">Product Views</span>
                <div className="text-xl font-bold text-[#2D004D] mt-1">{referralAnalytics?.summary?.product_views || 0}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm">
                <span className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider block">Purchases & Conversions</span>
                <div className="text-xl font-bold text-emerald-600 mt-1">{referralAnalytics?.summary?.purchases || 0} ({referralAnalytics?.summary?.conversion_rate || 0}%)</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden">
              <div className="p-4 border-b border-[#F3EAF8] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#2D004D]">Persistent Referral Attribution Ledger</h3>
                <span className="text-xs text-[#7B3FA0] font-medium">PostgreSQL Single Source of Truth</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#2D004D]">
                  <thead className="bg-[#F8F3FB] text-[10px] font-bold uppercase tracking-wider text-[#7B3FA0]">
                    <tr>
                      <th className="p-3">Ref Code</th>
                      <th className="p-3">Promoter</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Customer Email</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Clicked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EAF8]">
                    {(!referralAnalytics?.referrals || referralAnalytics.referrals.length === 0) ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-xs text-gray-400">
                          No referral lifecycle events recorded yet.
                        </td>
                      </tr>
                    ) : (
                      referralAnalytics.referrals.map((r) => (
                        <tr key={r.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[#7B3FA0]">{r.referral_code}</td>
                          <td className="p-3 font-medium">{r.affiliate_name}</td>
                          <td className="p-3 font-medium">{r.product_title}</td>
                          <td className="p-3 text-gray-600">{r.customer_email}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              r.status === 'PURCHASED' ? 'bg-emerald-100 text-emerald-700' :
                              r.status === 'AUTHENTICATED' ? 'bg-blue-100 text-blue-700' :
                              r.status === 'PRODUCT_VIEWED' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-gray-500">{r.order_id ? `#${r.order_id}` : '—'}</td>
                          <td className="p-3 text-gray-400">{r.clicked_at ? new Date(r.clicked_at).toLocaleString() : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PRODUCTS MATRIX ── */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            {/* Filter & Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#F3EAF8] shadow-sm">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product..."
                    className="w-full pl-9 pr-4 py-2 bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-xs focus:outline-none text-[#2D004D]"
                  />
                </div>

                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'enabled', label: '🟢 Affiliate Enabled' },
                    { value: 'disabled', label: '⚪ Affiliate Disabled' },
                  ]}
                  className="w-36"
                />

                <AdminSelect
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Modes' },
                    { value: 'percentage', label: 'Percentage (%)' },
                    { value: 'fixed', label: 'Fixed Amount (₹)' },
                  ]}
                  className="w-36"
                />
              </div>

              {selectedProductIds.length > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#7B3FA0] text-white text-xs font-bold flex items-center gap-2 shadow-md hover:bg-[#5C2B7C] transition-all"
                >
                  <Sliders size={14} />
                  <span>Bulk Edit ({selectedProductIds.length})</span>
                </button>
              )}
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4 w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                          <CheckSquare size={16} className="text-[#7B3FA0]" />
                        ) : (
                          <Square size={16} className="text-[#7B3FA0]/40" />
                        )}
                      </button>
                    </th>
                    <th className="p-4">Product Title</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Affiliate Status</th>
                    <th className="p-4">Commission Policy</th>
                    <th className="p-4">Est. Earnings</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {filteredProducts.map(prod => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    const estEarnings = calculateCommission(prod.price, prod.commission_mode, prod.commission_value);

                    return (
                      <tr key={prod.id} className={`hover:bg-[#F8F3FB]/50 transition-colors ${isSelected ? 'bg-[#F8F3FB]' : ''}`}>
                        <td className="p-4">
                          <button onClick={() => toggleSelectProduct(prod.id)}>
                            {isSelected ? (
                              <CheckSquare size={16} className="text-[#7B3FA0]" />
                            ) : (
                              <Square size={16} className="text-[#7B3FA0]/40" />
                            )}
                          </button>
                        </td>
                        <td className="p-4 font-bold text-[#2D004D]">
                          {prod.title}
                          <span className="block text-[10px] text-[#7B3FA0] font-normal">{prod.category}</span>
                        </td>
                        <td className="p-4 font-semibold">₹{prod.price}</td>
                        <td className="p-4">
                          {prod.affiliate_enabled ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 Enabled
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
                              ⚪ Disabled
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-medium">
                          {prod.affiliate_enabled ? (
                            <span>
                              {prod.commission_mode === 'fixed' ? `Fixed ₹${prod.commission_value}` : `${prod.commission_value}%`}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-emerald-600">
                          {prod.affiliate_enabled ? `₹${estEarnings.toFixed(2)}` : '—'}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleToggleProductAffiliate(prod.id)}
                            className="px-3 py-1.5 rounded-lg border border-[#F3EAF8] hover:bg-white text-[11px] font-bold text-[#7B3FA0] transition-all"
                          >
                            {prod.affiliate_enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => setQrModalProduct(prod)}
                            className="p-1.5 rounded-lg border border-[#F3EAF8] hover:bg-white text-[#7B3FA0]"
                            title="Generate QR Code"
                          >
                            <QrCode size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 3: PROMOTERS TABLE ── */}
        {activeTab === 'affiliates' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs text-[#2D004D]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4">Promoter / Email</th>
                    <th className="p-4">Affiliate Code</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Total Clicks</th>
                    <th className="p-4">Sales Referred</th>
                    <th className="p-4">Total Commission</th>
                    <th className="p-4">Pending</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {affiliates.map(aff => (
                    <tr key={aff.id} className="hover:bg-[#F8F3FB]/50 transition-colors">
                      <td className="p-4 font-bold">
                        {aff.name}
                        <span className="block text-[10px] text-[#7B3FA0] font-normal">{aff.email}</span>
                      </td>
                      <td className="p-4 font-mono font-bold text-[#7B3FA0]">{aff.code}</td>
                      <td className="p-4">
                        {aff.status === 'active' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-medium">{aff.clicks}</td>
                      <td className="p-4 font-medium">{aff.sales}</td>
                      <td className="p-4 font-bold text-emerald-600">₹{aff.commission.toLocaleString()}</td>
                      <td className="p-4 font-semibold text-[#7B3FA0]">₹{aff.pending.toLocaleString()}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleAffiliateStatus(aff.id)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                            aff.status === 'active'
                              ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {aff.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: COMMISSION RULES ── */}
        {activeTab === 'rules' && (
          <div className="bg-white p-8 rounded-2xl border border-[#F3EAF8] shadow-sm space-y-6 max-w-3xl">
            <h3 className="text-base font-bold uppercase tracking-wider text-[#2D004D] border-b border-[#F3EAF8] pb-3">
              Default System Commission Policies
            </h3>
            <div className="space-y-4 text-xs text-[#2D004D]">
              <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                <span className="font-bold block mb-1">Global Fallback Commission Rate: 20%</span>
                <p className="text-[#7B3FA0]">When an affiliate-enabled product does not specify a custom rate, the promoter receives 20% of sale value.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                <span className="font-bold block mb-1">Default Cookie Attribution Window: 30 Days</span>
                <p className="text-[#7B3FA0]">Referral parameters (`?ref=AFF-XXXX`) are preserved in session and local browser state for up to 30 days prior to purchase.</p>
              </div>

              <div className="p-4 rounded-xl bg-[#F8F3FB] border border-[#F3EAF8]">
                <span className="font-bold block mb-1">Idempotency &amp; Self-Referral Shield</span>
                <p className="text-[#7B3FA0]">Affiliates purchasing products using their own referral code will have commission creation automatically suppressed by backend order validation.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: ANALYTICS ── */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">Top Converting Products</h3>
              <div className="space-y-3">
                {products.slice(0, 3).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3FB]">
                    <span className="font-bold text-xs">{p.title}</span>
                    <span className="text-xs font-bold text-emerald-600">{p.sales} sales referred</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#2D004D]">Top Performing Promoters</h3>
              <div className="space-y-3">
                {affiliates.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-[#F8F3FB]">
                    <span className="font-bold text-xs">{a.name} ({a.code})</span>
                    <span className="text-xs font-bold text-emerald-600">₹{a.commission.toLocaleString()} earned</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bulk Update Modal */}
        <AnimatePresence>
          {showBulkModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full space-y-5"
              >
                <h3 className="text-base font-bold text-[#2D004D]">
                  Bulk Edit Affiliate Settings ({selectedProductIds.length} Products)
                </h3>

                <div className="space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEnableStatus}
                      onChange={(e) => setBulkEnableStatus(e.target.checked)}
                      className="w-4 h-4 text-[#7B3FA0] rounded border-gray-300 focus:ring-[#7B3FA0]"
                    />
                    <span className="text-xs font-bold text-[#2D004D]">Enable Affiliate Promotion</span>
                  </label>

                  {bulkEnableStatus && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">Commission Mode</label>
                        <AdminSelect
                          value={bulkCommissionMode}
                          onChange={(e) => setBulkCommissionMode(e.target.value)}
                          options={[
                            { value: 'percentage', label: 'Percentage (%)' },
                            { value: 'fixed', label: 'Fixed Amount (₹)' },
                          ]}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold tracking-wider text-[#2D004D] uppercase block mb-1">
                          Commission Rate {bulkCommissionMode === 'fixed' ? '(₹)' : '(%)'}
                        </label>
                        <input
                          type="number"
                          value={bulkCommissionValue}
                          onChange={(e) => setBulkCommissionValue(e.target.value)}
                          className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-4 py-2 text-xs text-[#2D004D]"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3EAF8]">
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyBulkUpdate}
                    className="px-5 py-2 rounded-xl bg-[#7B3FA0] hover:bg-[#5C2B7C] text-white text-xs font-bold shadow-md transition-all"
                  >
                    Apply Bulk Changes
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* QR Code Preview Modal */}
        {qrModalProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full relative">
              <button
                onClick={() => setQrModalProduct(null)}
                className="absolute top-4 right-4 text-[#7B3FA0] hover:text-[#2D004D]"
              >
                <X size={18} />
              </button>
              <h4 className="text-sm font-bold text-[#2D004D] mb-4 text-center">
                Product Referral QR Code
              </h4>
              <ProductQrCode product={qrModalProduct} size={220} showDownload showShare />
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
