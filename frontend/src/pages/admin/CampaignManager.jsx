import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import { backendFetch } from '../../utils/api';
import { 
  Compass, Plus, Trash2, Play, Pause, DollarSign, ShoppingBag, X, Link2,
  Search, RefreshCw, Eye, ArrowUpRight, TrendingUp, Users, Check,
  ChevronRight, Copy, CheckCircle2, Sliders, AlertCircle, FileText, Target,
  Layers, Zap, Calendar, Tag
} from 'lucide-react';

const BASE_URL = window.location.origin;

function generateAdminReferralCode() {
  return `ADM-${Math.random().toString(36).slice(-6).toUpperCase()}`;
}

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtN = (n) => Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

// ── Slide-Over Side Drawer for Product Affiliate Details ──────────────────────
function ProductAffiliateDrawer({ productId, onClose, onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);

  const loadDetails = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await backendFetch(`/admin/affiliates/affiliate-products/${productId}/details`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(null);
      }
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleCopy = (code) => {
    const url = `${BASE_URL}/#product/${productId}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const handleToggleLink = async (linkId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await backendFetch(`/admin/referral-links/${linkId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        loadDetails();
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error('Failed to update link status:', e);
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!window.confirm('Delete this referral link?')) return;
    try {
      const res = await backendFetch(`/admin/referral-links/${linkId}`, { method: 'DELETE' });
      if (res.ok) {
        loadDetails();
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error('Failed to delete link:', e);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="w-full max-w-xl bg-white shadow-2xl overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#F3EAF8] bg-gradient-to-r from-[#7B3FA0] to-[#2D004D]">
            <div>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-black tracking-widest uppercase">PRODUCT TELEMETRY</span>
              <h2 className="text-base font-bold text-white mt-1">Affiliate Performance & Referral Roster</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10">
              <X size={18} />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-[#7B3FA0]">
              <RefreshCw size={24} className="animate-spin mr-2" />
              <span className="text-sm font-medium">Loading telemetry…</span>
            </div>
          ) : !data || !data.product ? (
            <div className="flex-1 flex items-center justify-center p-12 text-[#7B3FA0]/60">
              <p className="text-sm font-medium">Product telemetry details not available.</p>
            </div>
          ) : (
            <div className="flex-1 p-6 space-y-6">
              {/* Product Info Card */}
              <div className="p-4 rounded-2xl bg-[#F8F3FB] border border-[#F3EAF8] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[#2D004D] text-base">{data.product.title}</h3>
                    <p className="text-xs text-[#7B3FA0]">ID: #{data.product.id} · Category: {data.product.category || 'General'}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    🟢 Affiliate Enabled
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#F3EAF8] text-xs">
                  <div>
                    <span className="text-[10px] text-[#7B3FA0] uppercase font-bold block">Product Price</span>
                    <span className="font-bold text-[#2D004D]">{fmt(data.product.price)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7B3FA0] uppercase font-bold block">Commission Rate</span>
                    <span className="font-bold text-[#7B3FA0]">
                      {data.product.commission_mode === 'fixed' ? `₹${data.product.commission_value}` : `${data.product.commission_value}%`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#7B3FA0] uppercase font-bold block">Status</span>
                    <span className="font-bold text-emerald-600 capitalize">{data.product.status}</span>
                  </div>
                </div>
              </div>

              {/* Analytics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-[#F3EAF8] shadow-sm">
                  <span className="text-[9px] font-bold text-[#7B3FA0] uppercase block">Total Clicks</span>
                  <span className="text-base font-bold text-[#2D004D]">{fmtN(data.analytics?.total_clicks)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#F3EAF8] shadow-sm">
                  <span className="text-[9px] font-bold text-[#7B3FA0] uppercase block">Conversions</span>
                  <span className="text-base font-bold text-emerald-600">{fmtN(data.analytics?.total_conversions)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#F3EAF8] shadow-sm">
                  <span className="text-[9px] font-bold text-[#7B3FA0] uppercase block">Total Revenue</span>
                  <span className="text-base font-bold text-[#2D004D]">{fmt(data.analytics?.total_revenue)}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#F3EAF8] shadow-sm">
                  <span className="text-[9px] font-bold text-[#7B3FA0] uppercase block">Active Promoters</span>
                  <span className="text-base font-bold text-[#7B3FA0]">{fmtN(data.analytics?.active_affiliates_count)}</span>
                </div>
              </div>

              {/* Referral Links Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Referral Links Roster</h4>
                {data.referral_links?.length > 0 ? (
                  <div className="space-y-2">
                    {data.referral_links.map(link => (
                      <div key={link.id} className="p-3 bg-white rounded-xl border border-[#F3EAF8] shadow-sm flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#7B3FA0] bg-[#F8F3FB] px-2 py-0.5 rounded border border-[#F3EAF8]">{link.code}</span>
                            <span className="font-bold text-[#2D004D]">{link.name}</span>
                          </div>
                          <p className="text-[10px] text-[#7B3FA0] mt-1">Promoter: {link.promoter_name} · Clicks: {fmtN(link.clicks)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleCopy(link.code)} className="px-2.5 py-1 bg-[#F8F3FB] hover:bg-[#F3EAF8] text-[#7B3FA0] rounded-lg text-[10px] font-bold">
                            {copiedCode === link.code ? 'Copied!' : 'Copy Link'}
                          </button>
                          <button onClick={() => handleToggleLink(link.id, link.status)} className="p-1 text-[#7B3FA0] hover:text-[#2D004D]">
                            {link.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button onClick={() => handleDeleteLink(link.id)} className="p-1 text-rose-600 hover:text-rose-800">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-[#F8F3FB] rounded-xl text-center text-xs text-[#7B3FA0]">
                    No referral links created for this product yet.
                  </div>
                )}
              </div>

              {/* Latest Commissions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#2D004D]">Latest Attributed Purchases</h4>
                {data.commissions?.length > 0 ? (
                  <div className="space-y-2">
                    {data.commissions.map(c => (
                      <div key={c.id} className="p-3 bg-white rounded-xl border border-[#F3EAF8] flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#2D004D]">Order #{c.order_id || c.id}</p>
                          <p className="text-[10px] text-[#7B3FA0]">{c.customer_name} · {fmtDate(c.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{fmt(c.sale_amount)}</p>
                          <span className="text-[9px] font-bold text-[#7B3FA0]">Commission: {fmt(c.commission_earned)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-[#F8F3FB] rounded-xl text-center text-xs text-[#7B3FA0]">
                    No orders attributed to this product yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function CampaignManager() {
  const [affiliateProducts, setAffiliateProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Link Creation Modal State
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', productName: '', referralName: '', commissionPct: 20, code: '' });
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Load real affiliate-enabled products from PostgreSQL
  const loadAffiliateProducts = useCallback(async () => {
    setLoading(true);
    try {
      const q = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const res = await backendFetch(`/admin/affiliates/affiliate-products${q}`);
      if (res.ok) {
        const items = await res.json();
        setAffiliateProducts(Array.isArray(items) ? items : []);
      } else {
        setAffiliateProducts([]);
      }
    } catch (e) {
      console.error('Failed to load affiliate products:', e);
      setAffiliateProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Real-time 15-second background auto-sync ticker
  useEffect(() => {
    loadAffiliateProducts();
    const interval = setInterval(() => {
      loadAffiliateProducts();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadAffiliateProducts]);

  // Toggle affiliate_enabled status for a product directly via backend API
  const handleToggleProductAffiliate = async (productId, currentStatus) => {
    try {
      const res = await backendFetch(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ affiliate_enabled: !currentStatus }),
      });
      if (res.ok) {
        loadAffiliateProducts();
      }
    } catch (e) {
      console.error('Error toggling product affiliate status:', e);
    }
  };

  // Open Creation Form
  const openCreationForm = () => {
    const firstProd = affiliateProducts[0];
    setForm({
      productId: firstProd ? String(firstProd.id) : '',
      productName: firstProd ? firstProd.title : '',
      referralName: '',
      commissionPct: firstProd ? (firstProd.commission_value || 20) : 20,
      code: generateAdminReferralCode(),
    });
    setShowForm(true);
  };

  // Create Referral Link submit handler
  const handleCreateLink = async (e) => {
    e.preventDefault();
    if (!form.productId) return;
    setCreating(true);

    const targetProd = affiliateProducts.find(p => String(p.id) === String(form.productId));
    const prodName = targetProd?.title || 'Product';

    try {
      const res = await backendFetch('/admin/referral-links', {
        method: 'POST',
        body: JSON.stringify({
          productId: String(form.productId),
          productName: prodName,
          referralName: form.referralName || `${prodName} Promo`,
          commissionPct: Number(form.commissionPct) || 20,
          code: form.code,
        }),
      });

      if (res.ok) {
        setShowForm(false);
        setForm({ productId: '', productName: '', referralName: '', commissionPct: 20, code: '' });
        loadAffiliateProducts();
      } else {
        const errData = await res.json();
        alert(`Failed to create referral link: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Create referral link error:', err);
      alert(`Error creating referral link: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  // Copy referral link handler
  const handleCopyLink = (productId, code) => {
    const url = `${BASE_URL}/#product/${productId}?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  // Summary Metrics calculation from PostgreSQL data
  const metrics = useMemo(() => {
    const totalEnabled = affiliateProducts.length;
    const totalSales = affiliateProducts.reduce((acc, p) => acc + (p.conversions || 0), 0);
    const totalRevenue = affiliateProducts.reduce((acc, p) => acc + (p.revenue_generated || 0), 0);
    const totalCommissionPaid = affiliateProducts.reduce((acc, p) => acc + (p.commission_paid || 0), 0);
    const activeAffiliates = affiliateProducts.reduce((acc, p) => acc + (p.active_affiliates || 0), 0);

    return {
      totalEnabled,
      totalSales,
      totalRevenue,
      totalCommissionPaid,
      activeAffiliates,
    };
  }, [affiliateProducts]);

  return (
    <AdminLayout activePage="admin-campaigns">
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10 flex flex-col gap-7 text-[#2D004D]">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#F3EAF8] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-[#7B3FA0]/10 text-[#7B3FA0] text-[10px] font-black tracking-widest uppercase">ENTERPRISE SYSTEM</span>
              <span className="text-xs text-[#7B3FA0] font-medium">Product Affiliate Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-[#2D004D] font-bold">
              Campaign Manager
            </h1>
            <p className="text-xs text-[#7B3FA0] mt-1 max-w-2xl">
              Real-time directory of products with Affiliate Program enabled (`affiliate_enabled = true`). Powered 100% by PostgreSQL production database.
            </p>
          </div>
          {affiliateProducts.length > 0 && (
            <button 
              onClick={openCreationForm}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              <Plus size={16} /> Create Referral Link
            </button>
          )}
        </div>

        {/* 4 KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7B3FA0]">Active Affiliate Products</span>
              <ShoppingBag size={16} className="text-[#7B3FA0]" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#2D004D]">{fmtN(metrics.totalEnabled)}</div>
            <div className="text-[10px] font-medium text-[#7B3FA0]">Products currently promoted</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7B3FA0]">Total Referral Sales</span>
              <Target size={16} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-serif font-bold text-emerald-600">{fmtN(metrics.totalSales)}</div>
            <div className="text-[10px] font-medium text-[#7B3FA0]">Completed conversions</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7B3FA0]">Total Commission Paid</span>
              <DollarSign size={16} className="text-[#7B3FA0]" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#2D004D]">{fmt(metrics.totalCommissionPaid)}</div>
            <div className="text-[10px] font-medium text-[#7B3FA0]">Affiliate earnings distributed</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-[#F3EAF8] shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7B3FA0]">Active Promoters</span>
              <Users size={16} className="text-[#7B3FA0]" />
            </div>
            <div className="text-2xl font-serif font-bold text-[#7B3FA0]">{fmtN(metrics.activeAffiliates)}</div>
            <div className="text-[10px] font-medium text-[#7B3FA0]">Unique promoters advocating</div>
          </div>
        </div>

        {/* Product Affiliate Table Section */}
        <div className="bg-white rounded-2xl border border-[#F3EAF8] shadow-sm overflow-hidden space-y-4">
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#F3EAF8]">
            <div className="flex items-center gap-2">
              <Compass size={16} className="text-[#7B3FA0]" />
              <h2 className="text-sm font-bold text-[#2D004D] uppercase tracking-wider">Affiliate-Enabled Products Directory</h2>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search product name or ID…"
                className="w-full pl-9 pr-4 py-2 text-xs bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl text-[#2D004D] focus:outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#7B3FA0]">
              <RefreshCw size={20} className="animate-spin mr-2" />
              <span className="text-sm font-medium">Fetching real-time product affiliate metrics…</span>
            </div>
          ) : affiliateProducts.length === 0 ? (
            /* Clean Empty State Requirement */
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#F8F3FB] flex items-center justify-center text-[#7B3FA0]">
                <ShoppingBag size={32} />
              </div>
              <h3 className="text-base font-bold text-[#2D004D]">No Products Currently Enabled For Affiliate Program</h3>
              <p className="text-xs text-[#7B3FA0] max-w-md">
                Enable Affiliate Program on a product from Products Management to see it here automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#2D004D] min-w-[1000px]">
                <thead className="bg-[#F8F3FB] text-[10px] uppercase tracking-wider font-extrabold text-[#7B3FA0] border-b border-[#F3EAF8]">
                  <tr>
                    <th className="p-4">Product</th>
                    <th className="p-4">Product ID</th>
                    <th className="p-4">Affiliate Enabled</th>
                    <th className="p-4">Commission %</th>
                    <th className="p-4 text-center">Referral Links</th>
                    <th className="p-4 text-center">Active Affiliates</th>
                    <th className="p-4 text-center">Clicks</th>
                    <th className="p-4 text-center">Conversions</th>
                    <th className="p-4 text-right">Revenue</th>
                    <th className="p-4">Created Date</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3EAF8]">
                  {affiliateProducts.map(prod => (
                    <tr 
                      key={prod.id} 
                      onClick={() => setSelectedProductId(prod.id)}
                      className="hover:bg-[#F8F3FB]/60 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {prod.thumbnail && (
                            <img src={prod.thumbnail} alt="" className="w-9 h-9 rounded-lg object-cover border border-[#F3EAF8]" onError={e => e.target.style.display='none'} />
                          )}
                          <div>
                            <p className="font-bold text-[#2D004D] text-xs">{prod.title}</p>
                            <p className="text-[10px] text-[#7B3FA0]">{prod.category || 'General'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-bold text-[#7B3FA0]">#{prod.id}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🟢 Enabled
                        </span>
                      </td>
                      <td className="p-4 font-bold text-[#7B3FA0]">
                        {prod.commission_mode === 'fixed' ? `Fixed ₹${prod.commission_value}` : `${prod.commission_value}%`}
                      </td>
                      <td className="p-4 text-center font-bold">{fmtN(prod.referral_links_count)}</td>
                      <td className="p-4 text-center font-bold text-[#7B3FA0]">{fmtN(prod.active_affiliates)}</td>
                      <td className="p-4 text-center font-medium">{fmtN(prod.clicks)}</td>
                      <td className="p-4 text-center font-bold text-emerald-600">{fmtN(prod.conversions)}</td>
                      <td className="p-4 text-right font-bold text-[#2D004D]">{fmt(prod.revenue_generated)}</td>
                      <td className="p-4 text-xs text-[#7B3FA0]">{prod.created_date || fmtDate(prod.created_at)}</td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
                          {prod.status}
                        </span>
                      </td>
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedProductId(prod.id)}
                            className="px-2.5 py-1 rounded-lg border border-[#F3EAF8] bg-white hover:bg-[#F8F3FB] text-[#7B3FA0] text-[11px] font-bold transition-all"
                          >
                            Details
                          </button>
                          <button 
                            onClick={() => handleToggleProductAffiliate(prod.id, prod.affiliate_enabled)}
                            className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold transition-all"
                          >
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Product Side Drawer */}
        {selectedProductId && (
          <ProductAffiliateDrawer 
            productId={selectedProductId} 
            onClose={() => setSelectedProductId(null)}
            onRefresh={loadAffiliateProducts}
          />
        )}

        {/* Create Referral Link Modal */}
        <AnimatePresence>
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-2xl border border-[#F3EAF8] shadow-xl max-w-md w-full space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#2D004D] flex items-center gap-2">
                    <Plus size={18} className="text-[#7B3FA0]" /> Create Product Referral Link
                  </h3>
                  <button onClick={() => setShowForm(false)} className="text-[#7B3FA0] hover:text-[#2D004D]"><X size={18} /></button>
                </div>

                <form onSubmit={handleCreateLink} className="space-y-4 text-xs">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Select Affiliate Product *</label>
                    <AdminSelect 
                      value={form.productId}
                      onChange={e => {
                        const pid = e.target.value;
                        const p = affiliateProducts.find(item => String(item.id) === String(pid));
                        setForm(f => ({
                          ...f,
                          productId: pid,
                          productName: p ? p.title : '',
                          commissionPct: p ? p.commission_value : 20,
                        }));
                      }}
                      options={affiliateProducts.map(p => ({
                        value: String(p.id),
                        label: `${p.title} (₹${p.price})`
                      }))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Referral Campaign Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Summer Promo Campaign"
                      value={form.referralName}
                      onChange={e => setForm(f => ({ ...f, referralName: e.target.value }))}
                      className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3.5 py-2 text-xs text-[#2D004D]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Commission Rate (%)</label>
                    <input 
                      type="number" 
                      min="1"
                      max="90"
                      value={form.commissionPct}
                      onChange={e => setForm(f => ({ ...f, commissionPct: e.target.value }))}
                      className="w-full bg-[#F8F3FB] border border-[#F3EAF8] rounded-xl px-3.5 py-2 text-xs text-[#2D004D]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D] block mb-1">Generated Referral Code</label>
                    <input 
                      type="text" 
                      value={form.code}
                      disabled
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-[#7B3FA0]"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-3 border-t border-[#F3EAF8]">
                    <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-bold text-[#7B3FA0] hover:bg-[#F8F3FB] rounded-xl">Cancel</button>
                    <button type="submit" disabled={creating}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] text-white text-xs font-bold shadow-md disabled:opacity-50 transition-all">
                      {creating ? 'Generating…' : 'Generate Link'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </main>
    </AdminLayout>
  );
}
