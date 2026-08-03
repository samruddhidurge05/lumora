/**
 * VendorChartControls
 * -------------------
 * Shared filter bar used by every vendor analytics chart.
 * Renders:  [Range ▼]  [Month ▼]  (stacks on mobile)
 *
 * Props:
 *   period       {string}   – current range key
 *   onPeriod     {fn}       – (key) => void
 *   month        {number}   – selected month index 0-11 (null = all)
 *   onMonth      {fn}       – (index|null) => void
 *   isMobile     {boolean}
 */
import React from 'react';

export const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'This Month'    },
  { value: '30d',        label: 'Last 30 Days'  },
  { value: '6m',         label: 'Last 6 Months' },
  { value: '12m',        label: 'Last 12 Months'},
  { value: 'this_year',  label: 'This Year'     },
];

export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const MONTH_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

export default function VendorChartControls({
  period, onPeriod, month, onMonth, isMobile = false,
}) {
  const selectStyle = {
    height: 32,
    padding: '4px 28px 4px 10px',
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid rgba(196,148,230,0.35)',
    background: 'rgba(255,255,255,0.70)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'var(--v-text1, #2D004D)',
    fontFamily: 'var(--font-sans, system-ui)',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237B3FA0' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  };

  // Month selector is only relevant for 'this_year' and 'custom'
  const showMonthSelector = true;

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    }}>
      {/* Range selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--v-text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Range:</span>
        <select
          style={selectStyle}
          value={period}
          onChange={e => { onPeriod(e.target.value); onMonth(null); }}
        >
          {PERIOD_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Month selector */}
      {showMonthSelector && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--v-text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Month:</span>
          <select
            style={selectStyle}
            value={month === null ? '' : String(month)}
            onChange={e => onMonth(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">All</option>
            {MONTH_NAMES.map((n, i) => (
              <option key={i} value={i}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
