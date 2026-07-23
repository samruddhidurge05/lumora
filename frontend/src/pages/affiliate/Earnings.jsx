import React, { useState, useMemo } from 'react';
import {
  DollarSign, Clock, CheckCircle, ArrowUpRight, TrendingUp,
  AlertCircle, RefreshCw, BarChart2, Wallet,
} from 'lucide-react';
import { backendFetch } from '../../utils/api';

/* ── Status style map ─────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  pending:   { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.30)',  color: '#B45309', label: 'Pending'   },
  approved:  { bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.30)',  color: '#4338CA', label: 'Approved'  },
  paid:      { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.30)',   color: '#15803D', label: 'Paid'      },
  completed: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.30)',   color: '#15803D', label: 'Completed' },
  rejected:  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.30)',   color: '#DC2626', label: 'Rejected'  },
};

/* ── Formatters ───────────────────────────────────────────────────────────── */
const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Build rolling 12-month earnings array from commission records.
 */
function buildMonthlyChart(commissions) {
  const now = new Date();
  const arr = new Array(12).fill(0);
  (commissions || []).forEach((c) => {
    if (!c.created_at && !c.date) return;
    const d = new Date(c.created_at || c.date);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff < 12) {
      arr[11 - diff] += (c.commission_amt || c.commission || 0);
    }
  });
  return arr;
}

function buildMonthLabels() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return d.toLocaleString('default', { month: 'short' });
  });
}

/* ══════════════════════════════════════════════════════════════════════════ */

