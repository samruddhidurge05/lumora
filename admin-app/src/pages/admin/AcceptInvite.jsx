import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import { auth } from '../../services/firebase';
import { clearBackendToken } from '../../services/authService';
import { fetchSignInMethodsForEmail } from 'firebase/auth';

// --- Analytics Helper ---
const logAnalytics = (event, metadata = {}) => {
  // In a real production system, this would push to Mixpanel, Amplitude, or Google Analytics
  console.log(`[AdminInviteAnalytics] ${event}`, metadata);
};

// --- Error Mapping Utility ---
// Isolates backend string parsing so future API changes only require updating this function
const mapInvitationError = (err) => {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('revoked')) return 'INVITATION_REVOKED';
  if (msg.includes('expired')) return 'INVITATION_EXPIRED';
  if (msg.includes('already accepted')) return 'INVITATION_ALREADY_ACCEPTED';
  return 'INVITATION_INVALID';
};

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, userRole, loading: authLoading } = useAuth();
  
  const token = searchParams.get('token');
  const hasLoggedOpen = useRef(false);

  // --- Independent State Machines ---
  
  // Invitation State
  const [inviteStatus, setInviteStatus] = useState('LOADING_INVITATION'); 
  // LOADING_INVITATION | INVITATION_VALID | INVITATION_EXPIRED | INVITATION_REVOKED | INVITATION_ALREADY_ACCEPTED | INVITATION_INVALID | ERROR
  const [invitation, setInvitation] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [signInMethods, setSignInMethods] = useState(null);

  // Authentication State
  const [authStatus, setAuthStatus] = useState('CHECKING');
  // CHECKING | NOT_SIGNED_IN | SIGNED_IN_CORRECT | SIGNED_IN_WRONG | SESSION_EXPIRED

  // Activation State
  const [activationStatus, setActivationStatus] = useState('IDLE');
  // IDLE | ACTIVATING | REDIRECTING | SUCCESS | ERROR
  const [activationMessage, setActivationMessage] = useState('');

  // ── 0. Analytics: Invitation Opened ────────────────────────────────────────
  useEffect(() => {
    if (!hasLoggedOpen.current && token) {
      logAnalytics('invitation_opened', { token: token.substring(0, 8) + '...' });
      hasLoggedOpen.current = true;
    }
  }, [token]);

  // ── 1. Verify Token on Mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setInviteStatus('INVITATION_INVALID');
      setInviteError('No invitation token provided in the URL.');
      return;
    }

    backendFetch(`/admin/team/invitations/verify?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        setInvitation(data);
        setInviteStatus('INVITATION_VALID');
        
        try {
          const methods = await fetchSignInMethodsForEmail(auth, data.email);
          setSignInMethods(methods || []);
        } catch (_) {
          setSignInMethods([]);
        }
      })
      .catch(err => {
        const mappedStatus = mapInvitationError(err);
        setInviteStatus(mappedStatus);
        
        if (mappedStatus === 'INVITATION_ALREADY_ACCEPTED') {
          logAnalytics('invitation_already_accepted');
        }
        
        if (mappedStatus === 'INVITATION_INVALID') {
          setInviteError(err.message || 'This invitation is invalid or has already been accepted.');
        }
      });
  }, [token]);

  // ── 2. Determine Authentication State ──────────────────────────────────────
  useEffect(() => {
    if (authLoading || inviteStatus !== 'INVITATION_VALID' || !invitation) {
      return;
    }
    
    if (!user) {
      setAuthStatus('NOT_SIGNED_IN');
    } else {
      if (user.email.toLowerCase() === invitation.email.toLowerCase()) {
        setAuthStatus('SIGNED_IN_CORRECT');
      } else {
        logAnalytics('wrong_account_detected', { invited: invitation.email, actual: user.email });
        setAuthStatus('SIGNED_IN_WRONG');
      }
    }
  }, [authLoading, inviteStatus, invitation, user]);

  // ── 3. Auto-Activate if Signed In Correctly ────────────────────────────────
  useEffect(() => {
    if (authStatus === 'SIGNED_IN_CORRECT' && activationStatus === 'IDLE') {
      activateInvite();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, activationStatus]);

  const activateInvite = async () => {
    logAnalytics('activation_started');
    setActivationStatus('ACTIVATING');
    try {
      const res = await backendFetch('/admin/team/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      
      sessionStorage.removeItem('lumora_pending_invite_token');
      sessionStorage.removeItem('lumora_pending_invite_email');

      logAnalytics('activation_completed', { status: res?.already_admin ? 'already_admin' : 'new_activation' });
      
      setActivationStatus('SUCCESS');
      if (res?.already_admin || res?.already_accepted) {
        setActivationMessage('Administrator access has already been activated for this account.');
      } else {
        setActivationMessage('Your administrator permissions have been successfully activated.');
      }

      // Smooth transition to dashboard
      setTimeout(() => setActivationStatus('REDIRECTING'), 1200);
      setTimeout(() => handleGoToDashboard(), 2400);

    } catch (err) {
      if (err.status === 401) {
        logAnalytics('session_expired');
        setAuthStatus('SESSION_EXPIRED');
        setActivationStatus('IDLE');
      } else if (err.status === 403 && err.message?.toLowerCase().includes('sent to')) {
        setAuthStatus('SIGNED_IN_WRONG');
        setActivationStatus('IDLE');
      } else {
        setActivationStatus('ERROR');
        setActivationMessage(err.message || 'Failed to activate your admin role. Please contact a super admin.');
      }
    }
  };

  // ── 4. Action Handlers ─────────────────────────────────────────────────────
  const getRedirectParam = () => {
    return encodeURIComponent(`/admin/accept-invite?token=${encodeURIComponent(token || '')}`);
  };

  const handleLoginRedirect = () => {
    logAnalytics('sign_in_started', { method: 'password' });
    navigate(`/admin/login?redirect=${getRedirectParam()}&auth_mode=identity`);
  };

  const handleGoogleRedirect = () => {
    logAnalytics('sign_in_started', { method: 'google' });
    navigate(`/admin/login?redirect=${getRedirectParam()}&auth_mode=identity&provider=google`);
  };

  const handleRegisterRedirect = () => {
    navigate(`/admin/register?token=${encodeURIComponent(token || '')}&redirect=${getRedirectParam()}`);
  };

  const handleGoToDashboard = async () => {
    try {
      clearBackendToken();
      localStorage.setItem('lumora_active_role', 'admin');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (_) {}
    window.location.replace('/admin/login');
  };

  const handleSignOutAndSwitch = async () => {
    try {
      clearBackendToken();
      localStorage.setItem('lumora_active_role', 'admin');
      const { signOut } = await import('firebase/auth');
      await signOut(auth);
    } catch (_) {}
    navigate(`/admin/login?redirect=${getRedirectParam()}&auth_mode=identity`);
  };

  const handleReturnToMarketplace = () => {
    if (token && invitation?.email) {
      sessionStorage.setItem('lumora_pending_invite_token', token);
      sessionStorage.setItem('lumora_pending_invite_email', invitation.email);
    }
    navigate('/');
  };

  // ── 5. Render Helpers ──────────────────────────────────────────────────────
  const renderIcon = (type) => {
    const icons = {
      error: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D92D20" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      ),
      success: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ),
      lock: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      ),
      switch: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <polyline points="17 11 19 13 23 9"></polyline>
        </svg>
      ),
      mail: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7B3FA0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      )
    };
    return icons[type] || null;
  };

  const renderStateBox = (iconType, title, content, buttons, iconBg = 'rgba(123,63,160,0.10)') => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
        {renderIcon(iconType)}
      </div>
      <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 10px' }}>{title}</h2>
      <div style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 24px' }}>
        {content}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {buttons}
      </div>
    </div>
  );

  const btnStylePrimary = { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(90,30,126,0.25)' };
  const btnStyleSecondary = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' };

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

        {/* ── 1. LOADING STATES ── */}
        {(inviteStatus === 'LOADING_INVITATION' || (inviteStatus === 'INVITATION_VALID' && (authStatus === 'CHECKING' || activationStatus === 'ACTIVATING' || activationStatus === 'REDIRECTING'))) && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(123,63,160,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <h3 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 16px', fontSize: '1.05rem' }}>
              {inviteStatus === 'LOADING_INVITATION' ? 'Verifying invitation...' : 'Preparing administrator access...'}
            </h3>
            
            {/* Progressive loading checklist for Activation phase */}
            {(activationStatus === 'ACTIVATING' || activationStatus === 'REDIRECTING') && (
              <div style={{ textAlign: 'left', background: 'rgba(123,63,160,0.04)', padding: '16px 20px', borderRadius: '12px', display: 'inline-block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Verifying invitation
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Confirming account
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activationStatus === 'REDIRECTING' ? '#059669' : '#7B3FA0', fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>
                  {activationStatus === 'REDIRECTING' ? (
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(123,63,160,0.3)', borderTop: '2px solid #7B3FA0', animation: 'spin 1s linear infinite' }} />
                  )}
                  Activating administrator access...
                </div>
                {activationStatus === 'REDIRECTING' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7B3FA0', fontSize: '0.85rem', fontWeight: 600 }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(123,63,160,0.3)', borderTop: '2px solid #7B3FA0', animation: 'spin 1s linear infinite' }} />
                    Redirecting to dashboard...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 2. INVITATION ERROR STATES ── */}
        {inviteStatus === 'INVITATION_EXPIRED' && renderStateBox('error', 'Invitation Expired', 
          <p>Your invitation has expired.<br/><br/>Ask your administrator to resend a new invitation.</p>,
          <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>,
          'rgba(217,45,32,0.1)'
        )}

        {inviteStatus === 'INVITATION_REVOKED' && renderStateBox('error', 'Invitation Revoked',
          <p>This invitation was revoked by an administrator.<br/><br/>If you believe this is a mistake, contact your administrator.</p>,
          <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>,
          'rgba(217,45,32,0.1)'
        )}

        {inviteStatus === 'INVITATION_ALREADY_ACCEPTED' && renderStateBox('success', 'Already Accepted',
          <p>Administrator access has already been activated for this account.</p>,
          <>
            <button onClick={handleGoToDashboard} style={btnStylePrimary}>Go to Admin Dashboard</button>
            <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>
          </>,
          'rgba(5,150,105,0.12)'
        )}

        {inviteStatus === 'INVITATION_INVALID' && renderStateBox('error', 'Invalid Invitation',
          <p>{inviteError}</p>,
          <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>,
          'rgba(217,45,32,0.1)'
        )}

        {/* ── 3. AUTHENTICATION ERROR STATES ── */}
        {authStatus === 'SESSION_EXPIRED' && renderStateBox('lock', 'Session Expired',
          <p>Your session has expired. Please sign in again to continue.</p>,
          <>
            <button onClick={handleSignOutAndSwitch} style={btnStylePrimary}>Sign In Again</button>
            <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>
          </>,
          'rgba(217,45,32,0.1)'
        )}

        {/* ── 4. INVITATION VALID + NOT SIGNED IN ── */}
        {inviteStatus === 'INVITATION_VALID' && authStatus === 'NOT_SIGNED_IN' && (
          <div>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(123,63,160,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              {renderIcon('mail')}
            </div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, fontSize: '1.3rem', margin: '0 0 8px', textAlign: 'center' }}>Team Invitation</h2>
            <p style={{ color: '#66507A', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 12px', textAlign: 'center' }}>
              You've been invited to join the Lumora Admin Team as:
            </p>
            <div style={{ textAlign: 'center', marginBottom: '14px' }}>
              <span style={{ padding: '6px 18px', borderRadius: '999px', background: 'rgba(123,63,160,0.12)', color: '#5A1E7E', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {invitation?.role_level?.replace(/_/g, ' ')}
              </span>
            </div>
            <p style={{ color: '#8E6AA8', fontSize: '0.82rem', lineHeight: 1.6, margin: '0 0 24px', textAlign: 'center' }}>
              Invited address: <strong style={{ color: '#2D004D' }}>{invitation?.email}</strong>
            </p>

            {signInMethods === null ? (
              <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem', padding: '12px 0' }}>
                Loading account options…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {signInMethods.length === 0 && (
                  <button onClick={handleRegisterRedirect} style={btnStylePrimary}>
                    Create Account & Join Team
                  </button>
                )}

                {signInMethods.includes('google.com') && (
                  <button onClick={handleGoogleRedirect} style={{ ...btnStylePrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Continue with Google
                  </button>
                )}

                {signInMethods.includes('password') && (
                  <button onClick={handleLoginRedirect} style={{ ...btnStylePrimary, background: signInMethods.includes('google.com') ? 'transparent' : btnStylePrimary.background, color: signInMethods.includes('google.com') ? '#5A1E7E' : '#fff', border: signInMethods.includes('google.com') ? '1px solid rgba(123,63,160,0.3)' : 'none' }}>
                    Continue with Sign In
                  </button>
                )}

                {signInMethods.length === 0 && (
                  <button onClick={handleLoginRedirect} style={btnStyleSecondary}>
                    Sign In to Continue
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 5. INVITATION VALID + SIGNED IN WRONG ACCOUNT ── */}
        {inviteStatus === 'INVITATION_VALID' && authStatus === 'SIGNED_IN_WRONG' && renderStateBox('switch', 'Account Mismatch',
          <div style={{ textAlign: 'left', background: 'rgba(217,45,32,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(217,45,32,0.1)' }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>Invitation sent to:<br/><strong style={{ color: '#2D004D' }}>{invitation?.email}</strong></p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Currently signed in as:<br/><strong style={{ color: '#D92D20' }}>{user?.email}</strong></p>
            <p style={{ margin: '16px 0 0', fontSize: '0.85rem', color: '#D92D20', fontWeight: 500 }}>These accounts don't match. Please sign out and continue using the invited account.</p>
          </div>,
          <>
            <button onClick={handleSignOutAndSwitch} style={btnStylePrimary}>Sign Out</button>
            <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>
          </>
        )}

        {/* ── 6. ACTIVATION SUCCESS ── */}
        {activationStatus === 'SUCCESS' && renderStateBox('success', 'Administrator Access Granted',
          <p>{activationMessage}</p>,
          <button onClick={handleGoToDashboard} style={btnStylePrimary}>Go to Admin Dashboard →</button>,
          'rgba(5,150,105,0.12)'
        )}

        {/* ── 7. ACTIVATION ERROR ── */}
        {activationStatus === 'ERROR' && renderStateBox('error', 'Activation Failed',
          <p>{activationMessage}</p>,
          <>
            <button onClick={handleSignOutAndSwitch} style={btnStylePrimary}>Return to Sign In</button>
            <button onClick={handleReturnToMarketplace} style={btnStyleSecondary}>Return to Marketplace</button>
          </>,
          'rgba(217,45,32,0.1)'
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
