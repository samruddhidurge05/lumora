/**
 * AdminRegister.jsx
 * ──────────────────
 * Invitation-only Admin Registration page.
 *
 * Requirements:
 *  - Must NOT be publicly accessible.
 *  - Must ONLY open when a VALID invitation token exists.
 *  - If token is missing, invalid, expired, or already accepted, shows "Invitation Invalid" and never renders the form.
 *  - Locked to the invited email (pre-filled, read-only).
 *  - Matches the premium dark visual system of the Admin Portal.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { backendFetch } from '../../utils/api';
import { syncWithBackend } from '../../services/authService';

export default function AdminRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | valid | invalid
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [formError, setFormError] = useState('');

  // ── Step 1: Verify token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token provided. A valid link is required to access this page.');
      return;
    }

    backendFetch(`/admin/team/invitations/verify?token=${encodeURIComponent(token)}`)
      .then(data => {
        setInvitation(data);
        setName(data.invited_name || '');
        setStatus('valid');
      })
      .catch(err => {
        setStatus('invalid');
        setErrorMsg(err.message || 'This invitation is invalid, has expired, or was already accepted.');
      });
  }, [token]);

  // ── Step 2: Handle Registration ───────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setRegistering(true);
    setFormError('');

    try {
      // 1. Create Firebase Auth user
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const cred = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const firebaseUser = cred.user;
      await updateProfile(firebaseUser, { displayName: name });

      // 2. Create Firestore users/{uid} document with base 'customer' role
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        fullName: name,
        email: firebaseUser.email,
        photoURL: null,
        provider: 'password',
        emailVerified: firebaseUser.emailVerified,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        accountStatus: 'active',
        role: 'customer',
        roles: ['customer'],
        loginCount: 1,
        phoneNumber: null,
        country: null,
        timezone: null,
      });

      // 3. Create customer profile doc
      await setDoc(doc(db, 'customers', firebaseUser.uid), {
        uid: firebaseUser.uid,
        fullName: name,
        email: firebaseUser.email,
        role: 'customer',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Sync with backend (exchanges Firebase ID token for customer JWT)
      await syncWithBackend(firebaseUser, 'customer');

      // 5. Redirect back to AcceptInvite to perform role elevation
      navigate(`/admin/accept-invite?token=${encodeURIComponent(token)}`, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // ── Render Verification State ─────────────────────────────────────────────
  if (status === 'verifying') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinnerWrap}>
            <div style={styles.spinner} />
          </div>
          <h2 style={styles.verifyingText}>Verifying invitation…</h2>
        </div>
      </div>
    );
  }

  // ── Render Invalid Token Screen ───────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="36"
              height="36"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 style={styles.brand}>Lumora</h1>
          <p style={styles.subtitle}>Platform Administration</p>

          <div style={styles.errorBox}>
            <strong style={{ color: '#f87171', fontSize: '0.95rem' }}>Invitation Invalid</strong>
            <p style={{ color: '#d1d5db', marginTop: 8, fontSize: '0.8rem', lineHeight: 1.5 }}>
              {errorMsg}
            </p>
          </div>

          <button
            style={styles.secondaryBtn}
            onClick={() => window.location.replace('/')}
            type="button"
          >
            Return to Marketplace
          </button>
        </div>
        <div style={styles.blob1} />
        <div style={styles.blob2} />
      </div>
    );
  }

  // ── Render Dedicated Registration Form ────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.brand}>Lumora</h1>
        <p style={styles.subtitle}>Create Administrator Account</p>

        {invitation && (
          <div style={styles.badgeRow}>
            <span style={styles.roleBadge}>
              👑 {invitation.role_level?.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {formError && (
          <div style={styles.errorAlert} role="alert">
            <span style={{ fontWeight: 800 }}>⚠️</span>
            <span style={{ fontSize: '0.8rem' }}>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address (Invited)</label>
            <input
              type="email"
              value={invitation?.email || ''}
              disabled
              style={styles.inputDisabled}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              placeholder="e.g. Alexander Wright"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={registering}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Choose Password</label>
            <input
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={registering}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              disabled={registering}
              required
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={registering}
            style={styles.submitBtn}
          >
            {registering ? (
              <>
                <span style={styles.buttonSpinner} />
                <span>Creating Account…</span>
              </>
            ) : (
              'Create Account & Accept Invitation'
            )}
          </button>
        </form>

        <p style={styles.hint}>
          Once registered, you will be redirected to accept the invite and elevate your privileges.
        </p>
      </div>

      <div style={styles.blob1} />
      <div style={styles.blob2} />
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0d0d1f 100%)',
    fontFamily: "'DM Sans', 'Plus Jakarta Sans', 'Inter', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  blob1: {
    position: 'fixed',
    top: '-120px',
    left: '-80px',
    width: '480px',
    height: '480px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
    filter: 'blur(60px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  blob2: {
    position: 'fixed',
    bottom: '-80px',
    right: '-60px',
    width: '380px',
    height: '380px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
    filter: 'blur(50px)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '440px',
    background: 'rgba(30, 27, 46, 0.70)',
    backdropFilter: 'blur(30px)',
    borderRadius: '24px',
    border: '1px solid rgba(139,92,246,0.20)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.50), inset 0 1px 1px rgba(255,255,255,0.05)',
    padding: '40px',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  brand: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
    background: 'linear-gradient(to right, #ffffff 30%, #c084fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
  },
  subtitle: {
    margin: '8px 0 20px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#a78bfa',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  badgeRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  roleBadge: {
    padding: '3px 12px',
    borderRadius: '999px',
    fontSize: '0.68rem',
    fontWeight: 800,
    background: 'rgba(167,139,250,0.15)',
    color: '#c084fc',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  errorAlert: {
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '12px',
    padding: '12px',
    color: '#f87171',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textAlign: 'left',
    marginBottom: '20px',
    boxSizing: 'border-box',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    textAlign: 'left',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(139,92,246,0.30)',
    background: 'rgba(255,255,255,0.06)',
    color: '#e5e7eb',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
  },
  inputDisabled: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    color: '#6b7280',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'not-allowed',
  },
  submitBtn: {
    marginTop: '8px',
    padding: '12px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  hint: {
    marginTop: '20px',
    fontSize: '0.75rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },
  spinnerWrap: {
    display: 'flex',
    justifyContent: 'center',
    margin: '20px 0 16px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(124,58,237,0.2)',
    borderTopColor: '#7c3aed',
    borderRadius: '50%',
    animation: 'adminLoginSpin 0.7s linear infinite',
  },
  buttonSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'adminLoginSpin 0.7s linear infinite',
  },
  verifyingText: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#a78bfa',
  },
  iconWrap: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  errorBox: {
    padding: '16px 20px',
    borderRadius: '14px',
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.15)',
    textAlign: 'left',
    marginBottom: '20px',
    boxSizing: 'border-box',
  },
  secondaryBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '12px',
    border: '1px solid rgba(156,163,175,0.2)',
    background: 'transparent',
    color: '#cbd5e1',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
