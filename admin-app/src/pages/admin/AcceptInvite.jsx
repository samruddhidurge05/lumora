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
      const res = await backendFetch('/admin/team/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      // Clean up sessionStorage
      sessionStorage.removeItem('lumora_pending_invite_token');
      sessionStorage.removeItem('lumora_pending_invite_email');

      if (res?.already_admin) {
        setStatus('already_admin');
      } else {
        setStatus('activated');
      }
    } catch (err) {
      // Email mismatch: backend returns 403
      if (err.status === 403) {
        setStatus('email_mismatch');
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

  // ── Error recovery: sign out current mismatched user and go to login with identity scope ──
  const handleGoToAdminLoginOnError = async () => {
    try {
      clearBackendToken();
      localStorage.setItem('lumora_active_role', 'admin');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (_) {}
    const targetPath = `/admin/accept-invite?token=${encodeURIComponent(token)}`;
    navigate(`/admin/login?redirect=${encodeURIComponent(targetPath)}&auth_mode=identity`);
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
          <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.9rem', padding: '24px 0' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(123,63,160,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <h3 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 6px', fontSize: '1.05rem' }}>
              {status === 'activating' ? 'Activating Admin Access…' : 'Validating Invitation…'}
            </h3>
            <p style={{ color: '#7B3FA0', fontSize: '0.84rem', margin: 0 }}>
              {status === 'activating' ? 'Setting up your team workspace permissions…' : 'Checking security token credentials…'}
            </p>
          </div>
        )}

        {/* ── Invalid / Expired / Session Required State (Screen 1 Redesign) ── */}
        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(123,63,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 10px' }}>Sign In to Continue</h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>
              For security reasons, you need to sign in to your Lumora account before accepting your administrator invitation.
              <br /><br />
              Your invitation is secure and will activate automatically once authenticated.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate(`/admin/login?redirect=${encodeURIComponent(`/admin/accept-invite?token=${encodeURIComponent(token || '')}`)}`)}
                style={{ padding: '14px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
              >
                Sign In to Accept Invite
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ padding: '12px 28px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Return to Marketplace
              </button>
            </div>
          </div>
        )}

        {/* ── Valid — not yet authenticated ── */}
        {status === 'valid' && invitation && !user && (
          <div>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(123,63,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 8px', textAlign: 'center' }}>Team Invitation</h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 12px', textAlign: 'center' }}>
              You've been invited to join the Lumora Admin Team as:
            </p>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ padding: '6px 18px', borderRadius: '999px', background: 'rgba(123,63,160,0.12)', color: '#5A1E7E', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {invitation.role_level?.replace(/_/g, ' ')}
              </span>
            </div>
            <p style={{ color: '#8E6AA8', fontSize: '0.82rem', lineHeight: 1.6, margin: '0 0 16px', textAlign: 'center' }}>
              Invited address: <strong style={{ color: '#2D004D' }}>{invitation.email}</strong>
            </p>

            {/* ── Provider-aware action buttons ──────────────────────────── */}
            {signInMethods === null ? (
              <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem', padding: '12px 0' }}>
                Verifying account options…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* No Firebase account → offer registration */}
                {signInMethods.length === 0 && (
                  <button
                    onClick={handleRegisterRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
                  >
                    Create Account & Join Team
                  </button>
                )}

                {/* Google-only account → show Google button */}
                {signInMethods.includes('google.com') && (
                  <button
                    onClick={handleGoogleRedirect}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
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
                    Sign In to Accept Invite
                  </button>
                )}

                {/* No account + offer alternate sign in */}
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
          </div>
        )}

        {/* ── Activation Success ── */}
        {(status === 'activated' || status === 'already_admin') && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(5,150,105,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 10px' }}>
              {status === 'already_admin' ? 'Administrator Access Confirmed' : 'Welcome to the Team!'}
            </h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>
              {status === 'already_admin'
                ? 'Your administrator privileges are active and confirmed.'
                : 'Your administrator permissions have been successfully activated.'}
            </p>
            <button
              onClick={handleGoToAdminLogin}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
            >
              Open Admin Dashboard
            </button>
          </div>
        )}

        {/* ── Email Mismatch State (Screen 3 Redesign) ── */}
        {status === 'email_mismatch' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(123,63,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9"></polyline>
              </svg>
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 10px' }}>Switch Account to Accept</h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 12px' }}>
              You are currently signed in as <strong style={{ color: '#2D004D' }}>{user?.email}</strong>, but this invitation was sent to <strong style={{ color: '#2D004D' }}>{invitation?.email}</strong>.
            </p>
            <p style={{ color: '#8E6AA8', fontSize: '0.80rem', lineHeight: 1.5, margin: '0 0 24px' }}>
              Please sign in with <strong>{invitation?.email}</strong> to accept your administrator invitation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleGoToAdminLoginOnError}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
              >
                Sign In as {invitation?.email || 'Invited Email'}
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Return to Marketplace
              </button>
            </div>
          </div>
        )}

        {/* ── Generic Error ── */}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(123,63,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 10px' }}>Invitation Assistance Needed</h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>{errorMsg}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleGoToAdminLoginOnError}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' }}
              >
                Sign In to Admin Portal
              </button>
              <button
                onClick={() => navigate('/')}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
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
