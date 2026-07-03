import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthBackground from '../../components/AuthBackground';
import './auth.css';

const ROLES = [
  {
    id: 'customer',
    title: 'Customer',
    desc: 'Browse, buy, and download premium digital assets.',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
  {
    id: 'affiliate',
    title: 'Affiliate',
    desc: 'Share referral links and earn up to 30% commission.',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
    ),
  },
  {
    id: 'vendor',
    title: 'Vendor / Creator',
    desc: 'Sell your digital products and track live analytics.',
    icon: (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
];

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

export default function RegisterSelection() {
  const navigate = useNavigate();

  return (
    <AuthBackground>
      <div className="auth-container">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-card">
          <div className="auth-card-border" />

          <div className="card-brand">
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </div>

          <h2 className="card-heading">Join Lumora</h2>
          <p className="card-subheading">
            Pick your role. Each account type is separate — one email per role.
          </p>

          <div className="role-cards-container">
            {ROLES.map((role) => (
              <div
                key={role.id}
                className="role-card"
                onClick={() => navigate(`/auth/register?role=${role.id}`)}
              >
                <div className="role-card-icon">{role.icon}</div>
                <div className="role-card-content">
                  <h3 className="role-card-title">{role.title}</h3>
                  <p className="role-card-desc">{role.desc}</p>
                </div>
                <span className="role-card-arrow"><Arrow /></span>
              </div>
            ))}
          </div>

          <div className="signup-prompt">
            Already have an account?{' '}
            <a href="/auth/login-selection" onClick={(e) => { e.preventDefault(); navigate('/auth/login-selection'); }}>
              Sign in →
            </a>
          </div>

          <div className="trust-strip">
            <div className="trust-item"><div className="trust-pip" style={{ background: '#7B3FA0' }} />256-bit SSL</div>
            <div className="trust-item"><div className="trust-pip" style={{ background: '#B886D0' }} />SOC 2 Type II</div>
            <div className="trust-item"><div className="trust-pip" style={{ background: '#D8BFE3' }} />GDPR Ready</div>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
