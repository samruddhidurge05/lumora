import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X } from 'lucide-react';
import '../styles/vendor.css';

export default function VendorLayout({ activePage, title, subtitle, actions, children }) {
  const { user, logout, isAccountDisabled, isPlatformPaused } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSuspended = isAccountDisabled;

  // Close sidebar on route change / resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 900) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    try { await logout(); } catch (_) {}
    navigate('/');
  };

  const handleProfileClick = (e) => {
    e.preventDefault();
    navigate('/vendor/profile');
    setSidebarOpen(false);
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Creator';
  const initials = displayName[0]?.toUpperCase() || 'V';

  return (
    <div className="vendor-shell">

      {/* ── Top Navigation Bar ── */}
      <header className="vendor-topnav">
        <div className="vendor-topnav-inner">

          {/* Hamburger — mobile only */}
          <button
            className={`vendor-hamburger${sidebarOpen ? ' open' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            <span /><span /><span />
          </button>

          {/* Brand */}
          <a href="/" onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            textDecoration: 'none', cursor: 'pointer',
          }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '0.85rem',
              boxShadow: '0 4px 14px rgba(90,30,126,0.40)', flexShrink: 0,
            }}>L</span>
            <span className="text-editorial" style={{
              fontSize: '1.5rem', fontWeight: 500,
              color: 'var(--text-primary)', letterSpacing: '-0.03em',
            }}>
              Lumora
            </span>
            <span className="vendor-brand-badge">Seller Console</span>
          </a>

          {/* Right: profile + exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Avatar */}
            <a href="/vendor/profile" onClick={handleProfileClick} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              textDecoration: 'none', cursor: 'pointer',
              padding: '6px 12px', borderRadius: '30px',
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(196,148,230,0.28)',
              transition: 'all 0.22s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.78)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.borderColor = 'rgba(196,148,230,0.28)'; }}
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt={displayName} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(196,148,230,0.45)' }} />
              ) : (
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0 }}>
                  {initials}
                </div>
              )}
              <span className="vendor-topnav-username" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {displayName}
              </span>
            </a>

            {/* Exit */}
            <button onClick={handleLogout} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '7px 14px', borderRadius: '20px',
              border: '1px solid rgba(196,148,230,0.28)',
              background: 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
              transition: 'all 0.22s', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.82)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              Exit Console
            </button>
          </div>
        </div>
      </header>

      {/* ── Main layout grid ── */}
      <div className="vendor-layout-grid">

        {/* Overlay — mobile only */}
        <div
          className={`vendor-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Sidebar — static on desktop, drawer on mobile */}
        <aside className={`vendor-sidebar${sidebarOpen ? ' open' : ''}`}>
          <Sidebar activePage={activePage} />
        </aside>

        {/* Main content */}
        <div className="vendor-main-content">
          {/* Page header */}
          {(title || subtitle || actions) && (
            <header className="vendor-page-header">
              <div className="vendor-header-row">
                <div>
                  <span className="vendor-header-pre">Vendor Console</span>
                  {title && <h1 className="vendor-page-title">{isSuspended ? "Account Suspended" : title}</h1>}
                  {subtitle && <p className="vendor-page-sub">{isSuspended ? "Your account access has been restricted by platform administration." : subtitle}</p>}
                </div>
                {actions && !isSuspended && <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>{actions}</div>}
              </div>
            </header>
          )}

          {/* Animated page body */}
          <div className="vendor-page-body" style={{ animation: 'vendorPageIn 0.55s cubic-bezier(0.16,1,0.3,1)' }}>
            {isSuspended ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.45)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                padding: '48px 32px',
                borderRadius: '24px',
                textAlign: 'center',
                maxWidth: '520px',
                margin: '40px auto',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.05)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                fontFamily: 'var(--font-sans)',
                color: 'var(--text-primary)',
              }}>
                <div style={{
                  width: '80px', height: '80px',
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.2)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                  color: '#ef4444',
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em', color: '#dc2626', textTransform: 'uppercase' }}>ACCOUNT SUSPENDED</h2>
                <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '8px', fontWeight: 600 }}>
                  Your account has been disabled by the Platform Administrator.
                </p>
                <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: '12px', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason:</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
                    Platform access has been suspended.
                  </p>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '32px', fontWeight: 500 }}>
                  Please contact support for assistance.
                </p>
                <button
                  onClick={handleLogout}
                  style={{
                    background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                    border: 'none', color: '#fff',
                    padding: '12px 36px', fontSize: '0.85rem', fontWeight: 700,
                    borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(123, 63, 160, 0.2)',
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                {isPlatformPaused && (
                  <div style={{
                    marginBottom: '24px', padding: '20px 24px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(29,78,216,0.10))',
                    border: '1px solid rgba(37,99,235,0.30)',
                    boxShadow: '0 8px 32px rgba(37,99,235,0.08)',
                    backdropFilter: 'blur(16px)',
                    display: 'flex', alignItems: 'center', gap: '16px',
                  }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: 'rgba(37,99,235,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Platform Paused
                      </h3>
                      <p style={{ margin: 0, color: '#1d4ed8', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.4 }}>
                        Platform is currently under maintenance. Business operations are temporarily suspended.
                      </p>
                    </div>
                  </div>
                )}
                {children}
              </>
            )}
          </div>
          <style>{`@keyframes vendorPageIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
      </div>
    </div>
  );
}
