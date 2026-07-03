import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Package, ShoppingBag, Star,
  PlusCircle, BarChart2, CreditCard, ClipboardList,
  Award, Zap, Shield, TrendingUp, Check,
  RefreshCw, AlertCircle, Clock, CheckCircle,
  Eye, MessageSquare, ArrowRight,
} from 'lucide-react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useDashboard } from '../../hooks/useVendorData';

/* ── Seller level config ─────────────────────────────────────────────────── */
const LEVEL_CONFIG = {
  'Beginner':            { pct: 20,  next: 'Growing Seller',      threshold: 500  },
  'Growing Seller':      { pct: 42,  next: 'Professional Seller', threshold: 1200 },
  'Professional Seller': { pct: 68,  next: 'Premium Seller',      threshold: 3000 },
  'Premium Seller':      { pct: 85,  next: 'Elite Seller',        threshold: 8000 },
  'Elite Seller':        { pct: 100, next: null,                   threshold: null },
};

function getLevel(totalSales) {
  if (totalSales >= 8000) return 'Elite Seller';
  if (totalSales >= 3000) return 'Premium Seller';
  if (totalSales >= 1200) return 'Professional Seller';
  if (totalSales >= 500)  return 'Growing Seller';
  return 'Beginner';
}

/* ── Quick actions ───────────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { label: 'Add Product',  path: '/vendor/add-product',  icon: <PlusCircle    size={15} /> },
  { label: 'View Orders',  path: '/vendor/orders',        icon: <ClipboardList size={15} /> },
  { label: 'Analytics',    path: '/vendor/analytics',     icon: <BarChart2     size={15} /> },
  { label: 'Withdraw',     path: '/vendor/withdrawals',   icon: <CreditCard    size={15} /> },
];

/* ── Status colours ──────────────────────────────────────────────────────── */
const STATUS_COLOR = {
  completed:  '#16a34a',
  pending:    '#d97706',
  processing: '#2563eb',
  cancelled:  '#dc2626',
};

