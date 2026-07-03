import React, { useState, useEffect } from 'react';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function VerifyEmail() {
  const [cooldown, setCooldown] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | 'expired'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { user, reloadUser, resendVerification } = useAuth();

  // Parse oobCode from query params (Firebase verification link)
  const query = new URLSearchParams(location.search);
  const oobCode = query.get('oobCode');

  // Initialize email from user context and start cooldown timer
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [user]);

  const navigateToDashboard = async (firebaseUser) => {
    if (!firebaseUser) { navigate('/'); return; }
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'affiliate') navigate('/affiliate/dashboard');
      else if (role === 'vendor') navigate('/vendor/dashboard');
      else navigate('/customer/dashboard');
    } catch (e) {
      navigate('/customer/dashboard');
    }
  };

  // If verification link present, attempt to apply it automatically
  useEffect(() => {
    if (!oobCode) return;
    const verify = async () => {
      setIsLoading(true);
      try {
        // Validate the action code first
        await checkActionCode(auth, oobCode);
        // Apply the verification code (marks email as verified)
        await applyActionCode(auth, oobCode);
        // Force reload user token to get updated emailVerified flag
        await reloadUser();
        setStatus('success');
        setMessage('Email verified successfully.');
        setTimeout(() => navigateToDashboard(auth.currentUser || user), 1500);
      } catch (err) {
        if (err.code === 'auth/invalid-action-code') {
          setStatus('error');
          setMessage('Invalid verification link.');
        } else if (err.code === 'auth/expired-action-code') {
          setStatus('expired');
          setMessage('Verification link has expired.');
        } else {
          setStatus('error');
          setMessage('Verification failed.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckVerified = async () => {
    setIsLoading(true);
    try {
      await reloadUser();
      const currentUser = auth.currentUser || user;
      if (currentUser?.emailVerified) {
        setStatus('success');
        setMessage('Email verified successfully.');
        await navigateToDashboard(currentUser);
      } else {
        setStatus('error');
        setMessage('Email has not been verified yet.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Verification check failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      await resendVerification();
      setStatus('success');
      setMessage('Verification email resent.');
      setCooldown(60);
    } catch (err) {
      setStatus('error');
      setMessage('Failed to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="auth-container">
        <div className="auth-blob b1"></div>
        <div className="auth-blob b2"></div>
        <div className="auth-card">
          <div className="card-brand">
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </div>

          <h2 className="card-heading">Verify Email</h2>
          <p className="card-subheading">
            Verification email sent to: {email}
          </p>

          {status && (
            <div className={`auth-alert auth-alert-${status}`} role="alert" aria-live="assertive">
              <span>{status === 'success' ? '✦' : status === 'expired' ? '⚠' : '⚠'}</span>
              <p>{message}</p>
            </div>
          )}

          <button
            className="btn-cta"
            onClick={handleCheckVerified}
            disabled={isLoading}
          >
            {isLoading ? 'Checking...' : "I've Verified My Email"}
          </button>

          <div className="signup-prompt" style={{ marginTop: '1rem' }}>
            {cooldown > 0 ? (
              <span style={{ color: '#7B3FA0', fontWeight: '500' }}>
                Resend in {cooldown}s
              </span>
            ) : (
              <a href="#" onClick={(e) => { e.preventDefault(); handleResend(); }}>
                Resend verification email
              </a>
            )}
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
