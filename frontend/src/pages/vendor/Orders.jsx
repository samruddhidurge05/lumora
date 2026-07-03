import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useOrders } from '../../hooks/useVendorData';
import { backendFetch } from '../../utils/api';
import { 
  Package, 
  Clock, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  X, 
  Search, 
  User, 
  TrendingUp, 
  DollarSign, 
  CheckSquare, 
  Layers 
} from 'lucide-react';

const STATUS_MAP = {
  pending:    { label: 'Pending',    cls: 'v-badge-amber' },
  processing: { label: 'Processing', cls: 'v-badge-blue'  },
  completed:  { label: 'Completed',  cls: 'v-badge-green' },
  refunded:   { label: 'Refunded',   cls: 'v-badge-red'   },
  cancelled:  { label: 'Cancelled',  cls: 'v-badge-red'   },
};

const PRIORITY_MAP = {
  high:   { label: 'High',   color: '#dc2626' },
  normal: { label: 'Normal', color: '#7B3FA0' },
  low:    { label: 'Low',    color: '#9ca3af' },
};


const getPriority = (order) => {
  if (order.priority && order.priority !== 'normal') return order.priority;
  const amount = order.amount || 0;
  if (amount > 1000 && order.status === 'pending') return 'high';
  if (amount < 500) return 'low';
  return 'normal';
};

