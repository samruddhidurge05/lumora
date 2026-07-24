import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, DollarSign, User,
  LogOut, Link2, BarChart2, ShoppingBag, ChevronRight,
  Menu, X, RefreshCw, AlertCircle, HelpCircle, ArrowLeft
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import AffiliateDashboardHome from './Dashboard';
import AffiliateProducts       from './Products';
import AffiliateEarnings       from './Earnings';
import AffiliateProfile        from './Profile';
import SupportCenter           from '../customer/SupportCenter';
import { AffiliateCartProvider, useAffiliateCart } from '../../context/AffiliateCartContext';
import AffiliateCartDrawer from '../../components/affiliate/AffiliateCartDrawer';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',  icon: <LayoutDashboard size={17} /> },
  { id: 'products',  label: 'Products',   icon: <ShoppingBag size={17} />     },
  { id: 'earnings',  label: 'Earnings',   icon: <BarChart2 size={17} />       },
  { id: 'profile',   label: 'Profile',    icon: <User size={17} />            },
  { id: 'support',   label: 'Support',    icon: <HelpCircle size={17} />      },
];

export default function AffiliateDashboard() {
  return (
    <AffiliateCartProvider>
      <AffiliateDashboardInner />
    </AffiliateCartProvider>
  );
}

function AffiliateDashboardInner() {
  const { navigateTo } = useApp();
  const { affCart, affCartCount, setIsAffCartOpen } = useAffiliateCart();
  const { user, loading, logout, isAccountDisabled, isPlatformPaused } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash;
    const parts = hash.split('/');
    const sub = parts[1];
    const valid = ['dashboard','products','earnings','profile', 'support'];
    return valid.includes(sub) ? sub : 'dashboard';
  });
  const [scrolled, setScrolled]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live API State
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [commissions, setCommissions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const isSuspended = isAccountDisabled;

  const loadAffiliateData = async () => {
    try {
      setApiLoading(true);
      setApiError(null);
      const [pRes, sRes, cRes, payRes] = await Promise.all([
        backendFetch('/affiliate/profile').catch(() => null),
        backendFetch('/affiliate/stats').catch(() => null),
        backendFetch('/affiliate/commissions').catch(() => []),
        backendFetch('/affiliate/payouts').catch(() => []),
      ]);
      setProfile(pRes);
      setStats(sRes);
      setCommissions(Array.isArray(cRes) ? cRes : []);
      setPayouts(Array.isArray(payRes) ? payRes : []);
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
      setApiError(err.message || 'Failed to load affiliate portal records.');
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    setProfile(null);
    setStats(null);
    setCommissions([]);
    setPayouts([]);
    setApiLoading(true);
    setApiError(null);

    if (user) {
      loadAffiliateData();
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login?role=affiliate', { replace: true });
    }
  }, [user, loading, navigate]);

  // Update hash when tab changes
  useEffect(() => {
    window.location.hash = `#affiliate/${activeTab}`;
  }, [activeTab]);

  // Listen for tab-change events dispatched by Dashboard home buttons (via navigateTo)
  useEffect(() => {
    const handleTabChange = (e) => {
      const tab = e.detail;
      const valid = ['dashboard', 'products', 'earnings', 'profile', 'support'];
      if (valid.includes(tab)) {
        setActiveTab(tab);
      }
    };
    window.addEventListener('affiliate-tab-change', handleTabChange);
    return () => window.removeEventListener('affiliate-tab-change', handleTabChange);
  }, []);

  // Scroll tracking for navbar shrink
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleExit = async () => {
    try { await logout(); } catch (e) { /* ignore */ }
    navigate('/');
  };

  // Don't render until auth resolved
  if (loading || !user) return null;

  const renderContent = () => {
    const commonProps = {
      profile,
      stats,
      commissions,
      payouts,
      loading: apiLoading,
      error: apiError,
      refresh: loadAffiliateData,
    };
    switch (activeTab) {
      case 'products': return <AffiliateProducts {...commonProps} />;
      case 'earnings': return <AffiliateEarnings {...commonProps} />;
      case 'profile':  return <AffiliateProfile {...commonProps} />;
      case 'support':  return <SupportCenter />;
      default:         return <AffiliateDashboardHome {...commonProps} />;
    }
  };

  const PAGE_TITLES = {
    dashboard: 'Overview',
    products:  'Products & Links',
    earnings:  'Earnings',
    profile:   'Profile',
    support:   'Support Center',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'transparent',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      display: 'flex',
      position: 'relative',
    }}>
      {/* ── Affiliate Cart Drawer ── */}
      <AffiliateCartDrawer />

      {/* ── SIDEBAR (desktop) ─────────────────────────────────────────── */}
      <aside style={{
        width: '240px',
        minHeight: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(32px) saturate(200%)',
        WebkitBackdropFilter: 'blur(32px) saturate(200%)',
        borderRight: '1px solid rgba(196,181,253,0.22)',
        boxShadow: '4px 0 24px rgba(45,0,96,0.04)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0',
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        transform: sidebarOpen ? 'translateX(0)' : undefined,
      }} className={`aff-sidebar${sidebarOpen ? ' open' : ''}`}>

        {/* Logo */}
        <div style={{
          padding: '28px 24px 20px',
          borderBottom: '1px solid rgba(196,181,253,0.16)',
        }}>
          <button
            onClick={handleExit}
            style={{ background: 'none', border: 'none', outline: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0 }}
          >
            <span style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.85rem', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 800,
              boxShadow: '0 4px 14px rgba(90,30,126,0.40)',
              flexShrink: 0,
            }}>L</span>
            <span className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 500, color: '#3b0764', letterSpacing: '-0.03em' }}>
              Lumora
            </span>
          </button>
          <div style={{ marginTop: '12px', padding: '6px 10px', borderRadius: '8px', background: 'rgba(123,63,160,0.05)', border: '1px solid rgba(196,181,253,0.22)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', letterSpacing: '0.04em' }}>AFFILIATE PORTAL</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '11px 14px',
                  borderRadius: '12px',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(123,63,160,0.12), rgba(90,30,126,0.06))'
                    : 'transparent',
                  color: isActive ? '#7B3FA0' : 'var(--text-secondary)',
                  borderLeft: isActive ? '2px solid #7B3FA0' : '2px solid transparent',
                  transition: 'all 0.22s',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(123,63,160,0.04)'; e.currentTarget.style.color = '#7B3FA0'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
              >
                <span style={{ color: isActive ? '#7B3FA0' : 'var(--text-muted)', transition: 'color 0.22s', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && <ChevronRight size={13} style={{ color: '#7B3FA0', opacity: 0.6 }} />}
              </button>
            );
          })}
        </nav>

        {/* Bottom: Exit */}
        <div style={{ padding: '16px 14px 28px', borderTop: '1px solid rgba(196,181,253,0.16)' }}>
          <button
            onClick={handleExit}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '12px',
              border: 'none', outline: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '0.84rem', fontWeight: 600,
              color: 'var(--text-muted)', background: 'transparent',
              width: '100%', textAlign: 'left',
              transition: 'all 0.22s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,0,96,0.03)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <LogOut size={16} />
            Exit Dashboard
          </button>
        </div>
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(45,0,77,0.30)', backdropFilter: 'blur(8px)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: '240px', minHeight: '100vh', position: 'relative', zIndex: 10, minWidth: 0, maxWidth: '100vw', overflowX: 'hidden' }} className="aff-main-area">

        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: scrolled ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(28px) saturate(200%)',
          WebkitBackdropFilter: 'blur(28px) saturate(200%)',
          borderBottom: '1px solid rgba(196,181,253,0.16)',
          boxShadow: scrolled ? '0 2px 16px rgba(45,0,96,0.06)' : 'none',
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.3s',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="aff-hamburger"
            style={{ display: 'none', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, flexShrink: 0 }}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(196,181,253,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#7B3FA0', cursor: 'pointer', transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.12)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.25)'; }}
                title="Back to Dashboard"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Affiliate Dashboard</span>
              <h1 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.1, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isSuspended ? "Account Suspended" : PAGE_TITLES[activeTab]}
              </h1>
            </div>
          </div>

          {/* Right: breadcrumb + quick actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Affiliate Cart Button */}
            <button
              onClick={() => setIsAffCartOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '20px',
                border: '1px solid rgba(196,181,253,0.35)',
                background: affCartCount > 0 ? 'linear-gradient(135deg, rgba(123,63,160,0.10), rgba(90,30,126,0.05))' : 'rgba(255,255,255,0.80)',
                color: '#7B3FA0',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s',
                position: 'relative',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = affCartCount > 0 ? 'linear-gradient(135deg, rgba(123,63,160,0.10), rgba(90,30,126,0.05))' : 'rgba(255,255,255,0.80)'; }}
            >
              <ShoppingBag size={12} />
              <span>Cart</span>
              {affCartCount > 0 && (
                <span style={{
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  color: '#fff', fontSize: '0.6rem', fontWeight: 800,
                  minWidth: '16px', height: '16px', borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                }}>{affCartCount}</span>
              )}
            </button>

          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '36px 40px', maxWidth: '1200px', width: '100%', boxSizing: 'border-box', overflowX: 'hidden', minWidth: 0 }}>
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
                width: '80px',
                height: '80px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                onClick={handleExit}
                style={{
                  background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                  border: 'none',
                  color: '#fff',
                  padding: '12px 36px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                  marginBottom: '24px',
                  padding: '20px 24px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.10), rgba(29,78,216,0.10))',
                  border: '1px solid rgba(37,99,235,0.30)',
                  boxShadow: '0 8px 32px rgba(37,99,235,0.08)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(37,99,235,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
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

              <div style={{ animation: 'affPageIn 0.45s cubic-bezier(0.16,1,0.3,1)' }} key={activeTab}>
                {renderContent()}
              </div>
            </>
          )}
        </main>
      </div>

      <style>{`
        @keyframes affPageIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          .aff-sidebar {
            transform: translateX(-100%);
            z-index: 100 !important;
          }
          .aff-sidebar.open {
            transform: translateX(0);
          }
          .aff-main-area {
            margin-left: 0 !important;
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          .aff-main-area header {
            padding: 12px 14px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .aff-main-area main {
            padding: 16px 14px 40px !important;
            max-width: 100vw !important;
            width: 100% !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }
          .aff-hamburger {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
