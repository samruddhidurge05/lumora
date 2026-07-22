// src/pages/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AuthBackground from '../../components/AuthBackground';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../services/firebase';
import './auth.css';

const ROLE_META = {
  customer: {
    heading: 'Customer Login',
    sub: 'Access your purchases, downloads, and wishlist.',
    badge: '🛒 Customer',
  },
  affiliate: {
    heading: 'Affiliate Login',
    sub: 'Access your affiliate dashboard and earnings.',
    badge: '📣 Affiliate',
  },
  vendor: {
    heading: 'Vendor Login',
    sub: 'Access your creator dashboard and products.',
    badge: '🏪 Vendor',
  },
  admin: {
    heading: 'Admin Login',
    sub: 'Access the admin control center.',
    badge: '👑 Admin',
  },
};

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

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, googleSignIn, githubSignIn } = useAuth();

  const role = searchParams.get('role');
  const justRegistered = searchParams.get('registered') === 'true';
  const nextUrl = searchParams.get('next') || null; // invite redirect support
  const validRoles = ['customer', 'affiliate', 'vendor', 'admin'];

  // All hooks must be unconditional — declared before any early return
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Restore justRegistered success banner — must be in an effect, not an initial
  // useState value, because useState initializers only run once (on mount) and
  // the role/justRegistered values are derived from searchParams which are stable.
  useEffect(() => {
    if (justRegistered && role && validRoles.includes(role)) {
      setAuthStatus('success');
      setStatusMessage(`Account created! You can now sign in as ${role}.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guard: redirect to default role if missing/invalid — placed AFTER all hooks
  if (!role || !validRoles.includes(role)) {
    return <Navigate to="/auth/login?role=customer" replace />;
  }

  const meta = ROLE_META[role];

  const mapAuthError = (code) => {
    switch (code) {
      case 'auth/user-not-found':       return 'No account found with this email.';
      case 'auth/wrong-password':       return 'Incorrect password.';
      case 'auth/invalid-credential':   return 'Email or password is incorrect.';
      case 'auth/invalid-email':        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':    return 'Too many attempts. Please try again later.';
      case 'auth/network-request-failed': return 'Network error. Please check your connection.';
      case 'auth/user-disabled':        return 'This account has been disabled.';
      case 'auth/role-mismatch':
        return `This email is registered under a different account type. To use the ${role} dashboard, please register a separate ${role} account.`;
      case 'auth/account-not-found':    return 'No account found. Please register first.';
      default:                          return 'Authentication error. Please try again.';
    }
  };

  const validate = () => {
    const e = {};
    if (!email || !/\S+@\S+\.\S+/.test(email)) e.email = 'Please enter a valid email address.';
    if (!password || password.length < 6)        e.password = 'Password must be at least 6 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    if (!validate()) return;
    setIsLoading(true);
    setAuthStatus(null);
    try {
      await login(normalizedEmail, password, rememberMe, role);
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        const nextParam = nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : '';
        navigate(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&role=${role}${nextParam}`);
      } else {
        if (nextUrl) {
          navigate(nextUrl, { replace: true });
        } else {
          navigate(`/${role}/dashboard`);
        }
      }
    } catch (err) {
      setAuthStatus('error');
      setStatusMessage(mapAuthError(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthStatus(null);
    try {
      const user = await googleSignIn(rememberMe, role);
      if (nextUrl) {
        navigate(nextUrl, { replace: true });
      } else {
        navigate(`/${role}/dashboard`);
      }
    } catch (err) {
      setAuthStatus('error');
      setStatusMessage(mapAuthError(err.code) || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    setIsLoading(true);
    setAuthStatus(null);
    try {
      const user = await githubSignIn(rememberMe, role);
      if (nextUrl) {
        navigate(nextUrl, { replace: true });
      } else {
        navigate(`/${role}/dashboard`);
      }
    } catch (err) {
      setAuthStatus('error');
      setStatusMessage(mapAuthError(err.code) || err.message);
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

          {/* Brand */}
          <motion.div className="card-brand" variants={itemVariants}>
            <div className="card-gem">
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M9 1.5L15.5 5.25V12.75L9 16.5L2.5 12.75V5.25L9 1.5Z" fill="rgba(255,255,255,0.88)"/>
                <path d="M9 5.5L12.2 7.35V11.05L9 12.9L5.8 11.05V7.35L9 5.5Z" fill="rgba(220,198,255,0.65)"/>
              </svg>
            </div>
            <span className="card-name">Lumora</span>
          </motion.div>

          {/* Role badge */}
          <motion.div style={{ marginBottom: '10px', position: 'relative', zIndex: 2 }} variants={itemVariants}>
            <span className="role-badge">{meta.badge}</span>
          </motion.div>

          <motion.h2 className="card-heading" variants={itemVariants}>{meta.heading}</motion.h2>
          <motion.p className="card-subheading" variants={itemVariants}>{meta.sub}</motion.p>

          {authStatus && (
            <motion.div className={`auth-alert auth-alert-${authStatus}`} role="alert" aria-live="assertive" variants={itemVariants}>
              <span>{authStatus === 'success' ? '✦' : '⚠'}</span>
              <p>{statusMessage}</p>
            </motion.div>
          )}

          <motion.form onSubmit={handleSubmit} noValidate variants={itemVariants}>
            {/* Email */}
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
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <div className="meta-row">
              <label className="remember">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={isLoading} />
                <span>Remember me</span>
              </label>
              <a className="forgot" href="#" onClick={(e) => { e.preventDefault(); navigate('/auth/forgot-password'); }}>
                Forgot password?
              </a>
            </div>

            <motion.button 
              className="btn-cta" 
              type="submit" 
              disabled={isLoading}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
            >
              {isLoading && <div className="shimmer" />}
              {isLoading ? 'Signing In...' : `Sign In to ${role.charAt(0).toUpperCase() + role.slice(1)} Dashboard`}
            </motion.button>
          </motion.form>

          <motion.div className="divider" variants={itemVariants}>
            <div className="div-line" /><div className="div-text">or continue with</div><div className="div-line" />
          </motion.div>

          <motion.div className="social-row" variants={itemVariants}>
            <motion.button 
              className="btn-social" 
              type="button" 
              disabled={isLoading} 
              onClick={handleGoogleLogin}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </motion.button>
            <motion.button 
              className="btn-social" 
              type="button" 
              disabled={isLoading} 
              onClick={handleGitHubLogin}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </motion.button>
          </motion.div>

          <motion.div className="signup-prompt" variants={itemVariants}>
            Don't have a {role} account?{' '}
            <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/auth/register?role=${role}`); }}>
              Register here →
            </a>
          </motion.div>


          <motion.div className="trust-strip" variants={itemVariants}>
            <div className="trust-item"><div className="trust-pip" style={{ background: '#7B3FA0' }} />256-bit SSL</div>
            <div className="trust-item"><div className="trust-pip" style={{ background: '#B886D0' }} />SOC 2 Type II</div>
            <div className="trust-item"><div className="trust-pip" style={{ background: '#D8BFE3' }} />GDPR Ready</div>
          </motion.div>
        </motion.div>
      </div>
    </AuthBackground>
  );
}
