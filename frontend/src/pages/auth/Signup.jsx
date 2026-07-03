import React, { useState, useEffect } from 'react';
import './auth.css';
import AuthBackground from '../../components/AuthBackground';
// Firebase imports removed for frontend‑only mock implementation
export default function Signup() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Retrieve transient registration data
    const storedEmail = sessionStorage.getItem('reg_email');
    const storedName = sessionStorage.getItem('reg_name');
    if (!storedEmail || !storedName) {
      // If direct access, redirect back to step 1
      window.location.href = '/auth/register';
    } else {
      setEmail(storedEmail);
      setName(storedName);
    }
  }, []);

  const validate = () => {
    const tempErrors = {};
    if (!password) {
      tempErrors.password = 'Password is required';
    } else if (password.length < 8) {
      tempErrors.password = 'Password must be at least 8 characters';
    }
    if (password !== confirmPassword) {
      tempErrors.confirmPassword = 'Passwords do not match';
    }
    if (!agreeTerms) {
      tempErrors.agreeTerms = 'You must agree to the Terms of Service';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      // Mock async signup – no real Firebase calls
      await new Promise(r => setTimeout(r, 300));
      // Store the email for the verification step (same as original flow)
      sessionStorage.setItem('verify_email', email);
      // Redirect to the verification screen
      window.location.href = '/auth/verify-email';
    } catch (error) {
      // Preserve UI error area – show generic mock error
      setErrors(prev => ({
        ...prev,
        firebase: error.message || 'Signup failed (mock).'
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="auth-container">
      <div className="auth-card">
        <div className="card-brand">
          <div className="card-gem">
            <svg viewBox="0 0 18 18" fill="none">
              <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
              <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
            </svg>
          </div>
          <span className="card-name">Lumora</span>
        </div>

        <h2 className="card-heading">Set Password</h2>
        <p className="card-subheading">Step 2 of 2: Create a secure password for {email || 'your account'}</p>

        <form onSubmit={handleSignup}>
          <div className="field">
            <label className="field-label" htmlFor="password">Password</label>
            <div className="field-input-wrapper">
              <input
                className="field-input"
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="field-input-wrapper">
              <input
                className="field-input"
                id="confirmPassword"
                type="password"
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {errors.confirmPassword && <div className="field-error">{errors.confirmPassword}</div>}
          </div>

          <div className="meta-row" style={{ justifyContent: 'flex-start', gap: '10px' }}>
            <label className="remember" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                id="agree"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                disabled={isLoading}
              />
              <span style={{ fontSize: '12px' }}>
                I agree to the <a href="/terms" onClick={(e) => e.preventDefault()} style={{ color: '#B886D0', textDecoration: 'underline' }}>Terms</a> and <a href="/privacy" onClick={(e) => e.preventDefault()} style={{ color: '#B886D0', textDecoration: 'underline' }}>Privacy Policy</a>
              </span>
            </label>
          </div>
          {errors.agreeTerms && <div className="field-error" style={{ marginBottom: '15px' }}>{errors.agreeTerms}</div>}

          <button className="btn-cta" type="submit" disabled={isLoading}>
            {isLoading && <div className="shimmer"></div>}
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
{errors.firebase && <div className="field-error">{errors.firebase}</div>}
        </form>
      </div>
      </div>
    </AuthBackground>
  );
}
