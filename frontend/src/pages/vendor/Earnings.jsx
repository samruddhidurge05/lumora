import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useDashboard, useOrders, useWithdrawals } from '../../hooks/useVendorData';
import { useVendorChartData } from '../../hooks/useVendorChartData';
import VendorChartControls from '../../components/vendor/VendorChartControls';
import VendorBarChart from '../../components/vendor/VendorBarChart';
import { 
  Package, Clock, DollarSign, Wallet, Percent, Award,
  RefreshCw, AlertCircle, FileText, CheckCircle2
} from 'lucide-react';

function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

const MONTHS = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];

function MiniBar({ data, height = 60 }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: '3px 3px 0 0', minHeight: 3,
          height: `${(v / max) * 100}%`,
          background: i === data.length - 1
            ? 'linear-gradient(180deg,#7B3FA0,#B886D0)'
            : 'linear-gradient(180deg,#B886D0,rgba(216,191,227,0.4))',
        }} />
      ))}
    </div>
  );
}

export default function Earnings() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [period, setPeriod] = useState('12m');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const isMobile = useIsMobile();
  
  const { data: dashboardData, loading: dashLoading, error: dashError, refresh: refreshDash } = useDashboard();
  const { orders: liveOrders, loading: ordersLoading, error: ordersError, refresh: refreshOrders } = useOrders();
  const { history: liveWithdrawals, loading: withdrawalsLoading, error: withdrawalsError, refresh: refreshWithdrawals } = useWithdrawals();

  const loading = dashLoading || ordersLoading || withdrawalsLoading;
  const backendError = dashError || ordersError || withdrawalsError;

  const refreshAll = () => {
    refreshDash();
    refreshOrders();
    refreshWithdrawals();
  };

  const orders = liveOrders || [];
  const withdrawals = liveWithdrawals || [];

  // Earnings calculations (15% platform fee)
  const FEE_PCT = 0.15;
  
  const totalGross = orders.reduce((s, o) => s + (o.amount || 0), 0);

  const totalFees = Math.round(totalGross * FEE_PCT);
  const totalNet  = totalGross - totalFees;

  const totalWithdrawn = withdrawals
    .filter(w => w.status === 'completed')
    .reduce((s, w) => s + (w.amount || 0), 0);
    
  const pendingWithdrawn = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((s, w) => s + (w.amount || 0), 0);

  const available = Math.max(0, totalNet - totalWithdrawn - pendingWithdrawn);

  // Pending vs Paid Earnings
  const pendingOrdersRevenue = orders
    .filter(o => o.status === 'pending' || o.status === 'processing')
    .reduce((s, o) => s + (o.amount || 0), 0);
  const pendingEarnings = Math.round(pendingOrdersRevenue * (1 - FEE_PCT));

  const completedOrdersRevenue = orders
    .filter(o => o.status === 'completed')
    .reduce((s, o) => s + (o.amount || 0), 0);
  const paidEarnings = Math.round(completedOrdersRevenue * (1 - FEE_PCT));

  const goalAmount = 1500000;
  const goalPct    = Math.min(100, Math.round((totalNet / goalAmount) * 100));

  // Transactions list collation
  const salesTxns = orders.map(o => ({
    id: o.id,
    product: o.product || o.productName || 'Product Sale',
    amount: o.amount || 0,
    fee: Math.round((o.amount || 0) * FEE_PCT),
    net: Math.round((o.amount || 0) * (1 - FEE_PCT)),
    date: o.date ? new Date(o.date).toLocaleDateString() : 'Recent',
    type: 'sale',
    status: o.status
  }));

  const withdrawalTxns = withdrawals.map(w => ({
    id: w.id,
    product: 'Withdrawal Request',
    amount: w.amount || 0,
    fee: 0,
    net: -w.amount,
    date: w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent',
    type: 'withdrawal',
    status: w.status
  }));

  const allTxns = [...salesTxns, ...withdrawalTxns].sort((a, b) => new Date(b.date) - new Date(a.date));

  const transactions = allTxns;
  const filtered = transactions.filter(t => tab === 'all' || t.type === tab);

  // Chart aggregation — use shared hook for consistent filtering
  const { series: chartSeries } = useVendorChartData(liveOrders, period, selectedMonth);
  // Keep old displayMonths/chartGross/chartNet for the Revenue Comparison bars
  const displayMonths = chartSeries.map(s => s.label);
  const chartGross    = chartSeries.map(s => s.revenue);
  const chartNet      = chartSeries.map(s => s.net);

  const formatRevenue = (val) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    return `₹${val.toLocaleString()}`;
  };

  return (
    <VendorLayout activePage="earnings" title="Earnings" subtitle="Revenue, payouts, and financial performance">
      
      {backendError && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#DC2626',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{backendError}</span>
          </div>
          <button 
            className="v-btn v-btn-sm" 
            style={{ 
              background: 'rgba(239, 68, 68, 0.12)', 
              color: '#DC2626', 
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={refreshAll}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Gross Revenue', value: formatRevenue(totalGross), delta: 'Gross', up: true, icon: <DollarSign size={18} style={{ color: '#7B3FA0' }} /> },
          { label: 'Net Earnings',  value: formatRevenue(totalNet),   delta: '85% Share', up: true, icon: <Wallet size={18} style={{ color: '#7B3FA0' }} /> },
          { label: 'Platform Fees', value: formatRevenue(totalFees),  delta: '15%',    up: false, icon: <Percent size={17} style={{ color: '#9ca3af' }} /> },
          { label: 'Available Balance', value: `₹${available.toLocaleString()}`, delta: 'Payout Ready', up: true, icon: <CheckCircle2 size={18} style={{ color: '#16a34a' }} /> },
          { label: 'Pending Earnings', value: `₹${pendingEarnings.toLocaleString()}`, delta: 'Processing', up: false, icon: <Clock size={18} style={{ color: '#d97706' }} /> },
          { label: 'Paid Earnings', value: `₹${paidEarnings.toLocaleString()}`, delta: 'Settled', up: true, icon: <Award size={18} style={{ color: '#16a34a' }} /> },
        ].map((s, i) => (
          <div key={i} className="v-card v-stat-card">
            <div className="v-stat-header">
              <div className="v-stat-icon" style={{ background: 'rgba(184,134,208,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
              <span className={`v-stat-badge ${s.up ? 'up' : 'neutral'}`}>{s.delta}</span>
            </div>
            <div className="v-stat-value">{loading ? '…' : s.value}</div>
            <div className="v-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 20, marginBottom: 24 }}>
        <div className="v-card v-card-pad">
          <div className="v-section-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="v-section-title">Revenue Comparison</div>
              <div className="v-section-sub">Gross vs Net earnings</div>
            </div>
            <VendorChartControls
              period={period} onPeriod={p => { setPeriod(p); setSelectedMonth(null); }}
              month={selectedMonth} onMonth={setSelectedMonth}
              isMobile={isMobile}
            />
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[['#B886D0','Gross'],['#7B3FA0','Net']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 12, color: 'var(--v-text3)' }}>{l}</span>
              </div>
            ))}
          </div>
          {/* Grouped bars — Gross + Net side by side */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: chartSeries.length > 8 ? 2 : 4, height: 120 }}>
            {chartSeries.map((s, i) => {
              const maxV = Math.max(...chartGross, 1);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 100 }} title={`${s.fullLabel || s.label}\nGross: ₹${Math.round(s.revenue).toLocaleString()}\nNet: ₹${Math.round(s.net).toLocaleString()}`}>
                    <div style={{ flex: 1, borderRadius: '3px 3px 0 0', background: 'rgba(184,134,208,0.55)', height: `${(s.revenue/maxV)*100}%`, minHeight: s.revenue > 0 ? 4 : 2, transition: 'height 0.35s' }} />
                    <div style={{ flex: 1, borderRadius: '3px 3px 0 0', background: '#7B3FA0', height: `${(s.net/maxV)*100}%`, minHeight: s.net > 0 ? 4 : 2, transition: 'height 0.35s' }} />
                  </div>
                  <span style={{ fontSize: chartSeries.length > 8 ? 7 : 8, color: 'var(--v-text3)', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="v-section-title" style={{ marginBottom: 4 }}>Annual Goal</div>
            <div style={{ fontSize: 12, color: 'var(--v-text3)', marginBottom: 16 }}>₹{(goalAmount/100000).toFixed(0)}L target</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--v-serif)', fontSize: 32, color: 'var(--v-dark)', fontWeight: 600 }}>{goalPct}%</span>
              <span className="v-kpi-delta up">On track</span>
            </div>
            <div className="v-progress-track" style={{ height: 8 }}>
              <div className="v-progress-fill" style={{ width: `${goalPct}%` }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--v-text3)', marginTop: 6 }}>
              ₹{((goalAmount - totalNet)/100000).toFixed(2)}L remaining
            </div>
          </div>
          <div className="v-divider" style={{ margin: 0 }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--v-text3)', marginBottom: 10 }}>Monthly Trend</div>
            <MiniBar data={chartNet.length ? chartNet : [0]} height={60} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--v-text3)' }}>{displayMonths[0] || 'Jan'}</span>
              <span style={{ fontSize: 10, color: 'var(--v-text3)' }}>{displayMonths[displayMonths.length - 1] || 'Dec'}</span>
            </div>
          </div>
          <button className="v-btn v-btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => navigate('/vendor/withdrawals')}>
            💸 Request Payout
          </button>
        </div>
      </div>

      <div className="v-card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v-border)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
          <div className="v-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={16} />
            <span>Transaction History</span>
          </div>
          <div className="v-tabs" style={{ marginLeft: isMobile ? 0 : 'auto', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
            {['all','sale','withdrawal'].map(t => (
              <button key={t} className={`v-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ flexShrink: 0 }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {isMobile ? (
          /* Mobile transaction cards */
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(t => (
              <div key={t.id} style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(196,148,230,0.18)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span className={`v-badge ${t.type === 'sale' ? 'v-badge-green' : 'v-badge-blue'}`}>{t.type}</span>
                  <span style={{ fontSize: '11px', color: 'var(--v-text3)' }}>{t.date}</span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--v-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '8px' }}>{t.product}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(196,148,230,0.12)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--v-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gross</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--v-text2)' }}>₹{(t.amount||0).toLocaleString()}</span>
                  </div>
                  {t.fee > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--v-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fee</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--v-text3)' }}>₹{t.fee}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '10px', color: 'var(--v-text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Net</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: (t.net||0) < 0 ? '#dc2626' : '#16a34a' }}>
                      {(t.net||0) < 0 ? '-' : '+'}₹{Math.abs(t.net||0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="v-empty">
                <div className="v-empty-icon">📤</div>
                <div className="v-empty-title">No transactions found</div>
              </div>
            )}
          </div>
        ) : (
          <div className="v-table-wrap">
            <table className="v-table">
              <thead>
                <tr>
                  <th>Transaction ID</th><th>Description</th><th>Gross</th>
                  <th>Platform Fee</th><th>Net Amount</th><th>Date</th><th>Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--v-mid)', fontWeight: 600 }}>{t.id}</td>
                    <td style={{ fontSize: 13.5 }}>{t.product}</td>
                    <td style={{ fontWeight: 500 }}>₹{(t.amount||0).toLocaleString()}</td>
                    <td style={{ color: 'var(--v-text3)' }}>{t.fee > 0 ? `₹${t.fee}` : '—'}</td>
                    <td style={{ fontWeight: 600, color: (t.net||0) < 0 ? '#dc2626' : '#16a34a' }}>
                      {(t.net||0) < 0 ? '-' : '+'}₹{Math.abs(t.net||0).toLocaleString()}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--v-text3)' }}>{t.date}</td>
                    <td>
                      <span className={`v-badge ${t.type === 'sale' ? 'v-badge-green' : 'v-badge-blue'}`}>{t.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length === 0 && !isMobile && (
          <div className="v-empty">
            <div className="v-empty-icon">📤</div>
            <div className="v-empty-title">No transactions found</div>
            <div className="v-empty-sub">Transactions matching this category will appear here.</div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}

