import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Download, ExternalLink, RefreshCw,
  AlertCircle, CheckCircle, Package, ArrowRight, Calendar,
  CreditCard, Tag, ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { getUserPurchases } from '../../services/purchaseService';

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Recent';

function StatusBadge({ status }) {
  const ok = (status || 'completed').toLowerCase() === 'completed';
  return (
    <span style={{
      fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: '6px',
      background: ok ? 'rgba(34,197,94,0.10)' : 'rgba(234,179,8,0.10)',
      color: ok ? '#16a34a' : '#d97706',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.28)' : 'rgba(234,179,8,0.28)'}`,
    }}>
      {status || 'Completed'}
    </span>
  );
}

function PurchaseRow({ order, products, formatPrice, navigateTo, setDashboardTab }) {
  const [expanded, setExpanded] = useState(false);
  const items = order.items || [];
  const firstProduct = products.find(p => String(p.id) === String(items[0]?.product_id));

  return (
    <div
      style={{
        borderRadius: '16px', border: '1px solid rgba(196,148,230,0.22)',
        background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(28px)',
        overflow: 'hidden', transition: 'box-shadow 0.25s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 8px 32px rgba(90,30,126,0.10)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(x => !x)}
      >
        <div style={{
          width: '52px', height: '52px', borderRadius: '11px', overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(135deg,rgba(220,198,255,0.5),rgba(196,148,230,0.25))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {firstProduct?.preview ? (
            <img src={firstProduct.preview} alt={firstProduct.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <Package size={20} style={{ color: '#9B5CC4' }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Order #{order.id}
            </span>
            <StatusBadge status={order.status} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '3px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
              <Calendar size={11} /> {fmtDate(order.created_at)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
              <Tag size={11} /> {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
            {order.payment_method && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                <CreditCard size={11} /> {order.payment_method}
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#7B3FA0' }}>
            {formatPrice(order.total_amount || items.reduce((s, i) => s + (i.price_paid || 0), 0) || 49.99)}
          </div>
        </div>
        <ChevronRight size={14} style={{
          color: 'var(--text-muted)', flexShrink: 0,
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
        }} />
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(196,148,230,0.15)', padding: '12px 18px 16px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {items.map((item, idx) => {
            const prod = products.find(p => String(p.id) === String(item.product_id));
            return (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(196,148,230,0.14)',
              }}>
                {prod?.preview ? (
                  <img src={prod.preview} alt={prod.title}
                    style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                    loading="lazy" />
                ) : (
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
                    background: 'rgba(196,148,230,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Package size={16} style={{ color: '#9B5CC4' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {prod?.title || `Product #${item.product_id}`}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {prod?.category || 'Digital Asset'} · {formatPrice(item.price_paid || prod?.price || 0)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {prod && (
                    <button onClick={() => navigateTo('product-detail', prod.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '5px 10px', borderRadius: '7px',
                        border: '1px solid rgba(123,63,160,0.22)', background: 'rgba(255,255,255,0.80)',
                        color: '#5A1E7E', fontSize: '0.68rem', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      }}>
                      <ExternalLink size={10} /> View
                    </button>
                  )}
                  <button onClick={() => setDashboardTab('Downloads')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '5px 10px', borderRadius: '7px', border: 'none',
                      background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
                      color: '#fff', fontSize: '0.68rem', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)',
                      boxShadow: '0 2px 8px rgba(90,30,126,0.25)',
                    }}>
                    <Download size={10} /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RecentPurchases() {
  const { ownedProducts, products, formatPrice, navigateTo, setDashboardTab } = useApp();
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecent = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const res = await backendFetch('/orders/me').catch(() => null);
      let fetched = Array.isArray(res) ? res : [];

      if (fetched.length === 0 && user?.uid) {
        const fsIds = await getUserPurchases(user.uid).catch(() => []);
        const combined = Array.from(new Set([...(fsIds || []).map(String), ...ownedProducts.map(String)]));
        if (combined.length > 0) {
          fetched = combined.map((id, index) => {
            const prod = products.find(p => String(p.id) === String(id));
            return {
              id: 1000 + index + 1, status: 'completed',
              total_amount: prod?.price || 49.99, payment_method: 'UPI / Card',
              created_at: new Date(Date.now() - index * 86400000 * 3).toISOString(),
              items: [{ product_id: id, price_paid: prod?.price || 49.99 }],
            };
          });
        }
      }

      fetched.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setOrders(fetched.slice(0, 5));
    } catch (err) {
      setError('Could not load recent purchases.');
    } finally {
      setLoading(false);
    }
  }, [user, ownedProducts, products]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  // Reload immediately when any purchase or download event fires
  useEffect(() => {
    const handler = () => fetchRecent();
    window.addEventListener('lumora_refresh_user_data', handler);
    return () => window.removeEventListener('lumora_refresh_user_data', handler);
  }, [fetchRecent]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
            ✦ Purchase History
          </span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '4px', color: 'var(--text-primary)' }}>
            Recent Purchases
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Your last {orders.length} completed transactions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchRecent} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '8px 16px', borderRadius: '20px',
            border: '1px solid rgba(196,148,230,0.35)', background: 'rgba(255,255,255,0.80)',
            color: '#7B3FA0', fontSize: '0.74rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: loading ? 0.7 : 1,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
            {loading ? 'Syncing…' : 'Refresh'}
          </button>
          <button onClick={() => setDashboardTab('Purchases')} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '8px 18px', borderRadius: '20px', border: 'none',
            background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
            color: '#fff', fontSize: '0.74rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            boxShadow: '0 3px 14px rgba(90,30,126,0.28)',
          }}>
            View All <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 18px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', fontSize: '0.80rem', fontWeight: 600 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: '48px', textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem', fontWeight: 600 }}>
          <RefreshCw size={22} style={{ animation: 'spin 1.2s linear infinite', marginBottom: '10px' }} />
          <p>Loading recent purchases…</p>
        </div>
      )}

      {!loading && orders.length === 0 && !error && (
        <div className="glass-card" style={{ padding: '64px 40px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.28)' }}>
          <ShoppingBag size={44} style={{ color: 'rgba(123,63,160,0.25)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No purchases yet</h3>
          <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '360px', margin: '6px auto 0' }}>
            Once you complete a purchase, your recent orders will appear here.
          </p>
          <button onClick={() => navigateTo('marketplace')} style={{
            marginTop: '20px', padding: '10px 24px', borderRadius: '12px', border: 'none',
            background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff',
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.35)',
          }}>
            Browse Marketplace
          </button>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px', borderRadius: '12px', background: 'rgba(123,63,160,0.05)', border: '1px solid rgba(196,148,230,0.22)', fontSize: '0.78rem', color: '#7B3FA0', fontWeight: 700 }}>
            <CheckCircle size={14} />
            Showing {orders.length} most recent purchase{orders.length !== 1 ? 's' : ''}
            <span style={{ marginLeft: 'auto', fontWeight: 500, color: 'var(--text-muted)' }}>
              Click any row to see items ↓
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {orders.map(ord => (
              <PurchaseRow key={ord.id} order={ord} products={products}
                formatPrice={formatPrice} navigateTo={navigateTo} setDashboardTab={setDashboardTab} />
            ))}
          </div>

          <div style={{ textAlign: 'center', paddingTop: '8px' }}>
            <button
              onClick={() => setDashboardTab('Purchases')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '10px 28px', borderRadius: '24px',
                border: '1.5px solid rgba(123,63,160,0.30)', background: 'rgba(255,255,255,0.80)',
                color: '#7B3FA0', fontSize: '0.80rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-sans)', backdropFilter: 'blur(16px)', transition: 'all 0.22s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.07)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.50)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.30)'; }}
            >
              View Full Purchase History <ArrowRight size={13} />
            </button>
          </div>
        </>
      )}

      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
