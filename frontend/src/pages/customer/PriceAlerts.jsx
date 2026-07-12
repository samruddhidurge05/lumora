import React, { useState, useEffect } from 'react';
import { BellRing, Tag, ShoppingBag, Eye, Trash2, Clock, AlertCircle, RefreshCw, Plus, Edit2, Check, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getPriceAlerts, togglePriceAlertSubscription } from '../../services/priceAlertService';
import { backendFetch } from '../../utils/api';

export default function PriceAlerts() {
  const { user } = useAuth();
  const { addToCart, buyNow, navigateTo, products, formatPrice } = useApp();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState(null);
  const [editTargetPrice, setEditTargetPrice] = useState('');

  // Form states for creating alert
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customTargetPrice, setCustomTargetPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. View alerts
  const fetchAlerts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getPriceAlerts(user.uid);
      if (Array.isArray(data)) {
        setAlerts(data);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error fetching price alerts:', err);
      setError('Could not load active price trackers from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  // 2. Create alert
  const handleCreateAlert = async (e) => {
    e.preventDefault();
    if (!selectedProductId) return;
    const prod = products.find(p => String(p.id) === String(selectedProductId));
    if (!prod) return;

    setSubmitting(true);
    try {
      const targetVal = customTargetPrice ? Number(customTargetPrice) : Math.round(prod.price * 0.9 * 100) / 100;

      await backendFetch('/price-alerts/', {
        method: 'POST',
        body: JSON.stringify({
          user_id: parseInt(localStorage.getItem('lumora_backend_uid'), 10) || 1,
          product_id: prod.id,
          original_price: prod.price,
          target_price: targetVal,
          active: true
        })
      }).catch(async () => {
        // Fallback to service
        await togglePriceAlertSubscription(user.uid, prod, true);
      });

      setShowCreateModal(false);
      setSelectedProductId('');
      setCustomTargetPrice('');
      fetchAlerts();
    } catch (err) {
      console.error('Error creating price alert:', err);
      setError('Failed to create price tracker.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Update alert
  const handleUpdateAlert = async (alertId, targetPriceVal, activeVal) => {
    try {
      await backendFetch(`/price-alerts/${alertId}`, {
        method: 'PUT',
        body: JSON.stringify({
          user_id: parseInt(localStorage.getItem('lumora_backend_uid'), 10) || 1,
          product_id: 0,
          original_price: 0,
          target_price: Number(targetPriceVal),
          active: Boolean(activeVal)
        })
      }).catch(() => null);

      setEditingAlertId(null);
      setAlerts(prev => prev.map(a => String(a.id) === String(alertId) ? { ...a, targetPrice: Number(targetPriceVal), active: Boolean(activeVal) } : a));
    } catch (err) {
      console.error('Error updating price alert:', err);
    }
  };

  // 4. Delete alert
  const handleRemoveAlert = async (alert) => {
    const prod = products.find(p => String(p.id) === String(alert.productId)) || { id: alert.productId, title: 'Asset' };
    if (window.confirm(`Stop tracking price drops for ${prod.title || 'this product'}?`)) {
      try {
        await backendFetch(`/price-alerts/${alert.id}`, { method: 'DELETE' }).catch(() => null);
        await togglePriceAlertSubscription(user.uid, prod, false).catch(() => null);
        setAlerts(prev => prev.filter(a => String(a.id) !== String(alert.id)));
      } catch (err) {
        console.error('Error deleting price alert:', err);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fade-in 0.8s ease' }}>
      {/* Header with Create Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>ACTIVE TRACKERS</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Price Drop Monitors</h2>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-premium btn-premium-solid" style={{ padding: '10px 18px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Add Price Tracker
        </button>
      </div>

      {/* Handle errors */}
      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchAlerts} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Handle loading */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Fetching active alerts database...</span>
        </div>
      ) : alerts.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderRadius: '20px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}>
            <BellRing size={24} />
          </div>
          <div>
            <h3 style={{ fontWeight: 700, color: 'var(--color-espresso)', fontSize: '1.05rem' }}>No active price drop alerts</h3>
            <p style={{ color: 'var(--color-mocha)', fontSize: '0.82rem', marginTop: '4px' }}>Set up price trackers to receive automatic notifications whenever product prices drop.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="btn-premium btn-premium-solid" style={{ marginTop: '8px', padding: '10px 22px', fontSize: '0.8rem' }}>Create First Tracker</button>
        </div>
      ) : (
        /* Alerts Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {alerts.map((alert) => {
            const prod = products.find(p => String(p.id) === String(alert.productId)) || {
              id: alert.productId,
              title: alert.productTitle || `Product #${alert.productId}`,
              preview: alert.productPreview || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70',
              price: alert.originalPrice || 0
            };
            
            const isDiscounted = prod.price < (alert.originalPrice || prod.price);
            const percentOff = isDiscounted ? Math.round((((alert.originalPrice || prod.price) - prod.price) / (alert.originalPrice || prod.price)) * 100) : 0;
            const isEditing = editingAlertId === String(alert.id);

            return (
              <div
                key={alert.id}
                className="glass-card"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  height: '190px',
                  padding: '0px',
                  overflow: 'hidden',
                  border: isDiscounted ? '1.5px solid #7B3FA0' : '1px solid rgba(196,181,253,0.22)',
                  boxShadow: isDiscounted ? '0 10px 30px rgba(123,63,160,0.15)' : 'var(--shadow-premium)'
                }}
              >
                {/* Thumbnail */}
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <img src={alert.productPreview || prod.preview || prod.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {isDiscounted && (
                    <span style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.55rem', background: '#7B3FA0', color: '#fff', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                      {percentOff}% OFF
                    </span>
                  )}
                </div>

                {/* Details */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)', width: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prod.title}
                      </h4>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingAlertId(String(alert.id));
                            setEditTargetPrice(String(alert.targetPrice || Math.round(prod.price * 0.9)));
                          }}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7B3FA0', outline: 'none' }}
                          title="Edit target price"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleRemoveAlert(alert)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(220,38,38,0.7)', outline: 'none' }}
                          title="Remove alert"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Price & Target editing */}
                    <div style={{ marginTop: '8px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="number"
                            value={editTargetPrice}
                            onChange={e => setEditTargetPrice(e.target.value)}
                            style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #7B3FA0', fontSize: '0.78rem', outline: 'none' }}
                          />
                          <button 
                            onClick={() => handleUpdateAlert(alert.id, editTargetPrice, alert.active !== false)} 
                            style={{ background: '#7B3FA0', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '0.7rem', cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingAlertId(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={13} /></button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isDiscounted ? '#7B3FA0' : 'var(--color-espresso)' }}>
                              {formatPrice(prod.price)}
                            </span>
                            {isDiscounted && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--color-mocha)', textDecoration: 'line-through' }}>
                                {formatPrice(alert.originalPrice)}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-mocha)', fontWeight: 600 }}>
                            Target: {formatPrice(alert.targetPrice || Math.round(prod.price * 0.9))}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                    <button
                      onClick={() => navigateTo('product-detail', alert.productId)}
                      className="btn-premium"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.7rem', borderRadius: '8px', border: '1px solid rgba(123, 63, 160, 0.25)', background: 'rgba(255, 255, 255, 0.80)', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <Eye size={12} /> View
                    </button>
                    <button
                      onClick={() => addToCart(prod)}
                      className="btn-premium btn-premium-solid"
                      style={{ flex: 1, padding: '6px 10px', fontSize: '0.7rem', borderRadius: '8px', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <ShoppingBag size={12} /> Buy
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '24px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
            <button onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(123,63,160,0.10)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BellRing size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>New Price Drop Tracker</h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Get notified automatically when catalog item price decreases</span>
              </div>
            </div>

            <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Select Digital Product:</label>
                <select 
                  value={selectedProductId} 
                  onChange={e => setSelectedProductId(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.82rem', outline: 'none', background: '#FAF8FC' }}
                >
                  <option value="">Choose product to monitor...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.title} ({formatPrice(p.price)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Custom Target Price (Optional):</label>
                <input 
                  type="number"
                  placeholder="Leave blank for automatic 10% target"
                  value={customTargetPrice}
                  onChange={e => setCustomTargetPrice(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.82rem', outline: 'none', background: '#FAF8FC' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={submitting} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}>
                  {submitting ? 'Creating...' : 'Start Tracker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
