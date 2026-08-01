import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Compass, Users, LayoutDashboard, ArrowUpRight, Home, TrendingUp, ChevronDown, Store, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function Navbar() {
  const { navigateTo, currentView, cart, platformStatus, setDashboardTab } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;
  const { user, logout } = useAuth();
  const { vendor_enabled } = useFeatureFlags();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const mobileRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu & dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu when navigating
  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    closeMobile();
  };

  const handleDashboardClick = async () => {
    setDashboardTab('Dashboard');
    if (!user) { navigate('/auth/login?role=customer'); closeMobile(); return; }
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'admin') navigate('/admin/dashboard');
      else if (role === 'affiliate') navigate('/affiliate/dashboard');
      else if (role === 'vendor') navigate('/vendor/dashboard');
      else {
        setDashboardTab('Dashboard');
        navigate('/customer/dashboard');
      }
    } catch {
      setDashboardTab('Dashboard');
      navigate('/customer/dashboard');
    }
    closeMobile();
  };

  const handleMouseMove = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate3d(${x * 0.25}px, ${y * 0.25}px, 0)`;
  };
  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = 'translate3d(0px, 0px, 0)';
  };

  const handleNavClick = (e, item) => {
    e.preventDefault();
    closeMobile();
    if (item.href === '#dashboard') {
      handleDashboardClick();
    } else if (item.href === '#cart') {
      navigateTo('cart');
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
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } else {
        if (elementId === 'categories') {
          navigateTo('categories');
        } else {
          navigateTo('landing');
          setTimeout(() => {
            const el = document.getElementById(elementId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
  };

  const baseNavItems = [
    { label: 'Explore',     icon: <Compass size={14} color="#7B3FA0" />,       href: '#products' },
    { label: 'Categories',  icon: <Sparkles size={14} color="#7B3FA0" />,      href: '#categories' },
    { label: 'Showcase',    icon: <Home size={14} color="#7B3FA0" />,          href: '#home' },
  ];

  return (
    <header 
      className="lumora-navbar-header"
      style={{
        position: 'fixed',
        top: scrolled ? '0.5rem' : '0.85rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: scrolled ? 'min(1200px, 92%)' : 'min(1340px, 94%)',
        zIndex: 999999,
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'visible',
      }}
    >
      <div 
        className="glass-surface lumora-navbar-inner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: scrolled ? '6px 18px' : '8px 24px',
          borderRadius: '100px',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.20), inset 0 1px 0 rgba(255, 255, 255, 1)',
          border: '1.5px solid rgba(255, 255, 255, 0.95)',
          position: 'relative',
          overflow: 'visible',
          zIndex: 999999,
        }}
      >
        {/* Brand Logo */}
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); navigateTo('landing'); }}
          className="text-editorial lumora-navbar-logo"
          style={{
            fontSize: '1.5rem', fontWeight: 600, textDecoration: 'none',
            color: '#2D004D', letterSpacing: '-0.03em',
            display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
          }}
        >
          Lumora
        </a>

        {/* Desktop Navigation Links */}
        <nav
          className="nav-menu"
          style={{ display: 'flex', alignItems: 'center', gap: '24px', overflow: 'visible', position: 'relative', zIndex: 999999 }}
        >
          {baseNavItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              style={{
                fontSize: '0.82rem', fontWeight: 700,
                color: '#2D004D', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '5px',
                position: 'relative', padding: '4px 0',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#7B3FA0';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#2D004D';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(0)';
              }}
            >
              {item.icon}
              {item.label}
              <span
                className="dot"
                style={{
                  position: 'absolute', bottom: -3, left: '50%',
                  transform: 'translateX(-50%) scale(0)',
                  width: '4px', height: '4px', borderRadius: '50%',
                  backgroundColor: '#7B3FA0',
                  transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                  transformOrigin: 'center center',
                }}
              />
            </a>
          ))}

          {/* Partnership Dropdown */}
          <div
            ref={dropdownRef}
            style={{ position: 'relative', overflow: 'visible', zIndex: 999999 }}
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(o => !o);
              }}
              aria-expanded={dropdownOpen}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: dropdownOpen ? '#7B3FA0' : '#2D004D',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 0',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                fontFamily: 'inherit',
              }}
            >
              <Users size={14} color="#7B3FA0" />
              Partnership
              <ChevronDown
                size={12}
                style={{
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: 0.85
                }}
              />
            </button>

            {/* Partnership Dropdown Panel */}
            {dropdownOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  minWidth: '250px',
                  paddingTop: '8px',
                  zIndex: 9999999,
                  animation: 'lumoraNavDropdownFadeIn 0.20s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(30px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                    borderRadius: '18px',
                    padding: '8px',
                    boxShadow: '0 20px 60px rgba(45, 0, 77, 0.25), 0 4px 16px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 1)',
                    border: '1.5px solid rgba(255, 255, 255, 0.95)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {/* Affiliate Link -> New Tab */}
                  <a
                    href="/partnership/affiliate"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: '#2D004D',
                      transition: 'all 0.2s ease',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(123, 63, 160, 0.08)';
                      e.currentTarget.style.transform = 'translateX(3px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: 'rgba(123, 63, 160, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#7B3FA0',
                      flexShrink: 0
                    }}>
                      <TrendingUp size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D004D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        Affiliate <ExternalLink size={11} style={{ opacity: 0.6 }} />
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#665C70', marginTop: '1px' }}>
                        Earn commissions on sales
                      </span>
                    </div>
                  </a>

                  {/* Vendor Link -> New Tab */}
                  {vendor_enabled !== false && (
                    <a
                      href="/partnership/vendor"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        textDecoration: 'none',
                        color: '#2D004D',
                        transition: 'all 0.2s ease',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(123, 63, 160, 0.08)';
                        e.currentTarget.style.transform = 'translateX(3px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        background: 'rgba(123, 63, 160, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#7B3FA0',
                        flexShrink: 0
                      }}>
                        <Store size={16} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D004D', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          Vendor <ExternalLink size={11} style={{ opacity: 0.6 }} />
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#665C70', marginTop: '1px' }}>
                          Sell templates & digital products
                        </span>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <a
              href="#dashboard"
              onClick={(e) => handleNavClick(e, { href: '#dashboard' })}
              style={{
                fontSize: '0.82rem', fontWeight: 700,
                color: '#2D004D', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: '5px',
                position: 'relative', padding: '4px 0',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#7B3FA0';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#2D004D';
                const dot = e.currentTarget.querySelector('.dot');
                if (dot) dot.style.transform = 'translateX(-50%) scale(0)';
              }}
            >
              <LayoutDashboard size={14} color="#7B3FA0" />
              Dashboard
              <span
                className="dot"
                style={{
                  position: 'absolute', bottom: -3, left: '50%',
                  transform: 'translateX(-50%) scale(0)',
                  width: '4px', height: '4px', borderRadius: '50%',
                  backgroundColor: '#7B3FA0',
                  transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
                  transformOrigin: 'center center',
                }}
              />
            </a>
          )}
        </nav>

        {/* Action Button */}
        <div className="lumora-navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user ? (
            <>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); handleLogout(); }}
                className="text-sans lumora-navbar-signin"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#2D004D',
                  textDecoration: 'none',
                  transition: 'opacity 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#7B3FA0'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#2D004D'}
              >
                Sign Out
              </a>
              
              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); handleDashboardClick(); }}
                className="btn-premium btn-shine-sweep lumora-navbar-cta"
                style={{
                  padding: scrolled ? '6px 16px' : '8px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(90, 30, 126, 0.25)',
                  willChange: 'transform',
                  cursor: 'pointer'
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                Enter Lumora <ArrowUpRight size={13} style={{ opacity: 0.8 }} />
              </a>
            </>
          ) : (
            <>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigateTo('login', 'customer'); }}
                className="text-sans lumora-navbar-signin"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#2D004D',
                  textDecoration: 'none',
                  transition: 'opacity 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#7B3FA0'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#2D004D'}
              >
                Sign In
              </a>
              
              <a 
                href="#"
                onClick={(e) => { e.preventDefault(); navigateTo('register', 'customer'); }}
                className="btn-premium btn-shine-sweep lumora-navbar-cta"
                style={{
                  padding: scrolled ? '6px 16px' : '8px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 16px rgba(90, 30, 126, 0.25)',
                  willChange: 'transform',
                  cursor: 'pointer'
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                Get Started <ArrowUpRight size={13} style={{ opacity: 0.8 }} />
              </a>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className={`lumora-nav-hamburger${mobileOpen ? ' open' : ''}`}
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <span style={{ background: '#2D004D' }} />
          <span style={{ background: '#2D004D' }} />
          <span style={{ background: '#2D004D' }} />
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div
          ref={mobileRef}
          className="lumora-mobile-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            left: 0,
            right: 0,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(30px)',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.95)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            zIndex: 10000,
          }}
        >
          {navItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#2D004D',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 0',
              }}
            >
              {item.icon}
              {item.label}
            </a>
          ))}

          {/* Partnership Portals Group in Mobile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0', borderTop: '1px solid rgba(123, 63, 160, 0.15)', borderBottom: '1px solid rgba(123, 63, 160, 0.15)', margin: '4px 0' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} /> Partnership Portals
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '8px' }}>
              <a
                href="/partnership/affiliate"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobile}
                style={{
                  fontSize: '0.90rem',
                  fontWeight: 700,
                  color: '#2D004D',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  background: 'rgba(123, 63, 160, 0.06)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={14} color="#7B3FA0" /> Affiliate Portal
                </span>
                <ExternalLink size={12} style={{ opacity: 0.6 }} />
              </a>

              {vendor_enabled !== false && (
                <a
                  href="/partnership/vendor"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobile}
                  style={{
                    fontSize: '0.90rem',
                    fontWeight: 700,
                    color: '#2D004D',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    background: 'rgba(123, 63, 160, 0.06)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Store size={14} color="#7B3FA0" /> Vendor Portal
                  </span>
                  <ExternalLink size={12} style={{ opacity: 0.6 }} />
                </a>
              )}
            </div>
          </div>

          {user ? (
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '12px',
                background: 'rgba(225, 29, 72, 0.10)',
                color: '#E11D48',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => { closeMobile(); navigateTo('login', 'customer'); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'rgba(123, 63, 160, 0.10)',
                  color: '#7B3FA0',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Sign In
              </button>
              <button
                onClick={() => { closeMobile(); navigateTo('register', 'customer'); }}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes lumoraNavDropdownFadeIn {
          from { opacity: 0; transform: translate(-50%, -8px) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
      `}</style>
    </header>
  );
}
