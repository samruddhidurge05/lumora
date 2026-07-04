import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
      staggerChildren: 0.08
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

const roleContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const roleCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 22 }
  }
};

export default function RegisterSelection() {
  const navigate = useNavigate();

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

          <motion.h2 className="card-heading" variants={itemVariants}>Join Lumora</motion.h2>
          <motion.p className="card-subheading" variants={itemVariants}>
            Pick your role. Each account type is separate — one email per role.
          </motion.p>

          <motion.div className="role-cards-container" variants={roleContainerVariants}>
            {ROLES.map((role) => (
              <motion.div
                key={role.id}
                className="role-card"
                variants={roleCardVariants}
                whileHover={{ 
                  scale: 1.025, 
                  y: -2, 
                  boxShadow: '0 12px 30px rgba(123, 63, 160, 0.12)',
                  borderColor: 'rgba(184, 134, 208, 0.5)'
                }}
                whileTap={{ scale: 0.985 }}
                onClick={() => navigate(`/auth/register?role=${role.id}`)}
              >
                <div className="role-card-icon">{role.icon}</div>
                <div className="role-card-content">
                  <h3 className="role-card-title">{role.title}</h3>
                  <p className="role-card-desc">{role.desc}</p>
                </div>
                <span className="role-card-arrow"><Arrow /></span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="signup-prompt" variants={itemVariants}>
            Already have an account?{' '}
            <a href="/auth/login-selection" onClick={(e) => { e.preventDefault(); navigate('/auth/login-selection'); }}>
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
