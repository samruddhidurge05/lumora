// src/pages/auth/Register.jsx
import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import './auth.css';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';

const ROLE_META = {
  customer: {
    heading: 'Create Account',
    sub: 'Sign up as a Customer to buy premium digital assets.',
    badge: '🛒 Customer',
    btnLabel: 'Create Customer Account',
  },
  affiliate: {
    heading: 'Join as Affiliate',
    sub: 'Sign up as an Affiliate to earn commissions by promoting products.',
    badge: '📣 Affiliate',
    btnLabel: 'Create Affiliate Account',
  },
  vendor: {
    heading: 'Become a Creator',
    sub: 'Sign up as a Vendor to sell your digital products on Lumora.',
    badge: '🏪 Vendor',
    btnLabel: 'Create Vendor Account',
  },
};

export default function Register() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const validRoles = ['customer', 'affiliate', 'vendor'];

  if (!role || !validRoles.includes(role)) {
    return <Navigate to="/auth/register-selection" replace />;
  }

  const meta = ROLE_META[role];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [pwStrength, setPwStrength] = useState(0);

  const { register } = useAuth();
  const navigate = useNavigate();

  const calcStrength = (pw) => {
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    return score;
  };

  const validate = () => {
    const e = {};
    if (!name || name.trim().length < 2) e.name = 'Full name must be at least 2 characters.';
    if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Please enter a valid email address.';
    if (!password || password.length < 6) e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await register(name, email, password, role);
      navigate(`/auth/login?role=${role}&registered=true`);
    } catch (err) {
      // Map error codes to friendly messages
      if (err.code === 'auth/email-already-in-use') {
        setErrors({ form: `This email is already registered. To add the ${role} role to your account, enter your existing Lumora password. If you forgot it, use "Forgot password" on the login page.` });
      } else if (err.code === 'auth/weak-password') {
        setErrors({ password: 'Password must be at least 6 characters.' });
      } else if (err.code === 'auth/invalid-email') {
        setErrors({ email: 'Please enter a valid email address.' });
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrors({ form: `Wrong password. To add the ${role} role, enter the password you used when you first registered on Lumora.` });
      } else {
        setErrors({ form: err.message || 'Registration failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="auth-container">
        <div className="auth-blob b1" />
        <div className="auth-blob b2" />
        <div className="auth-card">
          <div className="auth-card-border" />

          {/* Brand */}
          <div className="card-brand">
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </div>

          {/* Role badge */}
          <div style={{ marginBottom: '10px', position: 'relative', zIndex: 2 }}>
            <span className="role-badge">{meta.badge}</span>
          </div>

          <h2 className="card-heading">{meta.heading}</h2>
          <p className="card-subheading">{meta.sub}</p>

          {errors.form && (
            <div className="auth-alert auth-alert-error" role="alert">
              <span>⚠</span><p>{errors.form}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div className="field">
              <label className="field-label" htmlFor="name">Full Name</label>
              <div className="field-input-wrapper">
                <input
                  className="field-input"
                  id="name"
                  type="text"
                  placeholder="Alexander Wright"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="name"
                />
              </div>
              {errors.name && <div className="field-error">{errors.name}</div>}
            </div>

            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="email">Email Address</label>
              <div className="field-input-wrapper">
                <input
                  className="field-input"
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {errors.email && <div className="field-error">{errors.email}</div>}
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div className="field-input-wrapper">
                <input
                  className="field-input"
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwStrength(calcStrength(e.target.value)); }}
                  disabled={isLoading}
                  autoComplete="new-password"
                />
              </div>
              {password && (
                <div className="pw-strength">
                  {[0,1,2].map(i => (
                    <div key={i} className={`pw-bar ${i < pwStrength ? (pwStrength === 3 ? 'strong' : 'active') : ''}`} />
                  ))}
                </div>
              )}
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <button className="btn-cta" type="submit" disabled={isLoading} style={{ marginTop: '8px' }}>
              {isLoading && <div className="shimmer" />}
              {isLoading ? 'Creating Account...' : meta.btnLabel}
            </button>
          </form>

          <div className="signup-prompt">
            Already have a {role} account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/auth/login?role=${role}`); }}>
              Sign in →
            </a>
          </div>

          <div className="signup-prompt" style={{ marginTop: '8px' }}>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/auth/register-selection'); }}
              style={{ color: 'rgba(123,63,160,0.55)', fontSize: '12px' }}>
              ← Choose a different account type
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
