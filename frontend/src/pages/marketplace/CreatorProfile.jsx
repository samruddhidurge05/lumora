import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, ShoppingBag, Package, MessageSquare, BarChart3, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { createConversation } from '../../services/messageService';
import { backendFetch } from '../../utils/api';


export default function CreatorProfile() {
  const { getActiveCreator, getCreatorProducts, addToCart, buyNow, navigateTo, formatPrice } = useApp();
  const { user } = useAuth();
  const creator = getActiveCreator();
  const products = getCreatorProducts(creator.id);

  // Try to load real backend stats for the creator
  const [backendStats, setBackendStats] = useState(null);
  useEffect(() => {
    if (!creator?.id) return;
    backendFetch(`/vendors/public/${creator.id}/profile`)
      .then(data => { if (data?.vendor_id) setBackendStats(data); })
      .catch(() => {}); // graceful degradation
  }, [creator?.id]);

  const totalSales    = backendStats?.product_count
    ? `${backendStats.product_count} products`
    : creator.sales || '0';
  const avgRating     = backendStats?.avg_rating
    ? `${backendStats.avg_rating} ★`
    : creator.rating || '5.0 ★';
  const productCount  = backendStats?.product_count ?? products.length;
  const totalDownloads = backendStats?.total_downloads ?? null;

  const handleContactCreator = async () => {
    if (!user) {
      alert("Please log in to contact the creator.");
      navigateTo('login-selection');
      return;
    }
    try {
      const buyerId    = user.uid;
      const buyerName  = user.displayName || user.email || 'Customer';
      const sellerId   = creator.id || 'sophia-vance';
      const sellerName = creator.name || 'Sophia Vance';
      await createConversation(buyerId, buyerName, sellerId, sellerName);
      navigateTo('dashboard', 'Messages Center');
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };


  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 20 }}>
      {/* Banner */}
      <div style={{ height: '280px', position: 'relative', overflow: 'hidden' }}>
        <img src={creator.banner} alt={creator.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(45,0,77,0.30) 100%)' }} />
        <button onClick={() => navigateTo('marketplace')} className="btn-premium"
          style={{ position: 'absolute', top: '24px', left: '24px', padding: '8px 16px', fontSize: '0.75rem', borderRadius: '20px', background: 'rgba(216,191,227,0.25)', backdropFilter: 'blur(10px)' }}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>

      <div style={{ padding: '0 clamp(16px, 4vw, 48px) 48px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Creator Info */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', marginTop: '-48px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <img src={creator.avatar} alt={creator.name}
            style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(216,191,227,0.30)', boxShadow: '0 8px 24px rgba(216,191,227,0.20)', flexShrink: 0 }} />
          <div style={{ flex: 1, paddingBottom: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h1 className="text-editorial" style={{ fontSize: '2.5rem', fontWeight: 400, color: 'var(--color-espresso)' }}>{creator.name}</h1>
              <p style={{ color: 'var(--color-mocha)', fontSize: '0.85rem', marginTop: '4px', maxWidth: '600px', lineHeight: 1.5 }}>{creator.bio}</p>
            </div>
            <button
              onClick={handleContactCreator}
              className="btn-premium btn-premium-solid"
              style={{ padding: '8px 16px', fontSize: '0.75rem', borderRadius: '10px', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <MessageSquare size={13} /> Message Creator
            </button>
          </div>
          <div style={{ display: 'flex', gap: '16px', paddingBottom: '8px' }}>
            <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{totalSales}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>TOTAL SALES</div>
            </div>
            <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{avgRating}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>AVG RATING</div>
            </div>
            <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{productCount}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>PRODUCTS</div>
            </div>
            {totalDownloads !== null && (
              <div className="glass-card" style={{ padding: '12px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{totalDownloads.toLocaleString()}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)', letterSpacing: '0.05em' }}>DOWNLOADS</div>
              </div>
            )}
          </div>
        </div>

        {/* Products */}
        <div>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--color-espresso)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} /> Products by {creator.name}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {products.map(product => (
              <div key={product.id} className="glass-card" onClick={() => navigateTo('product-detail', product.id)}
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', height: '390px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
                  <img src={product.preview} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {product.badge && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '0.6rem', background: 'var(--color-peach)', color: 'var(--color-espresso)', fontWeight: 800, padding: '4px 8px', borderRadius: '6px' }}>
                      {product.badge}
                    </div>
                  )}
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--color-mocha)', fontWeight: 600 }}>
                      <Star size={10} fill="var(--color-latte)" stroke="var(--color-latte)" /> {product.rating} ({product.reviews})
                    </div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '6px' }}>{product.title}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{formatPrice(product.price)}</span>
                      <button onClick={e => { e.stopPropagation(); addToCart(product); }} className="btn-premium"
                        style={{ padding: '8px 12px', fontSize: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', border: '1.5px solid rgba(123, 63, 160, 0.25)', background: 'rgba(255, 255, 255, 0.60)' }}>
                        <ShoppingBag size={12} /> Add
                      </button>
                    </div>
                    <button onClick={e => { e.stopPropagation(); buyNow(product); }} className="btn-premium btn-premium-solid buy-now-glow"
                      style={{ width: '100%', padding: '8px', fontSize: '0.75rem', borderRadius: '8px', justifyContent: 'center', display: 'flex', alignItems: 'center', boxShadow: '0 4px 14px rgba(123, 63, 160, 0.3)' }}>
                      Buy Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
