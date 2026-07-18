// src/pages/auth/Register.jsx
import React, { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

export default function Register() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const inviteToken = searchParams.get('invite_token') || null;
  const inviteEmail = searchParams.get('email') || '';
  // Allow role=admin ONLY when a valid invite_token is present
  const validRoles = ['customer', 'affiliate', 'vendor'];
  const isAdminInvite = role === 'admin' && !!inviteToken;

  if (!role || (!validRoles.includes(role) && !isAdminInvite)) {
    return <Navigate to="/auth/register?role=customer" replace />;
  }

  const meta = isAdminInvite
    ? {
        heading: 'Create Admin Account',
        sub: 'Create your account to accept the admin invitation.',
        badge: '👑 Admin Invite',
        btnLabel: 'Create Account & Accept Invite',
      }
    : ROLE_META[role];
  const [name, setName] = useState('');
  const [email, setEmail] = useState(inviteEmail); // pre-fill from invite URL
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
    const normalizedEmail = email.trim().toLowerCase();
    setEmail(normalizedEmail);

    if (!validate()) return;
    setIsLoading(true);
    try {
      // Register with 'customer' role for admin invites — role is elevated by accept-invite endpoint
      const registrationRole = isAdminInvite ? 'customer' : role;
      await register(name, normalizedEmail, password, registrationRole);
      
      // On success, redirect to verification screen
      const nextParam = isAdminInvite
        ? `&next=${encodeURIComponent(`/admin/accept-invite?token=${encodeURIComponent(inviteToken)}`)}`
        : '';
      navigate(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}&role=${registrationRole}${nextParam}`);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setErrors({ form: 'An account with this email already exists. Please sign in instead.' });
      } else if (err.code === 'auth/weak-password') {
        setErrors({ password: 'Password must be at least 6 characters.' });
      } else if (err.code === 'auth/invalid-email') {
        setErrors({ email: 'Please enter a valid email address.' });
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

          {errors.form && (
            <motion.div className="auth-alert auth-alert-error" role="alert" variants={itemVariants}>
              <span>⚠</span><p>{errors.form}</p>
            </motion.div>
          )}

          <motion.form onSubmit={handleSubmit} noValidate variants={itemVariants}>
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
                    <motion.div 
                      key={i} 
                      className={`pw-bar ${i < pwStrength ? (pwStrength === 3 ? 'strong' : 'active') : ''}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      style={{ originX: 0 }}
                    />
                  ))}
                </div>
              )}
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <motion.button 
              className="btn-cta" 
              type="submit" 
              disabled={isLoading} 
              style={{ marginTop: '8px' }}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
            >
              {isLoading && <div className="shimmer" />}
              {isLoading ? 'Creating Account...' : meta.btnLabel}
            </motion.button>
          </motion.form>

          <motion.div className="signup-prompt" variants={itemVariants}>
            Already have a {isAdminInvite ? 'Lumora' : role} account?{' '}
            <a href="#" onClick={(e) => {
              e.preventDefault();
              if (isAdminInvite) {
                navigate(`/auth/login?role=customer&next=${encodeURIComponent(`/admin/accept-invite?token=${encodeURIComponent(inviteToken)}`)}`);
              } else {
                navigate(`/auth/login?role=${role}`);
              }
            }}>
              Sign in →
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
