import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Compass, Users, LayoutDashboard, ArrowUpRight, Home } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function Navbar() {
  const { navigateTo, currentView, cart, platformStatus } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Route to the correct dashboard based on the user's stored role
  const handleDashboardClick = async () => {
    if (!user) { navigate('/auth/login?role=customer'); return; }
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'affiliate') navigate('/affiliate/dashboard');
      else if (role === 'vendor') navigate('/vendor/dashboard');
      else navigate('/customer/dashboard');
    } catch {
      navigate('/customer/dashboard');
    }
  };

  // Magnetic CTA Hover effect
  const handleMouseMove = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    // Magnetic pull (25% translation towards mouse)
    btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.25}px, 0)`;
  };

  const handleMouseLeave = (e) => {
    const btn = e.currentTarget;
    btn.style.transform = 'translate3d(0px, 0px, 0)';
  };

  const handleNavClick = (e, item) => {
    e.preventDefault();
    if (item.href === '#dashboard') {
      handleDashboardClick();
    } else if (item.href === '#cart') {
      navigateTo('cart');
    } else if (item.href === '/partnerships') {
      navigate('/partnerships');
    } else if (item.href === '#categories') {
      navigateTo('categories');
    } else if (item.href === '#home') {
      navigateTo('landing');
    } else if (item.href.startsWith('#')) {
      const elementId = item.href.substring(1);
      if (elementId === 'products') {
        navigateTo('marketplace');
      } else if (currentView === 'landing') {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        if (elementId === 'categories') {
          navigateTo('categories');
        } else {
          navigateTo('landing');
          setTimeout(() => {
            const el = document.getElementById(elementId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        }
      }
    }
  };

  return (
    <header 
      style={{
        position: 'fixed',
        top: isPlatformPaused ? (scrolled ? '1rem' : '2rem') : (scrolled ? '1rem' : '2rem'),
        left: '50%',
        transform: 'translateX(-50%)',
        width: scrolled ? 'min(1200px, 92%)' : 'min(1340px, 94%)',
        zIndex: 9999, // Ensure it is always on top of all page elements
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div 
        className="glass-surface"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: scrolled ? '10px 24px' : '16px 40px',
          borderRadius: '100px',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          background: scrolled ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(24px) saturate(180%) brightness(1.02)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%) brightness(1.02)',
          boxShadow: scrolled 
            ? '0 10px 30px rgba(90, 30, 126, 0.12), inset 0 1px 0 rgba(255,255,255,0.40)' 
            : '0 4px 20px rgba(90, 30, 126, 0.05), inset 0 1px 0 rgba(255,255,255,0.30)',
          border: '1px solid',
          borderColor: scrolled ? 'rgba(255, 255, 255, 0.50)' : 'rgba(255, 255, 255, 0.30)',
        }}
      >
        {/* Brand Logo */}
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigateTo('landing'); }}
          className="text-editorial"
          style={{
            fontSize: '1.8rem',
            fontWeight: 500,
            textDecoration: 'none',
            color: 'var(--color-espresso)',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'none'
          }}
        >
          Lumora
        </a>

        {/* Navigation Links */}
        <nav 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
          }}
          className="nav-menu"
        >
          {[
            { label: 'Explore', icon: <Compass size={14} />, href: '#products' },
            { label: 'Categories', icon: <Sparkles size={14} />, href: '#categories' },
            { label: 'Showcase', icon: <Home size={14} />, href: '#home' },
            { label: 'Partnership', icon: <Users size={14} />, href: '/partnerships' },
            ...(user ? [{ label: 'Dashboard', icon: <LayoutDashboard size={14} />, href: '#dashboard' }] : [])
          ].map((item, index) => (
            <a
              key={index}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className="text-sans"
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-mocha)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                position: 'relative',
                padding: '6px 0',
                transition: 'color 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-espresso)';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-mocha)';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(0)';
              }}
            >
              {item.icon}
              {item.label}
              <span 
                className="dot"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  left: '50%',
                  transform: 'translateX(-50%) scale(0)',
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-latte)',
                  transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  transformOrigin: 'center center'
                }}
              />
            </a>
          ))}
        </nav>

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user ? (
            <>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
                className="text-sans"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-espresso)',
                  textDecoration: 'none',
                  transition: 'opacity 0.3s',
                  cursor: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Sign Out
              </a>
              
              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); handleDashboardClick(); }}
                className="btn-premium"
                style={{
                  padding: scrolled ? '10px 22px' : '14px 28px',
                  fontSize: scrolled ? '0.85rem' : '0.9rem',
                  willChange: 'transform',
                  cursor: 'none'
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                Enter Lumora
                <ArrowUpRight size={14} style={{ opacity: 0.8 }} />
              </a>
            </>
          ) : (
            <>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigateTo('login', 'customer'); }}
                className="text-sans"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-espresso)',
                  textDecoration: 'none',
                  transition: 'opacity 0.3s',
                  cursor: 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Sign In
              </a>
              
              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); navigateTo('register', 'customer'); }}
                className="btn-premium"
                style={{
                  padding: scrolled ? '10px 22px' : '14px 28px',
                  fontSize: scrolled ? '0.85rem' : '0.9rem',
                  willChange: 'transform',
                  cursor: 'none'
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                Get Started
                <ArrowUpRight size={14} style={{ opacity: 0.8 }} />
              </a>
            </>
          )}
        </div>
      </div>
      
      {/* Visual responsive overlay script to hide nav-menu on mobile */}
      <style>{`
        @media (max-width: 768px) {
          .nav-menu {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
