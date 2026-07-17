import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard, Link2, DollarSign, TrendingUp, Users,
  MousePointerClick, BarChart2, ArrowUpRight, Copy, Check,
  Activity, Sparkles, ShoppingBag, Star, AlertCircle, RefreshCw,
  Clock, CheckCircle, XCircle, HelpCircle, User, Headset
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

/* ── Fallback mock data — shown only when backend has no records ──────────── */
const MOCK_STATS = {
  totalEarnings: 0,
  totalSales: 0,
  referralClicks: 0,
  conversionRate: 0,
};

const MOCK_ACTIVITY = [];
const MOCK_TOP_PRODUCTS = [];

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

/**
 * Build a 12-month earnings array from commission records.
 * Groups by calendar month relative to the current date.
 */
function buildMonthlyEarnings(commissions) {
  const now = new Date();
  const arr = new Array(12).fill(0);
  (commissions || []).forEach((c) => {
    if (!c.created_at && !c.date) return;
    const d = new Date(c.created_at || c.date);
    const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (mDiff >= 0 && mDiff < 12) {
      arr[11 - mDiff] += (c.commission_amt || 0);
    }
  });
  return arr;
}

/**
 * Build rolling 12-month labels ending at current month.
 */
function buildMonthLabels() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return d.toLocaleString('default', { month: 'short' });
  });
}

/**
 * Relative time helper.
 */