/* ── Relative time helper ────────────────────────────────────────────────── */
function relTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hr${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

/* ── Skeleton loader ─────────────────────────────────────────────────────── */
function Skeleton({ w = '100%', h = '16px', r = '6px', style = {} }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: 'rgba(184,134,208,0.15)', animation: 'pulse 1.4s ease-in-out infinite', ...style }} />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('12m');
  const { data, stats, loading, error, refresh } = useDashboard();

  /* Derived values from real API data ──────────────────────────────────── */
  const totalRevenue = stats?.totalRevenue ?? 0;
  const totalSales   = stats?.totalSales   ?? 0;
  const activeCount  = stats?.activeCount  ?? 0;
  const avgRating    = stats?.avgRating    ?? 0;
  const recentOrders   = data?.recentOrders   ?? [];
  const recentProducts = data?.recentProducts ?? [];
  const recentReviews  = data?.recentReviews  ?? [];
  const activity       = data?.activity       ?? [];
  const monthlyChart   = data?.monthlyChart   ?? [];

  const level = getLevel(totalSales);
  const cfg   = LEVEL_CONFIG[level];

  /* Revenue chart data ──────────────────────────────────────────────────── */
  const MONTHS_12 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chartData = monthlyChart.length
    ? monthlyChart
    : MONTHS_12.map(m => ({ label: m, value: 0 }));

  const filtered30 = chartData.slice(-6);
  const displayChart = period === '30d' ? filtered30 : chartData;
  const chartMax = Math.max(...displayChart.map(d => d.value), 1);
  const sparkVal = totalRevenue > 0
    ? totalRevenue >= 100000
      ? `₹${(totalRevenue / 100000).toFixed(2)}L`
      : `₹${Math.round(totalRevenue).toLocaleString('en-IN')}`
    : '₹0';

  /* Stat cards ────────────────────────────────────────────────────────────── */
  const STATS = [
    { label: 'Total Revenue',     value: loading ? null : `₹${Math.round(totalRevenue).toLocaleString('en-IN')}`,  delta: '+18.4%', up: true,  icon: <DollarSign  size={20} />, bg: 'rgba(184,134,208,0.16)' },
    { label: 'Total Orders',      value: loading ? null : String(totalSales),                                        delta: '+12.1%', up: true,  icon: <ShoppingBag size={20} />, bg: 'rgba(123,63,160,0.12)'  },
    { label: 'Active Products',   value: loading ? null : String(activeCount),                                       delta: `${activeCount} live`, up: true, icon: <Package size={20} />,    bg: 'rgba(216,191,227,0.20)' },
    { label: 'Avg. Rating',       value: loading ? null : (Number(avgRating) || 0).toFixed(1),                       delta: '/ 5.0',  up: true,  icon: <Star        size={20} />, bg: 'rgba(90,30,126,0.10)'   },
  ];

  return (
    <VendorLayout activePage="dashboard" title="Overview" subtitle="Your store at a glance"
      actions={
        <button onClick={refresh} disabled={loading}
          style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'20px', border:'1px solid rgba(196,148,230,0.30)', background:'rgba(255,255,255,0.70)', color:'#7B3FA0', fontSize:'0.78rem', fontWeight:700, cursor: loading?'not-allowed':'pointer', fontFamily:'var(--font-sans)' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1.2s linear infinite' : 'none' }} />
          {loading ? 'Syncing…' : 'Refresh'}
        </button>
      }
    >

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom:'20px', padding:'12px 18px', borderRadius:'12px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.22)', display:'flex', alignItems:'center', gap:'10px', color:'#dc2626', fontSize:'0.80rem', fontWeight:600 }}>
          <AlertCircle size={15} />
          Backend unreachable — showing available data. {error}
        </div>
      )}

      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="v-stat-grid" style={{ marginBottom:'24px' }}>
        {STATS.map((s, i) => (
          <div key={i} className="v-card v-stat-card v-fade-in" style={{ animationDelay:`${i*0.07}s` }}>
            <div className="v-stat-header">
              <div className="v-stat-icon" style={{ background: s.bg, color:'#7B3FA0' }}>{s.icon}</div>
              <span className={`v-stat-badge ${s.up ? 'up' : 'down'}`}>{s.delta}</span>
            </div>
            {s.value === null
              ? <Skeleton w="70%" h="28px" r="8px" style={{ margin:'8px 0 6px' }} />
              : <div className="v-stat-value">{s.value}</div>
            }
            <div className="v-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Revenue chart + Level ────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px', marginBottom:'24px' }} className="v-two-col">

        {/* Revenue sparkline */}
        <div className="v-card v-card-pad v-fade-in v-delay-1">
          <div className="v-section-header">
            <div>
              <div className="v-section-title">Revenue Overview</div>
              <select className="v-select" style={{ marginTop:'6px', padding:'5px 28px 5px 10px', fontSize:'12px', height:'30px' }}
                value={period} onChange={e => setPeriod(e.target.value)}>
                <option value="12m">Last 12 Months</option>
                <option value="30d">Last 6 Months</option>
              </select>
            </div>
            <div className="v-kpi-row">
              <span className="v-kpi-value">{loading ? '…' : sparkVal}</span>
              <span className="v-kpi-delta up">Total</span>
            </div>
          </div>

          {loading ? (
            <div style={{ height:'88px', display:'flex', alignItems:'flex-end', gap:'5px' }}>
              {[60,80,50,90,70,100,75,85,65,95,80,100].map((h,i) => (
                <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:'4px', background:'rgba(184,134,208,0.15)', animation:'pulse 1.4s ease-in-out infinite', animationDelay:`${i*0.06}s` }} />
              ))}
            </div>
          ) : (
            <>
              <div className="v-sparkline" style={{ height:'88px', gap:'5px' }}>
                {displayChart.map((d, i) => (
                  <div key={i}
                    className={`v-spark-bar${i === displayChart.length - 1 ? ' active' : ''}`}
                    style={{ height:`${Math.max(4, (d.value / chartMax) * 100)}%` }}
                    title={`${d.label}: ₹${Math.round(d.value).toLocaleString('en-IN')}`}
                  />
                ))}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:'8px' }}>
                {displayChart.map((d, i) => i % 2 === 0 && (
                  <span key={d.label} style={{ fontSize:'10px', color:'var(--v-text3)' }}>{d.label}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Vendor Level */}
        <div className="v-card v-card-pad v-fade-in v-delay-2" style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
          <div>
            <div className="v-section-title" style={{ marginBottom:'10px' }}>Vendor Level</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
              <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'linear-gradient(135deg,rgba(184,134,208,0.30),rgba(123,63,160,0.20))', border:'1px solid rgba(196,148,230,0.35)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Award size={22} style={{ color:'#7B3FA0' }} />
              </div>
              <div>
                {loading ? <Skeleton w="120px" h="14px" /> : (
                  <>
                    <div style={{ fontWeight:700, color:'var(--v-deep)', fontSize:'14px' }}>{level}</div>
                    {cfg.next && <div style={{ fontSize:'11px', color:'var(--v-text3)', marginTop:'2px' }}>Next: {cfg.next}</div>}
                  </>
                )}
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px' }}>
              <span style={{ fontSize:'11px', color:'var(--v-text3)' }}>Progress</span>
              <span style={{ fontSize:'11px', color:'var(--v-purple)', fontWeight:600 }}>{cfg.pct}%</span>
            </div>
            <div className="v-progress-track"><div className="v-progress-fill" style={{ width:`${cfg.pct}%` }} /></div>
          </div>
          <div className="v-divider" style={{ margin:0 }} />
          <div>
            <div style={{ fontSize:'12px', color:'var(--v-text3)', marginBottom:'5px' }}>Monthly Goals</div>
            {[
              { label:'Revenue',  current: Math.round(totalRevenue).toLocaleString('en-IN'), target:'3,00,000', pct: Math.min(100, Math.round((totalRevenue/300000)*100)) },
              { label:'Orders',   current: String(totalSales), target:'150', pct: Math.min(100, Math.round((totalSales/150)*100)) },
              { label:'Rating',   current: (Number(avgRating)||0).toFixed(1), target:'4.9', pct: Math.min(100, Math.round((Number(avgRating||0)/4.9)*100)) },
            ].map(g => (
              <div key={g.label} style={{ marginBottom:'10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontSize:'11px', color:'var(--v-text2)' }}>{g.label}</span>
                  <span style={{ fontSize:'10px', color:'var(--v-text3)' }}>{loading ? '…' : g.current} / {g.target}</span>
                </div>
                <div className="v-progress-track" style={{ height:'5px' }}>
                  <div className="v-progress-fill" style={{ width: loading ? '0%' : `${g.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Orders ────────────────────────────────────────────────── */}
      <div className="v-card v-card-pad v-fade-in v-delay-2" style={{ marginBottom:'20px' }}>
        <div className="v-section-header" style={{ marginBottom:'16px' }}>
          <div className="v-section-title">Recent Orders</div>
          <button onClick={() => navigate('/vendor/orders')} className="v-btn v-btn-ghost v-btn-sm" style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            View All <ArrowRight size={12} />
          </button>
        </div>

        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[1,2,3].map(i => <Skeleton key={i} h="52px" r="10px" />)}
          </div>
        ) : recentOrders.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center', color:'var(--v-text3)', fontSize:'13px' }}>
            <ShoppingBag size={28} style={{ opacity:0.3, margin:'0 auto 10px', display:'block' }} />
            No orders yet. Share your products to get started.
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(196,148,230,0.18)' }}>
                  {['Order ID','Customer','Product','Amount','Status','Date'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:700, color:'var(--v-text3)', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={o.id || i} style={{ borderBottom:'1px solid rgba(196,148,230,0.10)', transition:'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,134,208,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding:'12px', fontWeight:700, color:'var(--v-purple)' }}>{o.id}</td>
                    <td style={{ padding:'12px', color:'var(--v-text2)' }}>{o.customer}</td>
                    <td style={{ padding:'12px', color:'var(--v-dark)', maxWidth:'160px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.product}</td>
                    <td style={{ padding:'12px', fontWeight:700, color:'var(--v-deep)' }}>₹{Math.round(o.amount).toLocaleString('en-IN')}</td>
                    <td style={{ padding:'12px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 9px', borderRadius:'20px', background:`${STATUS_COLOR[o.status] || '#6b7280'}18`, color: STATUS_COLOR[o.status] || '#6b7280', textTransform:'capitalize' }}>
                        {o.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px', color:'var(--v-text3)', fontSize:'12px', whiteSpace:'nowrap' }}>{relTime(o.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3-column: Activity + Recent Products + Quick Actions ─────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 260px', gap:'20px', marginBottom:'24px' }} className="v-three-col">

        {/* Activity Feed */}
        <div className="v-card v-card-pad v-fade-in v-delay-2">
          <div className="v-section-header">
            <div className="v-section-title">Recent Activity</div>
            {!loading && activity.length > 0 && (
              <span className="v-badge v-badge-purple">{activity.length}</span>
            )}
          </div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ display:'flex', gap:'10px' }}>
                  <Skeleton w="8px" h="8px" r="50%" style={{ flexShrink:0, marginTop:'4px' }} />
                  <div style={{ flex:1 }}><Skeleton h="13px" w="90%" /><Skeleton h="10px" w="50%" style={{ marginTop:'5px' }} /></div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--v-text3)', fontSize:'13px' }}>
              <Clock size={24} style={{ opacity:0.3, margin:'0 auto 8px', display:'block' }} />
              No activity yet
            </div>
          ) : (
            <div className="v-timeline">
              {activity.map((a, i) => (
                <div key={i} className="v-timeline-item">
                  <div className="v-timeline-line">
                    <div className="v-timeline-dot" style={{ background: a.type === 'review' ? '#C7A55A' : a.type === 'order' ? '#7B3FA0' : 'var(--v-soft)' }} />
                    {i < activity.length - 1 && <div className="v-timeline-connector" />}
                  </div>
                  <div className="v-timeline-body">
                    <div className="v-timeline-title" style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                      {a.type === 'order'  && <ShoppingBag size={11} style={{ color:'#7B3FA0' }} />}
                      {a.type === 'review' && <Star size={11} style={{ color:'#C7A55A' }} />}
                      {a.text}
                    </div>
                    {a.sub && <div style={{ fontSize:'11px', color:'var(--v-text3)', marginTop:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{a.sub}</div>}
                    <div className="v-timeline-meta">{relTime(a.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Products */}
        <div className="v-card v-card-pad v-fade-in v-delay-3">
          <div className="v-section-header" style={{ marginBottom:'12px' }}>
            <div className="v-section-title">Recent Products</div>
            <button onClick={() => navigate('/vendor/products')} className="v-btn v-btn-ghost v-btn-sm" style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              Manage <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[1,2,3].map(i => <Skeleton key={i} h="56px" r="10px" />)}
            </div>
          ) : recentProducts.length === 0 ? (
            <div style={{ padding:'24px', textAlign:'center', color:'var(--v-text3)', fontSize:'13px' }}>
              <Package size={24} style={{ opacity:0.3, margin:'0 auto 8px', display:'block' }} />
              No products yet.
              <button onClick={() => navigate('/vendor/add-product')} className="v-btn v-btn-primary v-btn-sm" style={{ marginTop:'12px', display:'flex', alignItems:'center', gap:'6px', margin:'12px auto 0' }}>
                <PlusCircle size={12} /> Add First Product
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {recentProducts.map((p, i) => (
                <div key={p.id || i} style={{ display:'flex', gap:'10px', alignItems:'center', padding:'10px', borderRadius:'10px', background:'rgba(255,255,255,0.35)', border:'1px solid rgba(196,148,230,0.15)', transition:'all 0.18s', cursor:'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(184,134,208,0.10)'; e.currentTarget.style.borderColor='rgba(123,63,160,0.22)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor='rgba(196,148,230,0.15)'; }}
                  onClick={() => navigate('/vendor/products')}
                >
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt={p.title} style={{ width:'38px', height:'38px', borderRadius:'8px', objectFit:'cover', flexShrink:0, border:'1px solid rgba(220,198,255,0.25)' }} />
                  ) : (
                    <div style={{ width:'38px', height:'38px', borderRadius:'8px', background:'rgba(184,134,208,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Package size={16} style={{ color:'#7B3FA0' }} />
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'12px', fontWeight:700, color:'var(--v-deep)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</div>
                    <div style={{ fontSize:'11px', color:'var(--v-text3)', marginTop:'2px', display:'flex', gap:'8px' }}>
                      <span>₹{Math.round(p.price).toLocaleString('en-IN')}</span>
                      <span>·</span>
                      <span style={{ color: p.status === 'active' || p.status === 'published' ? '#16a34a' : '#d97706', fontWeight:600 }}>{p.status}</span>
                      {p.downloads > 0 && <><span>·</span><span>{p.downloads} dl</span></>}
                    </div>
                  </div>
                  {p.rating > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:'3px', flexShrink:0 }}>
                      <Star size={10} fill="#C7A55A" stroke="#C7A55A" />
                      <span style={{ fontSize:'11px', fontWeight:700, color:'#8B6B5B' }}>{Number(p.rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + Recent Reviews */}
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div className="v-card v-card-pad v-fade-in v-delay-3">
            <div className="v-section-title" style={{ marginBottom:'12px' }}>Quick Actions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} className="v-btn v-btn-secondary"
                  style={{ justifyContent:'flex-start', width:'100%', gap:'8px' }}
                  onClick={() => navigate(a.path)}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="v-card v-card-pad v-fade-in v-delay-4">
            <div className="v-section-header" style={{ marginBottom:'10px' }}>
              <div className="v-section-title" style={{ fontSize:'13px' }}>Latest Reviews</div>
              <button onClick={() => navigate('/vendor/reviews')} className="v-btn v-btn-ghost v-btn-sm">
                <Eye size={11} />
              </button>
            </div>
            {loading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {[1,2].map(i => <Skeleton key={i} h="46px" r="8px" />)}
              </div>
            ) : recentReviews.length === 0 ? (
              <div style={{ fontSize:'12px', color:'var(--v-text3)', textAlign:'center', padding:'16px 0' }}>
                <MessageSquare size={20} style={{ opacity:0.25, margin:'0 auto 6px', display:'block' }} />
                No reviews yet
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {recentReviews.slice(0,3).map((r, i) => (
                  <div key={r.id || i} style={{ padding:'10px', borderRadius:'9px', background:'rgba(184,134,208,0.08)', border:'1px solid rgba(196,148,230,0.15)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                      <span style={{ fontSize:'11px', fontWeight:700, color:'var(--v-deep)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'120px' }}>{r.productName}</span>
                      <div style={{ display:'flex', gap:'1px', flexShrink:0 }}>
                        {[1,2,3,4,5].map(s => <Star key={s} size={9} fill={s <= Math.round(r.rating) ? '#C7A55A' : 'none'} stroke="#C7A55A" />)}
                      </div>
                    </div>
                    {r.comment && (
                      <p style={{ fontSize:'11px', color:'var(--v-text3)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        "{r.comment}"
                      </p>
                    )}
                    <div style={{ fontSize:'10px', color:'var(--v-text3)', marginTop:'4px' }}>{relTime(r.date)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Earnings Summary Strip ───────────────────────────────────────── */}
      <div className="v-card v-card-pad v-fade-in v-delay-4">
        <div className="v-section-header" style={{ marginBottom:'16px' }}>
          <div className="v-section-title">Earnings Summary</div>
          <button onClick={() => navigate('/vendor/earnings')} className="v-btn v-btn-ghost v-btn-sm" style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            Full Report <ArrowRight size={12} />
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px' }} className="v-earnings-grid">
          {[
            { label:'Gross Revenue',   value: loading ? null : `₹${Math.round(totalRevenue).toLocaleString('en-IN')}`,                  icon:<DollarSign size={16}/>,  color:'rgba(184,134,208,0.18)' },
            { label:'Net Earnings',    value: loading ? null : `₹${Math.round(totalRevenue * 0.85).toLocaleString('en-IN')}`,            icon:<TrendingUp size={16}/>,  color:'rgba(123,63,160,0.12)'  },
            { label:'Platform Fee',    value: loading ? null : `₹${Math.round(totalRevenue * 0.15).toLocaleString('en-IN')}`,            icon:<Shield size={16}/>,      color:'rgba(220,198,255,0.20)' },
            { label:'Products Sold',   value: loading ? null : String(totalSales),                                                        icon:<ShoppingBag size={16}/>, color:'rgba(90,30,126,0.10)'   },
          ].map((e, i) => (
            <div key={i} style={{ padding:'16px 18px', borderRadius:'14px', background:e.color, border:'1px solid rgba(196,148,230,0.20)', backdropFilter:'blur(8px)' }}>
              <div style={{ color:'#7B3FA0', marginBottom:'8px' }}>{e.icon}</div>
              {e.value === null
                ? <Skeleton w="70%" h="20px" r="6px" style={{ marginBottom:'6px' }} />
                : <div style={{ fontSize:'1.2rem', fontWeight:700, color:'var(--v-deep)', lineHeight:1 }}>{e.value}</div>
              }
              <div style={{ fontSize:'11px', color:'var(--v-text3)', marginTop:'5px', fontWeight:600 }}>{e.label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width:1024px){
          .v-two-col   { grid-template-columns: 1fr !important; }
          .v-three-col { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width:640px){
          .v-three-col    { grid-template-columns: 1fr !important; }
          .v-earnings-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </VendorLayout>
  );
}
