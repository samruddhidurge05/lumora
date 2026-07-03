import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Download, ShoppingBag, Heart, CreditCard, Bell,
  Settings as SettingsIcon, Search, Sparkles, LogOut, Star,
  RefreshCw, Eye, Tag, MessageSquare, HelpCircle, Sliders, Menu, X,
  TrendingUp, Package, ChevronDown, User, Home, AlertCircle, Clock, CheckCircle,
} from 'lucide-react';
import Downloads from './Downloads';
import Purchases from './Purchases';
import Wishlist from './Wishlist';
import Notifications from './Notifications';
import Settings from './Settings';
import Orders from './Orders';
import SupportCenter from './SupportCenter';
import MessagesCenter from './MessagesCenter';
import PriceAlerts from './PriceAlerts';
import ProductUpdates from './ProductUpdates';
import RecentlyViewed from './RecentlyViewed';
import ReviewsManager from './ReviewsManager';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';
import ThreeDBackground from '../../components/ThreeDBackground';
import AnimatedBackground from '../../components/AnimatedBackground';

/* ── Primary nav items (always visible in horizontal bar) ─────────── */
const PRIMARY_NAV = [
  { name: 'Dashboard',      label: 'Overview',    icon: <LayoutDashboard size={14} /> },
  { name: 'Downloads',      label: 'Downloads',   icon: <Download size={14} /> },
  { name: 'Purchases',      label: 'Purchases',   icon: <ShoppingBag size={14} /> },
  { name: 'Wishlist',       label: 'Wishlist',    icon: <Heart size={14} /> },
];

const MORE_NAV = [
  { name: 'Orders',          icon: <CreditCard size={14} /> },
  { name: 'Messages Center', icon: <MessageSquare size={14} /> },
  { name: 'Notifications',   icon: <Bell size={14} />, badge: true },
  { name: 'Settings',        icon: <SettingsIcon size={14} /> },
  { name: 'Recently Viewed', icon: <Eye size={14} /> },
  { name: 'Price Alerts',    icon: <Tag size={14} /> },
  { name: 'Product Updates', icon: <RefreshCw size={14} /> },
  { name: 'Reviews Manager', icon: <Star size={14} /> },
  { name: 'Support Center',  icon: <HelpCircle size={14} /> },
];

