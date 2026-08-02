// src/pages/auth/VerifyEmail.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { applyActionCode, checkActionCode, signOut } from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { clearBackendToken } from '../../services/authService';
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react';
import './auth.css';

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
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

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

  const markRoleVerifiedInFirestore = async (uid, targetRole) => {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        [`roleVerifications.${targetRole}`]: true,
        emailVerified: true,
        updatedAt: serverTimestamp(),
      });
      if (targetRole === 'affiliate') {
        const affRef = doc(db, 'affiliates', uid);
        await updateDoc(affRef, {
          emailVerified: true,
          status: 'active',
          verificationStatus: 'verified',
          updatedAt: serverTimestamp(),
        });
      } else if (targetRole === 'vendor') {
        const venRef = doc(db, 'vendors', uid);
        await updateDoc(venRef, {
          emailVerified: true,
          status: 'active',
          verificationStatus: 'verified',
          updatedAt: serverTimestamp(),
        });
      } else {
        const custRef = doc(db, 'customers', uid);
        await updateDoc(custRef, {
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Failed to mark role verified in Firestore:', e);
    }
  };

  const isRoleVerifiedInFirestore = async (uid, targetRole) => {
    try {
      if (targetRole === 'affiliate') {
        const affSnap = await getDoc(doc(db, 'affiliates', uid));
        if (affSnap.exists() && affSnap.data().emailVerified === true) return true;
      } else if (targetRole === 'vendor') {
        const venSnap = await getDoc(doc(db, 'vendors', uid));
        if (venSnap.exists() && venSnap.data().emailVerified === true) return true;
      } else if (targetRole === 'customer') {
        const custSnap = await getDoc(doc(db, 'customers', uid));
        if (custSnap.exists() && custSnap.data().emailVerified === true) return true;
      }
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.roleVerifications && data.roleVerifications[targetRole] === true) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const navigateToDashboard = async (firebaseUser) => {
    if (!firebaseUser) { navigate('/'); return; }
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
      const userRole = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (userRole === 'affiliate' || role === 'affiliate') navigate('/affiliate/dashboard');
      else if (userRole === 'vendor' || role === 'vendor') navigate('/vendor/dashboard');
      else navigate('/customer/dashboard');
    } catch (e) {
      if (role === 'affiliate') navigate('/affiliate/dashboard');
      else navigate('/customer/dashboard');
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
        const currentUser = auth.currentUser || user;
        if (currentUser?.uid) {
          await markRoleVerifiedInFirestore(currentUser.uid, role);
        }
        await reloadUser();
        setStatus('success');
        setMessage('Email verified successfully! Redirecting to dashboard...');
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
      if (!currentUser) {
        setStatus('error');
        setMessage('No active user session. Please register or sign in again.');
        return;
      }

      // Check if role is marked verified in Firestore (or if oobCode link was applied)
      const verified = await isRoleVerifiedInFirestore(currentUser.uid, role);

      if (verified) {
        await markRoleVerifiedInFirestore(currentUser.uid, role);
        setStatus('success');
        setMessage('Email verified successfully! Redirecting...');
        await navigateToDashboard(currentUser);
      } else {
        setStatus('error');
        setMessage(`Email has not been verified yet for your ${roleLabel} account. Please check your inbox or spam folder and click the verification link.`);
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
      await resendVerification(role);
      setStatus('success');
      setMessage(`Verification email sent to ${email || 'your inbox'}! Check your inbox or spam folder.`);
      setCooldown(60);
    } catch (err) {
      setStatus('error');
      setMessage('Failed to resend verification email. Please try again in a few moments.');
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

          {/* Brand Logo Header */}
          <motion.div className="card-brand" variants={itemVariants}>
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </motion.div>

          {/* Role badge */}
          <motion.div style={{ marginBottom: '12px', position: 'relative', zIndex: 2 }} variants={itemVariants}>
            <span className="role-badge">{roleLabel} Account Verification</span>
          </motion.div>

          <motion.h2 className="card-heading" variants={itemVariants}>Verify Your Email</motion.h2>
          <motion.p className="card-subheading" variants={itemVariants}>
            We've sent a verification link to confirm your account identity.
          </motion.p>

          {/* Email Target Chip */}
          {email && (
            <motion.div 
              variants={itemVariants}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'rgba(123, 63, 160, 0.10)',
                border: '1px solid rgba(196, 148, 230, 0.35)',
                margin: '12px 0 20px 0',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <Mail size={16} color="#7B3FA0" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </span>
            </motion.div>
          )}

          {status && (
            <motion.div className={`auth-alert auth-alert-${status}`} role="alert" aria-live="assertive" variants={itemVariants}>
              <span>{status === 'success' ? '✦' : '⚠'}</span>
              <p style={{ margin: 0 }}>{message}</p>
            </motion.div>
          )}

          <motion.button
            className="btn-cta"
            onClick={handleCheckVerified}
            disabled={isLoading}
            variants={itemVariants}
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            style={{ marginTop: '8px' }}
          >
            {isLoading ? 'Checking Verification...' : "I've Verified My Email"}
          </motion.button>

          <motion.div 
            className="signup-prompt" 
            style={{ marginTop: '1.4rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }} 
            variants={itemVariants}
          >
            {cooldown > 0 ? (
              <span style={{ color: '#7B3FA0', fontWeight: 600, fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={13} className="spin-slow" /> Resend link available in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                style={{
                  background: 'none', border: 'none', color: '#7B3FA0',
                  fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                  textDecoration: 'underline', fontFamily: 'var(--font-sans)'
                }}
              >
                Resend verification email
              </button>
            )}

            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={isLoading}
              style={{
                background: 'none', border: 'none', color: 'rgba(45, 0, 77, 0.65)',
                fontSize: '0.80rem', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', marginTop: '4px'
              }}
            >
              Wrong email address? Register again
            </button>
          </motion.div>
        </motion.div>
      </div>
    </AuthBackground>
  );
}