function OrderModal({ order, onClose, onUpdateStatus, loadingIds }) {
  if (!order) return null;
  const st = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const customerName = order.customer || order.customerName || 'Customer';
  const dateStr = order.date
    ? new Date(order.date).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  const orderItems = order.items && order.items.length > 0 ? order.items : [
    {
      productName: order.product || order.productName || '—',
      pricePaid: order.amount || 0
    }
  ];

  const isLoading = loadingIds.includes(order.id);
  const priorityKey = getPriority(order);
  const pr = PRIORITY_MAP[priorityKey] || PRIORITY_MAP.normal;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,12,20,0.45)',
      backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="v-card v-card-pad" style={{ width: '100%', maxWidth: 520,
        borderRadius: 24, background: 'rgba(255,253,249,0.96)', border: '1px solid rgba(168,85,247,0.15)', boxShadow: '0 24px 64px rgba(90,30,126,0.15)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--v-serif)', fontSize: 22, color: 'var(--v-dark)', fontWeight: 600 }}>Order Details</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--v-purple)', marginTop: 2 }}>#{order.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--v-text3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        {/* Customer Information */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'rgba(123,63,160,0.04)', marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>
            {customerName[0]?.toUpperCase() || 'C'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--v-dark)' }}>{customerName}</div>
            <div style={{ fontSize: 12, color: 'var(--v-text3)' }}>Customer ID: {order.user_id || '—'}</div>
          </div>
        </div>

        {/* Info Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Date Placed', value: dateStr },
            { label: 'Priority Level', value: (
              <span style={{ color: pr.color, fontWeight: 600 }}>
                {pr.label}
              </span>
            )},
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: 'var(--v-text3)' }}>{r.label}</span>
              <span style={{ fontWeight: 500, color: 'var(--v-dark)' }}>{r.value}</span>
            </div>
          ))}
          
          {/* Status Dropdown */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(168,85,247,0.06)' }}>
            <span style={{ fontSize: 13.5, color: 'var(--v-text3)' }}>Order Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`v-badge ${st.cls}`} style={{ pointerEvents: 'none' }}>
                <span className="v-badge-dot" />
                {st.label}
              </span>
              <select 
                className="v-select" 
                style={{ width: 'auto', padding: '4px 28px 4px 10px', fontSize: 12.5, height: 32, borderRadius: 10 }}
                value={order.status || 'pending'}
                disabled={isLoading}
                onChange={(e) => onUpdateStatus([order.id], e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="refunded">Refunded</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div style={{ borderTop: '1px solid rgba(168,85,247,0.06)', paddingTop: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--v-dark)', marginBottom: 12 }}>Items in Order</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
            {orderItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.08)', background: 'rgba(168,85,247,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={14} style={{ color: 'var(--v-purple)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--v-dark)' }}>{item.productName || item.title || `Product #${item.productId || item.product_id}`}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--v-purple)' }}>₹{(item.pricePaid || item.price || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Total Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 16, background: 'rgba(123,63,160,0.04)', marginBottom: 24 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--v-text2)' }}>Total Order Value</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--v-purple)' }}>₹{(order.amount || 0).toLocaleString()}</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {order.status === 'pending' && (
            <button 
              className="v-btn v-btn-primary" 
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => onUpdateStatus([order.id], 'completed')}
              disabled={isLoading}
            >
              {isLoading ? <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} /> : <CheckCircle2 size={14} />}
              Fulfill Order
            </button>
          )}
          <button className="v-btn v-btn-secondary" style={{ flex: 1 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const { orders: liveOrders, loading: backendLoading, error: backendError, refresh } = useOrders();
  const [localOrders, setLocalOrders] = useState([]);
  const [tab,        setTab]        = useState('all');
  const [selected,   setSelected]   = useState([]);
  const [search,     setSearch]     = useState('');
  const [loadingIds, setLoadingIds] = useState([]);
  const [viewOrder,  setViewOrder]  = useState(null);
  const [bulkStatus, setBulkStatus] = useState('completed');
  const [error,      setError]      = useState(null);

  // Always reflect live backend orders; empty array shows the built-in empty state
  useEffect(() => {
    setLocalOrders(Array.isArray(liveOrders) ? liveOrders : []);
  }, [liveOrders]);

  const handleUpdateStatus = async (ids, newStatus) => {
    setLoadingIds(prev => [...prev, ...ids]);
    setError(null);
    try {
      const vendorId = localStorage.getItem('lumora_backend_uid');
      if (vendorId) {
        await Promise.all(
          ids.map(async (id) => {
            const numericId = String(id).replace('ORD-', '');
            await backendFetch(`/vendors/${vendorId}/orders/${numericId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: newStatus }),
            });
          })
        );
        refresh();
        if (viewOrder && ids.includes(viewOrder.id)) {
          setViewOrder(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        // No vendor session — optimistic local update only
        setLocalOrders(prev =>
          prev.map(o => ids.includes(o.id) ? { ...o, status: newStatus } : o)
        );
        if (viewOrder && ids.includes(viewOrder.id)) {
          setViewOrder(prev => ({ ...prev, status: newStatus }));
        }
      }
      setSelected([]);
    } catch (err) {
      console.error('Error updating order status:', err);
      setError(err.message || 'Failed to update order status.');
    } finally {
      setLoadingIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const counts = {
    all:        localOrders.length,
    pending:    localOrders.filter(o => o.status === 'pending').length,
    processing: localOrders.filter(o => o.status === 'processing').length,
    completed:  localOrders.filter(o => o.status === 'completed').length,
    refunded:   localOrders.filter(o => o.status === 'refunded').length,
  };

  const filtered = localOrders.filter(o => {
    const matchTab    = tab === 'all' || o.status === tab;
    const matchSearch = (o.id || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.customer || '').toLowerCase().includes(search.toLowerCase()) ||
      (o.product  || o.productName || '').toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const toggleSelect = id =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const totalRevenue = localOrders.reduce((s, o) => s + (o.amount || 0), 0);

  const formatRevenue = (val) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)}L`;
    }
    return `₹${val.toLocaleString()}`;
  };

  const displayError = error || backendError;

  return (
    <VendorLayout activePage="orders" title="Orders" subtitle="Manage and fulfill customer orders">
      <OrderModal 
        order={viewOrder} 
        onClose={() => setViewOrder(null)} 
        onUpdateStatus={handleUpdateStatus} 
        loadingIds={loadingIds}
      />

      {displayError && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#DC2626',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{displayError}</span>
          </div>
          <button 
            className="v-btn v-btn-sm" 
            style={{ 
              background: 'rgba(239, 68, 68, 0.12)', 
              color: '#DC2626', 
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={() => {
              setError(null);
              refresh();
            }}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="v-stat-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Orders',  value: String(localOrders.length),    delta: '+12%', up: true, icon: <Package size={18} style={{ color: '#7B3FA0' }} /> },
          { label: 'Pending',       value: String(counts.pending),   delta: counts.pending > 0 ? 'Action needed' : 'All clear', up: counts.pending === 0, icon: <Clock size={18} style={{ color: '#D97706' }} /> },
          { label: 'Completed',     value: String(counts.completed), delta: localOrders.length > 0 ? `${Math.round((counts.completed / localOrders.length) * 100)}%` : '0%', up: true, icon: <CheckCircle2 size={18} style={{ color: '#16A34A' }} /> },
          { label: 'Revenue',       value: formatRevenue(totalRevenue), delta: '+8.4%', up: true, icon: <DollarSign size={18} style={{ color: '#7B3FA0' }} /> },
        ].map((s, i) => (
          <div key={i} className="v-card v-stat-card">
            <div className="v-stat-header">
              <div className="v-stat-icon" style={{ background: 'rgba(184,134,208,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
              <span className={`v-stat-badge ${s.up ? 'up' : 'neutral'}`}>{s.delta}</span>
            </div>
            <div className="v-stat-value">{s.value}</div>
            <div className="v-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search & Tabs Controls */}
      <div className="v-card v-card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, maxWidth: 280 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--v-text3)' }} />
            <input className="v-input" style={{ paddingLeft: 36, width: '100%' }}
              placeholder="Search orders..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="v-tabs" style={{ display: 'flex', gap: 4 }}>
            {Object.entries(counts).map(([k, v]) => (
              <button key={k} className={`v-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}{' '}
                <span style={{ opacity: 0.6, fontSize: 11 }}>({v})</span>
              </button>
            ))}
          </div>
          
          {/* Bulk Actions */}
          {selected.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', animation: 'fade-in 0.2s ease' }}>
              <select className="v-select" style={{ height: 32, padding: '4px 28px 4px 10px', fontSize: 12 }}
                value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                <option value="completed">Mark Completed</option>
                <option value="processing">Mark Processing</option>
                <option value="pending">Mark Pending</option>
                <option value="refunded">Mark Refunded</option>
                <option value="cancelled">Mark Cancelled</option>
              </select>
              <button 
                className="v-btn v-btn-primary v-btn-sm" 
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => handleUpdateStatus(selected, bulkStatus)}
                disabled={loadingIds.some(id => selected.includes(id))}
              >
                {loadingIds.some(id => selected.includes(id)) ? (
                  <RefreshCw size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
                ) : null}
                Apply to ({selected.length})
              </button>
              <button className="v-btn v-btn-ghost v-btn-sm" onClick={() => setSelected([])}>Clear</button>
            </div>
          )}
        </div>
      </div>

      {backendLoading ? (
        <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
          <RefreshCw size={32} className="text-purple" style={{ animation: 'spin 2s linear infinite', color: 'var(--v-purple)' }} />
          <div style={{ color: 'var(--v-text3)', fontSize: 14, fontWeight: 500 }}>Loading live orders from backend...</div>
        </div>
      ) : (
        <div className="v-card">
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" style={{ accentColor: '#B886D0' }}
                      checked={selected.length === filtered.length && filtered.length > 0}
                      onChange={e => setSelected(e.target.checked ? filtered.map(o => o.id) : [])} />
                  </th>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const st = STATUS_MAP[o.status] || STATUS_MAP.pending;
                  const priorityKey = getPriority(o);
                  const pr = PRIORITY_MAP[priorityKey] || PRIORITY_MAP.normal;
                  const customerName = o.customer || o.customerName || 'Customer';
                  const productName  = o.product  || o.productName  || '—';
                  const dateStr = o.date ? new Date(o.date).toLocaleDateString() : '—';
                  
                  return (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setViewOrder(o)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" style={{ accentColor: '#B886D0' }}
                          checked={selected.includes(o.id)} onChange={() => toggleSelect(o.id)} />
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--v-deep)', fontFamily: 'monospace', fontSize: 13 }}>{o.id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="v-avatar v-avatar-sm" style={{ background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: 11 }}>
                            {customerName[0]?.toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13.5, fontWeight: 500 }}>{customerName}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--v-text2)', maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--v-dark)' }}>₹{(o.amount || 0).toLocaleString()}</td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pr.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: pr.color, display: 'inline-block' }} />
                          {pr.label}
                        </span>
                      </td>
                      <td>
                        <span className={`v-badge ${st.cls}`}>
                          <span className="v-badge-dot" />
                          {st.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--v-text3)' }}>{dateStr}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="v-btn v-btn-ghost v-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setViewOrder(o)}>
                            <Eye size={12} />
                            View
                          </button>
                          {o.status === 'pending' && (
                            <button className="v-btn v-btn-primary v-btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              onClick={() => handleUpdateStatus([o.id], 'completed')}
                              disabled={loadingIds.includes(o.id)}>
                              {loadingIds.includes(o.id) ? (
                                <RefreshCw size={12} style={{ animation: 'spin 1.5s linear infinite' }} />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              Fulfill
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="v-empty">
              <div className="v-empty-icon">📦</div>
              <div className="v-empty-title">No orders found</div>
              <div className="v-empty-sub">Try adjusting your search or filter</div>
            </div>
          )}
        </div>
      )}
    </VendorLayout>
  );
}