function relativeTime(dateStr) {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins} mins ago`;
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function AffiliateDashboardHome({
  profile,
  stats,
  commissions,
  payouts,
  loading: parentLoading,
  error,
  refresh,
}) {
  const { navigateTo } = useApp();
  const { user } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  /* ── Sync active tab when hash changes (e.g. from navigateTo buttons) ── */
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const parts = hash.split('/');
      const sub = parts[1];
      const valid = ['dashboard', 'products', 'earnings', 'profile'];
      // Only propagate if AffiliateDashboard is still mounted and tab exists
      if (valid.includes(sub)) {
        // Bubble up by dispatching a custom event that AffiliateDashboard listens to
        window.dispatchEvent(new CustomEvent('affiliate-tab-change', { detail: sub }));
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const loading = parentLoading !== undefined ? parentLoading : localLoading;

  /* Referral link from live stats, then profile, then fallback */
  const REFERRAL_CODE = stats?.referral_code || profile?.referral_code || 'AFF001';
  const SITE_URL      = import.meta.env.VITE_SITE_URL || window.location.origin;
  const REFERRAL_LINK = stats?.referral_link || `${SITE_URL}?ref=${REFERRAL_CODE}`;

  /* Welcome name: Firebase displayName → profile → email prefix → generic */
  const welcomeName = useMemo(() => {
    const n =
      user?.displayName ||
      profile?.name ||
      user?.email?.split('@')[0] ||
      'Affiliate';
    return n.split(' ')[0]; // First name only
  }, [user, profile]);

  /* ── Local loading fallback ───────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setLocalLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  /* ── Mouse glow tracking ─────────────────────────────────────────────── */
  useEffect(() => {
    const handleMouse = (e) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(REFERRAL_LINK).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  /* ── Live stats (fallback to zeroes, not fake mock numbers) ──────────── */
  const activeStats = {
    totalEarnings:  stats?.total_earnings   ?? MOCK_STATS.totalEarnings,
    totalSales:     stats?.total_sales      ?? MOCK_STATS.totalSales,
    referralClicks: stats?.total_clicks     ?? MOCK_STATS.referralClicks,
    conversionRate: stats?.conversion_rate  ?? MOCK_STATS.conversionRate,
    pendingEarnings:stats?.pending_earnings ?? 0,
    paidEarnings:   stats?.paid_earnings    ?? 0,
    revenueGenerated: stats?.revenue_generated ?? 0,
  };

  /* ── Commission summary breakdown ────────────────────────────────────── */
  const commissionBreakdown = useMemo(() => {
    const list = commissions || [];
    const paid     = list.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amt || 0), 0);
    const approved = list.filter(c => c.status === 'approved').reduce((s, c) => s + (c.commission_amt || 0), 0);
    const pending  = list.filter(c => c.status === 'pending').reduce((s, c) => s + (c.commission_amt || 0), 0);
    return {
      paid:     stats?.paid_earnings    ?? paid,
      approved: approved,
      pending:  stats?.pending_earnings ?? pending,
      total:    stats?.total_earnings   ?? (paid + approved + pending),
    };
  }, [commissions, stats]);

  /* ── Monthly earnings chart (built from live commissions) ────────────── */
  const monthlyEarnings = useMemo(() => {
    if (commissions && commissions.length > 0) {
      return buildMonthlyEarnings(commissions);
    }
    return new Array(12).fill(0);
  }, [commissions]);

  const monthLabels = useMemo(() => buildMonthLabels(), []);
  const chartMax = Math.max(...monthlyEarnings, 1); // avoid divide-by-zero
  const chartTotal = monthlyEarnings.reduce((a, b) => a + b, 0);

  /* ── Top performing products (from commissions) ──────────────────────── */
  const displayTopProducts = useMemo(() => {
    if (commissions && commissions.length > 0) {
      const map = {};
      commissions.forEach((c) => {
        const pName = c.product_name || 'Referral Product';
        if (!map[pName]) {
          map[pName] = {
            id: pName,
            name: pName,
            sales: 0,
            commission: 0,
            preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=60&q=60',
          };
        }
        map[pName].sales += 1;
        map[pName].commission += (c.commission_amt || 0);
      });
      return Object.values(map).sort((a, b) => b.commission - a.commission).slice(0, 5);
    }
    return MOCK_TOP_PRODUCTS;
  }, [commissions]);

  /* ── Recent activity feed (from commissions + payouts) ───────────────── */
  const displayActivity = useMemo(() => {
    const feed = [];
    const comms   = commissions || [];
    const payoutL = payouts     || [];

    comms.slice(0, 4).forEach((c, idx) => {
      feed.push({
        id:    `comm-${c.id || idx}`,
        type:  'commission',
        title: 'Commission recorded',
        desc:  `${c.product_name || 'Product'} — ${formatINR(c.commission_amt)}`,
        time:  relativeTime(c.created_at),
        icon:  <DollarSign size={13} />,
        status: c.status,
      });
    });

    payoutL.slice(0, 2).forEach((p, idx) => {
      feed.push({
        id:    `pay-${p.id || idx}`,
        type:  'payout',
        title: `Payout ${p.status}`,
        desc:  `${formatINR(p.amount)} via ${(p.method || 'UPI').toUpperCase()}`,
        time:  relativeTime(p.created_at),
        icon:  <Check size={13} />,
        status: p.status,
      });
    });

    // Sort by most recent first (rough heuristic by id order since creation is desc)
    return feed.slice(0, 6);
  }, [commissions, payouts]);

  /* ── Status colour map ───────────────────────────────────────────────── */
  const STATUS_COLOR = {
    paid:      '#15803D',
    approved:  '#4338CA',
    pending:   '#B45309',
    completed: '#15803D',
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     SKELETON LOADER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div className="premium-flat-card" style={{ height: '160px', borderRadius: '20px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '20px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="premium-flat-card" style={{ height: '100px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
        <div className="premium-flat-card" style={{ height: '70px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div className="aff-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="premium-flat-card" style={{ height: '280px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          <div className="premium-flat-card" style={{ height: '280px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        </div>
        <style>{`@keyframes skeletonPulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ERROR STATE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '320px', gap: '16px',
        background: 'rgba(255,255,255,0.70)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(239,68,68,0.18)',
        borderRadius: '20px',
        padding: '40px',
        textAlign: 'center',
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
          <AlertCircle size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Failed to load dashboard</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '340px' }}>{error}</div>
        </div>
        {refresh && (
          <button
            onClick={refresh}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '10px 22px', fontSize: '0.82rem', fontWeight: 700,
              borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)',
              boxShadow: '0 4px 14px rgba(123,63,160,0.35)',
            }}
          >
            <RefreshCw size={13} /> Try Again
          </button>
        )}
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MAIN RENDER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div ref={containerRef} className="aff-page-wrap" style={{ display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative' }}>

      {/* Mouse glow */}
      <div style={{
        position: 'fixed',
        left: `${mousePos.x}px`,
        top:  `${mousePos.y}px`,
        width: '420px', height: '420px',
        background: 'radial-gradient(circle, rgba(196,181,253,0.12) 0%, transparent 70%)',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── HERO BANNER ──────────────────────────────────────────────────────── */}
      <div className="glass-card" style={{
        padding: '40px 44px',
        background: 'linear-gradient(135deg, rgba(246,244,255,0.92) 0%, rgba(237,233,254,0.60) 100%)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '24px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ position: 'absolute', top: '-60px', right: '80px', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,181,253,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>✦ Affiliate Program</span>
          <h1 className="text-editorial" style={{ fontSize: '2.6rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1.05 }}>
            Welcome back, {welcomeName}.
          </h1>
          <p style={{ color: 'var(--text-light)', fontSize: '0.875rem', marginTop: '10px', lineHeight: 1.6, maxWidth: '440px' }}>
            Share Lumora products and earn up to 30% commission on every sale through your referral link.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('affiliate-tab-change', { detail: 'products' }))}
              style={{ display:'inline-flex', alignItems:'center', gap:'7px', padding:'10px 22px', fontSize:'0.84rem', fontWeight:700, borderRadius:'12px', border:'none', background:'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color:'#fff', cursor:'pointer', boxShadow:'0 4px 18px rgba(123,63,160,0.38)', fontFamily:'var(--font-sans)' }}
            >
              <Link2 size={14} /> Get Links
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('affiliate-tab-change', { detail: 'earnings' }))}
              style={{ display:'inline-flex', alignItems:'center', gap:'7px', padding:'10px 22px', fontSize:'0.84rem', fontWeight:700, borderRadius:'12px', border:'1.5px solid rgba(185,157,216,0.35)', background:'rgba(255,255,255,0.80)', color:'var(--text-primary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}
            >
              View Earnings
            </button>
            {refresh && (
              <button
                onClick={refresh}
                title="Refresh dashboard"
                style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(196,181,253,0.30)', background:'rgba(255,255,255,0.70)', color:'var(--text-muted)', cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'; e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(196,181,253,0.30)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Quick copy widget */}
        <div style={{
          background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(196,181,253,0.35)', borderRadius: '16px',
          padding: '20px 24px', minWidth: '280px',
          boxShadow: '0 8px 32px rgba(123,63,160,0.10)', position: 'relative', zIndex: 2,
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px' }}>Your Referral Link</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', wordBreak: 'break-all', lineHeight: 1.4 }}>{REFERRAL_LINK}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            Code: <span style={{ color: '#7B3FA0', fontWeight: 800 }}>{REFERRAL_CODE}</span>
          </div>
          <button
            onClick={handleCopyLink}
            style={{
              width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              padding: '9px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '10px',
              border: copiedLink ? '1.5px solid rgba(34,197,94,0.50)' : '1.5px solid rgba(185,157,216,0.40)',
              background: copiedLink ? 'rgba(34,197,94,0.07)' : 'rgba(123,63,160,0.06)',
              color: copiedLink ? '#16a34a' : '#7B3FA0',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.25s',
            }}
          >
            {copiedLink ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ───────────────────────────────────────────────────────── */}
      <div className="aff-stat-grid" style={{ position: 'relative', zIndex: 1 }}>
        {[
          {
            label: 'Total Earnings',
            value: formatINR(activeStats.totalEarnings),
            sub: 'All-time commissions',
            icon: <DollarSign size={14} />,
            trend: 'Total commission',
          },
          {
            label: 'Pending Earnings',
            value: formatINR(activeStats.pendingEarnings),
            sub: 'Awaiting approval/payout',
            icon: <Clock size={14} />,
            trend: 'In verification',
          },
          {
            label: 'Paid Earnings',
            value: formatINR(activeStats.paidEarnings),
            sub: 'Transferred to account',
            icon: <CheckCircle size={14} />,
            trend: 'Fully settled',
          },
          {
            label: 'Total Sales',
            value: formatINR(activeStats.revenueGenerated),
            sub: 'Revenue generated',
            icon: <TrendingUp size={14} />,
            trend: 'Store revenue',
          },
          {
            label: 'Total Referrals',
            value: activeStats.totalSales,
            sub: 'Successful referrals',
            icon: <Users size={14} />,
            trend: 'Conversions',
          },
          {
            label: 'Total Clicks',
            value: (activeStats.referralClicks || 0).toLocaleString(),
            sub: 'Referral link visits',
            icon: <MousePointerClick size={14} />,
            trend: 'Unique clicks',
          },
        ].map((stat, idx) => (
          <div key={idx} className="premium-flat-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
              <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1 }}>{stat.value}</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block', marginTop: '6px', fontWeight: 500 }}>{stat.sub}</span>
              <span style={{ fontSize: '0.65rem', color: '#7B3FA0', display: 'block', marginTop: '3px', fontWeight: 600 }}>{stat.trend}</span>
            </div>
            <div style={{
              width: '34px', height: '34px', borderRadius: '8px',
              background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.06)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {stat.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── COMMISSION SUMMARY STRIP ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{
        padding: '18px 24px', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))',
        gap: '16px', position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: 0 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Commission Summary</span>
        </div>
        {[
          { label: 'Paid Out',  value: formatINR(commissionBreakdown.paid),     color: '#15803D', bg: 'rgba(34,197,94,0.07)',    icon: <CheckCircle size={13} /> },
          { label: 'Approved',  value: formatINR(commissionBreakdown.approved), color: '#4338CA', bg: 'rgba(99,102,241,0.07)',   icon: <Check size={13} /> },
          { label: 'Pending',   value: formatINR(commissionBreakdown.pending),  color: '#B45309', bg: 'rgba(245,158,11,0.07)',   icon: <Clock size={13} /> },
          { label: 'Total',     value: formatINR(commissionBreakdown.total),    color: '#7B3FA0', bg: 'rgba(123,63,160,0.07)',   icon: <DollarSign size={13} /> },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: item.bg, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: item.color, marginTop: '2px' }}>{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CHART + ACTIVITY ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', position: 'relative', zIndex: 1 }} className="aff-two-col">

        {/* Monthly Earnings Bar Chart */}
        <div className="premium-flat-card" style={{ padding: '28px 28px 20px' }}>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="caption-premium" style={{ color: '#7B3FA0' }}>Performance</span>
              <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Earnings Overview</h3>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>12-Month Total</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7B3FA0', marginTop: '2px' }}>{formatINR(chartTotal)}</div>
            </div>
          </div>

          {chartTotal === 0 ? (
            /* Empty chart state */
            <div style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px' }}>
              <BarChart2 size={28} style={{ color: 'rgba(196,181,253,0.70)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>No earnings data yet — share your link to get started</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px' }}>
              {monthlyEarnings.map((val, i) => {
                const pct = (val / chartMax) * 100;
                const isHighest = val === chartMax && val > 0;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={`${monthLabels[i]}: ${formatINR(val)}`}
                      style={{
                        width: '100%',
                        height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                        borderRadius: '6px 6px 3px 3px',
                        background: isHighest
                          ? 'linear-gradient(180deg, #7B3FA0, #5A1E7E)'
                          : val > 0
                            ? 'rgba(196,181,253,0.55)'
                            : 'rgba(196,181,253,0.15)',
                        border: isHighest
                          ? '1px solid rgba(123,63,160,0.30)'
                          : '1px solid rgba(196,181,253,0.20)',
                        transition: 'all 0.3s',
                        minHeight: val > 0 ? '4px' : '2px',
                        cursor: 'default',
                      }}
                    />
                    <span style={{ fontSize: '0.55rem', fontWeight: 600, color: isHighest ? '#7B3FA0' : 'var(--text-muted)' }}>
                      {monthLabels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(45,0,96,0.05)', paddingTop: '14px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Last 12 months</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(chartTotal)} total</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="premium-flat-card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '20px' }}>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Vault Diary</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Recent Activity</h3>
          </div>

          {displayActivity.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '140px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
              <Activity size={26} style={{ color: 'rgba(196,181,253,0.70)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>No activity yet</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>Your commissions and payouts will appear here</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {displayActivity.map((act, idx) => (
                <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '8px',
                      background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.30)',
                      color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {act.icon}
                    </div>
                    {idx !== displayActivity.length - 1 && (
                      <div style={{ width: '1px', height: '18px', background: 'rgba(45,0,96,0.06)', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.title}</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>{act.time}</span>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-light)', marginTop: '2px', fontWeight: 500 }}>{act.desc}</p>
                    {act.status && (
                      <span style={{
                        fontSize: '0.58rem', fontWeight: 700, color: STATUS_COLOR[act.status] || 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {act.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── TOP PERFORMING PRODUCTS ───────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Leaderboard</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Top Performing Products</h3>
          </div>
          <button
            onClick={() => navigateTo('affiliate-products')}
            className="btn-minimal"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem' }}
          >
            View All <ArrowUpRight size={11} />
          </button>
        </div>

        {displayTopProducts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '120px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <ShoppingBag size={28} style={{ color: 'rgba(196,181,253,0.70)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>No product sales yet</span>
            <button
              onClick={() => navigateTo('affiliate-products')}
              style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7B3FA0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', textDecoration: 'underline' }}
            >
              Browse products to share →
            </button>
          </div>
        ) : (
          <div className="aff-table-wrap" style={{ minWidth: 0 }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(45,0,96,0.02)', marginBottom: '8px', minWidth: '440px' }}>
              {['Product', 'Total Sales', 'Commission Earned'].map(h => (
                <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {displayTopProducts.map((prod, idx) => (
              <div
                key={prod.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '16px', padding: '12px', borderRadius: '10px', minWidth: '440px',
                  border: '1px solid transparent', transition: 'all 0.25s', alignItems: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.03)'; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.20)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', width: '16px', flexShrink: 0 }}>#{idx + 1}</span>
                  <img src={prod.preview} alt={prod.name} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(45,0,96,0.07)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.name}</span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{prod.sales}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(prod.commission)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RECENT REFERRALS ─────────────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Sales Feed</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Recent Referrals</h3>
          </div>
        </div>

        {(!commissions || commissions.length === 0) ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '120px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <Users size={28} style={{ color: 'rgba(196,181,253,0.70)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>No referrals recorded yet</span>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '16px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(45,0,96,0.02)', marginBottom: '8px' }}>
              {['Product', 'Sale Amount', 'Commission', 'Status', 'Date'].map(h => (
                <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {commissions.slice(0, 5).map((comm, idx) => (
              <div
                key={comm.id || idx}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  gap: '16px', padding: '12px', borderRadius: '10px',
                  border: '1px solid transparent', transition: 'all 0.25s', alignItems: 'center',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.03)'; e.currentTarget.style.borderColor = 'rgba(196,181,253,0.20)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comm.product_name || 'Referral Sale'}</span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{formatINR(comm.sale_amount)}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(comm.commission_amt)}</span>
                <div>
                  <span style={{
                    padding: '4px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 750,
                    background: comm.status === 'paid' ? 'rgba(34,197,94,0.1)' : comm.status === 'approved' ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)',
                    color: STATUS_COLOR[comm.status] || 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}>
                    {comm.status}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{relativeTime(comm.created_at || comm.date)}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── REFERRAL PERFORMANCE STRIP ────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '22px 28px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '16px' }}>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Analytics</span>
          <h3 className="text-editorial" style={{ fontSize: '1.3rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Referral Performance</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: '16px' }}>
          {[
            { label: 'Referral Code',   value: REFERRAL_CODE,                                  icon: <Link2 size={13} />,           color: '#7B3FA0' },
            { label: 'Total Clicks',    value: (activeStats.referralClicks || 0).toLocaleString(), icon: <MousePointerClick size={13} />, color: '#4338CA' },
            { label: 'Conversions',     value: activeStats.totalSales,                          icon: <Users size={13} />,           color: '#15803D' },
            { label: 'Conversion Rate', value: `${activeStats.conversionRate}%`,                icon: <TrendingUp size={13} />,      color: '#B45309' },
            { label: 'Avg Commission',  value: activeStats.totalSales > 0 ? formatINR(activeStats.totalEarnings / activeStats.totalSales) : '—', icon: <DollarSign size={13} />, color: '#7B3FA0' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(196,181,253,0.25)', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: item.color, marginTop: '2px' }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── QUICK ACTIONS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '16px', position: 'relative', zIndex: 1 }}>
        {[
          { label: 'Browse Products',  sub: 'Generate referral links',    icon: <Link2 size={18} />,      action: () => navigateTo('affiliate-products') },
          { label: 'View Earnings & Payouts', sub: 'Track commissions and payouts', icon: <BarChart2 size={18} />,  action: () => navigateTo('affiliate-earnings') },
          { label: 'Edit Profile',     sub: 'Update payment details',      icon: <User size={18} />,       action: () => navigateTo('affiliate-profile') },
          { label: 'Support',          sub: 'Get help and support',        icon: <Headset size={18} />,    action: () => navigateTo('affiliate-support') },
        ].map((qa, i) => (
          <button
            key={i}
            onClick={qa.action}
            className="premium-flat-card"
            style={{
              padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '6px',
              textAlign: 'left', border: '1px solid rgba(45,0,96,0.06)',
              background: 'rgba(255,255,255,0.75)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', outline: 'none', transition: 'all 0.25s', height: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,63,160,0.22)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(123,63,160,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(45,0,96,0.06)'; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px' }}>
              {qa.icon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>{qa.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{qa.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        @media (max-width: 860px) { .aff-two-col { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
