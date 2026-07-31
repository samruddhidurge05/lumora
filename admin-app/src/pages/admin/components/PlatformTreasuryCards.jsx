/**
 * PlatformTreasuryCards.jsx
 * --------------------------
 * Dashboard treasury section — 7 KPI cards + balance strip.
 * Uses the Lumora AdminComponents design system (glass-surface, purple palette).
 * All values served from backend; zero frontend math.
 *
 * Available to Withdraw = Revenue − Affiliate Liability − Pending WD − Completed WD
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Wallet, TrendingUp, ArrowUpRight, Clock, CheckCircle2, Shield, RefreshCw } from 'lucide-react';
import { StatsGrid, DashboardCard } from './AdminComponents';
import { fetchTreasurySummary, formatINR } from '../../../services/treasuryService';
import { useAdminContext } from '../../../context/AdminContext';

export default function PlatformTreasuryCards() {
  const navigate = useNavigate();
  const { adminProfile } = useAdminContext();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchTreasurySummary();
      if (data) { setSummary(data); setError(null); }
    } catch (e) {
      setError('Treasury data unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);   // refresh every 60s
    return () => clearInterval(iv);
  }, [load]);

  const CARDS = [
    {
      title: 'Platform Revenue', value: loading ? '…' : formatINR(summary?.platform_revenue),
      icon: DollarSign, trend: 'TOTAL', trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,18 L20,14 L40,11 L60,8 L80,5 L100,3" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Available to Withdraw', value: loading ? '…' : formatINR(summary?.available_balance),
      icon: Wallet, trend: loading ? '…' : `${formatINR(summary?.net_withdrawable)} net`, trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,14 L30,11 L60,8 L80,6 L100,4" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Minimum Reserve', value: loading ? '…' : formatINR(summary?.minimum_reserve || 5000),
      icon: Shield, trend: 'REQUIRED', trendLabel: 'reserve',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,10 L100,10" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Affiliate Owed', value: loading ? '…' : formatINR(summary?.affiliate_liability),
      icon: ArrowUpRight, trend: 'owed', trendLabel: 'to affiliates',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,8 L40,10 L70,11 L100,10" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Pending Withdrawals', value: loading ? '…' : formatINR(summary?.pending_withdrawals),
      icon: Clock, trend: loading ? '…' : `${summary?.settlement_counts?.pending || 0} pending`, trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,10 L100,10" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Completed Withdrawals', value: loading ? '…' : formatINR(summary?.completed_withdrawals),
      icon: CheckCircle2, trend: loading ? '…' : `${summary?.settlement_counts?.completed || 0} done`, trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,15 L30,12 L60,9 L80,7 L100,5" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
    {
      title: 'Net Platform Earnings', value: loading ? '…' : formatINR(summary?.net_platform_earnings),
      icon: TrendingUp, trend: 'after aff.', trendLabel: '',
      chart: <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
        <path d="M0,16 L25,13 L60,10 L80,7 L100,5" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>,
    },
  ];

  return (
    <div>
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Financial Overview</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#B886D0] animate-pulse" />
          </div>
          <p className="text-[9px] text-[#8E6AA8]">
            Available to Withdraw = Revenue − Affiliate Liability − Pending − Completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 rounded-lg border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 text-[#7B3FA0] transition-colors"
            aria-label="Refresh treasury"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/admin/finance')}
            className="px-3 py-1.5 text-[10px] font-bold text-[#7B3FA0] border border-[#8E6AA8]/20 hover:bg-[#D8BFE3]/20 rounded-xl transition-colors"
          >
            Finance & Withdrawals →
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-600">
          ⚠ {error} — <button className="underline font-semibold" onClick={load}>Retry</button>
        </div>
      )}

      {/* 7 KPI Cards */}
      <StatsGrid columns={4}>
        {CARDS.map(c => (
          <DashboardCard
            key={c.title}
            isLoading={loading}
            onClick={c.title === 'Available to Withdraw' ? () => navigate('/admin/finance?tab=withdrawals') : undefined}
            {...c}
          />
        ))}
      </StatsGrid>

      {/* Bottom strip */}
      {summary && !loading && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1">
          {[
            { label: "Today's Revenue",   val: summary.today_revenue },
            { label: 'Month Withdrawn',   val: summary.current_month_withdrawn },
            { label: 'Net Withdrawable',  val: summary.net_withdrawable },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#8E6AA8]">{s.label}</span>
              <span className="text-[10px] font-bold text-[#2D004D]">{formatINR(s.val)}</span>
            </div>
          ))}
          {summary.last_withdrawal && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[9px] text-[#8E6AA8]">Last withdrawal</span>
              <span className="text-[10px] font-bold text-[#7B3FA0]">{formatINR(summary.last_withdrawal.amount)}</span>
              <span className="text-[9px] font-mono text-[#8E6AA8]">{summary.last_withdrawal.withdrawal_number}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
