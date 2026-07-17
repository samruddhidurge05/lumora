import React, { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { backendFetch } from '../../utils/api';
import { 
  Compass, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  DollarSign, 
  ShoppingBag, 
  X, 
  Link2
} from 'lucide-react';

const BASE_URL = window.location.origin;

// Auto-generates a unique Admin referral code mirroring Vendor random generation logic
function generateAdminReferralCode() {
  return `ADM-${Math.random().toString(36).slice(-6).toUpperCase()}`;
}

export default function CampaignManager() {
  const [links, setLinks] = useState([]);
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', productName: '', referralName: '', commissionPct: 15, code: '' });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(null);

  // ─── LOAD DATA ────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Fetch available products catalog
    const fetchProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };
    fetchProducts();

    // 2. Listen to active adminReferralLinks (opportunities where affiliateId is empty)
    const linksQuery = query(collection(db, 'adminReferralLinks'), where('affiliateId', '==', ''));
    const unsubLinks = onSnapshot(linksQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setLinks(list);
    }, (err) => {
      console.warn('[CampaignManager] adminReferralLinks listener:', err.code);
    });

    // 3. Listen to adminAnalytics/global
    const unsubAnalytics = onSnapshot(doc(db, 'adminAnalytics', 'global'), (snap) => {
      if (snap.exists()) {
        setAnalytics(snap.data());
      }
    }, (err) => {
      console.warn('[CampaignManager] adminAnalytics listener:', err.code);
    });

    // 4. Listen to adminAffiliateOrders
    const ordersQuery = query(collection(db, 'adminAffiliateOrders'));
    const unsubOrders = onSnapshot(ordersQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setRecentOrders(list);
    }, (err) => {
      console.warn('[CampaignManager] adminAffiliateOrders listener:', err.code);
    });

    return () => {
      unsubLinks();
      unsubAnalytics();
      unsubOrders();
    };
  }, []);

  // Generate code on select or form open
  const openCreationForm = () => {
    setForm({
      productId: '',
      productName: '',
      referralName: '',
      commissionPct: 15,
      code: generateAdminReferralCode()
    });
    setShowForm(true);
  };

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.productId) return;
    setCreating(true);

    const prod = products.find(p => p.id === form.productId);
    const prodName = prod?.name || prod?.title || 'Product';

    try {
      // Writes go through the backend — JWT-validated and audit-logged server-side
      await backendFetch('/admin/referral-links', {
        method: 'POST',
        body: JSON.stringify({
          productId: form.productId,
          productName: prodName,
          referralName: form.referralName || `${prodName} Promo`,
          commissionPct: Number(form.commissionPct) || 15,
          code: form.code,
        }),
      });
      // onSnapshot listener will update the UI automatically after Firestore write
      setShowForm(false);
      setForm({ productId: '', productName: '', referralName: '', commissionPct: 15, code: '' });
    } catch (err) {
      console.error('Create referral link error:', err);
      alert(`Failed to create referral link: ${err.message || 'Unknown error'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (link) => {
    const nextStatus = link.status === 'active' ? 'paused' : 'active';
    try {
      await backendFetch(`/admin/referral-links/${link.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      // onSnapshot will update the badge automatically
    } catch (err) {
      console.error('Error toggling referral link status:', err);
      alert(`Failed to update status: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDelete = async (linkId) => {
    if (!window.confirm('Delete this referral link? Affiliates will no longer be able to promote this code.')) return;
    try {
      await backendFetch(`/admin/referral-links/${linkId}`, { method: 'DELETE' });
      // onSnapshot will remove the row automatically
    } catch (err) {
      console.error('Error deleting referral link:', err);
      alert(`Failed to delete referral link: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCopyLink = (code) => {
    const url = `${BASE_URL}/products?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Stats summaries
  const totalReferrals = links.length;
  const activeReferrals = links.filter(c => c.status === 'active').length;
  const totalSalesCount = analytics?.affiliateSales || 0;
  const totalCommissionPaid = recentOrders.reduce((acc, o) => acc + (o.commissionAmount || 0), 0);
  const activeAffiliatesCount = new Set(recentOrders.map(o => o.affiliateId).filter(Boolean)).size;

  return (
    <AdminLayout activePage="admin-campaigns">
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: '#2D004D' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E6AA8' }}>Ecosystem Management</span>
            <h1 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>
              Referral Links
            </h1>
            <p style={{ color: 'rgba(45,0,77,0.6)', fontSize: '0.82rem', marginTop: '4px' }}>
              Referral Management
            </p>
          </div>
          <button 
            onClick={openCreationForm}
            className="v-btn v-btn-primary" 
            style={{ borderRadius: '20px', gap: '6px' }}
          >
            <Plus size={16} /> Create Referral Link
          </button>
        </div>

        {/* Stats Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Referrals</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)' }}>{activeReferrals}</div>
              <span style={{ fontSize: '0.65rem', color: '#8E6AA8', fontWeight: 500 }}>{totalReferrals} Total Templates</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(123,63,160,0.06)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(123,63,160,0.1)' }}>
              <Compass size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Referral Sales</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)' }}>{totalSalesCount}</div>
              <span style={{ fontSize: '0.65rem', color: '#8E6AA8', fontWeight: 500 }}>Completed Conversions</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.1)' }}>
              <ShoppingBag size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Commission Paid</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)', color: '#16a34a' }}>
                ₹{totalCommissionPaid.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>Affiliate Earnings</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.06)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34,197,94,0.1)' }}>
              <DollarSign size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Affiliates</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)', color: '#7B3FA0' }}>
                {activeAffiliatesCount}
              </div>
              <span style={{ fontSize: '0.65rem', color: '#7B3FA0', fontWeight: 600 }}>Unique Promoters</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(123,63,160,0.06)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(123,63,160,0.1)' }}>
              <Link2 size={18} />
            </div>
          </div>
        </div>

        {/* Referrals Opportunities Inventory Table */}
        <div className="glass-surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(142, 106, 168, 0.1)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={16} style={{ color: '#7B3FA0' }} /> Admin Referral Links
            </h3>
          </div>
          {links.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8E6AA8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔗</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No referral links created yet</div>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "Create Referral Link" to generate a referral link.</p>
            </div>
          ) : (
            <div className="v-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="v-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Product</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Referral Name</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Referral Code</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Commission %</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Created Date</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Status</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map(link => (
                    <tr key={link.id} style={{ borderBottom: '1px solid rgba(142, 106, 168, 0.08)' }}>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{link.productName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {link.productId}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
                        {link.referralName || 'Admin Promo'}
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontWeight: 700 }}>
                        {link.code}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#7B3FA0' }}>
                        {link.commissionPct}%
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.8rem', color: 'rgba(45,0,77,0.6)' }}>
                        {link.createdAt ? new Date(link.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className={`v-badge ${link.status === 'active' ? 'v-badge-green' : 'v-badge-gray'}`}>
                          {link.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleCopyLink(link.code)}
                            className="v-btn v-btn-ghost v-btn-sm" 
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            {copied === link.code ? 'Copied' : 'Copy'}
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(link)}
                            className="v-btn v-btn-ghost v-btn-sm" 
                            style={{ width: '32px', height: '32px', padding: 0 }}
                          >
                            {link.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button 
                            onClick={() => handleDelete(link.id)}
                            className="v-btn v-btn-ghost v-btn-sm" 
                            style={{ width: '32px', height: '32px', padding: 0, color: '#dc2626', borderColor: 'rgba(220,38,38,0.15)' }}
                          >
                            <Trash2 size={14} />
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

        {/* Campaign Conversion History Ledger */}
        <div className="glass-surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(142, 106, 168, 0.1)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={16} style={{ color: '#2563eb' }} /> Referral Sales Ledger
            </h3>
          </div>
          {recentOrders.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8E6AA8', fontSize: '0.8rem' }}>
              No referred sales conversions recorded yet.
            </div>
          ) : (
            <div className="v-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="v-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Purchase Date</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Product</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Affiliate Name</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Referral Code</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Customer</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Sale Amount</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Commission</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(142, 106, 168, 0.08)' }}>
                      <td style={{ padding: '16px 20px', fontSize: '0.78rem', color: 'rgba(45,0,77,0.6)' }}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
                        {order.productName}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
                        {order.affiliateName || 'Affiliate'}
                      </td>
                      <td style={{ padding: '16px 20px', fontFamily: 'monospace', fontWeight: 700 }}>
                        {order.affiliateCode || '—'}
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.82rem', color: 'var(--text-light)' }}>
                        {order.customerName || 'Customer'}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                        ₹{(order.price || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#16a34a' }}>
                        ₹{(order.commissionAmount || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className="v-badge v-badge-green">
                          Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── CREATOR MODAL ──────────────────────────────────────────────── */}
        {showForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,0,77,0.35)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal" style={{ maxWidth: '420px', width: '100%', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={18} style={{ color: '#7B3FA0' }} /> Create Admin Referral Link
                </h3>
                <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="v-field">
                  <label className="v-label">Select Product *</label>
                  <select 
                    className="v-input"
                    value={form.productId} 
                    onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                    required
                  >
                    <option value="">Select a product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.title} (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="v-field">
                  <label className="v-label">Referral Name</label>
                  <input 
                    type="text" 
                    className="v-input"
                    placeholder="e.g. Summer Special 15%"
                    value={form.referralName} 
                    onChange={e => setForm(f => ({ ...f, referralName: e.target.value }))}
                  />
                </div>

                <div className="v-field">
                  <label className="v-label">Commission Rate (%)</label>
                  <input 
                    type="number" 
                    className="v-input" 
                    min="1"
                    max="90"
                    value={form.commissionPct} 
                    onChange={e => setForm(f => ({ ...f, commissionPct: e.target.value }))}
                    required 
                  />
                </div>

                <div className="v-field">
                  <label className="v-label">Generated Referral Code (Read-Only)</label>
                  <input 
                    type="text" 
                    className="v-input" 
                    value={form.code}
                    disabled
                    style={{ background: 'rgba(0,0,0,0.03)', fontFamily: 'monospace', fontWeight: 'bold' }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={creating}
                  className="v-btn v-btn-primary" 
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {creating ? 'Creating...' : 'Create Referral'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </AdminLayout>
  );
}
