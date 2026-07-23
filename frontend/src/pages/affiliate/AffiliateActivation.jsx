// src/pages/affiliate/AffiliateActivation.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Allows an existing customer to activate affiliate access without creating
// a new Firebase account. Calls POST /api/affiliate/activate, stores the
// new JWT (with active_role=affiliate), updates AuthContext role, then
// redirects to the affiliate dashboard.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import AuthBackground from '../../components/AuthBackground';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  ALREADY: 'already',
};

export default function AffiliateActivation() {
  const navigate   = useNavigate();
  const { user, userRole, updateRole } = useAuth();
  const [status, setStatus]       = useState(STATUS.IDLE);
  const [errMsg, setErrMsg]       = useState('');
  const [referralCode, setReferralCode] = useState('');

  // Redirect away if not logged in or already an affiliate
  useEffect(() => {
    if (!user) {
      navigate('/auth/login?role=affiliate', { replace: true });
      return;
    }
    if (userRole === 'affiliate' || userRole === 'vendor') {
      navigate('/affiliate/dashboard', { replace: true });
    }
  }, [user, userRole, navigate]);

  const handleActivate = async () => {
    if (status === STATUS.LOADING) return;
    setStatus(STATUS.LOADING);
    setErrMsg('');

    try {
      const data = await backendFetch('/affiliate/activate', { method: 'POST' });

      // Store the new JWT (active_role=affiliate) returned by the backend
      if (data?.access_token) {
        localStorage.setItem('lumora_backend_token', data.access_token);
        if (data?.user?.id) {
          localStorage.setItem('lumora_backend_uid', String(data.user.id));
        }
      }

      // Update AuthContext role so the SPA renders affiliate views
      updateRole('affiliate');
      localStorage.setItem('lumora_active_role', 'affiliate');

      if (data?.referral_code) setReferralCode(data.referral_code);
      setStatus(data?.already_active ? STATUS.ALREADY : STATUS.SUCCESS);

      // Redirect to affiliate dashboard after 2 seconds
      setTimeout(() => {
        navigate('/affiliate/dashboard', { replace: true });
      }, 2200);
    } catch (err) {
      console.error('[AffiliateActivation] Failed:', err);
      setErrMsg(
        err?.detail ||
        err?.message ||
        'Activation failed. Please try again or contact support.'
      );
      setStatus(STATUS.ERROR);
    }
  };

  const isLoading = status === STATUS.LOADING;
  const isSuccess = status === STATUS.SUCCESS || status === STATUS.ALREADY;

  const cardStyle = {
    background: 'rgba(255,255,255,0.18)',
    backdropFilter: 'blur(48px) saturate(220%) brightness(1.04)',
    WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.04)',
    border: '1.5px solid rgba(255,255,255,0.45)',
    borderTop: '2px solid rgba(255,255,255,0.60)',
    borderRadius: '28px',
    boxShadow: '0 20px 72px rgba(90,30,126,0.18), inset 0 1px 0 rgba(255,255,255,0.65)',
    padding: '52px 44px 44px',
    width: '100%',
    maxWidth: '480px',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <AuthBackground>
      <div className="auth-container">
        <motion.div
          style={cardStyle}
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: '-60px', right: '-60px',
            width: '260px', height: '260px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(220,198,255,0.30) 0%, transparent 65%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />

          {/* Brand */}
          <motion.div
            className="card-brand"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </motion.div>

          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="activate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Role badge */}
                <div style={{ marginBottom: '10px', position: 'relative', zIndex: 2 }}>
                  <span className="role-badge">📣 Affiliate Activation</span>
                </div>

                <h2 className="card-heading" style={{ marginBottom: '8px' }}>
                  Activate Affiliate Access
                </h2>
                <p className="card-subheading" style={{ marginBottom: '28px' }}>
                  Your existing account will get affiliate capabilities added — your orders,
                  wishlist, and downloads are untouched.
                </p>

                {/* What you get */}
                <div style={{
                  background: 'rgba(123,63,160,0.06)',
                  border: '1px solid rgba(123,63,160,0.15)',
                  borderRadius: '14px', padding: '16px 18px',
                  marginBottom: '24px',
                }}>
                  {[
                    '✦ Unique referral link to share',
                    '✦ Earn 20% commission on every sale',
                    '✦ Real-time earnings dashboard',
                    '✦ All existing purchases remain intact',
                  ].map((item, i) => (
                    <div key={i} style={{
                      fontSize: '.84rem', color: '#5A1E7E', fontWeight: 600,
                      padding: '4px 0',
                    }}>
                      {item}
                    </div>
                  ))}
                </div>

                {/* Error alert */}
                {status === STATUS.ERROR && (
                  <motion.div
                    className="auth-alert auth-alert-error"
                    role="alert"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '20px' }}
                  >
                    <span>⚠</span><p>{errMsg}</p>
                  </motion.div>
                )}

                {/* CTA button */}
                <motion.button
                  className="btn-cta"
                  type="button"
                  disabled={isLoading}
                  style={{ marginTop: '4px', position: 'relative', overflow: 'hidden' }}
                  onClick={handleActivate}
                  whileHover={{ scale: isLoading ? 1 : 1.015 }}
                  whileTap={{ scale: isLoading ? 1 : 0.985 }}
                >
                  {isLoading && <div className="shimmer" />}
                  {isLoading ? 'Activating…' : 'Activate Affiliate Access'}
                </motion.button>

                <div style={{
                  marginTop: '20px', textAlign: 'center',
                  fontSize: '.82rem', color: '#8B7A9E',
                }}>
                  <span>Already an affiliate? </span>
                  <a
                    href="#"
                    style={{ color: '#7B3FA0', fontWeight: 700, textDecoration: 'none' }}
                    onClick={(e) => { e.preventDefault(); navigate('/auth/login?role=affiliate'); }}
                  >
                    Sign in →
                  </a>
                </div>

                <div className="signup-prompt" style={{ marginTop: '12px' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); navigate(-1); }}>
                    ← Go back
                  </a>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ textAlign: 'center', paddingTop: '8px' }}
              >
                {/* Success icon */}
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: '0 12px 40px rgba(90,30,126,0.30)',
                }}>
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path d="M7 16l7 7 11-13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                <h2 className="card-heading" style={{ marginBottom: '8px' }}>
                  {status === STATUS.ALREADY ? 'Already Active!' : 'Welcome, Affiliate! 🎉'}
                </h2>
                <p className="card-subheading" style={{ marginBottom: '20px' }}>
                  {status === STATUS.ALREADY
                    ? 'Your affiliate access was already active. Redirecting to dashboard…'
                    : 'Your affiliate access has been activated. Redirecting to your dashboard…'}
                </p>

                {referralCode && (
                  <div style={{
                    background: 'rgba(123,63,160,0.08)',
                    border: '1px solid rgba(123,63,160,0.20)',
                    borderRadius: '12px', padding: '12px 18px',
                    marginBottom: '20px',
                  }}>
                    <p style={{ fontSize: '.78rem', color: '#7B3FA0', fontWeight: 700, marginBottom: '4px' }}>
                      YOUR REFERRAL CODE
                    </p>
                    <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2D004D', letterSpacing: '.05em' }}>
                      {referralCode}
                    </p>
                  </div>
                )}

                {/* Loading dots */}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: '#7B3FA0', opacity: 0.5,
                      }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.2, 0.85] }}
                      transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AuthBackground>
  );
}
