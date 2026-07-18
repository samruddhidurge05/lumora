/**
 * AdminLogin.jsx
 * ──────────────
 * Dedicated admin login page at /admin/login.
 *
 * Behaviour:
 *  - Shows Lumora platform name and "Platform Administration" label
 *  - Single "Sign in with Google" button (no email/password fields)
 *  - Calls signInWithPopup(auth, new GoogleAuthProvider()) on click
 *  - On Firebase success: calls adminLogin(firebaseUser) from adminAuthService
 *  - On success: navigates to ?redirect param or /admin/dashboard
 *  - On auth/popup-closed-by-user: shows "Sign-in cancelled"
 *  - On backend 403: shows "This account is not authorised as a platform administrator"
 *  - On other errors: shows "Sign-in failed. Please try again."
 *  - If user is non-null and userRole === 'admin': auto-redirects to dashboard
 *  - If user is non-null and userRole !== 'admin': shows "Access Denied — Admin Only",
 *    does NOT redirect to dashboard
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { adminLogin } from '../../services/adminAuthService';
import { clearBackendToken, syncWithBackend } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

/* ─── Google "G" SVG logo ─────────────────────────────────────────────────── */
function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

/* ─── Helper: sign out without triggering the full logout() redirect ──────── */
async function signOutAndStay(navigate) {
  try {
    clearBackendToken();
    // Re-set the admin role hint after clearing tokens so the next sign-in
    // attempt immediately triggers the admin auth branch in AuthContext
    localStorage.setItem('lumora_active_role', 'admin');
    try { sessionStorage.clear(); } catch (_) {}
    await signOut(auth);
  } catch (_) {}
  // Stay on /admin/login so the admin Google sign-in button is shown
  navigate('/admin/login', { replace: true });
}

/* ─── Access Denied screen ────────────────────────────────────────────────── */
function AccessDenied() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);

  // Auto sign-out after 3 s — brings the user back to /admin/login sign-in form
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      setSigningOut(true);
      await signOutAndStay(navigate);
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div style={styles.page} aria-live="assertive">
      <div style={styles.card}>
        {/* Shield icon */}
        <div style={styles.iconWrap} aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f87171"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="40"
            height="40"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 style={styles.brand}>Lumora</h1>
        <p style={styles.subtitle}>Platform Administration</p>

        <div style={styles.accessDeniedBox} role="alert">
          <strong style={{ color: '#f87171', fontSize: '1rem' }}>
            Access Denied — Admin Only
          </strong>
          <p style={{ color: '#d1d5db', marginTop: 8, fontSize: '0.875rem', lineHeight: 1.5 }}>
            You are signed in with a non-administrator account.{' '}
            {signingOut
              ? 'Signing you out…'
              : 'Signing out automatically in 3 seconds so you can log in with an admin account.'}
          </p>
        </div>

        <button
          style={{ ...styles.secondaryBtn, opacity: signingOut ? 0.6 : 1 }}
          onClick={async () => {
            setSigningOut(true);
            await signOutAndStay(navigate);
          }}
          type="button"
          disabled={signingOut}
        >
          {signingOut ? 'Signing out…' : 'Sign Out & Use Admin Account'}
        </button>

        <button
          style={{ ...styles.secondaryBtn, marginTop: 8, background: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.75rem' }}
          onClick={() => navigate('/')}
          type="button"
        >
          Return to Marketplace instead
        </button>
      </div>
      <div style={styles.blob1} aria-hidden="true" />
      <div style={styles.blob2} aria-hidden="true" />
    </div>
  );
}

