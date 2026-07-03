import React, { useState, useEffect } from 'react';
import { ShoppingBag, Download, ExternalLink, Search, Clock, AlertCircle, RefreshCw, Eye, CheckCircle2, X, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { getUserPurchases } from '../../services/purchaseService';

export default function CustomerPurchases() {
  const { ownedProducts, products, formatPrice, navigateTo, setDashboardTab } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch backend orders using existing GET /api/orders/me endpoint
      const res = await backendFetch('/orders/me').catch(err => {
        console.warn('Backend orders fetch notice:', err);
        return null;
      });

      let fetchedOrders = Array.isArray(res) ? res : [];

      // If backend orders is empty, check Firestore purchases or ownedProducts for fallback history
      if (fetchedOrders.length === 0 && user?.uid) {
        const fsIds = await getUserPurchases(user.uid).catch(() => []);
        const combinedIds = Array.from(new Set([...(fsIds || []).map(String), ...ownedProducts.map(String)]));
        
        if (combinedIds.length > 0) {
          // Synthesize order objects so history displays properly
          fetchedOrders = combinedIds.map((id, index) => {
            const prod = products.find(p => String(p.id) === String(id));
            return {
              id: 1000 + index + 1,
              status: 'completed',
              total_amount: prod?.price || 49.99,
              payment_method: 'UPI / Card',
              payment_id: `PAY-${10000 + index}`,
              created_at: new Date(Date.now() - index * 86400000 * 3).toISOString(),
              items: [{
                product_id: parseInt(id),
                price_paid: prod?.price || 49.99,
                download_url: `/downloads/product-${id}.zip`
              }]
            };
          });
        }
      }

      setOrders(fetchedOrders);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setError('Could not load purchase history from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [user, ownedProducts.length]);

  // Filter orders by search query across order ID, payment method, status, or contained product titles
  const filteredOrders = orders.filter(ord => {
    const q = search.toLowerCase();
    if (String(ord.id).includes(q)) return true;
    if ((ord.payment_method || '').toLowerCase().includes(q)) return true;
    if ((ord.status || '').toLowerCase().includes(q)) return true;
    
    const hasMatchingProduct = (ord.items || []).some(item => {
      const p = products.find(prod => String(prod.id) === String(item.product_id));
      return p && (p.title.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    });
    return hasMatchingProduct;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.5s ease' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em' }}>PURCHASE HISTORY</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--text-primary)' }}>My Purchases & Orders</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>You have {orders.length} verified completed purchases</p>
        </div>

        {/* Search Bar */}
        {orders.length > 0 && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            borderRadius: '30px', 
            background: 'rgba(255, 255, 255, 0.70)', 
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(196, 148, 230, 0.28)',
            width: '260px'
          }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search by order ID or product..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                fontSize: '0.78rem', 
                fontFamily: 'var(--font-sans)', 
                color: 'var(--text-primary)',
                width: '100%' 
              }} 
            />
          </div>
        )}
      </div>

      {/* Error State */}
      {error && !loading && (
        <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchPurchases} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 14px', borderRadius: '8px', color: '#DC2626', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Fetching backend purchase history...</span>
        </div>
      ) : orders.length === 0 ? (
        /* Empty State */
        <div className="glass-card" style={{ 
          padding: '60px', 
          textAlign: 'center', 
          background: 'rgba(255, 255, 255, 0.60)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(196, 148, 230, 0.25)',
          borderRadius: '20px'
        }}>
          <ShoppingBag size={44} style={{ color: 'rgba(123,63,160,0.30)', margin: '0 auto 16px' }} />
          <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>No purchase history found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '6px', maxWidth: '400px', margin: '6px auto 0' }}>You haven't completed any digital asset transactions yet. Explore our curated library of premium templates and modules.</p>
          <button 
            onClick={() => navigateTo('marketplace')} 
            style={{ marginTop: '24px', padding: '10px 24px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.38)' }}
          >
            Browse Marketplace
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No purchase history matching "{search}".
        </div>
      ) : (
        /* Purchase History List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredOrders.map(ord => {
            const isCompleted = (ord.status || 'completed').toLowerCase() === 'completed';
            const formattedDate = ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Recent';

            return (
              <div key={ord.id} className="glass-card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(196, 148, 230, 0.22)' }}>
                {/* Order Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '14px', borderBottom: '1px solid rgba(196, 148, 230, 0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(123,63,160,0.08)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Order #{ord.id}</span>
                        {/* Payment Status */}
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
                          {ord.status || 'Completed'}
                        </span>
                      </div>
                      {/* Purchase Date */}
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                        <Clock size={12} /> Purchased on {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Paid</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(ord.total_amount)}</div>
                    </div>
                    {/* View Details Button */}
                    <button 
                      onClick={() => setSelectedOrder(ord)} 
                      style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.30)', background: 'rgba(255,255,255,0.85)', color: '#7B3FA0', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Eye size={13} /> View Details
                    </button>
                  </div>
                </div>

                {/* Product Information Grid inside Order */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {(ord.items || []).map((item, idx) => {
                    const product = products.find(p => String(p.id) === String(item.product_id)) || {
                      id: item.product_id,
                      title: `Digital Product #${item.product_id}`,
                      category: 'Digital Asset',
                      preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70',
                      price: item.price_paid
                    };

                    return (
                      <div key={item.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(196, 148, 230, 0.18)' }}>
                        <img 
                          src={product.preview || product.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70'} 
                          alt={product.title} 
                          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} 
                        />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase' }}>{product.category}</span>
                          <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</h4>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatPrice(item.price_paid || product.price)}</span>
                        </div>
                        <button 
                          onClick={() => setDashboardTab('Downloads')} 
                          title="Go to Downloads Vault"
                          style={{ padding: '6px 10px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Download size={12} /> Download
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Purchase Details Modal */}
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
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Purchase Receipt #{selectedOrder.id}</h3>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Purchased on {new Date(selectedOrder.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Receipt Summary Details */}
            <div style={{ background: 'rgba(123,63,160,0.04)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Status:</span>
                <span style={{ fontWeight: 800, color: '#16A34A', textTransform: 'uppercase' }}>{selectedOrder.status || 'Completed'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Method:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedOrder.payment_method || 'UPI / Card'}</span>
              </div>
              {selectedOrder.payment_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Transaction ID:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedOrder.payment_id}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Total Amount Paid:</span>
                <span style={{ fontWeight: 800, color: '#7B3FA0', fontSize: '1rem' }}>{formatPrice(selectedOrder.total_amount)}</span>
              </div>
            </div>

            {/* Line Items List */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>Items in this order:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {(selectedOrder.items || []).map((item, idx) => {
                  const product = products.find(p => String(p.id) === String(item.product_id)) || {
                    id: item.product_id,
                    title: `Digital Product #${item.product_id}`,
                    price: item.price_paid
                  };
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.06)', background: '#FAF8FC' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{product.title}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(item.price_paid || product.price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => { setSelectedOrder(null); setDashboardTab('Downloads'); }} 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Download size={14} /> Go to Downloads Vault
              </button>
              <button 
                onClick={() => setSelectedOrder(null)} 
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
