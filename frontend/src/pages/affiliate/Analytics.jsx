import React, { useState, useMemo } from 'react';
import { BarChart2, Activity, Filter } from 'lucide-react';

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

function buildEarningsData(commissions, monthsCount) {
  const now = new Date();
  const arr = new Array(monthsCount).fill(0);
  (commissions || []).forEach((c) => {
    if (!c.created_at && !c.date) return;
    const d = new Date(c.created_at || c.date);
    const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (mDiff >= 0 && mDiff < monthsCount) {
      arr[monthsCount - 1 - mDiff] += (c.commission_amt || 0);
    }
  });
  return arr;
}

function buildMonthLabels(monthsCount) {
  const now = new Date();
  return Array.from({ length: monthsCount }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsCount - 1) + i, 1);
    return d.toLocaleString('default', { month: 'short' });
  });
}

export default function AffiliateAnalytics({ commissions }) {
  const [timeFilter, setTimeFilter] = useState('12'); // '12' or '6'

  const monthsCount = parseInt(timeFilter, 10);
  
  const chartData = useMemo(() => buildEarningsData(commissions, monthsCount), [commissions, monthsCount]);
  const monthLabels = useMemo(() => buildMonthLabels(monthsCount), [monthsCount]);
  const chartTotal = useMemo(() => chartData.reduce((a, b) => a + b, 0), [chartData]);
  const chartMax = useMemo(() => Math.max(0, ...chartData), [chartData]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Analytics Graph Card */}
      <div className="premium-flat-card" style={{ padding: '28px 28px 20px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Performance</span>
            <h3 className="text-editorial" style={{ fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '2px' }}>Earnings Overview</h3>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(123,63,160,0.05)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(196,181,253,0.3)' }}>
              <Filter size={12} color="var(--text-muted)" />
              <select 
                value={timeFilter} 
                onChange={(e) => setTimeFilter(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <option value="6">Last 6 Months</option>
                <option value="12">Last 12 Months</option>
              </select>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{timeFilter}-Month Total</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7B3FA0', marginTop: '2px' }}>{formatINR(chartTotal)}</div>
            </div>
          </div>
        </div>

        {chartTotal === 0 ? (
          /* Empty chart state */
          <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', border: '1px dashed rgba(196,181,253,0.35)', borderRadius: '12px' }}>
            <BarChart2 size={32} style={{ color: 'rgba(196,181,253,0.70)' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>No earnings data yet for this period.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '240px' }}>
            {chartData.map((val, i) => {
              const pct = (val / chartMax) * 100;
              const isHighest = val === chartMax && val > 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                  <div
                    title={`${monthLabels[i]}: ${formatINR(val)}`}
                    style={{
                      width: '100%',
                      maxWidth: '48px',
                      height: `${Math.max(pct, val > 0 ? 4 : 0)}%`,
                      borderRadius: '8px 8px 4px 4px',
                      background: isHighest
                        ? 'linear-gradient(180deg, #7B3FA0, #5A1E7E)'
                        : val > 0
                          ? 'rgba(196,181,253,0.55)'
                          : 'rgba(196,181,253,0.15)',
                      border: isHighest
                        ? '1px solid rgba(123,63,160,0.30)'
                        : '1px solid rgba(196,181,253,0.20)',
                      transition: 'all 0.3s',
                      minHeight: val > 0 ? '6px' : '3px',
                      cursor: 'default',
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: isHighest ? '#7B3FA0' : 'var(--text-muted)' }}>
                    {monthLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(45,0,96,0.05)', paddingTop: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Last {timeFilter} months</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7B3FA0' }}>{formatINR(chartTotal)} total</span>
        </div>
      </div>
      
    </div>
  );
}
