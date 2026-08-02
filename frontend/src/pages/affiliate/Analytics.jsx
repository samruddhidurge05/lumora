import React, { useState, useMemo } from 'react';
import { BarChart2, TrendingUp, Filter, ShoppingBag, DollarSign } from 'lucide-react';

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

// Helper: Get start of day
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Aggregation logic
function buildAggregatedData(commissions, filterType) {
  const now = new Date();
  const today = startOfDay(now);
  
  let labels = [];
  let data = [];
  let startDate = new Date();
  let endDate = new Date();

  if (filterType === 'this-week' || filterType === 'last-week') {
    const daysOffset = filterType === 'last-week' ? 7 : 0;
    
    // Create exactly 7 days
    labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - daysOffset - (6 - i));
      return d;
    });
    
    data = new Array(7).fill(0);
    startDate = labels[0];
    endDate = new Date(labels[6]);
    endDate.setHours(23, 59, 59, 999);

    (commissions || []).forEach(c => {
      if (!c.created_at && !c.date) return;
      const d = new Date(c.created_at || c.date);
      if (d >= startDate && d <= endDate) {
        // Find which day index it belongs to
        const diffTime = Math.abs(startOfDay(d) - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          data[diffDays] += (c.commission_amt || 0);
        }
      }
    });

    // Format labels to short weekday names (Mon, Tue, etc.)
    labels = labels.map(d => d.toLocaleString('default', { weekday: 'short' }));

  } else {
    // 6 or 12 months
    const monthsCount = filterType === '6-months' ? 6 : 12;
    
    labels = Array.from({ length: monthsCount }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1) + i, 1);
      return d.toLocaleString('default', { month: 'short' });
    });

    data = new Array(monthsCount).fill(0);
    
    // Set start date to the first day of the first month
    startDate = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1), 1);
    endDate = new Date(); // now

    (commissions || []).forEach((c) => {
      if (!c.created_at && !c.date) return;
      const d = new Date(c.created_at || c.date);
      if (d >= startDate && d <= endDate) {
        const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (mDiff >= 0 && mDiff < monthsCount) {
          data[monthsCount - 1 - mDiff] += (c.commission_amt || 0);
        }
      }
    });
  }

  // Filter commissions for Top Products
  const periodCommissions = (commissions || []).filter(c => {
    if (!c.created_at && !c.date) return false;
    const d = new Date(c.created_at || c.date);
    return d >= startDate && d <= endDate;
  });

  return { labels, data, periodCommissions };
}

// Top Products Aggregation
function buildTopProducts(periodCommissions) {
  const map = {};
  periodCommissions.forEach(c => {
    const id = c.product_id || 'unknown';
    const name = c.product_name || 'Unknown Product';
    if (!map[id]) map[id] = { id, name, sales: 0, earnings: 0 };
    map[id].sales += 1;
    map[id].earnings += (c.commission_amt || 0);
  });
  return Object.values(map).sort((a, b) => b.earnings - a.earnings);
}