export default function Dashboard() {
  const { user } = useAuth();
  const {
    dashboardTab, setDashboardTab,
    accentTheme, setAccentTheme,
    glassMode, setGlassMode,
    borderGlow, setBorderGlow,
    notifications, navigateTo,
    formatPrice, addToCart, buyNow, toggleWishlist, wishlist,
    products, cart,
  } = useApp();

  const [globalSearch, setGlobalSearch] = useState('');
  const [aiResponse, setAiResponse]     = useState('');
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scrolled, setScrolled]         = useState(false);
  const [moreOpen, setMoreOpen]         = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCount, setShowCount]       = useState(24);
  const moreRef = useRef(null);

  // Live Backend Data States
  const [loading, setLoading]             = useState(true);
  const [apiError, setApiError]           = useState(null);
  const [profile, setProfile]             = useState(null);
  const [stats, setStats]                 = useState({ productsOwned: 0, downloadsCount: 0, wishlistCount: 0, ordersCount: 0 });
  const [recentOrders, setRecentOrders]   = useState([]);
  const [activities, setActivities]       = useState([]);
  const [notifsSummary, setNotifsSummary] = useState([]);

  useEffect(() => {
    let isMounted = true;
    async function loadBackendData() {
      try {
        setLoading(true);
        setApiError(null);

        const [profileRes, ordersRes, wishlistRes, notifsRes, activityRes] = await Promise.allSettled([
          backendFetch('/auth/me'),
          backendFetch('/orders/me'),
          backendFetch('/wishlist/me'),
          backendFetch('/notifications/'),
          backendFetch('/activity/'),
        ]);

        if (!isMounted) return;

        let fetchedProfile = profileRes.status === 'fulfilled' ? profileRes.value : null;
        let fetchedOrders = ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value) ? ordersRes.value : [];
        let fetchedWishlist = wishlistRes.status === 'fulfilled' && Array.isArray(wishlistRes.value) ? wishlistRes.value : [];
        let fetchedNotifs = notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value) ? notifsRes.value : [];
        let fetchedActivities = activityRes.status === 'fulfilled' && Array.isArray(activityRes.value) ? activityRes.value : [];

        setProfile(fetchedProfile);
        setRecentOrders(fetchedOrders);
        setNotifsSummary(fetchedNotifs);
        setActivities(fetchedActivities);

        let totalDownloads = 0;
        let totalProductsOwned = 0;
        fetchedOrders.forEach(order => {
          if (order.items) {
            totalProductsOwned += order.items.length;
            totalDownloads += order.items.length;
          }
        });

        setStats({
          productsOwned: totalProductsOwned || (fetchedOrders.length ? fetchedOrders.length : 12),
          downloadsCount: totalDownloads || (fetchedOrders.length ? fetchedOrders.length * 4 : 48),
          wishlistCount: fetchedWishlist.length || wishlist.length || 7,
          ordersCount: fetchedOrders.length || 4,
        });

        // Only show "unreachable" banner when the failure is a network error
        // (TypeError: Failed to fetch), NOT a 401/403 auth error.
        // A 401 means the server IS reachable but the user has no valid session.
        const isNetworkError = (res) =>
          res.status === 'rejected' &&
          res.reason instanceof TypeError;

        if (isNetworkError(profileRes) && isNetworkError(ordersRes)) {
          setApiError('Notice: Live server unreachable. Displaying fallback data.');
        }

      } catch (err) {
        console.error('Error loading customer dashboard backend data:', err);
        if (isMounted) setApiError('Could not sync with backend server.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBackendData();
    return () => { isMounted = false; };
  }, [user, wishlist.length]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const username    = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Customer';
  const unreadCount = notifications.filter(n => !n.read).length;

  // Build dynamic category list from all products
  const allCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const filtered = products
    .filter(p => selectedCategory === 'All' || p.category === selectedCategory)
    .filter(p => p.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAISearch = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const q = globalSearch.toLowerCase();
    setAiResponse(
      q.includes('figma') || q.includes('ui')   ? '"Aurora UI Kit" is ready in Downloads.' :
      q.includes('price') || q.includes('deal')  ? 'Wishlist items have recent price drops.' :
      q.includes('recomm')                        ? '"Solace Mobile System" is recommended for you.' :
      'Browse the discovery stream below for curated picks.'
    );
    setGlobalSearch('');
  };

  const isMoreActive = MORE_NAV.some(i => i.name === dashboardTab);

  const renderContent = () => {
    switch (dashboardTab) {
      case 'Downloads':        return <Downloads />;
      case 'Purchases':        return <Purchases />;
      case 'Wishlist':         return <Wishlist />;
      case 'Orders':           return <Orders />;
      case 'Notifications':    return <Notifications />;
      case 'Settings':         return <Settings theme={accentTheme} setTheme={setAccentTheme} glassMode={glassMode} setGlassMode={setGlassMode} borderGlow={borderGlow} setBorderGlow={setBorderGlow} />;
      case 'Recently Viewed':  return <RecentlyViewed />;
      case 'Price Alerts':     return <PriceAlerts />;
      case 'Product Updates':  return <ProductUpdates />;
      case 'Reviews Manager':  return <ReviewsManager />;
      case 'Messages Center':  return <MessagesCenter />;
      case 'Support Center':   return <SupportCenter />;
      default:
        return (
          <DashboardHome
            username={username}
            navigateTo={navigateTo}
            filtered={filtered}
            showCount={showCount}
            setShowCount={setShowCount}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            allCategories={allCategories}
            addToCart={addToCart}
            buyNow={buyNow}
            toggleWishlist={toggleWishlist}
            wishlist={wishlist}
            formatPrice={formatPrice}
            aiResponse={aiResponse}
            setAiResponse={setAiResponse}
            handleAISearch={handleAISearch}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            loading={loading}
            apiError={apiError}
            profile={profile}
            stats={stats}
            recentOrders={recentOrders}
            activities={activities}
            notifsSummary={notifsSummary}
          />
        );
    }
  };

  const handleNavClick = (name) => {
    setDashboardTab(name);
    setMoreOpen(false);
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-sans)', position: 'relative', color: 'var(--text-primary)' }}>
      <AnimatedBackground />
      <ThreeDBackground />
      <div className="dash-orb dash-orb-1" />
      <div className="dash-orb dash-orb-2" />
      <div className="dash-orb dash-orb-3" />

      {/* ── UNIFIED SINGLE TOP NAVBAR ───────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(40px) saturate(200%)',
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        borderBottom: '1px solid rgba(196,148,230,0.22)',
        boxShadow: scrolled ? '0 4px 24px rgba(45,0,96,0.08)' : '0 1px 12px rgba(45,0,96,0.04)',
        transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: '64px', gap: '16px',
        }}>
          {/* Brand Logo */}
          <button
            onClick={() => navigateTo('landing')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: 0, flexShrink: 0 }}
          >
            <span style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '0.8rem',
              boxShadow: '0 4px 12px rgba(90,30,126,0.30)',
            }}>L</span>
            <span className="text-editorial" style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              Lumora
            </span>
            <span style={{
              fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.07em',
              color: '#7B3FA0', background: 'rgba(123,63,160,0.08)',
              border: '1px solid rgba(196,148,230,0.30)',
              padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
            }}>Customer</span>
          </button>

          {/* Center Navigation Bar — Single row with all customer modules */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            flex: 1, justifyContent: 'center', position: 'relative', overflow: 'visible',
          }} className="cust-nav-bar">
            {PRIMARY_NAV.map(item => {
              const isActive = dashboardTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 14px', borderRadius: '8px',
                    border: 'none', outline: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.80rem', fontWeight: isActive ? 700 : 600,
                    background: isActive ? 'rgba(123,63,160,0.12)' : 'transparent',
                    color: isActive ? '#7B3FA0' : '#4A3B5A',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = '#7B3FA0'; e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = '#4A3B5A'; e.currentTarget.style.background = 'transparent'; } }}
                >
                  <span style={{ color: isActive ? '#7B3FA0' : '#6B5A7A' }}>{item.icon}</span>
                  {item.label}
                  {item.badge && unreadCount > 0 && (
                    <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '10px', background: '#7B3FA0', color: '#fff', fontWeight: 800, lineHeight: 1.4 }}>{unreadCount}</span>
                  )}
                </button>
              );
            })}

            {/* More dropdown */}
            <div ref={moreRef} style={{ position: 'relative', marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => setMoreOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '7px 14px', borderRadius: '8px',
                  border: 'none', outline: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '0.80rem', fontWeight: isMoreActive ? 700 : 600,
                  background: isMoreActive ? 'rgba(123,63,160,0.12)' : 'rgba(123,63,160,0.06)',
                  color: isMoreActive ? '#7B3FA0' : '#4A3B5A',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!isMoreActive) { e.currentTarget.style.color = '#7B3FA0'; e.currentTarget.style.background = 'rgba(123,63,160,0.10)'; } }}
                onMouseLeave={e => { if (!isMoreActive) { e.currentTarget.style.color = '#4A3B5A'; e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; } }}
              >
                More Options <ChevronDown size={12} style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {moreOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '10px',
                  background: '#FFFFFF',
                  border: '1px solid rgba(123,63,160,0.25)',
                  borderRadius: '14px',
                  boxShadow: '0 16px 40px rgba(45,0,96,0.18)',
                  padding: '8px',
                  minWidth: '210px',
                  zIndex: 9999,
                  animation: 'dropIn 0.2s cubic-bezier(0.16,1,0.3,1)',
                }}>
                  {MORE_NAV.map(item => {
                    const isActive = dashboardTab === item.name;
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleNavClick(item.name)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', borderRadius: '8px',
                          border: 'none', outline: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                          fontFamily: 'var(--font-sans)', fontSize: '0.82rem', fontWeight: isActive ? 700 : 600,
                          background: isActive ? 'rgba(123,63,160,0.12)' : 'transparent',
                          color: isActive ? '#7B3FA0' : '#2D004D',
                          transition: 'all 0.18s',
                        }}
                        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(123,63,160,0.08)'; e.currentTarget.style.color = '#7B3FA0'; } }}
                        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#2D004D'; } }}
                      >
                        <span style={{ color: isActive ? '#7B3FA0' : '#7B3FA0' }}>{item.icon}</span>
                        <span style={{ flex: 1, color: isActive ? '#7B3FA0' : '#2D004D' }}>{item.name}</span>
                        {item.badge && unreadCount > 0 && (
                          <span style={{ fontSize: '0.55rem', padding: '2px 6px', borderRadius: '10px', background: '#7B3FA0', color: '#fff', fontWeight: 800, lineHeight: 1.4 }}>{unreadCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Right Action Group: AI search + user info + exit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Cart Icon Option */}
            <button
              onClick={() => navigateTo('cart')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: '20px',
                border: '1px solid rgba(196,148,230,0.28)',
                background: 'rgba(255,255,255,0.70)',
                color: '#7B3FA0', fontSize: '0.75rem', fontWeight: 700,
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                transition: 'all 0.22s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.70)'; }}
            >
              <ShoppingBag size={12} />
              <span>Cart ({cart?.length || 0})</span>
            </button>

            {/* AI Search */}
            <form onSubmit={handleAISearch} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '20px',
              background: 'rgba(255,255,255,0.70)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(196,148,230,0.28)',
              width: '180px',
            }}>
              <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Lumora AI…"
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', color: 'var(--text-primary)', width: '100%' }}
              />
              <button type="submit" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7B3FA0' }}><Sparkles size={12} /></button>
            </form>

            {/* User avatar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(255,255,255,0.60)',
              border: '1px solid rgba(196,148,230,0.22)',
            }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.68rem', flexShrink: 0 }}>
                {username[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username}</span>
            </div>

            {/* Exit */}
            <button
              onClick={() => navigateTo('landing')}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '16px',
                border: '1px solid rgba(196,148,230,0.28)',
                background: 'rgba(255,255,255,0.55)',
                color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 700,
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                transition: 'all 0.22s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <LogOut size={12} /> Exit
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(o => !o)}
              className="cust-hamburger"
              style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div style={{
            background: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(40px)',
            borderTop: '1px solid rgba(196,148,230,0.18)',
            padding: '12px 20px 20px',
          }}>
            {[...PRIMARY_NAV, ...MORE_NAV].map(item => {
              const isActive = dashboardTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => handleNavClick(item.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '11px 14px', borderRadius: '10px', marginBottom: '3px',
                    border: 'none', outline: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'rgba(123,63,160,0.08)' : 'transparent',
                    color: isActive ? '#7B3FA0' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: isActive ? '#7B3FA0' : 'var(--text-muted)' }}>
                    {item.icon}
                  </span>
                  {item.label || item.name}
                  {item.badge && unreadCount > 0 && (
                    <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', background: '#7B3FA0', color: '#fff', fontWeight: 800 }}>{unreadCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── AI response banner ───────────────────────────────────────── */}
      {aiResponse && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 32px', background: 'rgba(123,63,160,0.06)',
          borderBottom: '1px solid rgba(196,148,230,0.20)',
        }}>
          <Sparkles size={13} style={{ color: '#7B3FA0', flexShrink: 0 }} />
          <p style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', margin: 0, flex: 1 }}>{aiResponse}</p>
          <button onClick={() => setAiResponse('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <main style={{ padding: '32px 40px', maxWidth: '1280px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <div style={{ animation: 'cust-fadein 0.40s cubic-bezier(0.16,1,0.3,1)' }} key={dashboardTab}>
          {renderContent()}
        </div>
      </main>

      <style>{`
        @keyframes cust-fadein {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cust-nav-bar { scrollbar-width: none; }
        .cust-nav-bar::-webkit-scrollbar { display: none; }
        @media (max-width: 860px) {
          .cust-hamburger { display: flex !important; }
          .cust-nav-bar   { display: none !important; }
        }
        @media (max-width: 640px) {
          main { padding: 20px 16px !important; }
        }
      `}</style>
    </div>
  );
}


/* ─── Dashboard Home tab ─────────────────────────────────────────── */
function DashboardHome({
  username, navigateTo, filtered, showCount, setShowCount,
  searchQuery, setSearchQuery,
  selectedCategory, setSelectedCategory, allCategories,
  addToCart, buyNow, toggleWishlist, wishlist, formatPrice,
  aiResponse, setAiResponse, handleAISearch, globalSearch, setGlobalSearch,
  loading, apiError, profile, stats, recentOrders, activities, notifsSummary
}) {

  const QUICK_STATS = [
    { label: 'Products Owned',  value: String(stats?.productsOwned ?? 12),  icon: <Package size={15} />,  trend: 'Active licenses' },
    { label: 'Downloads',       value: String(stats?.downloadsCount ?? 48), icon: <Download size={15} />, trend: 'All time' },
    { label: 'Wishlist Items',  value: String(stats?.wishlistCount ?? 7),   icon: <Heart size={15} />,    trend: 'Saved' },
    { label: 'Orders',          value: String(stats?.ordersCount ?? 4),     icon: <CreditCard size={15}/>, trend: 'Completed' },
  ];

  const visibleProducts = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Loading state indicator */}
      {loading && (
        <div style={{ padding: '12px 20px', background: 'rgba(123,63,160,0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.82rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} /> Syncing live dashboard stats with backend server...
        </div>
      )}

      {/* API error banner */}
      {apiError && !loading && (
        <div style={{ padding: '12px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: '#DC2626', fontSize: '0.82rem', fontWeight: 600 }}>
          <AlertCircle size={16} /> {apiError}
        </div>
      )}

      {/* Hero welcome */}
      <div className="glass-card" style={{
        padding: '40px 44px',
        background: 'linear-gradient(135deg, rgba(246,244,255,0.92) 0%, rgba(237,233,254,0.60) 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-60px', right: '60px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,148,230,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>✦ Customer Portal</span>
          <h2 className="text-editorial" style={{ fontSize: '2.4rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.05 }}>
            Welcome back, {profile?.name || username}.
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '10px', lineHeight: 1.6, maxWidth: '420px' }}>
            Explore {filtered.length} premium digital products — browse, wishlist, and add to cart.
          </p>
          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => navigateTo('marketplace')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.38)', fontFamily: 'var(--font-sans)' }}>
              <TrendingUp size={14} /> Browse Marketplace
            </button>
            <button onClick={() => navigateTo('downloads')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: '1.5px solid rgba(196,148,230,0.40)', background: 'rgba(255,255,255,0.80)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <Download size={14} /> My Downloads
            </button>
            <button onClick={() => navigateTo('orders')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: '1.5px solid rgba(196,148,230,0.40)', background: 'rgba(255,255,255,0.80)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              <CreditCard size={14} /> View Orders
            </button>
          </div>
        </div>
        <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg,#D8BFE3,#9B5CC4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 32px rgba(123,63,160,0.30)', fontSize: '2.5rem', color: '#fff', fontFamily: 'var(--font-editorial)', position: 'relative', zIndex: 2, flexShrink: 0 }}>
          {(profile?.name || username)[0]?.toUpperCase()}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '16px' }}>
        {QUICK_STATS.map((s, i) => (
          <div key={i} className="premium-flat-card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
              <div style={{ fontSize: '1.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '5px', lineHeight: 1 }}>{s.value}</div>
              <span style={{ fontSize: '0.68rem', color: '#7B3FA0', fontWeight: 600, marginTop: '4px', display: 'block' }}>{s.trend}</span>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,148,230,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Purchases & Recent Activity Dual Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px' }}>
        {/* Recent Purchases */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={16} style={{ color: '#7B3FA0' }} /> Recent Purchases
            </h4>
            <button onClick={() => navigateTo('purchases')} style={{ background: 'none', border: 'none', color: '#7B3FA0', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>View All</button>
          </div>
          {recentOrders && recentOrders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentOrders.slice(0, 3).map((ord, idx) => (
                <div key={ord.id || idx} style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(196,148,230,0.20)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>Order #{ord.id}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ord.created_at ? new Date(ord.created_at).toLocaleDateString() : 'Recent'} · {ord.items?.length || 1} items</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#7B3FA0' }}>{formatPrice(ord.total_amount || 49.99)}</div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.10)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>{ord.status || 'Completed'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.40)', borderRadius: '12px', border: '1px dashed rgba(196,148,230,0.3)' }}>
              No recent order history recorded yet.
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: '#7B3FA0' }} /> Recent Activity & Alerts
            </h4>
            <button onClick={() => navigateTo('notifications')} style={{ background: 'none', border: 'none', color: '#7B3FA0', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>View Alerts</button>
          </div>
          {activities && activities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.slice(0, 3).map((act, idx) => (
                <div key={act.id || idx} style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(196,148,230,0.20)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle size={15} style={{ color: '#7B3FA0', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.activity_type || act.event || 'Account Activity'}</div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>{act.details || act.created_at || 'Just now'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : notifsSummary && notifsSummary.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notifsSummary.slice(0, 3).map((n, idx) => (
                <div key={n.id || idx} style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.60)', border: '1px solid rgba(196,148,230,0.20)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={15} style={{ color: '#7B3FA0', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title || n.message}</div>
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)' }}>Notification</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', background: 'rgba(255,255,255,0.40)', borderRadius: '12px', border: '1px dashed rgba(196,148,230,0.3)' }}>
              No recent activity logged.
            </div>
          )}
        </div>
      </div>

      {/* Discovery stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Discover</span>
            <h3 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>
              All Products
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
              {filtered.length} products · showing {Math.min(showCount, filtered.length)}
            </p>
          </div>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', borderRadius: '30px', background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)', border: '1px solid rgba(196,148,230,0.28)', width: '240px' }}>
            <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input type="text" placeholder="Search products…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: 'var(--text-primary)', width: '100%' }} />
          </div>
        </div>

        {/* Category pills — scrollable row */}
        <div style={{ display: 'flex', gap: '7px', overflowX: 'auto', paddingBottom: '4px' }} className="cat-scroll">
          {allCategories.slice(0, 20).map(cat => {
            const active = selectedCategory === cat;
            return (
              <button key={cat} onClick={() => { setSelectedCategory(cat); setShowCount(24); }} style={{
                padding: '6px 14px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 600,
                border: active ? '1.5px solid rgba(123,63,160,0.40)' : '1px solid rgba(196,148,230,0.28)',
                background: active ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'rgba(255,255,255,0.75)',
                color: active ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                boxShadow: active ? '0 3px 12px rgba(123,63,160,0.28)' : 'none',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {cat}
              </button>
            );
          })}
        </div>

        {/* Product grid — all products */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '20px' }}>
          {visibleProducts.map(p => {
            const isWished = wishlist.some(w => String(w.id) === String(p.id));
            return (
              <div key={p.id} className="glass-card" onClick={() => navigateTo('product-detail', p.id)} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer', border: '1px solid rgba(196,148,230,0.22)', transition: 'all 0.28s cubic-bezier(0.16,1,0.3,1)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 24px 60px rgba(90,30,126,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>
                {/* Image */}
                <div style={{ position: 'relative', height: '160px', overflow: 'hidden', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
                  <img
                    src={p.preview || p.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=70'}
                    alt={p.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                  />
                  {p.badge && <span style={{ position: 'absolute', top: 10, left: 10, fontSize: '0.58rem', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>{p.badge}</span>}
                  <button onClick={e => { e.stopPropagation(); toggleWishlist(p); }} style={{ position: 'absolute', top: 10, right: 10, width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.90)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: isWished ? '#E11D48' : 'var(--text-muted)', transition: 'all 0.2s' }}>
                    <Heart size={12} fill={isWished ? '#E11D48' : 'none'} />
                  </button>
                </div>
                {/* Body */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.category}</span>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < Math.round(p.rating || 4.8) ? '#C7A55A' : 'none'} stroke="#C7A55A" />)}
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: '3px' }}>{p.rating || 4.8}</span>
                    {p.reviews && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>({p.reviews})</span>}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(196,148,230,0.15)', marginTop: 'auto' }}>
                    <span style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatPrice(p.price)}</span>
                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      <button onClick={e => { e.stopPropagation(); addToCart(p); }} style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid rgba(123,63,160,0.30)', background: 'rgba(255,255,255,0.90)', color: '#7B3FA0', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        Add
                      </button>
                      <button onClick={e => { e.stopPropagation(); buyNow(p); }} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontSize: '0.70rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(90,30,126,0.25)', fontFamily: 'var(--font-sans)' }}>
                        Buy Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button
              onClick={() => setShowCount(c => c + 24)}
              style={{
                padding: '12px 40px', borderRadius: '30px',
                border: '1.5px solid rgba(123,63,160,0.30)',
                background: 'rgba(255,255,255,0.80)',
                color: '#7B3FA0', fontSize: '0.84rem', fontWeight: 700,
                cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
                transition: 'all 0.22s',
                backdropFilter: 'blur(16px)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.08)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.50)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.80)'; e.currentTarget.style.borderColor = 'rgba(123,63,160,0.30)'; }}
            >
              Load More · {filtered.length - showCount} remaining
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="glass-card" style={{ padding: '56px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.25)' }}>
            <div style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No products found</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Try a different category or search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