export default function AffiliateEarnings({
  profile,
  stats,
  commissions: parentCommissions,
  payouts: parentPayouts,
  loading,
  error,
  refresh,
}) {
  const [statusFilter, setStatusFilter]     = useState('all');
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [withdrawError, setWithdrawError]   = useState(null);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  /* ── Normalise commission records from the API ──────────────────────────
     API shape: { id, product_name, sale_amount, commission_amt, status, created_at }
  ───────────────────────────────────────────────────────────────────────── */
  const activeCommissions = useMemo(() => {
    if (!parentCommissions || parentCommissions.length === 0) return [];
    return parentCommissions.map((c) => ({
      id:                 c.id,
      date:               c.created_at,
      orderId:            c.order_id ? `#ORD-${c.order_id}` : (c.orderId || 'N/A'),
      customerName:       c.customer_name || c.customerName || 'Customer',
      customerEmail:      c.customer_email || c.customerEmail || null,
      product:            c.product_name || c.product || 'Referral Product',
      productId:          c.product_id || c.productId || null,
      referralCode:       c.referral_code_used || c.referral_code || c.coupon_code || profile?.referral_code || 'AFF',
      attributionSource:  c.attribution_source || c.attributionSource || 'referral_link',
      saleAmount:         c.sale_amount  || c.saleAmount || 0,
      commission:         c.commission_amt || c.commission || 0,
      status:             c.commission_status || c.status || 'pending',
    }));
  }, [parentCommissions, profile]);

  /* ── Normalise payout records from the API ──────────────────────────────
     API shape: { id, amount, method, status, created_at }
  ───────────────────────────────────────────────────────────────────────── */
  const activePayouts = useMemo(() => {
    if (!parentPayouts || parentPayouts.length === 0) return [];
    return parentPayouts.map((p) => ({
      id:     p.id,
      date:   p.created_at,
      amount: p.amount || 0,
      method: p.method || 'upi',
      status: p.status || 'pending',
    }));
  }, [parentPayouts]);

  /* ── Earnings totals — prefer live stats, fall back to computed ─────── */
  const totalEarnings    = stats?.total_earnings    ?? activeCommissions.reduce((a, c) => a + c.commission, 0);
  const paidEarnings     = stats?.paid_earnings     ?? activeCommissions.filter(c => c.status === 'paid').reduce((a, c) => a + c.commission, 0);
  const pendingEarnings  = stats?.pending_earnings  ?? activeCommissions.filter(c => c.status === 'pending').reduce((a, c) => a + c.commission, 0);
  const approvedEarnings = activeCommissions.filter(c => c.status === 'approved').reduce((a, c) => a + c.commission, 0);

  /* Available balance = approved (ready to withdraw) commissions */
  const availableBalance = approvedEarnings;

  /* Commission rate from profile */
  const commissionRate = profile?.commission_rate ?? 20;

  /* ── Monthly chart ──────────────────────────────────────────────────── */
  const monthlyEarnings = useMemo(() => buildMonthlyChart(activeCommissions), [activeCommissions]);
  const monthLabels     = useMemo(() => buildMonthLabels(), []);
  const chartMax        = Math.max(...monthlyEarnings, 1);
  const chartTotal      = monthlyEarnings.reduce((a, b) => a + b, 0);
  const currentMonthIdx = 11; // always the last bar = current month

  /* ── Filtered commission list ────────────────────────────────────────── */
  const filtered = activeCommissions.filter(c => statusFilter === 'all' || c.status === statusFilter);

  /* ── Count by status for filter badges ───────────────────────────────── */
  const countByStatus = useMemo(() => {
    const m = { all: activeCommissions.length, pending: 0, approved: 0, paid: 0 };
    activeCommissions.forEach(c => { if (m[c.status] !== undefined) m[c.status]++; });
    return m;
  }, [activeCommissions]);

  /* ── YoY growth hint (best-effort from chart data) ────────────────────
     Compare current month vs same month last year (first bar).            */
  const yoyLabel = useMemo(() => {
    const curr = monthlyEarnings[11];
    const prev = monthlyEarnings[0];
    if (!prev || !curr) return null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct >= 0 ? `+${pct}% MoM` : `${pct}% MoM`;
  }, [monthlyEarnings]);

  /* ── Withdrawal handler ───────────────────────────────────────────────── */
  const handleWithdrawal = async () => {
    const amt = Number(withdrawAmount);
    if (!withdrawAmount || isNaN(amt) || amt <= 0) {
      setWithdrawError('Please enter a valid positive withdrawal amount.');
      return;
    }
    if (amt > availableBalance) {
      setWithdrawError(`Amount exceeds available balance of ${formatINR(availableBalance)}.`);
      return;
    }
    try {
      setSubmittingWithdraw(true);
      setWithdrawError(null);
      await backendFetch('/affiliate/payouts', {
        method: 'POST',
        body: JSON.stringify({
          amount:       amt,
          method:       profile?.upi_id ? 'upi' : 'bank',
          upi_id:       profile?.upi_id       || null,
          bank_account: profile?.account_number || null,
        }),
      });
      setWithdrawSuccess(true);
      setWithdrawAmount('');
      if (refresh) refresh();
      setTimeout(() => { setWithdrawSuccess(false); setShowWithdrawal(false); }, 2600);
    } catch (err) {
      console.error('Withdrawal error:', err);
      setWithdrawError(err.message || 'Failed to submit withdrawal request. Please try again.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     LOADING SKELETON
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="premium-flat-card" style={{ width: '120px', height: '12px', borderRadius: '6px', marginBottom: '10px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            <div className="premium-flat-card" style={{ width: '240px', height: '28px', borderRadius: '8px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          </div>
          <div className="premium-flat-card" style={{ width: '180px', height: '44px', borderRadius: '12px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        </div>
        {/* Stat cards skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: '20px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="premium-flat-card" style={{ height: '90px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="premium-flat-card" style={{ height: '240px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        {/* Table skeleton */}
        <div className="premium-flat-card" style={{ height: '320px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <style>{`@keyframes skeletonPulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ERROR STATE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '320px', gap: '16px', padding: '48px',
        background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(239,68,68,0.18)', borderRadius: '20px', textAlign: 'center',
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
          <AlertCircle size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Failed to load earnings</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '340px' }}>{error}</div>
        </div>
        {refresh && (
          <button
            onClick={refresh}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(123,63,160,0.35)' }}
          >
            <RefreshCw size={13} /> Try Again
          </button>
        )}
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MAIN RENDER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Financial Overview</span>
          <h2 className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '4px' }}>Earnings &amp; Payouts</h2>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {refresh && (
            <button
              onClick={refresh}
              title="Refresh"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: 'rgba(255,255,255,0.70)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'; e.currentTarget.style.color = '#7B3FA0'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(196,181,253,0.30)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={() => setShowWithdrawal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 24px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 18px rgba(123,63,160,0.38)', fontFamily: 'var(--font-sans)' }}
          >
            <ArrowUpRight size={14} /> Request Withdrawal
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', gap: '20px' }}>
        {[
          {
            label: 'Total Earnings',
            value: formatINR(totalEarnings),
            icon: <DollarSign size={15} />,
            color: '#7B3FA0',
            sub: 'All commissions combined',
          },
          {
            label: 'Paid Earnings',
            value: formatINR(paidEarnings),
            icon: <CheckCircle size={15} />,
            color: '#15803D',
            sub: 'Successfully transferred',
          },
          {
            label: 'Approved',
            value: formatINR(approvedEarnings),
            icon: <Wallet size={15} />,
            color: '#4338CA',
            sub: 'Ready to withdraw',
          },
          {
            label: 'Pending',
            value: formatINR(pendingEarnings),
            icon: <Clock size={15} />,
            color: '#B45309',
            sub: 'Awaiting approval',
          },
        ].map((s, i) => (
          <div key={i} className="premium-flat-card" style={{ padding: '22px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
              <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px', lineHeight: 1 }}>{s.value}</div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', display: 'block', marginTop: '6px', fontWeight: 500 }}>{s.sub}</span>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.06)', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
          </div>
        ))}
      </div>

      {/* ── COMMISSION BREAKDOWN STRIP ──────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Commission Rate</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7B3FA0', marginTop: '2px' }}>{commissionRate}%</div>
        </div>
        <div style={{ width: '1px', height: '36px', background: 'rgba(45,0,96,0.07)' }} />
        {[
          { label: 'Total Commissions', value: activeCommissions.length },
          { label: 'Paid',              value: countByStatus.paid,     color: '#15803D' },
          { label: 'Approved',          value: countByStatus.approved, color: '#4338CA' },
          { label: 'Pending',           value: countByStatus.pending,  color: '#B45309' },
        ].map((item, i) => (
          <div key={i}>
            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: item.color || 'var(--text-primary)', marginTop: '2px' }}>{item.value}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Available to Withdraw</span>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: availableBalance > 0 ? '#15803D' : 'var(--text-muted)', marginTop: '2px' }}>
            {formatINR(availableBalance)}
          </div>
        </div>
      </div>

      {/* ── MONTHLY CHART ───────────────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Trends</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Monthly Earnings</h3>
          </div>
          {yoyLabel && chartTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: '#15803D', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.22)', padding: '5px 12px', borderRadius: '20px' }}>
              <TrendingUp size={12} /> {yoyLabel}
            </div>
          )}
        </div>

        {chartTotal === 0 ? (
          <div style={{ height: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed rgba(196,181,253,0.40)', borderRadius: '12px' }}>
            <BarChart2 size={32} style={{ color: 'rgba(196,181,253,0.70)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>No commission data yet — your monthly chart will appear here</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px' }}>
            {monthlyEarnings.map((val, i) => {
              const pct       = (val / chartMax) * 100;
              const isHighest = val === chartMax && val > 0;
              const isCurrent = i === currentMonthIdx;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    title={`${monthLabels[i]}: ${formatINR(val)}`}
                    style={{
                      width: '100%',
                      height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                      minHeight: val > 0 ? '4px' : '2px',
                      borderRadius: '6px 6px 3px 3px',
                      background: (isHighest || isCurrent)
                        ? 'linear-gradient(180deg,#7B3FA0,#5A1E7E)'
                        : val > 0
                          ? 'rgba(196,181,253,0.50)'
                          : 'rgba(196,181,253,0.15)',
                      border: (isHighest || isCurrent)
                        ? '1px solid rgba(123,63,160,0.30)'
                        : '1px solid rgba(196,181,253,0.20)',
                      transition: 'all 0.3s',
                      cursor: 'default',
                    }}
                  />
                  <span style={{ fontSize: '0.55rem', fontWeight: 600, color: (isHighest || isCurrent) ? '#7B3FA0' : 'var(--text-muted)' }}>
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

      {/* ── COMMISSION TABLE ─────────────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Commission Log</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Commission History</h3>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(45,0,96,0.02)', padding: '4px', borderRadius: '20px', border: '1px solid rgba(45,0,96,0.06)' }}>
            {['all','pending','approved','paid'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 14px', borderRadius: '16px', fontSize: '0.72rem', fontWeight: 600,
                  border: 'none', outline: 'none', cursor: 'pointer',
                  background: statusFilter === s ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'transparent',
                  color: statusFilter === s ? '#fff' : 'var(--text-muted)',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                }}
              >
                {s}{countByStatus[s] > 0 && s !== 'all' && (
                  <span style={{ marginLeft: '5px', fontSize: '0.6rem', opacity: 0.8 }}>({countByStatus[s]})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr 2fr 1.3fr 1fr 1.1fr 1fr', gap: '10px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(45,0,96,0.02)', marginBottom: '4px', minWidth: '780px' }}>
            {['Date', 'Order ID', 'Customer', 'Product', 'Code / Source', 'Sale Price', 'Commission', 'Status'].map(h => (
              <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {filtered.length > 0 ? (
            filtered.map((row, idx) => {
              const st = STATUS_STYLE[row.status] || STATUS_STYLE.pending;
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 1.2fr 2fr 1.3fr 1fr 1.1fr 1fr',
                    gap: '10px', padding: '13px 16px',
                    borderRadius: '10px',
                    borderTop: idx > 0 ? '1px solid rgba(45,0,96,0.04)' : 'none',
                    transition: 'background 0.2s',
                    alignItems: 'center',
                    minWidth: '780px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-light)' }}>{formatDate(row.date)}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7B3FA0' }}>{row.orderId}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customerName}</span>
                  <span style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.product}</span>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2D004D' }}>{row.referralCode}</span>
                    <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {row.attributionSource === 'coupon_code' ? '🏷️ Coupon' : '🔗 Link'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{formatINR(row.saleAmount)}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(row.commission)}</span>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                      background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                    }}>{st.label}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <DollarSign size={32} style={{ color: 'rgba(196,181,253,0.60)', marginBottom: '12px' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {activeCommissions.length === 0 ? 'No commissions yet' : `No ${statusFilter} commissions`}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {activeCommissions.length === 0
                  ? 'Share your referral link to start earning commissions.'
                  : 'Try a different filter to see other commissions.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RECENT PAYOUTS ───────────────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px' }}>
        <div style={{ marginBottom: '20px' }}>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Payout History</span>
          <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Recent Payout Requests</h3>
        </div>

        {activePayouts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px' }}>
            <Wallet size={30} style={{ color: 'rgba(196,181,253,0.70)', marginBottom: '10px' }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No payout requests yet</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Once you request a withdrawal, your payout history will appear here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(45,0,96,0.02)', marginBottom: '4px' }}>
              {['Date', 'Amount', 'Method', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
              ))}
            </div>
            {activePayouts.map((p, idx) => {
              const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '12px', padding: '13px 16px',
                    borderRadius: '10px',
                    borderTop: idx > 0 ? '1px solid rgba(45,0,96,0.04)' : 'none',
                    transition: 'background 0.2s',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-light)' }}>{formatDate(p.date)}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(p.amount)}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{p.method}</span>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700,
                      background: st.bg, border: `1px solid ${st.border}`, color: st.color,
                    }}>{st.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── WITHDRAWAL MODAL ─────────────────────────────────────────────────── */}
      {showWithdrawal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(45,0,77,0.35)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowWithdrawal(false); }}
        >
          <div className="glass-card" style={{
            width: '100%', maxWidth: '440px',
            background: 'rgba(255,255,255,0.94)',
            border: '1px solid rgba(123,63,160,0.28)',
            boxShadow: '0 24px 64px rgba(45,0,96,0.22)',
            padding: '36px', borderRadius: '24px',
          }}>
            {withdrawSuccess ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: '2.4rem', marginBottom: '12px' }}>🎉</div>
                <h3 className="text-editorial" style={{ fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 400 }}>Request Submitted!</h3>
                <p style={{ color: 'var(--text-light)', fontSize: '0.82rem', marginTop: '8px', lineHeight: 1.5 }}>
                  Your withdrawal request has been submitted. Processing takes 2–3 business days.
                </p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <span className="caption-premium" style={{ color: '#7B3FA0' }}>Withdraw Funds</span>
                  <h3 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '4px' }}>Request Payout</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
                    Available balance:{' '}
                    <strong style={{ color: availableBalance > 0 ? '#7B3FA0' : '#B45309' }}>
                      {formatINR(availableBalance)}
                    </strong>
                  </p>
                  {availableBalance === 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', color: '#B45309', fontSize: '0.72rem', fontWeight: 500 }}>
                      You have no approved commissions available for withdrawal at this time.
                    </div>
                  )}
                </div>

                {profile?.upi_id && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.25)', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '14px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Method</span>
                    <span style={{ fontWeight: 700, color: '#7B3FA0' }}>UPI — {profile.upi_id}</span>
                  </div>
                )}

                {withdrawError && (
                  <div style={{ padding: '10px 14px', borderRadius: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626', fontSize: '0.75rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={14} /> {withdrawError}
                  </div>
                )}

                <div className="glass-input" style={{ padding: '12px 16px', marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                    Amount (INR)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={withdrawAmount}
                    min={1}
                    max={availableBalance}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleWithdrawal}
                    disabled={submittingWithdraw || availableBalance === 0}
                    style={{
                      flex: 1, padding: '12px', fontSize: '0.84rem', fontWeight: 700,
                      borderRadius: '12px', border: 'none',
                      background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff',
                      cursor: (submittingWithdraw || availableBalance === 0) ? 'not-allowed' : 'pointer',
                      opacity: (submittingWithdraw || availableBalance === 0) ? 0.65 : 1,
                      fontFamily: 'var(--font-sans)',
                      boxShadow: '0 4px 16px rgba(123,63,160,0.36)',
                    }}
                  >
                    {submittingWithdraw ? 'Submitting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => { setShowWithdrawal(false); setWithdrawError(null); setWithdrawAmount(''); }}
                    style={{ flex: 1, padding: '12px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: '1.5px solid rgba(185,157,216,0.35)', background: 'rgba(255,255,255,0.80)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
