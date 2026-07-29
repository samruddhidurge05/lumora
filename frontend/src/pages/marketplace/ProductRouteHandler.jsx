import React, { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { backendFetch } from '../../utils/api';

export default function ProductRouteHandler() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const { openProductModal, navigateTo } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!productId) {
      navigate('/#products', { replace: true });
      return;
    }

    const isQr = searchParams.get('src') === 'qr';

    // If source is QR code, record QR scan analytics on backend non-fatally
    if (isQr) {
      backendFetch(`/products/${encodeURIComponent(productId)}/qr-scan`, { method: 'POST' }).catch(() => {});
    }

    // Open product page in SPA
    if (typeof openProductModal === 'function') {
      openProductModal(productId);
    } else if (typeof navigateTo === 'function') {
      navigateTo('product-detail', productId);
    } else {
      navigate(`/#product/${productId}`, { replace: true });
    }
  }, [productId, searchParams, openProductModal, navigateTo, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(196,181,253,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
