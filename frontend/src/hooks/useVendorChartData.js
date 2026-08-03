/**
 * useVendorChartData
 * ------------------
 * Shared analytics data-builder for all vendor charts.
 * Converts raw order arrays into chart-ready series based on
 * the selected period and optional month filter.
 *
 * Periods:
 *   this_month  → daily buckets for current calendar month
 *   30d         → daily buckets for last 30 days
 *   6m          → monthly buckets for last 6 months
 *   12m         → monthly buckets for last 12 months (all 12, none skipped)
 *   this_year   → all 12 months of current calendar year
 *
 * Month filter (0-11):
 *   When set, narrows to that specific month across all years in the period.
 *   Works on top of the period filter.
 *
 * Returns: { series, filteredOrders, startDate }
 *   series:        [{ label, fullLabel, revenue, orders, net, growth }]
 *   filteredOrders: orders matching the selected period
 *   startDate:      start boundary of the period
 */

import { useMemo } from 'react';
import { MONTH_SHORT, MONTH_NAMES } from '../components/vendor/VendorChartControls';

const FEE_PCT = 0.15;

function getStartDate(period) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (period === 'this_month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (period === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return d;
  }
  if (period === '6m') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return d;
  }
  if (period === 'this_year') {
    return new Date(now.getFullYear(), 0, 1);
  }
  // 12m default
  const d = new Date(now);
  d.setMonth(d.getMonth() - 11);
  d.setDate(1);
  return d;
}

export function useVendorChartData(orders, period = '12m', selectedMonth = null) {
  return useMemo(() => {
    const allOrders = (orders || []).filter(o => o && (o.createdAt || o.date));
    const startDate = getStartDate(period);
    const now = new Date();

    // Filter by period
    let periodOrders = allOrders.filter(o => {
      const d = new Date(o.createdAt || o.date);
      return d >= startDate;
    });

    // Further filter by selected month if set
    if (selectedMonth !== null && selectedMonth !== undefined) {
      periodOrders = periodOrders.filter(o => {
        const d = new Date(o.createdAt || o.date);
        return d.getMonth() === selectedMonth;
      });
    }

    let series = [];

    if (period === 'this_month' || period === '30d') {
      // Daily buckets
      const daysBack = period === 'this_month'
        ? new Date(now.getFullYear(), now.getMonth(), 0).getDate() // days in this month
        : 29;

      const base = period === 'this_month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : (() => { const d = new Date(now); d.setDate(d.getDate() - 29); return d; })();

      const totalDays = period === 'this_month'
        ? now.getDate() // only up to today
        : 30;

      for (let i = 0; i < totalDays; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        const dateStr = d.toDateString();
        const label = d.getDate() === 1 || i === 0
          ? `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`
          : String(d.getDate());
        const fullLabel = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

        const dayOrders = periodOrders.filter(o => new Date(o.createdAt || o.date).toDateString() === dateStr);
        const revenue = dayOrders.reduce((s, o) => s + (o.amount || 0), 0);
        const oCount = dayOrders.length;

        series.push({
          label,
          fullLabel,
          revenue,
          net: Math.round(revenue * (1 - FEE_PCT)),
          orders: oCount,
          growth: null,
        });
      }
    } else {
      // Monthly buckets
      let monthCount;
      let startYear, startMonth;

      if (period === 'this_year') {
        monthCount = now.getMonth() + 1; // Jan to current month
        startYear = now.getFullYear();
        startMonth = 0;
      } else if (period === '6m') {
        monthCount = 6;
        const ref = new Date(now);
        ref.setMonth(ref.getMonth() - 5);
        startYear = ref.getFullYear();
        startMonth = ref.getMonth();
      } else {
        // 12m
        monthCount = 12;
        const ref = new Date(now);
        ref.setMonth(ref.getMonth() - 11);
        startYear = ref.getFullYear();
        startMonth = ref.getMonth();
      }

      for (let i = 0; i < monthCount; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();

        const label = MONTH_SHORT[m];
        const fullLabel = `${MONTH_NAMES[m]} ${y}`;

        // If selectedMonth filter is active, only include matching months
        if (selectedMonth !== null && selectedMonth !== undefined && m !== selectedMonth) {
          series.push({ label, fullLabel, revenue: 0, net: 0, orders: 0, growth: null });
          continue;
        }

        const monthOrders = periodOrders.filter(o => {
          const od = new Date(o.createdAt || o.date);
          return od.getMonth() === m && od.getFullYear() === y;
        });

        const revenue = monthOrders.reduce((s, o) => s + (o.amount || 0), 0);
        const oCount = monthOrders.length;
        const net = Math.round(revenue * (1 - FEE_PCT));

        series.push({ label, fullLabel, revenue, net, orders: oCount, growth: null });
      }

      // Calculate month-over-month growth
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1].revenue;
        const curr = series[i].revenue;
        if (prev > 0) {
          series[i].growth = Math.round(((curr - prev) / prev) * 100);
        }
      }
    }

    return { series, filteredOrders: periodOrders, startDate };
  }, [orders, period, selectedMonth]);
}
