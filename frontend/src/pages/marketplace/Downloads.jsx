import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { Download, Lock, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react';

export default function Downloads() {
  const { ownedProducts, products, formatPrice, navigateTo } = useApp();
  const { user } = useAuth();
  const [backendOrders, setBackendOrders] = useState(null); // null = loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Build owned list: merge backend order items + locally tracked ownedProducts
  const loadBackendDownloads = useCallback(async () => {
    if (!user) { setBackendOrders([]); return; }
    setLoading(true);
    setError(null);
    try {
      const orders = await backendFetch('/orders/me');
      if (Array.isArray(orders)) {
        // Flatten all completed order items
        const items = orders
          .filter(o => o.status === 'completed' || o.status === 'paid')
          .flatMap(o => (o.items || []).map(item => ({
            product_id: String(item.product_id),
            download_url: item.download_url || null,
            order_id: o.id,
            price_paid: item.price_paid,
            order_date: o.created_at,
          })));
        setBackendOrders(items);
      }
    } catch (err) {
      // Backend offline — gracefully fall back to local ownedProducts
      setError('Could not connect to server. Showing locally tracked downloads.');
      setBackendOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadBackendDownloads(); }, [loadBackendDownloads]);

  // Auto-refresh when a purchase or other download event fires
  useEffect(() => {
    const handler = () => loadBackendDownloads();
    window.addEventListener('lumora_refresh_user_data', handler);
    return () => window.removeEventListener('lumora_refresh_user_data', handler);
  }, [loadBackendDownloads]);

  // Build the final list of owned products to display
  const backendOwnedIds = new Set((backendOrders || []).map(i => i.product_id));
  const localOwnedIds = new Set(ownedProducts.map(String));
  const allOwnedIds = new Set([...backendOwnedIds, ...localOwnedIds]);

  const owned = products.filter(p => allOwnedIds.has(String(p.id)));

  // Get download URL for a product (prefer backend order URL)
  const getDownloadUrl = (productId) => {
    const orderItem = (backendOrders || []).find(i => i.product_id === String(productId));
    return orderItem?.download_url || null;
  };

  const [downloadToast, setDownloadToast] = useState(null); // { id, msg, ok }

  const handleDownload = async (product) => {
    const directUrl = getDownloadUrl(product.id);
    setDownloadingId(product.id);
    setDownloadToast(null);
    try {
      await new Promise(r => setTimeout(r, 600)); // brief "preparing" delay

      if (directUrl && directUrl.startsWith('http')) {
        // Already have a direct URL from the order item
        window.open(directUrl, '_blank');
        setDownloadToast({ id: product.id, msg: '✓ Download started!', ok: true });
        window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
      } else {
        // Call the secure download endpoint (requires JWT + verified purchase)
        const numericId = parseInt(product.id, 10);
        if (!isNaN(numericId)) {
          const resp = await backendFetch(`/products/${numericId}/download`);

          // ── Download Pending state ──────────────────────────────────────────
          // Backend signals the asset has not been uploaded yet.
          if (resp?.download_available === false) {
            setDownloadToast({ id: product.id, msg: 'Download Pending — asset not yet uploaded by creator.', ok: false, pending: true });
            return;
          }

          // Handle pCloud / external redirect (temporary dev/testing implementation)
          if (resp?.type === 'external' && resp?.redirect_url) {
            window.open(resp.redirect_url, '_blank');
            setDownloadToast({ id: product.id, msg: '✓ Download started!', ok: true });
          } else if (resp?.download_url) {
            // Internal token-based URL — call the download-file endpoint
            const fileResp = await backendFetch(resp.download_url.replace('/api', ''));
            // ── Handle pending response from download-file endpoint ────────────
            if (fileResp?.type === 'pending') {
              setDownloadToast({ id: product.id, msg: 'Download Pending — asset not yet uploaded by creator.', ok: false, pending: true });
              return;
            }
            if (fileResp?.type === 'external' && fileResp?.redirect_url) {
              window.open(fileResp.redirect_url, '_blank');
            } else {
              window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${resp.download_url}`, '_blank');
            }
            setDownloadToast({ id: product.id, msg: '✓ Download started!', ok: true });
            window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
          } else {
            setDownloadToast({ id: product.id, msg: 'Download link will be available after order processing.', ok: false });
          }
        } else {
          setDownloadToast({ id: product.id, msg: 'Download link will be available after order processing.', ok: false });
        }
      }
    } catch (err) {
      const msg = err?.message?.includes('403') || err?.message?.includes('401')
        ? 'Access denied. Please verify your purchase is complete.'
        : 'Download unavailable. Try refreshing or contact support.';
      setDownloadToast({ id: product.id, msg, ok: false });
    } finally {
      setDownloadingId(null);
      // Auto-clear toast after 6s (longer for pending messages)
      setTimeout(() => setDownloadToast(null), 6000);
    }
  };

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,5vw,6rem) 80px', maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Your Vault</span>
            <h1 className="text-editorial" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px' }}>Downloads</h1>
          </div>
          {user && (
            <button onClick={loadBackendDownloads} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '20px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.80)', color: '#7B3FA0', fontSize: '0.78rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              <RefreshCw size={13} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
              {loading ? 'Syncing…' : 'Refresh'}
            </button>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ marginBottom: '20px', padding: '12px 18px', background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)', borderRadius: '12px', fontSize: '0.80rem', color: '#92400e', fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && backendOrders === null && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
            <RefreshCw size={24} style={{ animation: 'spin 1.2s linear infinite', marginBottom: '12px' }} />
            <p>Loading your downloads…</p>
          </div>
        )}

        {!loading && owned.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px 40px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)' }}>
            <Lock size={48} style={{ color: 'rgba(123,63,160,0.2)', margin: '0 auto 16px' }} />
            <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--color-espresso)' }}>No downloads yet</h2>
            <p style={{ color: 'var(--color-mocha)', marginTop: '8px' }}>
              {!user ? 'Sign in and purchase products to access them here.' : 'Purchase products to access them here.'}
            </p>
            <button onClick={() => navigateTo('marketplace')} className="btn-premium btn-premium-solid" style={{ marginTop: '24px', padding: '12px 28px' }}>Browse Products</button>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ marginBottom: '24px', padding: '14px 20px', background: 'rgba(123,63,160,0.05)', borderRadius: '12px', border: '1px solid rgba(196,181,253,0.25)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: '#7B3FA0', fontWeight: 700 }}>
              <CheckCircle size={16} />
              {owned.length} product{owned.length !== 1 ? 's' : ''} in your vault
              {backendOrders !== null && backendOrders.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#8B6B5B', fontWeight: 500 }}>
                  from {new Set((backendOrders || []).map(i => i.order_id)).size} order{new Set((backendOrders || []).map(i => i.order_id)).size !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {owned.map(p => {
                const orderItem = (backendOrders || []).find(i => i.product_id === String(p.id));
                const isDownloading = downloadingId === p.id;
                return (
                  <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', gap: '16px', alignItems: 'center', border: '1px solid rgba(196,181,253,0.22)' }}>
                    <img src={p.preview} alt={p.title} style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{p.category}</p>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</h3>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>{p.version || 'v1.0.0'} · {p.fileSize || 'N/A'}</p>
                        {orderItem && (
                          <p style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, margin: 0 }}>
                            ✓ Verified Purchase · {orderItem.order_date ? new Date(orderItem.order_date).toLocaleDateString() : 'Completed'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => navigateTo('product-detail', p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.80)', color: '#5A1E7E', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        <ExternalLink size={12} /> Details
                      </button>
                      <button
                        onClick={() => handleDownload(p)}
                        disabled={isDownloading}
                        className="btn-premium btn-premium-solid"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', fontSize: '0.78rem', borderRadius: '10px', flexShrink: 0, opacity: isDownloading ? 0.7 : 1, cursor: isDownloading ? 'not-allowed' : 'pointer' }}>
                        {isDownloading ? <RefreshCw size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> : <Download size={13} />}
                        {isDownloading ? 'Preparing…' : 'Download'}
                      </button>
                    </div>
                  </div>
                  {/* Inline toast for this product */}
                  {downloadToast && downloadToast.id === p.id && (
                    <div style={{
                      padding: '8px 16px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600,
                      background: downloadToast.ok
                        ? 'rgba(34,197,94,0.10)'
                        : downloadToast.pending
                          ? 'rgba(123,63,160,0.08)'
                          : 'rgba(251,191,36,0.12)',
                      border: `1px solid ${downloadToast.ok
                        ? 'rgba(34,197,94,0.30)'
                        : downloadToast.pending
                          ? 'rgba(123,63,160,0.25)'
                          : 'rgba(251,191,36,0.30)'}`,
                      color: downloadToast.ok ? '#15803d' : downloadToast.pending ? '#5A1E7E' : '#92400e',
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      {downloadToast.pending ? (
                        <>
                          <span style={{ fontWeight: 800 }}>⏳ Download Not Yet Available</span>
                          <span style={{ fontWeight: 400, fontSize: '0.74rem', lineHeight: 1.5 }}>
                            The creator has not uploaded the downloadable asset yet. Your purchase is secure and your ownership has been verified. Once the creator uploads the file, it will automatically become available in your Downloads.
                          </span>
                        </>
                      ) : downloadToast.msg}
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <Footer />
      <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
