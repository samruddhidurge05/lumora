import React, { useEffect, useState } from 'react';
import { CheckCircle, Download, ArrowRight, Package, Star, RefreshCw } from 'lucide-react';
import Navbar from '../../components/common/Navbar';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import confetti from 'canvas-confetti';

export default function Success() {
  const { lastPurchasedItems, navigateTo, formatPrice } = useApp();
  const { user } = useAuth();
  const [latestOrder, setLatestOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    // Fire confetti on mount
    confetti({
      particleCount: 120,
      spread: 80,
      colors: ['#D8BFE3', '#B886D0', '#7B3FA0'],
      origin: { y: 0.5 },
    });

    // Fetch the most recent order from backend to show real order details
    if (user) {
      setLoadingOrder(true);
      backendFetch('/orders/me')
        .then(orders => {
          if (Array.isArray(orders) && orders.length > 0) {
            // Most recent order first
            const sorted = [...orders].sort((a, b) =>
              new Date(b.created_at) - new Date(a.created_at)
            );
            setLatestOrder(sorted[0]);
          }
        })
        .catch(() => {}) // Backend offline — use lastPurchasedItems fallback
        .finally(() => setLoadingOrder(false));
    }
  }, [user]);

  // Derive items to display: prefer backend order items, fall back to lastPurchasedItems
  const displayItems = latestOrder?.items?.length
    ? latestOrder.items
    : lastPurchasedItems;

  const orderTotal = latestOrder?.total_amount
    ? `₹${Number(latestOrder.total_amount).toLocaleString('en-IN')}`
    : lastPurchasedItems.length > 0
      ? formatPrice(lastPurchasedItems.reduce((s, i) => s + i.price * (i.quantity || 1), 0))
      : null;

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{
        paddingTop: '120px',
        padding: '120px clamp(1.5rem,5vw,6rem) 80px',
        maxWidth: '720px',
        margin: '0 auto',
        textAlign: 'center',
      }}>
        {/* Success icon */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(34,197,94,0.18),rgba(34,197,94,0.06))',
          border: '2px solid rgba(34,197,94,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', color: '#16a34a',
          boxShadow: '0 8px 32px rgba(34,197,94,0.15)',
        }}>
          <CheckCircle size={42} />
        </div>

        <span className="caption-premium" style={{ color: '#7B3FA0' }}>Purchase Complete</span>
        <h1 className="text-editorial" style={{
          fontSize: 'clamp(2.5rem,5vw,3.5rem)', fontWeight: 400,
          color: 'var(--color-espresso)', marginTop: '8px', lineHeight: 1.1,
        }}>
          Assets Unlocked!
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-mocha)', marginTop: '12px', lineHeight: 1.6 }}>
          Your purchase was successful. Your digital assets are now in your secure vault.
        </p>

        {/* Order reference */}
        {latestOrder && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '10px',
            marginTop: '16px', padding: '8px 18px',
            background: 'rgba(123,63,160,0.06)', borderRadius: '20px',
            border: '1px solid rgba(196,181,253,0.28)',
            fontSize: '0.78rem', fontWeight: 700, color: '#7B3FA0',
          }}>
            <Package size={13} />
            Order #{latestOrder.id} &nbsp;·&nbsp;
            {latestOrder.payment_method?.toUpperCase() || 'PAID'} &nbsp;·&nbsp;
            {orderTotal}
          </div>
        )}

        {/* Loading state */}
        {loadingOrder && !latestOrder && (
          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#7B3FA0', fontSize: '0.82rem', fontWeight: 600 }}>
            <RefreshCw size={14} style={{ animation: 'spin 1.2s linear infinite' }} />
            Fetching order details…
          </div>
        )}

        {/* Purchased items */}
        {displayItems.length > 0 && (
          <div className="glass-card" style={{
            padding: '24px', marginTop: '36px', textAlign: 'left',
            border: '1px solid rgba(34,197,94,0.22)',
          }}>
            <h3 style={{
              fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-mocha)',
              letterSpacing: '0.08em', marginBottom: '16px', textTransform: 'uppercase',
            }}>
              {displayItems.length} Item{displayItems.length !== 1 ? 's' : ''} Purchased
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {displayItems.map((item, idx) => {
                // Support both local cart items and backend OrderItem format
                const title    = item.title || `Product #${item.product_id}`;
                const preview  = item.preview || null;
                const category = item.category || '';
                const priceVal = item.price
                  ? formatPrice(item.price)
                  : item.price_paid
                    ? `₹${Number(item.price_paid).toLocaleString('en-IN')}`
                    : null;
                const downloadUrl = item.download_url || null;

                return (
                  <div key={item.id || item.product_id || idx} style={{
                    display: 'flex', gap: '14px', alignItems: 'center',
                    padding: '12px', borderRadius: '12px',
                    background: 'rgba(34,197,94,0.04)',
                    border: '1px solid rgba(34,197,94,0.12)',
                  }}>
                    {preview && (
                      <img
                        src={preview} alt={title}
                        style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-espresso)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {title}
                      </p>
                      {category && (
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{category}</p>
                      )}
                      {downloadUrl && (
                        <SuccessDownloadLink
                          downloadUrl={downloadUrl}
                          title={title}
                        />
                      )}
                    </div>
                    {priceVal && (
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#7B3FA0', flexShrink: 0 }}>
                        {priceVal}
                      </span>
                    )}
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: 'rgba(34,197,94,0.15)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <CheckCircle size={13} style={{ color: '#16a34a' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Verified purchase badge */}
        <div className="glass-card" style={{
          marginTop: '20px', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: '12px',
          textAlign: 'left', border: '1px solid rgba(196,181,253,0.25)',
        }}>
          <Star size={18} style={{ color: '#C7A55A', flexShrink: 0 }} fill="#C7A55A" />
          <div>
            <p style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '2px' }}>
              Verified Purchase Complete
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--color-mocha)', lineHeight: 1.5 }}>
              You can now leave a review from your Customer Dashboard → Reviews Manager.
            </p>
          </div>
        </div>

        {/* CTA buttons */}
        <div style={{
          display: 'flex', gap: '12px', justifyContent: 'center',
          marginTop: '32px', flexWrap: 'wrap',
        }}>
          <button
            onClick={() => navigateTo('dashboard', 'Downloads')}
            className="btn-premium btn-premium-solid"
            style={{ padding: '12px 24px', fontSize: '0.88rem', borderRadius: '12px' }}
          >
            <Download size={15} /> View Downloads
          </button>
          <button
            onClick={() => navigateTo('dashboard', 'Orders')}
            className="btn-premium"
            style={{ padding: '12px 24px', fontSize: '0.88rem', borderRadius: '12px' }}
          >
            <Package size={15} /> My Orders
          </button>
          <button
            onClick={() => navigateTo('marketplace')}
            className="btn-premium"
            style={{ padding: '12px 24px', fontSize: '0.88rem', borderRadius: '12px' }}
          >
            Continue Shopping <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ─── SuccessDownloadLink ────────────────────────────────────────────────────
   Replaces the plain <a> tag on the purchase success page.
   - If the backend responds with { type: "pending" }, shows a friendly message.
   - If external (pCloud), opens in new tab.
   - Otherwise falls through to the token-based file stream.
   Never exposes a 404 or technical error to the customer.
────────────────────────────────────────────────────────────────────────────── */
function SuccessDownloadLink({ downloadUrl, title }) {
  const [state, setState] = useState('idle'); // idle | pending

  const handleClick = async (e) => {
    e.preventDefault();
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${apiBase}${downloadUrl}`;

    try {
      const resp = await backendFetch(downloadUrl.replace(/^\/api/, ''));
      if (resp?.type === 'pending') {
        setState('pending');
        return;
      }
      if (resp?.type === 'external' && resp?.redirect_url) {
        window.open(resp.redirect_url, '_blank');
        return;
      }
      if (resp?.download_url) {
        const apiBaseClean = (import.meta.env.VITE_API_BASE_URL || apiBase || 'http://localhost:8000').replace(/\/api\/?$/, '');
        const fileCheckUrl = resp.download_url.startsWith('/api') ? resp.download_url.replace('/api', '') : resp.download_url;
        window.open(`${apiBaseClean}${fileCheckUrl.startsWith('/') ? fileCheckUrl : '/' + fileCheckUrl}`, '_blank');
        return;
      }
    } catch (_) {
      // Not JSON — it's a real file stream; open directly
    }

    window.open(fullUrl, '_blank');
  };

  if (state === 'pending') {
    return (
      <div style={{
        marginTop: '6px',
        padding: '8px 12px',
        borderRadius: '10px',
        background: 'rgba(123,63,160,0.06)',
        border: '1px solid rgba(123,63,160,0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5A1E7E' }}>
          ⏳ Download Pending
        </span>
        <span style={{ fontSize: '0.66rem', color: '#7B3FA0', lineHeight: 1.5 }}>
          Your purchase is confirmed. The creator has not yet uploaded the file — it will appear in your Downloads automatically once available.
        </span>
      </div>
    );
  }

  return (
    <a
      href={downloadUrl}
      onClick={handleClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        marginTop: '4px', fontSize: '0.70rem', fontWeight: 700,
        color: '#16a34a', textDecoration: 'none',
      }}
    >
      <Download size={10} /> Download now
    </a>
  );
}
