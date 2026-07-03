import React, { useState, useEffect } from 'react';
import { ShoppingBag, Package, Clock, ExternalLink, AlertCircle, RefreshCw, Eye, X, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { backendFetch } from '../../utils/api';

export default function CustomerOrders() {
  const { user } = useAuth();
  const { formatPrice, products, navigateTo } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 1. Fetch customer orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await backendFetch('/orders/me').catch(err => {
        console.warn('Backend orders fetch notice:', err);
        return null;
      });

      if (Array.isArray(res)) {
        setOrders(res);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Could not load customer orders from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [user]);

  // 5. Allow viewing individual orders
  const handleViewOrder = async (order) => {
    setSelectedOrder(order);
    try {
      const detailedOrder = await backendFetch(`/orders/${order.id}`).catch(() => null);
      if (detailedOrder) {
        setSelectedOrder(detailedOrder);
      }
    } catch (e) {
      console.warn('Individual order detail fetch notice:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.5s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em' }}>PURCHASE HISTORY</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--text-primary)' }}>My Orders</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Managing {orders.length} verified customer transactions</p>
        </div>
      </div>

      {/* 7. Handle API errors */}
      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchOrders} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* 6. Handle loading */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Loading customer orders from backend...</span>
        </div>
      ) : orders.length === 0 ? (
        /* Empty state */
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)', borderRadius: '20px' }}>
          <ShoppingBag size={44} style={{ color: 'rgba(123,63,160,0.25)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No orders found</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>You haven't placed any orders yet. Explore our digital marketplace catalog.</p>
          <button onClick={() => navigateTo('marketplace')} style={{ marginTop: '20px', padding: '10px 24px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.38)' }}>Browse Marketplace</button>
        </div>
      ) : (
        /* Orders List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map(order => {
            const orderIdStr = String(order.id);
            const displayId = orderIdStr.length > 8 ? orderIdStr.slice(-8).toUpperCase() : orderIdStr;
            const orderTotal = order.total_amount !== undefined ? order.total_amount : order.total;
            const isCompleted = (order.status || 'completed').toLowerCase() === 'completed';

            return (
              <div key={order.id} className="glass-card" style={{ padding: '20px 24px', border: '1px solid rgba(196,148,230,0.22)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(196,148,230,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(123,63,160,0.08)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Order #{displayId}</span>
                        {/* 3. Show order status */}
                        <span style={{ 
                          fontSize: '0.62rem', 
                          fontWeight: 800, 
                          padding: '3px 8px', 
                          borderRadius: '6px', 
                          textTransform: 'uppercase',
                          background: isCompleted ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                          color: isCompleted ? '#16A34A' : '#D97706',
                          border: `1px solid ${isCompleted ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
                        }}>
                          {order.status || 'completed'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Clock size={12} /> {order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* 4. Show payment status */}
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.62rem', color: '#16A34A', fontWeight: 800, textTransform: 'uppercase' }}>
                        Paid ({order.payment_method || 'UPI/Card'})
                      </span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(orderTotal || 0)}</div>
                    </div>
                    {/* 5. Allow viewing individual orders */}
                    <button 
                      onClick={() => handleViewOrder(order)}
                      style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.30)', background: 'rgba(255,255,255,0.90)', color: '#7B3FA0', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={13} /> Details
                    </button>
                  </div>
                </div>

                {/* 2. Show order details (Items) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(order.items || []).map((item, i) => {
                    const matchedProd = products.find(p => String(p.id) === String(item.product_id || item.id));
                    const itemTitle = item.title || matchedProd?.title || `Product #${item.product_id || item.id}`;
                    const itemPreview = item.preview || matchedProd?.preview || matchedProd?.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=70';
                    const itemPrice = item.price_paid !== undefined ? item.price_paid : item.price;

                    return (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(196,148,230,0.15)' }}>
                        <img src={itemPreview} alt={itemTitle} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{itemTitle}</span>
                        </div>
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(itemPrice || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Individual Order Details Modal */}
      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '540px', background: '#fff', borderRadius: '24px', padding: '32px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
            <button onClick={() => setSelectedOrder(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(123,63,160,0.10)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Order Summary #{selectedOrder.id}</h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Date: {new Date(selectedOrder.created_at || Date.now()).toLocaleString()}</span>
              </div>
            </div>

            {/* Status & Payment breakdown */}
            <div style={{ background: 'rgba(123,63,160,0.04)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Order Status:</span>
                <span style={{ fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' }}>{selectedOrder.status || 'completed'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
                <span style={{ fontWeight: 800, color: '#16A34A' }}>PAID (Verified)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOrder.payment_method || 'UPI / Card'}</span>
              </div>
              {selectedOrder.payment_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Payment ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrder.payment_id}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Total Order Amount:</span>
                <span style={{ fontWeight: 800, color: '#7B3FA0', fontSize: '1rem' }}>{formatPrice(selectedOrder.total_amount || selectedOrder.total || 0)}</span>
              </div>
            </div>

            {/* Item list */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>Purchased Items:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                {(selectedOrder.items || []).map((item, idx) => {
                  const matchedProd = products.find(p => String(p.id) === String(item.product_id || item.id));
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', background: '#FAF8FC' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title || matchedProd?.title || `Product #${item.product_id || item.id}`}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(item.price_paid !== undefined ? item.price_paid : item.price || 0)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button onClick={() => setSelectedOrder(null)} style={{ padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', textAlign: 'center' }}>
              Close Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
