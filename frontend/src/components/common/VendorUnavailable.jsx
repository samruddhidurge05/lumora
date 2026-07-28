import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import AnimatedBackground from '../AnimatedBackground';

export default function VendorUnavailable() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column' }}>
      <AnimatedBackground />
      <Navbar />

      <main style={{ flex: 1, paddingTop: '140px', paddingBottom: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '24px', paddingRight: '24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            maxWidth: '520px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.40)',
            backdropFilter: 'blur(40px) saturate(200%) brightness(1.05)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%) brightness(1.05)',
            border: '1px solid rgba(255, 255, 255, 0.50)',
            borderTop: '1.5px solid rgba(255, 255, 255, 0.70)',
            borderRadius: '28px',
            padding: '48px 36px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(90, 30, 126, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.70)',
          }}
        >
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '999px',
            background: 'rgba(255, 133, 151, 0.12)',
            border: '1px solid rgba(255, 133, 151, 0.30)',
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#D93856',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '24px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D93856' }} />
            Temporarily Unavailable
          </div>

          <h2 style={{ fontFamily: 'var(--font-editorial, serif)', fontSize: '2rem', fontWeight: 500, color: '#2D004D', marginBottom: '14px', lineHeight: 1.2 }}>
            Vendor Marketplace is Currently Unavailable
          </h2>

          <p style={{ color: '#6B4F7A', fontSize: '0.92rem', lineHeight: 1.65, marginBottom: '32px' }}>
            The Lumora Vendor Marketplace is currently undergoing maintenance or is paused by platform administrators. Existing vendor profiles and products remain safely preserved.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(90, 30, 126, 0.25)',
                transition: 'all 0.2s ease',
              }}
            >
              Return to Home Page
            </button>

            <button
              onClick={() => navigate('/auth/login?role=customer')}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.60)',
                color: '#2D004D',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: '1px solid rgba(184, 134, 208, 0.40)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Customer Sign In
            </button>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
