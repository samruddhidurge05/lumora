import React, { useState } from 'react';
import './auth.css';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [linkSent, setLinkSent] = useState(false);

  const { sendPasswordReset } = useAuth();

  const validate = () => {
    const tempErrors = {};
    if (!email) {
      tempErrors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = 'Please enter a valid email address';
    }
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const mapFirebaseError = (code) => {
    switch (code) {
      case 'auth/user-not-found':
        return 'No account found with this email.';
      case 'auth/invalid-email':
        return 'Invalid email address.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleSendLink = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setStatus(null);
    try {
      await sendPasswordReset(email);
      setLinkSent(true);
      setStatus('success');
      setMessage(`Password reset email sent to ${email}. Please check your inbox.`);
    } catch (err) {
      setStatus('error');
      const errMsg = err?.code ? mapFirebaseError(err.code) : err.message;
      setMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="auth-container">
        <div className="auth-blob b1"></div>
        <div className="auth-blob b2"></div>

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

          <h2 className="card-heading">Reset Password</h2>

          {!linkSent ? (
            <>
              <p className="card-subheading">Enter your email and we'll send you a recovery link</p>

              {status && (
                <div className={`auth-alert auth-alert-${status}`}>
                  <span>⚠</span>
                  <p>{message}</p>
                </div>
              )}

              <form onSubmit={handleSendLink}>
                <div className="field">
                  <label className="field-label" htmlFor="email">Email address</label>
                  <div className="field-input-wrapper">
                    <input
                      className="field-input"
                      id="email"
                      type="email"
                      placeholder="you@lumora.co"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <div className="field-error">{errors.email}</div>}
                </div>

                <button className="btn-cta" type="submit" disabled={isLoading}>
                  {isLoading && <div className="shimmer"></div>}
                  {isLoading ? 'Sending Link...' : 'Send Recovery Link'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="auth-alert auth-alert-success" style={{ marginTop: '20px' }}>
                <span>✦</span>
                <p>{message}</p>
              </div>
              <p className="card-subheading" style={{ marginBottom: '30px' }}>
                Click the link in your email to reset your password.
              </p>
              <button
                className="btn-cta"
                type="button"
                onClick={() => {
                  setLinkSent(false);
                  setEmail('');
                  setStatus(null);
                }}
              >
                Back to Forgot Password
              </button>
            </>
          )}

          <div className="signup-prompt">
            Remember your password? <a href="/auth/login" onClick={(e) => { e.preventDefault(); window.location.href = '/auth/login'; }}>Sign in →</a>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}
