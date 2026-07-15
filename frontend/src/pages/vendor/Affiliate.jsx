import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import {
  collection, addDoc, getDocs, query,
  where, serverTimestamp, updateDoc, doc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { backendFetch } from '../../utils/api';

function getVendorId() {
  return localStorage.getItem('lumora_backend_uid') || null;
}

const BASE_URL = window.location.origin;

async function getAffiliateLinks(vendorId) {
  const q = query(collection(db, 'affiliateLinks'), where('vendorId', '==', vendorId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createAffiliateLink(vendorId, productId, productName, commissionPct) {
  const code = `${vendorId.slice(-6)}-${Math.random().toString(36).slice(-6).toUpperCase()}`;
  const ref  = await addDoc(collection(db, 'affiliateLinks'), {
    vendorId, productId, productName, code,
    commissionPct: Number(commissionPct),
    clicks: 0, conversions: 0, earnings: 0,
    status: 'active', createdAt: serverTimestamp(),
  });
  return { id: ref.id, vendorId, productId, productName, code, commissionPct, clicks: 0, conversions: 0, earnings: 0, status: 'active' };
}

async function getAffiliateStats(vendorId) {
  const links = await getAffiliateLinks(vendorId);
  return {
    totalLinks:       links.length,
    totalClicks:      links.reduce((s, l) => s + (l.clicks || 0), 0),
    totalConversions: links.reduce((s, l) => s + (l.conversions || 0), 0),
    totalEarnings:    links.reduce((s, l) => s + (l.earnings || 0), 0),
  };
}

export default function Affiliate() {
  const [links,    setLinks]    = useState([]);
  const [stats,    setStats]    = useState({ totalLinks: 0, totalClicks: 0, totalConversions: 0, totalEarnings: 0 });
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied,   setCopied]   = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [products, setProducts] = useState([]);
  const [form,     setForm]     = useState({ productId: '', productName: '', commissionPct: 10 });
  const [tab,      setTab]      = useState('links');

  useEffect(() => {
    const vendorId = getVendorId();
    if (!vendorId) {
      // vendorId not ready yet — listen for the backend session event and retry
      const onReady = () => {
        const id = getVendorId();
        if (!id) return;
        window.removeEventListener('lumora_backend_ready', onReady);
        loadData(id);
      };
      window.addEventListener('lumora_backend_ready', onReady);
      return () => window.removeEventListener('lumora_backend_ready', onReady);
    }
    loadData(vendorId);
  }, []);

  function loadData(vendorId) {
    setLoading(true);
    Promise.all([
      getAffiliateLinks(vendorId),
      getAffiliateStats(vendorId),
      // Fetch vendor products from the SQLite backend (not Firestore)
      // Firestore only holds products synced from the old flow; new products
      // created via the vendor dashboard go to SQLite only.
      backendFetch('/vendors/' + vendorId + '/products?limit=200')
        .then(res => Array.isArray(res) ? res : (res.items || []))
        .catch(() => []),
    ]).then(([l, s, productItems]) => {
      setLinks(l);
      setStats(s);
      setProducts(productItems);
    }).catch(console.error).finally(() => setLoading(false));
  }

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.productId) return;
    const vendorId = getVendorId();
    if (!vendorId) return;
    setCreating(true);
    try {
      const newLink = await createAffiliateLink(
        vendorId, form.productId,
        form.productName || products.find(p => String(p.id) === String(form.productId))?.title || products.find(p => String(p.id) === String(form.productId))?.name || form.productId,
        form.commissionPct
      );
      setLinks(prev => [newLink, ...prev]);
      setStats(prev => ({ ...prev, totalLinks: prev.totalLinks + 1 }));
      setShowForm(false);
      setForm({ productId: '', productName: '', commissionPct: 10 });
    } catch (err) {
      console.error('Create affiliate link:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (link) => {
    const newStatus = link.status === 'active' ? 'paused' : 'active';
    await updateDoc(doc(db, 'affiliateLinks', link.id), { status: newStatus });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: newStatus } : l));
  };

  const copyLink = (code) => {
    const url = `${BASE_URL}/products?ref=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const conversionRate = stats.totalClicks > 0
    ? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
    : '0.0';

  return (
    <VendorLayout activePage="affiliate" title="Affiliate Program"
      subtitle="Generate referral links and track commissions"
      actions={<button className="v-btn v-btn-primary" onClick={() => setShowForm(true)}>+ Create Link</button>}>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="v-card v-card-pad" style={{ width: '100%', maxWidth: 420, borderRadius: 24, background: 'rgba(255,253,249,0.96)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--v-serif)', fontSize: 20, color: 'var(--v-dark)' }}>Create Affiliate Link</div>
              <button onClick={() => setShowForm(false)} className="v-btn v-btn-ghost v-btn-sm" style={{ fontSize: 18 }}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="v-field">
                <label className="v-label">Select Product *</label>
                <select className="v-select" value={form.productId}
                  onChange={e => {
                    const p = products.find(p => String(p.id) === e.target.value);
                    setForm(f => ({ ...f, productId: e.target.value, productName: p?.title || p?.name || '' }));
                  }} required>
                  <option value="">Choose a product</option>
                  {products.map(p => <option key={p.id} value={String(p.id)}>{p.title || p.name}</option>)}
                  {products.length === 0 && <option value="demo-product">Demo Product (no products yet)</option>}
                </select>
              </div>
              <div className="v-field">
                <label className="v-label">Commission Rate (%)</label>
                <input type="number" className="v-input" min="1" max="50"
                  value={form.commissionPct}
                  onChange={e => setForm(f => ({ ...f, commissionPct: e.target.value }))} />
                <div className="v-field-hint">Percentage of sale paid to the affiliate referrer</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="submit" className="v-btn v-btn-primary" style={{ flex: 1 }} disabled={creating}>
                  {creating ? 'Creating...' : 'Generate Link'}
                </button>
                <button type="button" className="v-btn v-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="v-stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Active Links',      value: String(stats.totalLinks),       icon: '🔗', delta: 'Total created' },
          { label: 'Total Clicks',      value: String(stats.totalClicks),      icon: '👆', delta: 'All time' },
          { label: 'Conversions',       value: String(stats.totalConversions), icon: '✅', delta: `${conversionRate}% rate` },
          { label: 'Affiliate Earnings',value: `₹${(stats.totalEarnings).toLocaleString()}`, icon: '💸', delta: 'Pending payout' },
        ].map((s, i) => (
          <div key={i} className="v-card v-stat-card">
            <div className="v-stat-header">
              <div className="v-stat-icon" style={{ background: 'rgba(184,134,208,0.15)', fontSize: 18 }}>{s.icon}</div>
              <span className="v-stat-badge neutral">{s.delta}</span>
            </div>
            <div className="v-stat-value">{loading ? '…' : s.value}</div>
            <div className="v-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="v-tabs" style={{ marginBottom: 20 }}>
        {['links', 'how-it-works'].map(t => (
          <button key={t} className={`v-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'links' ? '🔗 My Links' : '📖 How It Works'}
          </button>
        ))}
      </div>

      {tab === 'links' && (
        <>
          {loading ? (
            <div className="v-card v-card-pad" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ color: 'var(--v-text3)' }}>Loading affiliate links...</div>
            </div>
          ) : links.length === 0 ? (
            <div className="v-card">
              <div className="v-empty">
                <div className="v-empty-icon">🔗</div>
                <div className="v-empty-title">No affiliate links yet</div>
                <div className="v-empty-sub">Create your first link to start earning commissions from referrals.</div>
                <button className="v-btn v-btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>+ Create Your First Link</button>
              </div>
            </div>
          ) : (
            <div className="v-card">
              <div className="v-table-wrap">
                <table className="v-table">
                  <thead>
                    <tr>
                      <th>Product</th><th>Referral Link</th><th>Commission</th>
                      <th>Clicks</th><th>Conversions</th><th>Earnings</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map(link => (
                      <tr key={link.id}>
                        <td style={{ fontWeight: 500, color: 'var(--v-dark)', fontSize: 13.5 }}>{link.productName || link.productId}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <code style={{ fontSize: 11, background: 'rgba(168,85,247,0.07)', padding: '3px 8px', borderRadius: 6, color: 'var(--v-purple2)' }}>
                              ?ref={link.code}
                            </code>
                            <button className="v-btn v-btn-ghost v-btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                              onClick={() => copyLink(link.code)}>
                              {copied === link.code ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--v-deep)' }}>{link.commissionPct}%</td>
                        <td>{link.clicks || 0}</td>
                        <td>{link.conversions || 0}</td>
                        <td style={{ fontWeight: 600, color: '#16a34a' }}>₹{(link.earnings || 0).toLocaleString()}</td>
                        <td>
                          <span className={`v-badge ${link.status === 'active' ? 'v-badge-green' : 'v-badge-gray'}`}>
                            <span className="v-badge-dot" />{link.status}
                          </span>
                        </td>
                        <td>
                          <button className="v-btn v-btn-ghost v-btn-sm" onClick={() => toggleStatus(link)}>
                            {link.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'how-it-works' && (
        <div className="v-card v-card-pad" style={{ maxWidth: 680 }}>
          <div className="v-section-title" style={{ marginBottom: 20 }}>How the Affiliate Program Works</div>
          {[
            { step: '01', title: 'Create a referral link', desc: 'Generate a unique referral link for any of your products. Each link has a tracking code.' },
            { step: '02', title: 'Share with your audience', desc: 'Share your referral link on social media, in emails, or with your network.' },
            { step: '03', title: 'Earn commissions', desc: 'When someone clicks your link and purchases, you earn the set commission percentage.' },
            { step: '04', title: 'Track performance', desc: 'Monitor clicks, conversions, and earnings in real time from this dashboard.' },
            { step: '05', title: 'Withdraw earnings', desc: 'Affiliate earnings accumulate in your balance and can be withdrawn via the Withdrawals page.' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#A855F7,#7B3FA0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {s.step}
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--v-dark)', fontSize: 14 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--v-text3)', marginTop: 3 }}>{s.desc}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.15)', marginTop: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v-dark)', marginBottom: 6 }}>💡 Commission Rates</div>
            <div style={{ fontSize: 13, color: 'var(--v-text3)' }}>
              You set the commission rate per product (1%–50%). Higher rates attract more affiliates.
              Platform fee is 10% of each sale, deducted before your net payout.
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
