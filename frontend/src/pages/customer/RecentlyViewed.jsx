import React, { useState, useEffect } from 'react';
import { Eye, Trash2, ShoppingBag, ArrowRight, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getLocalRecentlyViewed, clearRecentlyViewedHistory, fetchRecentlyViewed } from '../../services/historyService';

export default function RecentlyViewed() {
  const { user } = useAuth();
  const { addToCart, buyNow, navigateTo, formatPrice, products, cart } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. First show local data immediately for fast UX
      const localItems = getLocalRecentlyViewed();
      if (localItems.length > 0) {
        setItems(localItems);
      }
      
      // 2. Fetch history from backend / Firebase
      const fetched = await fetchRecentlyViewed(user?.uid);
      if (fetched && fetched.length > 0) {
        const localIds = new Set(localItems.map(i => String(i.id)));
        const merged = [...localItems];
        for (const item of fetched) {
          const pId = String(item.productId || item.id);
          if (!localIds.has(pId)) {
            const matchedProd = Array.isArray(products) ? products.find(p => String(p.id) === pId) : null;
            if (matchedProd) {
              merged.push(matchedProd);
              localIds.add(pId);
            } else if (item.title) {
              merged.push(item);
              localIds.add(pId);
            }
          }
        }
        setItems(merged);
      }
    } catch (err) {
      console.warn('[RecentlyViewed] Error loading history:', err);
      setError('Could not sync browsing history with backend server.');
      setItems(getLocalRecentlyViewed());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user?.uid, products]);

  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear your browsing history?")) {
      await clearRecentlyViewedHistory(user?.uid);
      setItems([]);
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderRadius: '20px' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}>
          <Loader size={22} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <p style={{ color: 'var(--color-mocha)', fontSize: '0.8rem' }}>Loading your browsing history...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderRadius: '20px' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}>
          <Eye size={22} />
        </div>
        <div>
          <h3 className="text-sans" style={{ fontWeight: 700, color: 'var(--color-espresso)', fontSize: '1rem' }}>No recently viewed items</h3>
          <p style={{ color: 'var(--color-mocha)', fontSize: '0.8rem', marginTop: '4px' }}>Items you view on the marketplace will show up here to help you continue browsing.</p>
        </div>
        <button
          onClick={() => navigateTo('marketplace')}
          className="btn-premium btn-premium-solid"
          style={{ padding: '10px 20px', fontSize: '0.75rem', borderRadius: '10px', marginTop: '8px', cursor: 'pointer' }}
        >
          Explore Marketplace
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.8s ease' }}>
      
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>CONTINUE BROWSING</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Recently Viewed Products</h2>
        </div>
        
        <button
          onClick={handleClear}
          className="btn-premium btn-remove"
          style={{ padding: '8px 16px', fontSize: '0.72rem', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <Trash2 size={13} /> Clear History
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DC2626', fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
          <button onClick={loadHistory} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.74rem' }}>Retry</button>
        </div>
      )}

      {/* Grid of recently viewed items */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {items.map(item => (
          <div
            key={item.id}
            className="glass-card clickable"
            onClick={() => navigateTo('product-detail', item.id)}
            style={{ padding: '0', overflow: 'hidden', height: '380px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(196,181,253,0.22)', boxShadow: 'var(--shadow-premium)', cursor: 'pointer', borderRadius: '18px' }}
          >
            <div style={{ position: 'relative', height: '160px', overflow: 'hidden' }}>
              <img src={item.preview || item.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70'} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <span style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '0.6rem', background: 'rgba(45, 0, 77, 0.70)', border: '1px solid rgba(216, 191, 227, 0.20)', color: 'var(--color-lavender)', fontWeight: 700, padding: '4px 8px', borderRadius: '6px' }}>
                {item.category || 'Digital Asset'}
              </span>
            </div>
            
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-mocha)', fontWeight: 700 }}>
                  By {item.seller?.name || item.seller || 'Sophia Vance'}
                </span>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--color-mocha)', marginTop: '4px', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {item.description || 'Verified digital product template with premium features.'}
                </p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(45,0,77,0.06)', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(item.price || 0)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); addToCart(item); }}
                    className="btn-premium"
                    style={{ padding: '6px 12px', fontSize: '0.7rem', borderRadius: '8px', border: '1.5px solid rgba(123, 63, 160, 0.25)', background: 'rgba(255, 255, 255, 0.60)', cursor: 'pointer' }}
                  >
                    {cart.some(cartItem => String(cartItem.id) === String(item.id)) ? '✓ Added to Cart' : 'Add to Cart'}
                  </button>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); buyNow(item); }}
                  className="btn-premium btn-premium-solid buy-now-glow"
                  style={{ width: '100%', padding: '6px', fontSize: '0.72rem', borderRadius: '8px', justifyContent: 'center', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  Buy Now <ArrowRight size={12} style={{ marginLeft: '4px' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
