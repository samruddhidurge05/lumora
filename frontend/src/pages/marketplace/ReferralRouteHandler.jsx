import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { backendFetch } from '../../utils/api';
import { Clock, Shield } from 'lucide-react';

export default function ReferralRouteHandler() {
  const { code, productId: paramProductId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, userRole, loading: authLoading } = useAuth();
  const { navigateTo, openProductModal } = useApp();
  const navigate = useNavigate();

  const [statusMsg, setStatusMsg] = useState('Verifying affiliate referral link...');
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    const refCode = code || searchParams.get('ref') || '';
    const rawProdId = paramProductId || searchParams.get('product_id') || searchParams.get('p') || '';
    const numericProdId = parseInt(rawProdId, 10);

    if (!refCode) {
      navigate('/#products', { replace: true });
      return;
    }

    const processReferral = async () => {
      try {
        let sessionId = null;
        let validProdId = isNaN(numericProdId) ? null : numericProdId;

        // 1. Register referral click on backend
        if (validProdId) {
          try {
            const clickRes = await backendFetch('/affiliate/referrals/click', {
              method: 'POST',
              body: JSON.stringify({
                referral_code: refCode,
                product_id: validProdId
              })
            });

            if (clickRes && clickRes.session_id) {
              sessionId = clickRes.session_id;
            }
          } catch (err) {
            console.warn('[ReferralRouteHandler] Backend click tracking notice:', err);
          }
        }

        // Store pending referral in localStorage & sessionStorage for persistent cross-tab/refresh recovery
        const referralPayload = {
          session_id: sessionId,
          referral_code: refCode,
          product_id: validProdId,
          timestamp: Date.now()
        };
        localStorage.setItem('lumora_pending_referral', JSON.stringify(referralPayload));
        sessionStorage.setItem('lumora_aff_ref', refCode);
        if (sessionId) sessionStorage.setItem('lumora_ref_session_id', sessionId);

        // 2. Check Customer Authentication State
        if (!user) {
          // Unauthenticated customer -> Route to Login page with redirect query param
          setStatusMsg('Redirecting to secure login...');
          // Use hash-based SPA URL so the product loads correctly after login
          const targetRedirect = validProdId ? `/#product/${validProdId}` : '/#products';
          navigate(`/auth/login?role=customer&redirect=${encodeURIComponent(targetRedirect)}&ref=${encodeURIComponent(refCode)}`, { replace: true });
          return;
        }

        // 3. Authenticated customer -> Authenticate referral session in PostgreSQL
        if (user && sessionId) {
          try {
            await backendFetch('/affiliate/referrals/authenticate', {
              method: 'POST',
              body: JSON.stringify({
                session_id: sessionId,
                referral_code: refCode,
                product_id: validProdId
              })
            });
          } catch (authErr) {
            console.warn('[ReferralRouteHandler] Authentication linking notice:', authErr);
          }
        }

        // 4. Open the EXACT referred product page
        if (validProdId) {
          if (typeof openProductModal === 'function') {
            openProductModal(validProdId);
          } else if (typeof navigateTo === 'function') {
            navigateTo('product-detail', validProdId);
          } else {
            navigate(`/#product/${validProdId}`, { replace: true });
          }
        } else {
          navigate('/#products', { replace: true });
        }
      } catch (err) {
        setErrorMsg('Could not process referral link.');
        setTimeout(() => navigate('/#products', { replace: true }), 2000);
      }
    };

    processReferral();
  }, [code, paramProductId, searchParams, user, authLoading, navigate, navigateTo, openProductModal]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1A1625, #0F0C14)', color: '#FFFDF9',
      fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.06)', borderRadius: '24px', padding: '36px 44px',
        border: '1px solid rgba(220, 198, 255, 0.2)', textAlign: 'center', maxWidth: '440px', width: '100%',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(16px)'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.2)',
          border: '1px solid rgba(196, 181, 253, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', color: '#DCC6FF'
        }}>
          <Shield size={32} />
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#DCC6FF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          ✦ Lumora Referral Verification
        </span>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '8px 0 12px', color: '#FFFDF9' }}>
          {errorMsg ? 'Referral Notice' : 'Connecting Referral...'}
        </h3>
        <p style={{ fontSize: '0.86rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5, margin: 0 }}>
          {errorMsg || statusMsg}
        </p>
        {!errorMsg && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <Clock size={20} style={{ animation: 'spin 1.2s linear infinite', color: '#DCC6FF' }} />
          </div>
        )}
      </div>
    </div>
  );
}
