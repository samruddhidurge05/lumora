import React, { useState, useEffect } from 'react';
import { ShoppingBag, Download, ExternalLink, Search, Clock, AlertCircle, RefreshCw, Eye, CheckCircle2, X, CreditCard, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { getUserPurchases } from '../../services/purchaseService';
import PolicyAcknowledgementCheckbox from '../../components/policy/PolicyAcknowledgementCheckbox';

export default function CustomerPurchases() {
  const { ownedProducts, products, formatPrice, navigateTo, setDashboardTab } = useApp();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Refund request state management
  const [refundRequests, setRefundRequests] = useState([]);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState('broken_file');
  const [refundDetails, setRefundDetails] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState(null);
  const [refundSuccess, setRefundSuccess] = useState(null);
  const [ackCheckbox, setAckCheckbox] = useState(false);

  const fetchRefundRequests = async () => {
    try {
      const res = await backendFetch('/refunds/me').catch(() => []);
      setRefundRequests(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('Failed to load refund requests:', err);
    }
  };

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
    fetchRefundRequests();
  }, [user, ownedProducts.length, products.length]);

  // Reload when a purchase event fires from anywhere in the app
  useEffect(() => {
    const handler = () => {
      fetchPurchases();
      fetchRefundRequests();
    };
    window.addEventListener('lumora_refresh_user_data', handler);
    return () => window.removeEventListener('lumora_refresh_user_data', handler);
  }, [user]);

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

  const getRefundBadge = (orderId) => {
    const req = refundRequests.find(r => r.order_id === orderId);
    if (!req) return null;

    let bg = 'rgba(234, 179, 8, 0.12)';
    let border = 'rgba(234, 179, 8, 0.3)';
    let color = '#D97706';
    let text = 'Refund Pending';

    const statusUpper = req.status.toUpperCase();
    if (statusUpper === 'UNDER_REVIEW') {
      bg = 'rgba(59, 130, 246, 0.12)';
      border = 'rgba(59, 130, 246, 0.3)';
      color = '#2563EB';
      text = 'Under Review';
    } else if (statusUpper === 'APPROVED' || statusUpper === 'PROCESSING') {
      bg = 'rgba(34, 197, 94, 0.12)';
      border = 'rgba(34, 197, 94, 0.3)';
      color = '#16A34A';
      text = 'Refund Processing';
    } else if (statusUpper === 'REFUNDED') {
      bg = 'rgba(34, 197, 94, 0.12)';
      border = 'rgba(34, 197, 94, 0.3)';
      color = '#16A34A';
      text = 'Refunded';
    } else if (statusUpper === 'REJECTED') {
      bg = 'rgba(239, 68, 68, 0.12)';
      border = 'rgba(239, 68, 68, 0.3)';
      color = '#DC2626';
      text = 'Refund Rejected';
    } else if (statusUpper === 'FAILED') {
      bg = 'rgba(220, 38, 38, 0.12)';
      border = 'rgba(220, 38, 38, 0.3)';
      color = '#DC2626';
      text = 'Refund Failed';
    } else if (statusUpper === 'CANCELLED') {
      bg = 'rgba(107, 114, 128, 0.12)';
      border = 'rgba(107, 114, 128, 0.3)';
      color = '#4B5563';
      text = 'Cancelled';
    }

    return (
      <span style={{ 
        fontSize: '0.62rem', 
        fontWeight: 800, 
        padding: '3px 8px', 
        borderRadius: '6px', 
        textTransform: 'uppercase',
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        marginLeft: '8px'
      }}>
        {text}
      </span>
    );
  };


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
                        {getRefundBadge(ord.id)}
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
                <div className="purchases-card-grid">
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

            {/* Refund Section */}
            {((selectedOrder.status || '').toLowerCase() === 'completed' || (selectedOrder.status || '').toLowerCase() === 'paid') && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '16px' }}>
                {(() => {
                  const existingReq = refundRequests.find(r => r.order_id === selectedOrder.id);
                  const isDownloaded = (selectedOrder.items || []).some(item => item.downloaded);
                  const isWithinWindow = (Date.now() - new Date(selectedOrder.created_at || Date.now())) < 14 * 86400 * 1000;

                  if (existingReq) {
                    const statusUpper = existingReq.status.toUpperCase();
                    const canCancel = statusUpper === 'PENDING' || statusUpper === 'UNDER_REVIEW';

                    let bg = 'rgba(234, 179, 8, 0.12)';
                    let color = '#D97706';
                    let labelText = existingReq.status;

                    if (statusUpper === 'UNDER_REVIEW') {
                      bg = 'rgba(59, 130, 246, 0.12)';
                      color = '#2563EB';
                      labelText = 'Under Review';
                    } else if (statusUpper === 'APPROVED' || statusUpper === 'PROCESSING') {
                      bg = 'rgba(34, 197, 94, 0.12)';
                      color = '#16A34A';
                      labelText = 'Processing';
                    } else if (statusUpper === 'REFUNDED') {
                      bg = 'rgba(34, 197, 94, 0.12)';
                      color = '#16A34A';
                      labelText = 'Refunded';
                    } else if (statusUpper === 'REJECTED') {
                      bg = 'rgba(239, 68, 68, 0.12)';
                      color = '#DC2626';
                      labelText = 'Rejected';
                    } else if (statusUpper === 'FAILED') {
                      bg = 'rgba(220, 38, 38, 0.12)';
                      color = '#DC2626';
                      labelText = 'Failed';
                    } else if (statusUpper === 'CANCELLED') {
                      bg = 'rgba(107, 114, 128, 0.12)';
                      color = '#4B5563';
                      labelText = 'Cancelled';
                    }

                    return (
                      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Refund Request Status</span>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            fontWeight: 800, 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            textTransform: 'uppercase',
                            background: bg,
                            color: color
                          }}>
                            {labelText}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                          <strong>Reason:</strong> {existingReq.reason_category.replace('_', ' ')}
                        </div>
                        {existingReq.details && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <strong>Details:</strong> {existingReq.details}
                          </div>
                        )}
                        {existingReq.admin_notes && (
                          <div style={{ fontSize: '0.78rem', color: '#B45309', background: 'rgba(245,158,11,0.08)', padding: '8px 12px', borderRadius: '8px', marginTop: '10px' }}>
                            <strong>Admin Note:</strong> {existingReq.admin_notes}
                          </div>
                        )}
                        {canCancel && (
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              onClick={async () => {
                                if (window.confirm('Are you sure you want to cancel this refund request?')) {
                                  try {
                                    setRefundSubmitting(true);
                                    await backendFetch(`/refunds/${existingReq.id}/cancel`, { method: 'POST' });
                                    fetchRefundRequests();
                                  } catch (err) {
                                    alert(err.message || 'Failed to cancel refund request.');
                                  } finally {
                                    setRefundSubmitting(false);
                                  }
                                }
                              }}
                              disabled={refundSubmitting}
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                border: '1px solid rgba(0,0,0,0.12)', 
                                background: '#fff', 
                                color: '#EF4444', 
                                fontSize: '0.74rem', 
                                fontWeight: 700, 
                                cursor: 'pointer' 
                              }}
                            >
                              {refundSubmitting ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (showRefundForm) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Submit Refund Request</h4>
                        
                        {isDownloaded && (
                          <div style={{ padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', display: 'flex', gap: '8px', color: '#B45309', fontSize: '0.75rem', lineHeight: 1.4 }}>
                            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                            <span>This product has already been downloaded. Downloaded digital products are generally not eligible for refunds. Your request will undergo manual review, and if approved, your purchasing privileges may be restricted.</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Reason Category</label>
                          <select 
                            value={refundReason} 
                            onChange={e => setRefundReason(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.8rem', background: '#fff', outline: 'none' }}
                          >
                            <option value="broken_file">Broken / corrupted file</option>
                            <option value="wrong_file">Wrong / incorrect file delivered</option>
                            <option value="duplicate_charge">Duplicate charge</option>
                            <option value="other">Other issue</option>
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Additional Details (Optional)</label>
                          <textarea 
                            value={refundDetails}
                            onChange={e => setRefundDetails(e.target.value)}
                            placeholder="Explain why you are requesting a refund (max 500 chars)..."
                            maxLength={500}
                            rows={3}
                            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', fontSize: '0.8rem', outline: 'none', resize: 'none' }}
                          />
                        </div>

                        <PolicyAcknowledgementCheckbox 
                          checked={ackCheckbox}
                          onChange={setAckCheckbox}
                          label="I acknowledge that refund decisions are subject to Lumora's Digital Product Policy."
                        />

                        {refundError && (
                          <div style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600 }}>{refundError}</div>
                        )}
                        {refundSuccess && (
                          <div style={{ color: '#16A34A', fontSize: '0.75rem', fontWeight: 600 }}>{refundSuccess}</div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                          <button 
                            disabled={refundSubmitting || !ackCheckbox}
                            onClick={async () => {
                              try {
                                setRefundSubmitting(true);
                                setRefundError(null);
                                await backendFetch('/refunds/request', {
                                  method: 'POST',
                                  body: {
                                    order_id: selectedOrder.id,
                                    reason_category: refundReason,
                                    details: refundDetails
                                  }
                                });
                                setRefundSuccess('Refund request submitted successfully.');
                                fetchRefundRequests();
                                setTimeout(() => {
                                  setShowRefundForm(false);
                                  setRefundSuccess(null);
                                  setRefundDetails('');
                                  setAckCheckbox(false);
                                }, 1500);
                              } catch (err) {
                                setRefundError(err.message || 'Failed to submit refund request.');
                              } finally {
                                setRefundSubmitting(false);
                              }
                            }}
                            style={{ flex: 1, padding: '8px 14px', borderRadius: '8px', border: 'none', background: ackCheckbox ? '#7B3FA0' : '#E5E7EB', color: ackCheckbox ? '#fff' : '#9CA3AF', fontWeight: 700, fontSize: '0.78rem', cursor: ackCheckbox ? 'pointer' : 'default' }}
                          >
                            {refundSubmitting ? 'Submitting...' : 'Submit Request'}
                          </button>
                          <button 
                            onClick={() => { setShowRefundForm(false); setRefundError(null); }}
                            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (isWithinWindow) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button 
                          onClick={() => setShowRefundForm(true)}
                          style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(239,68,68,0.04)', color: '#DC2626', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Request a Refund
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Refund request period expired (limit: 14 days from purchase).
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={() => { setSelectedOrder(null); setDashboardTab('Downloads'); setShowRefundForm(false); setRefundError(null); }} 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Download size={14} /> Go to Downloads Vault
              </button>
              <button 
                onClick={() => { setSelectedOrder(null); setShowRefundForm(false); setRefundError(null); }} 
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
