/**
 * AcceptInvite.jsx
 * ─────────────────
 * Full invitation acceptance lifecycle:
 *  1. Verifies token against backend
 *  2. If already authenticated as admin → activates immediately
 *  3. If not authenticated → redirects to admin login, stores token in
 *     sessionStorage so the post-login hook can call activate automatically
 *
 * After successful activation the admin is redirected to /admin/team.
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

  const [status, setStatus]       = useState('loading'); // loading | valid | invalid | activating | activated | error
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg]   = useState('');

  // ── Step 1: Verify token on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token provided.');
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

  // ── Step 2: If already authenticated as admin, activate immediately ────────
  useEffect(() => {
    if (status !== 'valid' || !invitation || !user) return;
    if (userRole !== 'admin') return; // only admins can be activated here

    // Get the backend user id (stored by adminLogin in localStorage)
    const backendUid = localStorage.getItem('lumora_backend_uid');
    if (!backendUid) return;

    activateRole(backendUid);
  }, [status, invitation, user, userRole]);

  // ── Activate role via backend ──────────────────────────────────────────────
  const activateRole = async (userId) => {
    setStatus('activating');
    try {
      await backendFetch(`/admin/team/${userId}/activate`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      // Clean up stored token if any
      sessionStorage.removeItem('lumora_pending_invite_token');
      setStatus('activated');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to activate your admin role. Please contact a super admin.');
    }
  };

  // ── Step 3: Store token & redirect to admin login ─────────────────────────
  const handleLoginRedirect = () => {
    // Persist invite token in sessionStorage so the admin login page can pick it up
    sessionStorage.setItem('lumora_pending_invite_token', token);
    sessionStorage.setItem('lumora_pending_invite_email', invitation?.email || '');
    navigate('/admin/login?invite=1');
  };

  const handleRegisterRedirect = () => {
    sessionStorage.setItem('lumora_pending_invite_token', token);
    sessionStorage.setItem('lumora_pending_invite_email', invitation?.email || '');
    // Admin registration via the standard auth register page
    navigate(`/auth/register?role=admin&invite_token=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation?.email || '')}`);
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

        {/* ── Loading ── */}
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
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(5,150,105,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>✉️</div>
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
          </div>
        )}

        {/* ── Valid — already authenticated as admin, activation in progress ── */}
        {status === 'valid' && invitation && user && userRole === 'admin' && (
          <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.9rem', padding: '20px 0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(123,63,160,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Activating your admin role…
          </div>
        )}

        {/* ── Activation Success ── */}
        {status === 'activated' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(5,150,105,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>✓</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 12px' }}>Role Activated!</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px' }}>
              Your admin role has been successfully activated. You now have access to the admin panel.
            </p>
            <button
              onClick={() => navigate('/admin/team')}
              style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Go to Team Management
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(220,38,38,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>⚠️</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 12px' }}>Activation Failed</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 28px' }}>{errorMsg}</p>
            <button
              onClick={() => navigate('/admin/login')}
              style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
            >
              Go to Admin Login
            </button>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
