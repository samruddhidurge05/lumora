import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, Trash2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';

export default function CustomerWishlist() {
  const { user } = useAuth();
  const { wishlist, setWishlist, addToCart, buyNow, navigateTo, formatPrice, products } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // 1. Fetch Wishlist & Sync with backend securely
  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from backend API
      const res = await backendFetch('/wishlist/me').catch(err => {
        console.warn('Backend wishlist fetch notice:', err);
        return null;
      });

      let backendPids = [];
      if (Array.isArray(res)) {
        backendPids = res.map(item => typeof item === 'object' ? String(item.product_id || item.id) : String(item)).filter(Boolean);
      }

      // Safely extract existing context wishlist IDs
      const currentWishlistArr = Array.isArray(wishlist) ? wishlist : [];
      const contextPids = currentWishlistArr.map(p => {
        if (!p) return null;
        return typeof p === 'object' ? String(p.id) : String(p);
      }).filter(Boolean);

      // Combine and deduplicate product IDs
      const combinedPids = Array.from(new Set([...backendPids, ...contextPids]));
      const catalogProducts = Array.isArray(products) ? products : [];

      // Map IDs to full product objects from catalog or preserve existing item objects
      const matchedProducts = combinedPids
        .map(id => {
          const found = catalogProducts.find(p => p && String(p.id) === String(id));
          if (found) return found;
          return currentWishlistArr.find(p => p && typeof p === 'object' && String(p.id) === String(id));
        })
        .filter(Boolean);

      setWishlist(matchedProducts);
    } catch (err) {
      console.warn('Silent wishlist sync fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [user, products.length]);

  // 2. Add Item to Backend Wishlist
  const handleAddItem = async (product) => {
    if (!product || !product.id) return;
    const prodIdStr = String(product.id);
    const currentList = Array.isArray(wishlist) ? wishlist : [];

    if (currentList.some(p => p && String(p.id) === prodIdStr)) {
      return; // Prevent duplicate
    }

    try {
      setActionLoading(prodIdStr);
      setError(null);
      await backendFetch(`/wishlist/?product_id=${product.id}`, { method: 'POST' }).catch(err => console.warn('POST wishlist notice:', err));
      
      setWishlist(prev => {
        const prevArr = Array.isArray(prev) ? prev : [];
        if (prevArr.some(p => p && String(p.id) === prodIdStr)) return prevArr;
        return [...prevArr, product];
      });
    } catch (err) {
      console.error('Error adding item to wishlist:', err);
      setError('Could not save item to server wishlist.');
    } finally {
      setActionLoading(null);
    }
  };

  // 3. Remove Item from Backend Wishlist
  const handleRemoveItem = async (product) => {
    if (!product || !product.id) return;
    const prodIdStr = String(product.id);

    try {
      setActionLoading(prodIdStr);
      setError(null);
      await backendFetch(`/wishlist/${product.id}`, { method: 'DELETE' }).catch(err => console.warn('DELETE wishlist notice:', err));
      
      setWishlist(prev => {
        const prevArr = Array.isArray(prev) ? prev : [];
        return prevArr.filter(p => p && String(p.id) !== prodIdStr);
      });
    } catch (err) {
      console.error('Error removing item from wishlist:', err);
      setError('Could not remove item from server wishlist.');
    } finally {
      setActionLoading(null);
    }
  };

  const safeWishlist = Array.isArray(wishlist) ? wishlist.filter(Boolean) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.5s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em' }}>SAVED ITEMS</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--text-primary)' }}>Wishlist</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>You have {safeWishlist.length} saved digital products</p>
        </div>
      </div>

      {/* Handle errors gracefully */}
      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchWishlist} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Sync Again
          </button>
        </div>
      )}

      {/* Handle loading */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Syncing saved wishlist items...</span>
        </div>
      ) : safeWishlist.length === 0 ? (
        /* Empty State */
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)', borderRadius: '20px' }}>
          <Heart size={44} style={{ color: 'rgba(123,63,160,0.25)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No saved items yet</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>Save your favorite templates, tools, and UI kits to access them anytime.</p>
          <button onClick={() => navigateTo('marketplace')} style={{ marginTop: '20px', padding: '10px 24px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.38)' }}>Browse Marketplace</button>
        </div>
      ) : (
        /* Wishlist Items Grid */
        <div className="wishlist-grid">
          {safeWishlist.map(p => (
            <div key={p.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(196,148,230,0.22)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', height: '160px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => navigateTo('product-detail', p.id)}>
                <img src={p.preview || p.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70'} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Remove item button */}
                <button 
                  onClick={e => { e.stopPropagation(); handleRemoveItem(p); }} 
                  disabled={actionLoading === String(p.id)}
                  title="Remove from wishlist"
                  style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E11D48', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', transition: 'all 0.2s' }}
                >
                  {actionLoading === String(p.id) ? (
                    <Clock size={13} style={{ animation: 'spin 1.5s linear infinite' }} />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category || 'Digital Asset'}</span>
                <h3 style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(196,148,230,0.15)' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(p.price || 0)}</span>
                  <button onClick={() => addToCart(p)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(123,63,160,0.30)', background: 'rgba(255,255,255,0.90)', color: '#7B3FA0', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShoppingBag size={12} /> Add
                  </button>
                </div>
                <button onClick={() => buyNow(p)} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(90,30,126,0.25)' }}>
                  Buy Now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
