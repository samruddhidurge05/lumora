import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { backendFetch } from '../../utils/api';

export default function ProductRouteHandler() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const { navigateTo } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productId) {
      navigate('/', { replace: true });
      return;
    }

    const isQr = searchParams.get('src') === 'qr';
    const ref = searchParams.get('ref') || '';

    // Fire QR analytics non-fatally
    if (isQr) {
      backendFetch(`/products/${encodeURIComponent(productId)}/qr-scan`, { method: 'POST' }).catch(() => {});
    }

    // Fetch the product from backend to resolve slug → numeric ID
    // The SPA's getActiveProduct() matches by numeric ID, not slug.
    backendFetch(`/products/${encodeURIComponent(productId)}`)
      .then(res => res.json())
      .then(product => {
        if (!product || !product.id) {
          setError(true);
          return;
        }

        // Persist referral code so ProductPage can pick it up
        if (ref) {
          sessionStorage.setItem('lumora_aff_ref', ref);
        }

        // Navigate using the numeric ID so getActiveProduct() can match it
        navigateTo('product-detail', String(product.id));
        // Force React Router to unmount this handler and mount the SPA root
        navigate(`/#product/${product.id}`, { replace: true });
      })
      .catch(() => {
        setError(true);
      });
  }, [productId, navigate, navigateTo, searchParams]);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '24px', fontFamily: 'var(--font-sans)', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(216,191,227,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A1E7E' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2D004D', marginBottom: '8px' }}>This product is currently unavailable.</h2>
          <p style={{ fontSize: '0.875rem', color: '#7B3FA0', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
            It may have been archived, removed by the vendor, or is undergoing review.
          </p>
        </div>
        <button
          onClick={() => navigate('/', { replace: true })}
          style={{ padding: '12px 28px', borderRadius: '12px', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem' }}
        >
          Browse Marketplace
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(196,181,253,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

