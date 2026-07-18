// src/pages/auth/VerifyEmail.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { applyActionCode, checkActionCode, signOut } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { clearBackendToken } from '../../services/authService';

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      duration: 0.75, 
      ease: [0.16, 1, 0.3, 1],
      when: "beforeChildren",
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] }
  }
};

export default function VerifyEmail() {
  const [cooldown, setCooldown] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | 'expired'
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { user, reloadUser, resendVerification, logout } = useAuth();
  const role = new URLSearchParams(location.search).get('role') || 'customer';

  // Parse oobCode from query params (Firebase verification link)
  const query = new URLSearchParams(location.search);
  const oobCode = query.get('oobCode');

  // Initialize email from user context and start cooldown timer
  useEffect(() => {
    const queryEmail = new URLSearchParams(location.search).get('email');
    if (user?.email) {
      setEmail(user.email);
    } else if (queryEmail) {
      setEmail(queryEmail);
    }
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [user, location.search]);

  const handleChangeEmail = async () => {
    setIsLoading(true);
    try {
      if (typeof logout === 'function') {
        await logout();
      } else {
        await signOut(auth);
        clearBackendToken();
      }
      navigate(`/auth/register?role=${role}`);
    } catch (err) {
      setStatus('error');
      setMessage('Failed to sign out.');
    } finally {
      setIsLoading(false);
    }
  };

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
        await checkActionCode(auth, oobCode);
        await applyActionCode(auth, oobCode);
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
        <motion.div 
          className="auth-card"
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <div className="auth-card-border" />
          
          <motion.div className="card-brand" variants={itemVariants}>
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </motion.div>

          <motion.h2 className="card-heading" variants={itemVariants}>Verify Email</motion.h2>
          <motion.p className="card-subheading" variants={itemVariants}>
            Verification email sent to: {email}
          </motion.p>

          {status && (
            <motion.div className={`auth-alert auth-alert-${status}`} role="alert" aria-live="assertive" variants={itemVariants}>
              <span>{status === 'success' ? '✦' : '⚠'}</span>
              <p>{message}</p>
            </motion.div>
          )}

          <motion.button
            className="btn-cta"
            onClick={handleCheckVerified}
            disabled={isLoading}
            variants={itemVariants}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
          >
            {isLoading ? 'Checking...' : "I've Verified My Email"}
          </motion.button>

          <motion.div className="signup-prompt" style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', alignItems: 'center' }} variants={itemVariants}>
            {cooldown > 0 ? (
              <span style={{ color: '#7B3FA0', fontWeight: '500' }}>
                Resend in {cooldown}s
              </span>
            ) : (
              <a href="#" onClick={(e) => { e.preventDefault(); handleResend(); }} style={{ fontSize: '0.9rem' }}>
                Resend verification email
              </a>
            )}
            <a href="#" onClick={(e) => { e.preventDefault(); handleChangeEmail(); }} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
              Change email / Register again
            </a>
          </motion.div>
        </motion.div>
      </div>
    </AuthBackground>
  );
}