/* ─── Main AdminLogin component ───────────────────────────────────────────── */
export default function AdminLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Email/password form state
  const [emailInput, setEmailInput]   = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { user, userRole } = useAuth();
  const navigate           = useNavigate();
  const [searchParams]     = useSearchParams();

  const redirectTarget = searchParams.get('redirect') || '/admin/dashboard';
  const authMode       = searchParams.get('auth_mode') || 'admin';

  /* Auto-redirect if already authenticated */
  useEffect(() => {
    if (user) {
      if (authMode === 'identity') {
        navigate(redirectTarget, { replace: true });
      } else if (userRole === 'admin') {
        navigate(redirectTarget, { replace: true });
      }
    }
  }, [user, userRole, navigate, redirectTarget, authMode]);

  /* Show Access Denied for authenticated non-admin users */
  if (user && userRole && userRole !== 'admin') {
    if (authMode === 'identity') {
      return null; // Skip AccessDenied check for identity mode redirects
    }
    return <AccessDenied />;
  }

  /* While AuthContext is resolving (user set but role not yet confirmed) skip render */
  if (user && !userRole) {
    return null;
  }

  /* ── Sign-in handler ──────────────────────────────────────────────────── */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      if (authMode === 'identity') {
        // Log in in identity/customer scope to bypass admin elevation rules
        localStorage.setItem('lumora_active_role', 'customer');
        const provider = new GoogleAuthProvider();
        const result   = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        await syncWithBackend(firebaseUser, 'customer');
        navigate(redirectTarget, { replace: true });
      } else {
        // Enforce full admin checks
        localStorage.setItem('lumora_active_role', 'admin');
        const provider = new GoogleAuthProvider();
        const result   = await signInWithPopup(auth, provider);
        const firebaseUser = result.user;
        await adminLogin(firebaseUser);

        const pendingInviteToken = sessionStorage.getItem('lumora_pending_invite_token');
        if (pendingInviteToken) {
          navigate(`/admin/accept-invite?token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
          return;
        }

        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      localStorage.removeItem('lumora_active_role');

      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled');
      } else if (
        err.message?.toLowerCase().includes('not authorised') ||
        err.message?.toLowerCase().includes('not authorized') ||
        err.message?.toLowerCase().includes('only administrators') ||
        err.message?.toLowerCase().includes('not admin')
      ) {
        setError('This account is not authorised as a platform administrator');
      } else if (err.message?.includes('403') || err.status === 403) {
        setError('This account is not authorised as a platform administrator');
      } else {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Email / password sign-in handler ─────────────────────────────────── */
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (authMode === 'identity') {
        // Log in in identity/customer scope to bypass admin elevation rules
        localStorage.setItem('lumora_active_role', 'customer');
        const result = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
        const firebaseUser = result.user;
        await syncWithBackend(firebaseUser, 'customer');
        navigate(redirectTarget, { replace: true });
      } else {
        // Enforce full admin checks
        localStorage.setItem('lumora_active_role', 'admin');
        const result = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
        const firebaseUser = result.user;
        await adminLogin(firebaseUser);

        const pendingInviteToken = sessionStorage.getItem('lumora_pending_invite_token');
        if (pendingInviteToken) {
          navigate(`/admin/accept-invite?token=${encodeURIComponent(pendingInviteToken)}`, { replace: true });
          return;
        }

        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      localStorage.removeItem('lumora_active_role');

      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else if (
        err.message?.toLowerCase().includes('not authorised') ||
        err.message?.toLowerCase().includes('not authorized') ||
        err.message?.toLowerCase().includes('only administrators') ||
        err.status === 403
      ) {
        setError('This account is not authorised as a platform administrator.');
      } else {
        setError(err.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div style={styles.page}>
      {/* Decorative blobs */}
      <div style={styles.blob1} aria-hidden="true" />
      <div style={styles.blob2} aria-hidden="true" />

      <main style={styles.card} role="main" aria-label="Admin login">
        {/* Logo mark */}
        <div style={styles.logoMark} aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="32"
            height="32"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>

        <h1 style={styles.brand}>Lumora</h1>
        <p style={styles.subtitle}>Platform Administration</p>

        <div style={styles.divider} aria-hidden="true" />

        {/* Error message */}
        {error && (
          <div style={styles.errorBox} role="alert" aria-live="assertive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f87171"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="16"
              height="16"
              style={{ flexShrink: 0, marginTop: 2 }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Sign in with Google button */}
        <button
          type="button"
          style={{
            ...styles.googleBtn,
            ...(loading ? styles.googleBtnDisabled : {}),
          }}
          onClick={handleGoogleSignIn}
          disabled={loading}
          aria-busy={loading}
          aria-label={loading ? 'Signing in…' : 'Sign in with Google'}
        >
          {loading ? (
            <>
              <span style={styles.spinner} aria-hidden="true" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <GoogleLogo />
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', margin: '16px 0 4px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '0.72rem', color: '#6b7280', letterSpacing: '0.05em' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Email / password toggle */}
        {!showEmailForm ? (
          <button
            type="button"
            onClick={() => setShowEmailForm(true)}
            style={{
              marginTop: '4px',
              background: 'transparent',
              border: '1px solid rgba(139,92,246,0.25)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontSize: '0.82rem',
              fontWeight: 500,
              padding: '10px 20px',
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            Sign in with Email &amp; Password
          </button>
        ) : (
          <form onSubmit={handleEmailSignIn} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <input
              type="email"
              placeholder="admin@yourdomain.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 14px', borderRadius: '12px',
                border: '1px solid rgba(139,92,246,0.30)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e5e7eb', fontSize: '0.875rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '11px 14px', borderRadius: '12px',
                border: '1px solid rgba(139,92,246,0.30)',
                background: 'rgba(255,255,255,0.06)',
                color: '#e5e7eb', fontSize: '0.875rem',
                fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', fontSize: '0.9rem', fontWeight: 600,
                fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.65 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {loading ? <><span style={styles.spinner} /><span>Signing in…</span></> : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => { setShowEmailForm(false); setError(''); }}
              style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ← Back to Google sign-in
            </button>
          </form>
        )}

        <p style={styles.hint}>
          This portal is restricted to platform administrators.
        </p>
      </main>
    </div>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */
const styles = {
  /** Full-screen dark background */
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

  /** Decorative purple blur blob – top-left */
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

  /** Decorative purple blur blob – bottom-right */
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

  /** Glassmorphic dark card */
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    background: 'linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
    border: '1px solid rgba(139,92,246,0.25)',
    borderRadius: '28px',
    padding: '52px 44px 44px',
    backdropFilter: 'blur(32px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
    boxShadow: `
      inset 0 1px 0 rgba(255,255,255,0.08),
      0 4px 24px rgba(0,0,0,0.4),
      0 20px 60px rgba(0,0,0,0.5),
      0 0 0 1px rgba(139,92,246,0.10)
    `,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },

  /** Logo mark container */
  logoMark: {
    width: '60px',
    height: '60px',
    borderRadius: '18px',
    background: 'linear-gradient(135deg, rgba(124,58,237,0.30) 0%, rgba(139,92,246,0.15) 100%)',
    border: '1px solid rgba(139,92,246,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
    boxShadow: '0 4px 20px rgba(124,58,237,0.25)',
  },

  /** "Lumora" heading */
  brand: {
    margin: '0 0 6px',
    fontSize: '2rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 50%, #7c3aed 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  /** "Platform Administration" label */
  subtitle: {
    margin: '0 0 4px',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#9ca3af',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },

  /** Horizontal rule */
  divider: {
    width: '48px',
    height: '2px',
    borderRadius: '9999px',
    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
    margin: '20px 0 28px',
    opacity: 0.6,
  },

  /** Error alert box */
  errorBox: {
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.30)',
    color: '#fca5a5',
    fontSize: '0.875rem',
    lineHeight: 1.5,
    marginBottom: '20px',
    textAlign: 'left',
  },

  /** Google sign-in button */
  googleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '14px 20px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.95)',
    color: '#111827',
    fontSize: '0.9375rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)',
    outline: 'none',
    letterSpacing: '0.01em',
  },

  /** Disabled state for the Google button */
  googleBtnDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
    background: 'rgba(255,255,255,0.75)',
  },

  /** Secondary (outline) button – used in Access Denied screen */
  secondaryBtn: {
    marginTop: '12px',
    padding: '12px 24px',
    borderRadius: '12px',
    border: '1px solid rgba(139,92,246,0.40)',
    background: 'rgba(124,58,237,0.12)',
    color: '#c4b5fd',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },

  /** Small loading spinner */
  spinner: {
    display: 'inline-block',
    width: '18px',
    height: '18px',
    border: '2px solid rgba(124,58,237,0.3)',
    borderTopColor: '#7c3aed',
    borderRadius: '50%',
    animation: 'adminLoginSpin 0.7s linear infinite',
  },

  /** Hint text below the button */
  hint: {
    marginTop: '20px',
    fontSize: '0.75rem',
    color: '#6b7280',
    lineHeight: 1.5,
  },

  /** Icon wrapper used in Access Denied screen */
  iconWrap: {
    width: '72px',
    height: '72px',
    borderRadius: '20px',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '20px',
  },

  /** Access denied message box */
  accessDeniedBox: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '16px 20px',
    borderRadius: '14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    textAlign: 'left',
    marginBottom: '8px',
  },
};

/* ─── Keyframe injection (spinner animation) ─────────────────────────────── */
if (typeof document !== 'undefined') {
  const styleId = 'admin-login-keyframes';
  if (!document.getElementById(styleId)) {
    const styleTag = document.createElement('style');
    styleTag.id = styleId;
    styleTag.textContent = `
      @keyframes adminLoginSpin {
        to { transform: rotate(360deg); }
      }
      button[aria-label="Sign in with Google"]:not([disabled]):hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.25) !important;
      }
      button[aria-label="Sign in with Google"]:not([disabled]):active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleTag);
  }
}
