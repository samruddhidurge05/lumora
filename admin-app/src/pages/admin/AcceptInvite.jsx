/**
 * AcceptInvite.jsx
 * ─────────────────
 * Production-quality admin invitation acceptance flow.
 *
 * FLOW A — Invited user already has a Lumora account (any role):
 *   1. Verify token (public endpoint, no auth required)
 *   2. Detect Firebase provider(s) for the invited email
 *   3a. Google-only → Show "Continue with Google" button only
 *   3b. Password → Show "Log in with email/password"
 *   3c. No account → Show "Create a new account"
 *   4. After login, user is redirected back here via sessionStorage token
 *   5. Call POST /admin/team/accept-invite with regular JWT + token
 *   6. Backend sets user.role='admin' + creates AdminRole record
 *   7. Redirect to /admin/login so the admin JWT can be issued
 *
 * SECURITY:
 *   - Token is single-use (accepted_at is set on use)
 *   - Token is time-limited (48 h, verified server-side)
 *   - Email must match the authenticated user's email (server-side check)
 *   - No admin privileges are required to accept — token IS the credential
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { auth } from '../../services/firebase';
import { clearBackendToken } from '../../services/authService';
import { fetchSignInMethodsForEmail } from 'firebase/auth';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, userRole, loading } = useAuth();

  const token = searchParams.get('token');

  const [status, setStatus]         = useState('loading'); // loading | valid | invalid | activating | activated | error
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');
  // Detected Firebase sign-in providers for the invited email.
  // null  = not yet checked
  // []    = no Firebase account (show Create Account)
  // ['google.com']          = Google-only account (show Continue with Google)
  // ['password']            = Email/password account (show Log in)
  // ['google.com','password'] = both available (show both)
  const [signInMethods, setSignInMethods] = useState(null);

  // ── Step 1: Verify token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token provided. Please use the full link from your invitation email.');
      return;
    }

    backendFetch(`/admin/team/invitations/verify?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        setInvitation(data);
        // ── Provider detection ──────────────────────────────────────────────
        // Check which Firebase sign-in methods exist for the invited email.
        // This determines which action button(s) to show the user:
        //   []            → no Firebase account → show Create Account
        //   ['google.com'] → Google-only → show Continue with Google (NOT email form)
        //   ['password']   → email/password → show Log in with password
        // Without this check, a Google-only user who clicks "Create Account" gets
        // auth/email-already-in-use, and one who clicks "Log in" and uses the
        // password form gets auth/invalid-credential.
        try {
          const methods = await fetchSignInMethodsForEmail(auth, data.email);
          setSignInMethods(methods || []);
        } catch (_) {
          // fetchSignInMethodsForEmail can fail if the email is malformed or
          // Firebase is offline. Fall back to showing all options.
          setSignInMethods([]);
        }
        setStatus('valid');
      })
      .catch(err => {
        setStatus('invalid');
        setErrorMsg(err.message || 'This invitation is invalid or has expired.');
      });
  }, [token]);

  // ── Step 2: User is already authenticated → activate the invitation ────────
  // This fires when:
  //   a) User was already logged in when they opened the link, OR
  //   b) User logged in / registered and was redirected back here
  //
  // BUG FIX: The previous code short-circuited and navigated to /admin/team
  // when userRole === 'admin', without calling POST /admin/team/accept-invite.
  // AuthContext sets userRole='admin' from localStorage.getItem('lumora_active_role'),
  // which is 'admin' for ANY user coming through the admin login redirect —
  // including brand-new invitees. This left invitation.accepted_at = NULL in
  // SQLite forever, so the Admin Team page always showed the invitation as Pending.
  //
  // Fix: always call activateViaRegularJwt() regardless of current role.
  // The invitation token is the credential; accept-invite MUST be called to
  // set accepted_at in SQLite and update the Firestore mirror.
  // The backend handles duplicate calls safely: if already accepted, it returns
  // 400 ("Invalid or already used invitation token") which is caught below.
  useEffect(() => {
    if (loading || status !== 'valid' || !invitation || !user) return;
    activateViaRegularJwt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, status, invitation, user]);

  // ── Accept invite using the regular (customer) JWT ────────────────────────
  const activateViaRegularJwt = async () => {
    setStatus('activating');
    try {
      await backendFetch('/admin/team/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      // Clean up sessionStorage
      sessionStorage.removeItem('lumora_pending_invite_token');
      sessionStorage.removeItem('lumora_pending_invite_email');
      setStatus('activated');
    } catch (err) {
      // Email mismatch: backend returns 403
      if (err.status === 403) {
        setStatus('error');
        setErrorMsg(err.message || 'This invitation was sent to a different email address. Please sign in with the invited email.');
      } else {
        setStatus('error');
        setErrorMsg(err.message || 'Failed to activate your admin role. Please contact a super admin.');
      }
    }
  };

  // ── Redirect to global AdminLogin with identity auth scope ───────────────
  // auth_mode=identity tells AdminLogin to bypass admin role checks.
  // provider hint tells it which sign-in button to show / auto-trigger.
  const handleLoginRedirect = () => {
    const targetPath = `/admin/accept-invite?token=${encodeURIComponent(token)}`;
    navigate(`/admin/login?redirect=${encodeURIComponent(targetPath)}&auth_mode=identity`);
  };

  // ── Continue with Google — for accounts that only have Google provider ────
  const handleGoogleRedirect = () => {
    const targetPath = `/admin/accept-invite?token=${encodeURIComponent(token)}`;
    navigate(`/admin/login?redirect=${encodeURIComponent(targetPath)}&auth_mode=identity&provider=google`);
  };

  // ── Redirect to the dedicated admin registration page ────────────────────
  const handleRegisterRedirect = () => {
    const targetPath = `/admin/accept-invite?token=${encodeURIComponent(token)}`;
    navigate(`/admin/register?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(targetPath)}`);
  };

  // ── After activation: go to admin login to get the admin JWT ─────────────
  const handleGoToAdminLogin = async () => {
    try {
      clearBackendToken();                                 // clear ALL tokens first
      localStorage.setItem('lumora_active_role', 'admin'); // then plant the admin hint
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (_) {}
    window.location.replace('/admin/login');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
      fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      padding: '40px 20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '48px',
        maxWidth: '480px', width: '100%',
        boxShadow: '0 20px 60px rgba(90,30,126,0.12)',
        border: '1px solid rgba(196,148,230,0.25)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: '1rem',
          }}>L</div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2D004D' }}>Lumora</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin Portal</div>
          </div>
        </div>

        {/* ── Loading / Activating ── */}
        {(status === 'loading' || status === 'activating') && (
          <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.9rem', padding: '20px 0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(123,63,160,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            {status === 'activating' ? 'Activating your admin role…' : 'Verifying invitation…'}
          </div>
        )}

        {/* ── Invalid / Expired ── */}
        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>✕</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 12px' }}>Invalid Invitation</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px' }}>{errorMsg}</p>
            <button
              onClick={() => navigate('/admin/login')}
              style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Go to Admin Login
            </button>
          </div>
        )}

        {/* ── Valid — not yet authenticated ── */}
        {status === 'valid' && invitation && !user && (
          <div>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(5,150,105,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem', textAlign: 'center' }}>✉️</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>You've been invited!</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 8px', textAlign: 'center' }}>
              You have been invited to join Lumora Admin as:
            </p>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <span style={{ padding: '4px 16px', borderRadius: '999px', background: 'rgba(123,63,160,0.12)', color: '#5A1E7E', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {invitation.role_level?.replace(/_/g, ' ')}
              </span>
            </div>
            <p style={{ color: '#8E6AA8', fontSize: '0.78rem', lineHeight: 1.6, margin: '0 0 8px', textAlign: 'center' }}>
              Invited email: <strong>{invitation.email}</strong>
            </p>
            {invitation.expires_at && (
              <p style={{ color: '#8E6AA8', fontSize: '0.72rem', textAlign: 'center', margin: '0 0 24px' }}>
                Expires: {new Date(invitation.expires_at).toLocaleString()}
              </p>
            )}

            {/* ── Provider-aware action buttons ──────────────────────────── */}
            {/* signInMethods === null means provider check is still loading  */}
            {signInMethods === null ? (
              <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem', padding: '8px 0' }}>
                Checking account…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* No Firebase account → offer registration */}
                {signInMethods.length === 0 && (
                  <button
                    onClick={handleRegisterRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Create a new account
                  </button>
                )}

                {/* Google-only account → show Google button, NOT password form */}
                {signInMethods.includes('google.com') && (
                  <button
                    onClick={handleGoogleRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continue with Google
                  </button>
                )}

                {/* Password account → show email login */}
                {signInMethods.includes('password') && (
                  <button
                    onClick={handleLoginRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: signInMethods.includes('google.com') ? '1px solid rgba(123,63,160,0.3)' : 'none', background: signInMethods.includes('google.com') ? 'transparent' : 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: signInMethods.includes('google.com') ? '#5A1E7E' : '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Log in with email & password
                  </button>
                )}

                {/* No account + offer alternate registration */}
                {signInMethods.length === 0 && (
                  <button
                    onClick={handleLoginRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.3)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    I already have an account
                  </button>
                )}
              </div>
            )}

            <p style={{ color: '#8E6AA8', fontSize: '0.70rem', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
              You must sign in with the email address the invitation was sent to.
            </p>
          </div>
        )}

        {/* ── Activation Success ── */}
        {status === 'activated' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(5,150,105,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>✓</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 12px' }}>Role Activated!</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px' }}>
              Your admin role has been successfully activated. Click below to sign in to the Admin Portal.
            </p>
            <button
              onClick={handleGoToAdminLogin}
              style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Sign In to Admin Portal
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>⚠️</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 12px' }}>Activation Failed</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px' }}>{errorMsg}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate('/admin/login')}
                style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Go to Admin Login
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ padding: '12px 28px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.3)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Return to Marketplace
              </button>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
