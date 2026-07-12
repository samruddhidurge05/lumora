import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | valid | invalid | activating | activated | error
  const [invitation, setInvitation] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setErrorMsg('No invitation token provided.');
      return;
    }

    fetch(`${API_BASE}/api/admin/team/invitations/verify?token=${encodeURIComponent(token)}`)
      .then(res => {
        if (!res.ok) throw new Error('Invalid or expired invitation token.');
        return res.json();
      })
      .then(data => {
        setInvitation(data);
        setStatus('valid');
      })
      .catch(err => {
        setStatus('invalid');
        setErrorMsg(err.message || 'This invitation is invalid or has expired.');
      });
  }, [token]);

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

        {status === 'loading' && (
          <div style={{ textAlign: 'center', color: '#7B3FA0', fontSize: '0.9rem', padding: '20px 0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid rgba(123,63,160,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            Verifying invitation…
          </div>
        )}

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

        {status === 'valid' && invitation && (
          <div>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(5,150,105,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '1.5rem' }}>✓</div>
            <h2 style={{ color: '#2D004D', fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>You've been invited!</h2>
            <p style={{ color: '#7B3FA0', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 8px', textAlign: 'center' }}>
              You have been invited to join Lumora Admin as:
            </p>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <span style={{ padding: '4px 16px', borderRadius: '999px', background: 'rgba(123,63,160,0.12)', color: '#5A1E7E', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {invitation.role_level?.replace(/_/g, ' ')}
              </span>
            </div>
            <p style={{ color: '#8E6AA8', fontSize: '0.78rem', lineHeight: 1.6, margin: '0 0 28px', textAlign: 'center' }}>
              To complete activation, log in or register with <strong>{invitation.email}</strong>, then contact your admin to activate your role using this token.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => navigate(`/auth/login?invite_token=${token}&email=${encodeURIComponent(invitation.email)}`)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Log in to accept
              </button>
              <button
                onClick={() => navigate(`/auth/register?invite_token=${token}&email=${encodeURIComponent(invitation.email)}&role=admin`)}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(123,63,160,0.3)', background: 'transparent', color: '#5A1E7E', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Create a new account
              </button>
            </div>
            <div style={{ marginTop: '24px', padding: '14px', background: 'rgba(245,233,221,0.5)', borderRadius: '12px', fontSize: '0.72rem', color: '#7B3FA0' }}>
              <strong>Your invite token:</strong><br />
              <code style={{ wordBreak: 'break-all', fontSize: '0.68rem' }}>{token}</code>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
