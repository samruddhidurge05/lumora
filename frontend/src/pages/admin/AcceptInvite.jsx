/**
 * AcceptInvite.jsx
 * ─────────────────
 * Production-quality admin invitation acceptance flow.
 *
 * FLOW A — Invited user already has a Lumora account (any role):
 *   1. Verify token (public endpoint, no auth required)
 *   2. Show invitation details
 *   3. User clicks "Log in to accept"
 *   4. Redirect to /auth/login?role=customer (regular login, NOT admin login)
 *   5. After login, user is redirected back here via sessionStorage token
 *   6. Call POST /admin/team/accept-invite with regular JWT + token
 *   7. Backend sets user.role='admin' + creates AdminRole record
 *   8. Redirect to /admin/login so the admin JWT can be issued
 *
 * FLOW B — Invited user has NO Lumora account:
 *   1. Verify token
 *   2. User clicks "Create a new account"
 *   3. Redirect to /auth/register?role=admin&invite_token=TOKEN&email=EMAIL
 *   4. Register.jsx creates the Firebase + backend user
 *   5. After registration, user is redirected back here
 *   6. Call POST /admin/team/accept-invite
 *   7. Redirect to /admin/login
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

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();

  const token = searchParams.get('token');

  const [status, setStatus]         = useState('loading'); // loading | valid | invalid | activating | activated | error
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg]     = useState('');

  // ── Step 1: Verify token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token provided. Please use the full link from your invitation email.');
      return;
    }

    backendFetch(`/admin/team/invitations/verify?token=${encodeURIComponent(token)}`)
      .then(data => {
        setInvitation(data);
        setStatus('valid');
      })
      .catch(err => {
        setStatus('invalid');
        setErrorMsg(err.message || 'This invitation is invalid or has expired.');
      });
  }, [token]);

  // ── Step 2: User is already authenticated → try to activate ───────────────
  // This fires when:
  //   a) User was already logged in when they opened the link, OR
  //   b) User logged in / registered and was redirected back here
  useEffect(() => {
    if (status !== 'valid' || !invitation || !user) return;
    // If the user is already a full admin (not via this invite), skip activation
    if (userRole === 'admin') {
      // They might already be an admin — just redirect to the team page
      navigate('/admin/team', { replace: true });
      return;
    }
    // For any logged-in non-admin user: call the accept-invite endpoint
    activateViaRegularJwt();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, invitation, user, userRole]);

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

  // ── Redirect to regular login (not admin login) ───────────────────────────
  const handleLoginRedirect = () => {
    // Preserve token so we come back here after login
    sessionStorage.setItem('lumora_pending_invite_token', token);
    sessionStorage.setItem('lumora_pending_invite_email', invitation?.email || '');
    // Use regular login — the accept-invite endpoint only needs a regular JWT
    navigate(`/auth/login?role=customer&next=${encodeURIComponent(`/admin/accept-invite?token=${encodeURIComponent(token)}`)}`);
  };

  // ── Redirect to registration (for brand-new users) ────────────────────────
  const handleRegisterRedirect = () => {
    sessionStorage.setItem('lumora_pending_invite_token', token);
    sessionStorage.setItem('lumora_pending_invite_email', invitation?.email || '');
    // Register.jsx now handles role=admin when invite_token is present
    navigate(
      `/auth/register?role=admin&invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation?.email || '')}`
    );
  };

  // ── After activation: go to admin login to get the admin JWT ─────────────
  const handleGoToAdminLogin = () => {
    // user.role is now 'admin' in SQLite, so adminLogin will succeed
    navigate('/admin/login', { replace: true });
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={handleLoginRedirect}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Log in to accept
              </button>
              <button
                onClick={handleRegisterRedirect}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.3)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Create a new account
              </button>
            </div>
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
