/**
 * VendorBarChart
 * --------------
 * Production-quality bar chart for the Vendor dashboard.
 *
 * Features:
 *   - Every x-axis label always shown (never skipped)
 *   - Rich hover tooltip: label, revenue, orders, growth
 *   - Empty bars show ₹0 — never blank
 *   - Consistent purple/lilac gradient design
 *   - Responsive: smaller font on mobile
 *
 * Props:
 *   series      [{ label, revenue, orders }]   – one entry per x-axis point
 *   height      {number}                        – chart height px (default 140)
 *   color       {string}                        – bar color (default #B886D0)
 *   showOrders  {boolean}                       – show orders count in tooltip
 *   isMobile    {boolean}
 */
import React, { useState } from 'react';

function formatRupees(val) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000)   return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export default function VendorBarChart({
  series = [],
  height = 140,
  color = '#B886D0',
  showOrders = false,
  isMobile = false,
}) {
  const [tooltip, setTooltip] = useState(null);

  if (!series.length) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v-text3)', fontSize: 12 }}>
        No data available
      </div>
    );
  }

  const maxRevenue = Math.max(...series.map(s => s.revenue || 0), 1);
  const labelFontSize = series.length > 8 ? (isMobile ? 7 : 8) : (isMobile ? 8 : 9);

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* Bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: series.length > 8 ? 2 : 4, height }}>
        {series.map((s, i) => {
          const pct = Math.max(4, ((s.revenue || 0) / maxRevenue) * 100);
          const isLast = i === series.length - 1;
          const isHovered = tooltip?.index === i;
          return (
            <div
              key={i}
              style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2, position: 'relative' }}
              onMouseEnter={() => setTooltip({ index: i, ...s })}
              onMouseLeave={() => setTooltip(null)}
            >
              <div style={{
                width: '100%',
                borderRadius: '4px 4px 0 0',
                height: `${pct}%`,
                background: isHovered
                  ? 'linear-gradient(180deg, #5A1E7E, #9B5FC0)'
                  : isLast
                    ? 'linear-gradient(180deg, #7B3FA0, #B886D0)'
                    : `linear-gradient(180deg, ${color}, rgba(184,134,208,0.18))`,
                transition: 'height 0.35s cubic-bezier(0.16,1,0.3,1), background 0.15s',
                minHeight: 4,
                boxShadow: isHovered ? '0 4px 12px rgba(90,30,126,0.25)' : 'none',
              }} />
            </div>
          );
        })}
      </div>

      {/* X-axis labels — ALL shown, never skipped */}
      <div style={{ display: 'flex', gap: series.length > 8 ? 2 : 4, marginTop: 5 }}>
        {series.map((s, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: labelFontSize,
            color: tooltip?.index === i ? 'var(--v-purple, #7B3FA0)' : 'var(--v-text3)',
            fontWeight: tooltip?.index === i ? 700 : 400,
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap',
            lineHeight: 1.2,
          }}>
            {s.label}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(45,0,77,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(196,148,230,0.35)',
          borderRadius: 10,
          padding: '10px 14px',
          pointerEvents: 'none',
          zIndex: 50,
          minWidth: 160,
          boxShadow: '0 8px 24px rgba(45,0,77,0.22)',
          color: '#fff',
        }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: '#E8D5F5' }}>
            {tooltip.fullLabel || tooltip.label}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.65)' }}>Revenue</span>
              <span style={{ fontWeight: 700 }}>{formatRupees(tooltip.revenue || 0)}</span>
            </div>
            {showOrders && tooltip.orders != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Orders</span>
                <span style={{ fontWeight: 700 }}>{tooltip.orders}</span>
              </div>
            )}
            {tooltip.net != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Net</span>
                <span style={{ fontWeight: 700 }}>{formatRupees(tooltip.net)}</span>
              </div>
            )}
            {tooltip.growth != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.65)' }}>Growth</span>
                <span style={{ fontWeight: 700, color: tooltip.growth >= 0 ? '#86efac' : '#fca5a5' }}>
                  {tooltip.growth >= 0 ? '+' : ''}{tooltip.growth}%
                </span>
              </div>
            )}
            {(tooltip.revenue || 0) === 0 && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>No data for this period</div>
            )}
          </div>
          {/* Arrow */}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10,
            background: 'rgba(45,0,77,0.92)',
            border: '1px solid rgba(196,148,230,0.35)',
            borderTop: 'none', borderLeft: 'none',
            transform: 'translateX(-50%) rotate(45deg)',
          }} />
        </div>
      )}
    </div>
  );
}
