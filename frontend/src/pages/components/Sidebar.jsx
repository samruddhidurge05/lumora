import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, PlusCircle, BarChart2,
  DollarSign, CreditCard, Star, Link2, ShieldCheck, Settings, User,
  ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: <LayoutDashboard size={16} />, path: '/vendor/dashboard'      },
  { id: 'orders',         label: 'Orders',          icon: <ShoppingBag size={16} />,     path: '/vendor/orders'          },
  { id: 'products',       label: 'Products',        icon: <Package size={16} />,         path: '/vendor/products'        },
  { id: 'add-product',    label: 'Add Product',     icon: <PlusCircle size={16} />,      path: '/vendor/add-product'     },
  { id: 'analytics',      label: 'Analytics',       icon: <BarChart2 size={16} />,       path: '/vendor/analytics'       },
  { id: 'earnings',       label: 'Earnings',        icon: <DollarSign size={16} />,      path: '/vendor/earnings'        },
  { id: 'withdrawals',    label: 'Withdrawals',     icon: <CreditCard size={16} />,      path: '/vendor/withdrawals'     },
  { id: 'reviews',        label: 'Reviews',         icon: <Star size={16} />,            path: '/vendor/reviews'         },
  { id: 'affiliate',      label: 'Affiliate',       icon: <Link2 size={16} />,           path: '/vendor/affiliate'       },
  { id: 'verification',   label: 'Verification',    icon: <ShieldCheck size={16} />,     path: '/vendor/verification'    },
  { id: 'store-settings', label: 'Store Settings',  icon: <Settings size={16} />,        path: '/vendor/store-settings'  },
  { id: 'profile',        label: 'Profile',         icon: <User size={16} />,            path: '/vendor/profile'         },
];

export default function Sidebar({ activePage: activeProp }) {
  const navigate  = useNavigate();
  const { pathname } = useLocation();
  const activePage = activeProp || pathname.replace('/vendor/', '') || 'dashboard';

  return (
    <aside style={{
      width: '240px',
      flexShrink: 0,
      minHeight: '100%',
      position: 'sticky',
      top: 0,
      background: 'rgba(255,255,255,0.62)',
      backdropFilter: 'blur(40px) saturate(200%)',
      WebkitBackdropFilter: 'blur(40px) saturate(200%)',
      borderRight: '1px solid rgba(196,148,230,0.22)',
      boxShadow: '4px 0 24px rgba(90,30,126,0.04)',
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '3px',
    }}>

      {/* Section label */}
      <div style={{
        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.10em',
        color: 'rgba(123,63,160,0.45)', textTransform: 'uppercase',
        padding: '0 10px', marginBottom: '10px',
      }}>
        Vendor Portal
      </div>

      {NAV_ITEMS.map(item => {
        const isActive = activePage === item.id;
        return (
          <button key={item.id} onClick={() => navigate(item.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 13px', borderRadius: '12px', border: 'none', outline: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.83rem',
              fontWeight: isActive ? 700 : 500, textAlign: 'left', width: '100%',
              background: isActive
                ? 'linear-gradient(135deg, rgba(123,63,160,0.12), rgba(90,30,126,0.06))'
                : 'transparent',
              color: isActive ? '#7B3FA0' : 'var(--text-muted)',
              borderLeft: `2px solid ${isActive ? '#7B3FA0' : 'transparent'}`,
              transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(123,63,160,0.05)';
                e.currentTarget.style.color = '#7B3FA0';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            <span style={{ color: isActive ? '#7B3FA0' : 'var(--text-muted)', flexShrink: 0, transition: 'color 0.22s' }}>
              {item.icon}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {isActive && <ChevronRight size={13} style={{ color: '#7B3FA0', opacity: 0.6 }} />}
          </button>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Footer badge */}
      <div style={{
        padding: '14px', borderRadius: '14px', marginTop: '8px',
        background: 'linear-gradient(135deg, rgba(123,63,160,0.08), rgba(90,30,126,0.04))',
        border: '1px solid rgba(196,148,230,0.25)',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7B3FA0', marginBottom: '3px' }}>
          ✧ Lumora Seller Console
        </div>
        <div style={{ fontSize: '0.68rem', color: 'rgba(90,64,120,0.55)', lineHeight: 1.5 }}>
          Real-time data from the backend
        </div>
      </div>
    </aside>
  );
}
