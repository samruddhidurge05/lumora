import React, { useEffect, useState } from 'react';
import { Sparkles, Compass, Users, LayoutDashboard, HelpCircle, ArrowUpRight, UploadCloud, ShoppingBag, BarChart3, FileText, MessageSquare, Settings, CreditCard, Link2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <header 
      style={{
        position: 'fixed',
        top: scrolled ? '1rem' : '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        width: scrolled ? 'min(1240px, 92%)' : 'min(1400px, 95%)',
        zIndex: 900,
        transition: 'all 0.5s var(--ease-premium)',
      }}
    >
      <div 
        className="glass-surface"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: scrolled ? '12px 24px' : '18px 36px',
          borderRadius: '50px',
          transition: 'all 0.5s var(--ease-premium)',
          boxShadow: scrolled 
            ? '0 12px 40px -10px rgba(90, 30, 126, 0.08)' 
            : '0 4px 20px rgba(0, 0, 0, 0.01)',
          borderColor: scrolled ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)',
        }}
      >
        {/* Brand Logo */}
        <Link 
          to="/dashboard" 
          className="text-editorial"
          style={{
            fontSize: '1.8rem',
            fontWeight: 500,
            textDecoration: 'none',
            color: 'var(--color-espresso)',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '1.25rem', verticalAlign: 'middle', filter: 'drop-shadow(0 0 8px var(--color-lilac-glow))' }}>✧</span>
          Lumora
        </Link>

        {/* Navigation Links */}
        <nav 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
          }}
          className="nav-menu"
        >
          {[
            { label: 'Dashboard', icon: <LayoutDashboard size={14} />, to: '/dashboard' },
            { label: 'Products', icon: <Compass size={14} />, to: '/products' },
            { label: 'Orders', icon: <ShoppingBag size={14} />, to: '/orders' },
            { label: 'Vendors', icon: <Users size={14} />, to: '/vendors' },
            { label: 'Payments', icon: <CreditCard size={14} />, to: '/payments' },
            { label: 'Analytics', icon: <BarChart3 size={14} />, to: '/analytics' },
            { label: 'Reports', icon: <FileText size={14} />, to: '/reports' },
            { label: 'Reviews', icon: <MessageSquare size={14} />, to: '/reviews' },
            { label: 'Settings', icon: <Settings size={14} />, to: '/settings' }
          ].map((item, index) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={index}
                to={item.to}
                className="text-sans"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: isActive ? 'var(--color-espresso)' : 'var(--color-mocha)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  position: 'relative',
                  padding: '6px 4px',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.3s var(--ease-premium)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-espresso)';
                  const dot = e.currentTarget.querySelector('.dot');
                  if (dot) dot.style.transform = 'scale(1)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-mocha)';
                  }
                  const dot = e.currentTarget.querySelector('.dot');
                  if (dot && !isActive) dot.style.transform = 'scale(0)';
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
                    transform: isActive ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-latte)',
                    transition: 'transform 0.3s var(--ease-premium)',
                    transformOrigin: 'center center'
                  }}
                />
              </Link>
            );
          })}
        </nav>

        {/* Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link 
            to="/dashboard"
            className="btn-premium"
            style={{
              padding: scrolled ? '10px 22px' : '14px 28px',
              fontSize: scrolled ? '0.85rem' : '0.9rem',
              willChange: 'transform',
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            Enter Lumora
            <ArrowUpRight size={14} style={{ opacity: 0.8 }} />
          </Link>
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