export default function AffiliateAnalytics({ commissions }) {
  const [timeFilter, setTimeFilter] = useState('12-months');

  const { labels, data: chartData, periodCommissions } = useMemo(
    () => buildAggregatedData(commissions, timeFilter),
    [commissions, timeFilter]
  );

  const topProducts = useMemo(() => buildTopProducts(periodCommissions), [periodCommissions]);

  const chartTotal = useMemo(() => chartData.reduce((a, b) => a + b, 0), [chartData]);
  const chartMax = useMemo(() => Math.max(0, ...chartData), [chartData]);
  const totalSales = periodCommissions.length;

  // SVG Line Chart calculations
  const svgWidth = 800;
  const svgHeight = 180;
  
  const points = chartData.map((val, i) => {
    const x = chartData.length > 1 ? (i / (chartData.length - 1)) * svgWidth : svgWidth / 2;
    const y = chartMax > 0 ? svgHeight - ((val / chartMax) * (svgHeight - 20)) - 10 : svgHeight - 10;
    return `${x},${y}`;
  }).join(' ');

  const polygonPoints = chartData.length > 1 
    ? `0,${svgHeight} ${points} ${svgWidth},${svgHeight}` 
    : `${svgWidth/2},${svgHeight} ${points} ${svgWidth/2},${svgHeight}`;

  const filterLabels = {
    'this-week': 'This Week',
    'last-week': 'Last Week',
    '6-months': 'Last 6 Months',
    '12-months': 'Last 12 Months',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* HEADER & FILTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', color: '#3b0764', margin: 0, lineHeight: 1.2 }}>Analytics</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>Track your audience engagement and earnings performance.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.8)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(196,181,253,0.4)', boxShadow: '0 2px 8px rgba(90,30,126,0.04)' }}>
          <Filter size={14} color="#7B3FA0" />
          <select 
            value={timeFilter} 
            onChange={(e) => setTimeFilter(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.8rem', fontWeight: 700, color: '#3b0764', cursor: 'pointer', paddingRight: '8px' }}
          >
            <option value="this-week">This Week</option>
            <option value="last-week">Last Week</option>
            <option value="6-months">Last 6 Months</option>
            <option value="12-months">Last 12 Months</option>
          </select>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        <div className="premium-flat-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(123,63,160,0.1), rgba(90,30,126,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(196,181,253,0.3)' }}>
            <DollarSign size={24} color="#7B3FA0" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Earnings ({filterLabels[timeFilter]})</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b0764', marginTop: '2px' }}>{formatINR(chartTotal)}</div>
          </div>
        </div>
        
        <div className="premium-flat-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(74,222,128,0.3)' }}>
            <ShoppingBag size={24} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales ({filterLabels[timeFilter]})</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>{totalSales}</div>
          </div>
        </div>
      </div>

      {/* TREND LINE CHART */}
      <div className="premium-flat-card" style={{ padding: '28px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Overview</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)' }}>Earnings Trend</h3>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, background: 'rgba(123,63,160,0.05)', padding: '4px 10px', borderRadius: '20px' }}>
            {filterLabels[timeFilter]}
          </div>
        </div>

        {chartTotal === 0 ? (
          <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '16px' }}>
            <TrendingUp size={32} style={{ color: 'rgba(196,181,253,0.70)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>No earnings recorded during this period.</span>
          </div>
        ) : (
          <div style={{ position: 'relative', height: '240px', width: '100%' }}>
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: '180px', overflow: 'visible' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7B3FA0" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#7B3FA0" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Grid lines */}
              <line x1="0" y1={svgHeight} x2={svgWidth} y2={svgHeight} stroke="rgba(196,181,253,0.2)" strokeWidth="1" />
              <line x1="0" y1={svgHeight/2} x2={svgWidth} y2={svgHeight/2} stroke="rgba(196,181,253,0.2)" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="0" x2={svgWidth} y2="0" stroke="rgba(196,181,253,0.2)" strokeWidth="1" strokeDasharray="4 4" />

              {/* Area fill */}
              <polygon points={polygonPoints} fill="url(#lineGradient)" />
              
              {/* The Line */}
              <polyline 
                fill="none" 
                stroke="#7B3FA0" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                points={points} 
                style={{ filter: 'drop-shadow(0px 4px 6px rgba(123,63,160,0.15))' }}
              />
              
              {/* Data points */}
              {chartData.map((val, i) => {
                if (val === 0 && chartMax > 0) return null; // Only show dots for actual data if there's data
                const x = chartData.length > 1 ? (i / (chartData.length - 1)) * svgWidth : svgWidth / 2;
                const y = chartMax > 0 ? svgHeight - ((val / chartMax) * (svgHeight - 20)) - 10 : svgHeight - 10;
                return (
                  <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke="#7B3FA0" strokeWidth="2" />
                );
              })}
            </svg>

            {/* X-Axis Labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              {labels.map((lbl, i) => (
                <span key={i} style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{lbl}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* BAR CHART */}
        <div className="premium-flat-card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '24px' }}>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Comparison</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)' }}>Period Breakdown</h3>
          </div>

          {chartTotal === 0 ? (
            <div style={{ height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px' }}>
              <BarChart2 size={24} style={{ color: 'rgba(196,181,253,0.70)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No data</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px' }}>
              {chartData.map((val, i) => {
                const pct = (val / chartMax) * 100;
                const isHighest = val === chartMax && val > 0;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%', justifyContent: 'flex-end' }}>
                    <div
                      title={`${labels[i]}: ${formatINR(val)}`}
                      style={{
                        width: '100%',
                        maxWidth: '28px',
                        height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                        borderRadius: '6px 6px 3px 3px',
                        background: isHighest ? 'linear-gradient(180deg, #7B3FA0, #5A1E7E)' : val > 0 ? 'rgba(196,181,253,0.55)' : 'rgba(196,181,253,0.15)',
                        border: isHighest ? '1px solid rgba(123,63,160,0.30)' : '1px solid rgba(196,181,253,0.20)',
                        transition: 'all 0.3s',
                        minHeight: val > 0 ? '4px' : '2px',
                      }}
                    />
                    <span style={{ fontSize: '0.55rem', fontWeight: 600, color: isHighest ? '#7B3FA0' : 'var(--text-muted)' }}>
                      {labels[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* TOP PRODUCTS TABLE */}
        <div className="premium-flat-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '20px' }}>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Performance</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)' }}>Top Products</h3>
          </div>

          {topProducts.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px', padding: '30px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No product sales recorded in this period.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', paddingBottom: '8px', borderBottom: '1px solid rgba(45,0,96,0.06)' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product Name</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', minWidth: '40px' }}>Sales</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', minWidth: '70px' }}>Earnings</span>
              </div>
              
              {/* Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '160px', paddingRight: '4px' }}>
                {topProducts.map((p, idx) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', padding: '10px 8px', background: idx === 0 ? 'rgba(123,63,160,0.04)' : 'transparent', borderRadius: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#3b0764', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {idx + 1}. {p.name}
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', minWidth: '40px' }}>
                      {p.sales}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#7B3FA0', textAlign: 'right', minWidth: '70px' }}>
                      {formatINR(p.earnings)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  );
}
