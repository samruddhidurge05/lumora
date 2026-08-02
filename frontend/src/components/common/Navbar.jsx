import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Compass, Users, LayoutDashboard, ArrowUpRight, Home, TrendingUp, ChevronDown, Store, ExternalLink, User, Heart, Download, CreditCard, Settings as SettingsIcon, LogOut, Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function Navbar() {
  const { navigateTo, currentView, cart, platformStatus, setDashboardTab } = useApp();
  const isPlatformPaused = platformStatus?.isPlatformPaused;
  const { user, logout, logoutRole } = useAuth();
  const { vendor_enabled } = useFeatureFlags();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const mobileRef = useRef(null);
  const dropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu & dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile menu when navigating
  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    if (typeof logoutRole === 'function') {
      await logoutRole('customer');
    } else {
      await logout();
    }
    navigate('/');
    closeMobile();
  };

  const handleDashboardClick = async () => {
    setUserMenuOpen(false);
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

  const handleProfileNav = async () => {
    setUserMenuOpen(false);
    closeMobile();
    if (!user) return;
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'vendor') navigate('/vendor/profile');
      else if (role === 'affiliate') navigate('/affiliate/dashboard');
      else if (role === 'admin') navigate('/admin/settings');
      else {
        setDashboardTab('Settings');
        navigate('/customer/dashboard');
      }
    } catch {
      setDashboardTab('Settings');
      navigate('/customer/dashboard');
    }
  };

  const handleOrdersNav = async () => {
    setUserMenuOpen(false);
    closeMobile();
    if (!user) return;
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'vendor') navigate('/vendor/orders');
      else if (role === 'admin') navigate('/admin/orders');
      else {
        setDashboardTab('Orders');
        navigate('/customer/dashboard');
      }
    } catch {
      setDashboardTab('Orders');
      navigate('/customer/dashboard');
    }
  };

  const handleWishlistNav = () => {
    setUserMenuOpen(false);
    closeMobile();
    navigateTo('wishlist');
  };

  const handleDownloadsNav = () => {
    setUserMenuOpen(false);
    closeMobile();
    navigateTo('downloads');
  };

  const handleSettingsNav = async () => {
    setUserMenuOpen(false);
    closeMobile();
    if (!user) return;
    try {
      const activeRole = localStorage.getItem('lumora_active_role');
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
      if (role === 'admin') navigate('/admin/settings');
      else if (role === 'vendor') navigate('/vendor/store-settings');
      else {
        setDashboardTab('Settings');
        navigate('/customer/dashboard');
      }
    } catch {
      setDashboardTab('Settings');
      navigate('/customer/dashboard');
    }
  };

  const handleLogoutNav = async () => {
    setUserMenuOpen(false);
    await handleLogout();
  };

  const displayName = user?.displayName || user?.name || '';
  const displayEmail = user?.email || '';
  const displayLabel = displayName || (displayEmail ? (displayEmail.length > 15 ? displayEmail.slice(0, 12) + '...' : displayEmail) : 'Account');
  const initial = (displayName || displayEmail || 'U')[0].toUpperCase();

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

        {/* Action Area */}
        <div className="lumora-navbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user ? (
            /* Authenticated User Profile Pill & Dropdown */
            <div
              ref={profileDropdownRef}
              style={{ position: 'relative', overflow: 'visible', zIndex: 999999 }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUserMenuOpen(o => !o);
                }}
                aria-expanded={userMenuOpen}
                aria-label="User menu"
                className="lumora-profile-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px 4px 5px',
                  borderRadius: '100px',
                  background: userMenuOpen ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: userMenuOpen ? '1.5px solid rgba(123, 63, 160, 0.50)' : '1.5px solid rgba(123, 63, 160, 0.25)',
                  boxShadow: userMenuOpen ? '0 6px 20px rgba(90, 30, 126, 0.15)' : '0 4px 16px rgba(45, 0, 77, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.98)';
                  e.currentTarget.style.borderColor = 'rgba(123, 63, 160, 0.45)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(90, 30, 126, 0.15)';
                }}
                onMouseLeave={(e) => {
                  if (!userMenuOpen) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.85)';
                    e.currentTarget.style.borderColor = 'rgba(123, 63, 160, 0.25)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(45, 0, 77, 0.08)';
                  }
                }}
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayName || 'User'}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid rgba(123, 63, 160, 0.4)',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(90, 30, 126, 0.3)',
                    }}
                  >
                    {initial}
                  </div>
                )}

                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#2D004D',
                    whiteSpace: 'nowrap',
                    maxWidth: '130px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayLabel}
                </span>

                <ChevronDown
                  size={12}
                  style={{
                    color: '#7B3FA0',
                    transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    opacity: 0.85,
                  }}
                />
              </button>

              {/* User Menu Dropdown Panel */}
              {userMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: '240px',
                    zIndex: 9999999,
                    animation: 'lumoraNavDropdownFadeIn 0.20s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.98)',
                      backdropFilter: 'blur(30px) saturate(200%)',
                      WebkitBackdropFilter: 'blur(30px) saturate(200%)',
                      borderRadius: '20px',
                      padding: '12px',
                      boxShadow: '0 20px 60px rgba(45, 0, 77, 0.22), 0 4px 16px rgba(0, 0, 0, 0.10), inset 0 1px 0 rgba(255, 255, 255, 1)',
                      border: '1.5px solid rgba(255, 255, 255, 0.95)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {/* User Profile Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 10px 12px 10px',
                        borderBottom: '1px solid rgba(123, 63, 160, 0.12)',
                        marginBottom: '4px',
                      }}
                    >
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={displayName || 'User'}
                          style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(123, 63, 160, 0.4)', flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D004D', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {displayName || 'Lumora Member'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#665C70', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {displayEmail}
                        </span>
                      </div>
                    </div>

                    {/* Menu Items scoped by active role */}
                    {(() => {
                      const activeRole = (() => {
                        if (window.location.pathname.startsWith('/affiliate')) return 'affiliate';
                        if (window.location.pathname.startsWith('/vendor')) return 'vendor';
                        if (window.location.pathname.startsWith('/admin')) return 'admin';
                        const savedRole = localStorage.getItem('lumora_active_role');
                        if (savedRole && ['customer', 'affiliate', 'vendor', 'admin'].includes(savedRole)) return savedRole;
                        if (localStorage.getItem('lumora_token_affiliate') && !localStorage.getItem('lumora_token_customer')) return 'affiliate';
                        if (localStorage.getItem('lumora_token_vendor') && !localStorage.getItem('lumora_token_customer')) return 'vendor';
                        if (localStorage.getItem('lumora_token_admin') && !localStorage.getItem('lumora_token_customer')) return 'admin';
                        return 'customer';
                      })();

                      let items = [];
                      if (activeRole === 'affiliate') {
                        items = [
                          { label: 'Affiliate Dashboard', icon: <LayoutDashboard size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/affiliate/dashboard'); } },
                          { label: 'Profile & Settings', icon: <User size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/affiliate/dashboard'); } },
                        ];
                      } else if (activeRole === 'vendor') {
                        items = [
                          { label: 'Vendor Dashboard', icon: <LayoutDashboard size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/vendor/dashboard'); } },
                          { label: 'Store Settings', icon: <SettingsIcon size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/vendor/store-settings'); } },
                        ];
                      } else if (activeRole === 'admin') {
                        items = [
                          { label: 'Admin Dashboard', icon: <LayoutDashboard size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/admin/dashboard'); } },
                          { label: 'Platform Settings', icon: <SettingsIcon size={15} color="#7B3FA0" />, onClick: () => { setUserMenuOpen(false); navigate('/admin/settings'); } },
                        ];
                      } else {
                        // Customer Role (Default)
                        items = [
                          { label: 'Dashboard', icon: <LayoutDashboard size={15} color="#7B3FA0" />, onClick: handleDashboardClick },
                          { label: 'Profile',   icon: <User size={15} color="#7B3FA0" />,           onClick: handleProfileNav },
                          { label: 'Orders',    icon: <CreditCard size={15} color="#7B3FA0" />,     onClick: handleOrdersNav },
                          { label: 'Wishlist',  icon: <Heart size={15} color="#7B3FA0" />,          onClick: handleWishlistNav },
                          { label: 'Downloads', icon: <Download size={15} color="#7B3FA0" />,       onClick: handleDownloadsNav },
                          { label: 'Settings',  icon: <SettingsIcon size={15} color="#7B3FA0" />,   onClick: handleSettingsNav },
                        ];
                      }

                      return items.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={item.onClick}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '12px',
                            background: 'transparent',
                            border: 'none',
                            color: '#2D004D',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.18s ease',
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(123, 63, 160, 0.08)';
                            e.currentTarget.style.transform = 'translateX(2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.transform = 'translateX(0)';
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      ));
                    })()}

                    {/* Logout Option */}
                    <div style={{ borderTop: '1px solid rgba(123, 63, 160, 0.12)', marginTop: '4px', paddingTop: '4px' }}>
                      <button
                        type="button"
                        onClick={handleLogoutNav}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '12px',
                          background: 'transparent',
                          border: 'none',
                          color: '#E11D48',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'all 0.18s ease',
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(225, 29, 72, 0.08)';
                          e.currentTarget.style.transform = 'translateX(2px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <LogOut size={15} color="#E11D48" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Unauthenticated Enter Lumora CTA Button */
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
                onClick={(e) => { e.preventDefault(); navigateTo('login', 'customer'); }}
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
          {baseNavItems.map((item, index) => (
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(123, 63, 160, 0.15)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '12px', background: 'rgba(123, 63, 160, 0.06)' }}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={displayName || 'User'} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                    {initial}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D004D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName || 'Lumora Member'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#665C70', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayEmail}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={handleDashboardClick} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><LayoutDashboard size={14} color="#7B3FA0" /> Dashboard</button>
                <button onClick={handleProfileNav} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><User size={14} color="#7B3FA0" /> Profile</button>
                <button onClick={handleOrdersNav} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><CreditCard size={14} color="#7B3FA0" /> Orders</button>
                <button onClick={handleWishlistNav} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><Heart size={14} color="#7B3FA0" /> Wishlist</button>
                <button onClick={handleDownloadsNav} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><Download size={14} color="#7B3FA0" /> Downloads</button>
                <button onClick={handleSettingsNav} style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.06)', border: 'none', color: '#2D004D', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}><SettingsIcon size={14} color="#7B3FA0" /> Settings</button>
              </div>

              <button
                onClick={handleLogoutNav}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
              >
                <LogOut size={15} /> Logout
              </button>
            </div>
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
                onClick={() => { closeMobile(); navigateTo('login', 'customer'); }}
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                Enter Lumora <ArrowUpRight size={14} />
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
