import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BarChart3,
  ShoppingBag, 
  Compass,
  Users,
  CreditCard, 
  MessageSquare, 
  FileText,
  ShieldCheck,
  Settings, 
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import useAuth from '../../../hooks/useAuth';

export default function AdminSidebar({ activePage }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Load collapse preference from localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('admin-sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('admin-sidebar-collapsed', String(next));
      return next;
    });
  };

  const handleNavigate = (path, e) => {
    if (e) e.preventDefault();
    if (path !== '#') {
      navigate(path);
    }
  };

  const handleKeyDown = (path, action, e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action) {
        action(e);
      } else {
        handleNavigate(path, e);
      }
    }
  };

  const handleLogout = async (e) => {
    if (e) e.preventDefault();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/admin/dashboard' },
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} />, path: '/admin/analytics' },
      ]
    },
    {
      title: 'Commerce',
      items: [
        { id: 'products', label: 'Products', icon: <Compass size={18} />, path: '/admin/products' },
        { id: 'orders', label: 'Orders', icon: <ShoppingBag size={18} />, path: '/admin/orders' },
        { id: 'payments', label: 'Payments', icon: <CreditCard size={18} />, path: '/admin/payments' },
      ]
    },
    {
      title: 'Users',
      items: [
        { id: 'vendors', label: 'Vendors & Affiliates', icon: <Users size={18} />, path: '/admin/vendors' },
        { id: 'customers', label: 'Customers', icon: <User size={18} />, path: '/admin/customers' },
      ]
    },
    {
      title: 'Platform',
      items: [
        { id: 'reviews', label: 'Reviews', icon: <MessageSquare size={18} />, path: '/admin/reviews' },
        { id: 'reports', label: 'Reports', icon: <FileText size={18} />, path: '/admin/reports' },
        { id: 'admin-campaigns', label: 'Admin Referrals', icon: <Compass size={18} />, path: '/admin/campaign-manager' },
        { id: 'platform', label: 'Platform Status', icon: <ShieldAlert size={18} />, path: '/admin/platform' },
        { id: 'settings', label: 'Settings', icon: <Settings size={18} />, path: '/admin/settings' },
        { id: 'audit-logs', label: 'Audit Logs', icon: <ShieldCheck size={18} />, path: '/admin/audit-logs' },
      ]
    }
  ];

  return (
    <aside 
      className={`admin-sidebar glass-surface ${isCollapsed ? 'collapsed' : ''}`}
      role="navigation"
      aria-label="Admin Navigation"
      aria-expanded={!isCollapsed}
      style={{
        width: '260px',
        borderRadius: '24px',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(90, 30, 126, 0.04)',
        height: 'calc(100vh - 48px)',
        position: 'sticky',
        top: '24px',
        flexShrink: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Brand Header */}
      <div style={{
        padding: '0 8px 16px 8px',
        borderBottom: '1px solid rgba(142, 106, 168, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        gap: '8px'
      }}>
        {!isCollapsed && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}>
            <div style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-espresso, #2D004D)',
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '0.9rem', color: '#7B3FA0' }}>✧</span>
              Lumora
            </div>
            <div style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#8E6AA8',
            }}>
              Admin Console
            </div>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          style={{
            background: 'rgba(123, 63, 160, 0.06)',
            border: '1px solid rgba(123, 63, 160, 0.15)',
            borderRadius: '10px',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7B3FA0',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            outline: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(123, 63, 160, 0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(123, 63, 160, 0.06)'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav groups */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px',
        flex: 1,
        overflowY: 'auto',
        paddingRight: '4px'
      }}>
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {!isCollapsed ? (
              <div style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#8E6AA8',
                paddingLeft: '12px',
                opacity: 0.65
              }}>
                {group.title}
              </div>
            ) : (
              <div style={{
                height: '1px',
                background: 'rgba(142, 106, 168, 0.08)',
                margin: '4px 8px'
              }} />
            )}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {group.items.map((item) => {
                const isActive = activePage === item.id || (item.path !== '#' && location.pathname === item.path);
                
                return (
                  <a
                    key={item.id}
                    href={item.path}
                    onClick={(item.disabled) ? (e) => e.preventDefault() : item.onClick || ((e) => handleNavigate(item.path, e))}
                    onKeyDown={(e) => handleKeyDown(item.path, item.onClick, e)}
                    className={`admin-nav-item ${isActive ? 'active' : ''}`}
                    data-tooltip={item.label}
                    tabIndex={item.disabled ? -1 : 0}
                    aria-current={isActive ? 'page' : undefined}
                    aria-disabled={item.disabled}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: item.disabled ? 'rgba(45, 0, 77, 0.35)' : (isActive ? '#7B3FA0' : '#2D004D'),
                      textDecoration: 'none',
                      background: isActive ? 'rgba(123, 63, 160, 0.08)' : 'transparent',
                      border: isActive ? '1.5px solid rgba(123, 63, 160, 0.15)' : '1.5px solid transparent',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      if (!isActive && !item.disabled) {
                        e.currentTarget.style.borderColor = 'rgba(123, 63, 160, 0.25)';
                        e.currentTarget.style.background = 'rgba(123, 63, 160, 0.03)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!isActive && !item.disabled) {
                        e.currentTarget.style.borderColor = 'transparent';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !item.disabled) {
                        e.currentTarget.style.background = 'rgba(123, 63, 160, 0.04)';
                        e.currentTarget.style.borderColor = 'rgba(123, 63, 160, 0.08)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !item.disabled) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ 
                      color: item.disabled ? 'rgba(45, 0, 77, 0.3)' : (isActive ? '#7B3FA0' : 'rgba(45, 0, 77, 0.55)'),
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Refined Footer Area */}
      <div style={{
        paddingTop: '16px',
        borderTop: '1px solid rgba(142, 106, 168, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          gap: '8px'
        }}>
          {/* User profile details */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: 0
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(123, 63, 160, 0.15)',
              boxShadow: '0 2px 8px rgba(123, 63, 160, 0.06)',
              flexShrink: 0
            }}>
              <img 
                src={user?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                alt="Admin Avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            {!isCollapsed && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0
              }}>
                <span style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--color-espresso, #2D004D)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {user?.displayName || 'Alexander V.'}
                </span>
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  color: '#7B3FA0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'rgba(123, 63, 160, 0.06)',
                  padding: '1px 5px',
                  borderRadius: '6px',
                  width: 'fit-content'
                }}>
                  Admin
                </span>
              </div>
            )}
          </div>

          {/* Logout trigger icon button */}
          <button
            onClick={handleLogout}
            onKeyDown={(e) => handleKeyDown('#', handleLogout, e)}
            aria-label="Logout"
            tabIndex={0}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8E6AA8',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#8E6AA8';
            }}
            onFocus={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onBlur={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#8E6AA8';
            }}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Version tags */}
        {!isCollapsed && (
          <div style={{
            fontSize: '0.58rem',
            color: '#8E6AA8',
            opacity: 0.5,
            fontWeight: 700,
            letterSpacing: '0.02em',
            paddingLeft: '4px'
          }}>
            Version 1.0.0-enterprise
          </div>
        )}
      </div>
    </aside>
  );
}
