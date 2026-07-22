import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './auth.css';
import AuthBackground from '../../components/AuthBackground';
import { useAuth } from '../../context/AuthContext';

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.97 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      duration: 0.75, 
      ease: [0.16, 1, 0.3, 1],
      when: "beforeChildren",
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 1, 0.5, 1] }
  }
};

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlRole = searchParams.get('role');
  const storedRole = sessionStorage.getItem('lumora_last_auth_role') || localStorage.getItem('lumora_active_role');

  let refRole = null;
  try {
    if (typeof document !== 'undefined' && document.referrer && document.referrer.includes('role=')) {
      const match = document.referrer.match(/role=([a-z]+)/i);
      if (match && match[1]) refRole = match[1].toLowerCase();
    }
  } catch (_) {}

  const validRoles = ['customer', 'affiliate', 'vendor', 'admin'];
  const activeRole = (urlRole && validRoles.includes(urlRole))
    ? urlRole
    : ((refRole && validRoles.includes(refRole))
      ? refRole
      : ((storedRole && validRoles.includes(storedRole)) ? storedRole : 'customer'));

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
        <motion.div 
          className="auth-card"
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <div className="auth-card-border" />

          <motion.div className="card-brand" variants={itemVariants}>
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </motion.div>

          <motion.h2 className="card-heading" variants={itemVariants}>Reset Password</motion.h2>

          <AnimatePresence mode="wait">
            {!linkSent ? (
              <motion.div
                key="form-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <p className="card-subheading">Enter your email and we'll send you a recovery link</p>

                {status && (
                  <div className={`auth-alert auth-alert-${status}`}>
                    <span>⚠</span>
                    <p>{message}</p>
                  </div>
                )}

                <form onSubmit={handleSendLink}>
                  <div className="field">
                    <label className="field-label" htmlFor="email">Email Address</label>
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

                  <motion.button 
                    className="btn-cta" 
                    type="submit" 
                    disabled={isLoading}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                  >
                    {isLoading && <div className="shimmer"></div>}
                    {isLoading ? 'Sending Link...' : 'Send Recovery Link'}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="success-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="auth-alert auth-alert-success" style={{ marginTop: '20px' }}>
                  <span>✦</span>
                  <p>{message}</p>
                </div>
                <p className="card-subheading" style={{ marginBottom: '30px' }}>
                  Click the link in your email to reset your password.
                </p>
                <motion.button
                  className="btn-cta"
                  type="button"
                  onClick={() => {
                    navigate(`/auth/login?role=${activeRole}`);
                  }}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                >
                  Return to Sign In ({activeRole.charAt(0).toUpperCase() + activeRole.slice(1)})
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div className="signup-prompt" variants={itemVariants}>
            Remember your password?{' '}
            <a href={`/auth/login?role=${activeRole}`} onClick={(e) => { e.preventDefault(); navigate(`/auth/login?role=${activeRole}`); }}>
              Sign in ({activeRole.charAt(0).toUpperCase() + activeRole.slice(1)}) →
            </a>
          </motion.div>
        </motion.div>
      </div>
    </AuthBackground>
  );
}
