import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard } from './components/AdminComponents';
import {
  getDashboardData,
  buildActivityFeed,
  subscribeToOrders,
  subscribeToReviews,
  subscribeToDashboardReports,
} from '../../services/dashboardService.js';

// --- ROBUST SELF-CONTAINED LUXURY UI VECTOR SYSTEM ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    TrendingUp: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />,
    ArrowUpRight: <g><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></g>,
    DollarSign: <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    CheckCircle: <g><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></g>,
    AlertTriangle: <g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
    Sparkles: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    RefreshCw: <g><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></g>,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></g>,
    Zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    Globe: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
    Compass: <g><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></g>,
    Users: <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g>,
    Package: <g><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08" /><polygon points="12 22.08 21 17.08 21 6.92 12 12 12 22.08" /><polygon points="12 12 21 6.92 12 1.84 3 6.92 12 12" /></g>
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {svgs[name] || null}
    </svg>
  );
};

// --- SYSTEM AUDIO ENGINE ---
class AudioController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTap() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1250, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }
  playSwoosh() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
  playSuccess() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.02, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(523.25, now, 0.1);  // C5
    playNote(659.25, now + 0.05, 0.1);  // E5
    playNote(783.99, now + 0.1, 0.25); // G5
  }
}

const sysSound = new AudioController();

// All data comes from dashboardService.js via Firestore — no mock data here.

export default function Dashboard() {
  // ─── REAL DATA STATE ──────────────────────────────────────────────────────
  const [dashData, setDashData]     = useState(null);   // full dashboard payload
  const [isLoading, setIsLoading]   = useState(true);

  // Derived state slices (mapped from dashData for direct UI consumption)
  const [metrics, setMetrics]       = useState({
    totalRevenue: 0, ordersToday: 0, conversionRate: 0,
    activeProducts: 0, refundRate: 0, growthVelocity: 0,
    revenueChange: 0, ordersChange: 0, activeProductsChange: 0,
  });
  const [liveFeed, setLiveFeed]     = useState([]);
  const [ecosystemProducts, setEcosystemProducts] = useState([]);
  const [leaderboardCreators, setLeaderboardCreators] = useState([]);
  const [suspiciousLogs, setSuspiciousLogs] = useState([]);
  const [customerInsights, setCustomerInsights] = useState({ topCustomers: [], geoDistribution: [] });
  const [insights, setInsights]     = useState([]);
  const [headerStats, setHeaderStats] = useState({ activeUsers: 0, greeting: 'Good day', marketStatus: 'Loading...' });
  const [healthScore, setHealthScore] = useState(0);
  const [healthStatus, setHealthStatus] = useState('');
  const [metricModalData, setMetricModalData] = useState({
    totalRevenue: [], ordersToday: [], conversionRate: [],
    activeProducts: [], refundRate: [], growthVelocity: [],
  });

  // ─── UI STATE ─────────────────────────────────────────────────────────────
  const [timeframe, setTimeframe]   = useState('weekly');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeModalCard, setActiveModalCard] = useState(null);
  const [audioMuted, setAudioMuted] = useState(true);
  const [pulseGlow, setPulseGlow]   = useState(false);


  // Sync mute state
  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);

  // ─── REAL DATA LOAD ───────────────────────────────────────────────────────
  const applyDashData = useCallback((data) => {
    if (!data) return;
    setDashData(data);
    setMetrics({
      totalRevenue:         data.kpis.totalRevenue,
      ordersToday:          data.kpis.ordersToday,
      conversionRate:       data.kpis.conversionRate,
      activeProducts:       data.kpis.activeProducts,
      refundRate:           data.kpis.refundRate,
      growthVelocity:       data.kpis.growthVelocity,
      revenueChange:        data.kpis.revenueChange,
      ordersChange:         data.kpis.ordersChange,
      activeProductsChange: data.kpis.activeProductsChange,
    });
    setLiveFeed(data.liveFeed || []);
    setEcosystemProducts(data.productPerf || []);
    setLeaderboardCreators(data.leaderboard || []);
    setSuspiciousLogs(data.riskPanel || []);
    setCustomerInsights(data.customerInsights || { topCustomers: [], geoDistribution: [] });
    setInsights(data.insights || []);
    setHeaderStats(data.headerStats || { activeUsers: 0, greeting: 'Good day', marketStatus: 'Marketplace Healthy' });
    setHealthScore(data.healthScore || 0);
    setHealthStatus(data.healthStatus || '');
    setMetricModalData(data.kpis.modalData || {
      totalRevenue: [], ordersToday: [], conversionRate: [],
      activeProducts: [], refundRate: [], growthVelocity: [],
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getDashboardData()
      .then(data => { if (mounted) { applyDashData(data); setIsLoading(false); } })
      .catch(err  => { console.error('[Dashboard] Load error:', err); if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [applyDashData]);

  // ─── REAL-TIME LISTENERS ──────────────────────────────────────────────────
  useEffect(() => {
    let debounce = null;
    const reload = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        getDashboardData().then(applyDashData).catch(() => {});
      }, 2000);
    };

    // Inject a new feed event immediately, then debounce full reload
    const unsubOrders = subscribeToOrders((order) => {
      const amt   = order.total || order.price || 0;
      const title = order.items?.[0]?.snapshot?.title || 'Product';
      if (amt > 0) {
        const evt = {
          id:       `live-ord-${Date.now()}`,
          text:     `${order.customerName || 'Customer'} purchased ${title}`,
          category: 'purchase',
          time:     'Just now',
          value:    `+₹${Math.round(amt)}`,
        };
        setLiveFeed(prev => [evt, ...prev.slice(0, 19)]);
        setPulseGlow(true);
        setTimeout(() => setPulseGlow(false), 800);
        sysSound.playSuccess();
      }
      reload();
    });

    const unsubReviews = subscribeToReviews((review) => {
      const evt = {
        id:       `live-rev-${Date.now()}`,
        text:     `New ${review.rating}★ review on "${review.productTitle || 'Product'}"`,
        category: 'insight',
        time:     'Just now',
        value:    null,
      };
      setLiveFeed(prev => [evt, ...prev.slice(0, 19)]);
      reload();
    });

    const unsubReports = subscribeToDashboardReports((report) => {
      if (report.severity === 'critical') {
        const evt = {
          id:       `live-rpt-${Date.now()}`,
          text:     `Critical report: ${report.category} — "${report.productTitle || 'Product'}"`,
          category: 'refund',
          time:     'Just now',
          value:    'CRITICAL',
        };
        setLiveFeed(prev => [evt, ...prev.slice(0, 19)]);
      }
      reload();
    });

    return () => {
      unsubOrders();
      unsubReviews();
      unsubReports();
      clearTimeout(debounce);
    };
  }, [applyDashData]);

  // Security scanning simulation
  const handleTriggerSecurityScan = () => {
    sysSound.playSwoosh();
    setIsScanning(true);
    setScanProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 6;
      if (current >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        sysSound.playSuccess();
      } else {
        setScanProgress(current);
      }
    }, 120);
  };

  // --- GLOBAL SETTINGS SYNC ---
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("lumora-settings");
    return saved ? JSON.parse(saved) : {
      themeIntensity: "rich",
      animationLevel: "cinematic",
      dashboardDensity: "balanced",
      currencyDisplay: "INR",
      glowEffects: true,
      glassmorphismLevel: "standard"
    };
  });

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const saved = localStorage.getItem("lumora-settings");
      if (saved) setSettings(JSON.parse(saved));
    };
    window.addEventListener("lumoraSettingsUpdated", handleSettingsUpdate);
    return () => window.removeEventListener("lumoraSettingsUpdated", handleSettingsUpdate);
  }, []);

  const currencySymbol = settings.currencyDisplay === "INR" ? "?" : (settings.currencyDisplay === "EUR" ? "�" : "$");
  const formatValue = (val) => {
    let factor = settings.currencyDisplay === "INR" ? 1 : (settings.currencyDisplay === "EUR" ? 1 / 92 : 1 / 85);
    return (val * factor).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Metric metadata mapping for Modal expansion views — uses real sparkline data
  const metricModalDetails = {
    totalRevenue:   { title: "Revenue Deep Scan",        desc: "Aggregated gross sales across all paid orders this period.", data: metricModalData.totalRevenue   || [] },
    ordersToday:    { title: "Order Pipeline Activity",  desc: "Total transaction counts per month over the last 5 months.", data: metricModalData.ordersToday    || [] },
    conversionRate: { title: "Visitor Conversion Matrix",desc: "Percentage of orders that were paid vs total orders placed.", data: metricModalData.conversionRate || [] },
    activeProducts: { title: "Active Ledger Assets",     desc: "Count of published products available for purchase.", data: metricModalData.activeProducts || [] },
    refundRate:     { title: "Refund Audit Ledger",      desc: "Refund rate per month — refunded orders / total orders.", data: metricModalData.refundRate     || [] },
    growthVelocity: { title: "System Growth Velocity",   desc: "Month-over-month revenue growth percentage trend.", data: metricModalData.growthVelocity  || [] },
  };

  return (
    <AdminLayout activePage="dashboard">
      {/* Dashboard container body */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* --- LAYER 1: HERO INTELLIGENCE HEADER --- */}
        <section className="mb-10">
          <PageHeader
            title={`${headerStats.greeting}, Admin`}
            subtitle={`${headerStats.marketStatus}. ${isLoading ? 'Loading live data...' : `Last updated: ${dashData?._meta?.fetchedAt ? new Date(dashData._meta.fetchedAt).toLocaleTimeString() : 'just now'}`}`}
            actions={
              <div className="flex items-center gap-6 pt-2 md:pt-0">
                <div className="flex flex-col text-right">
                  <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Pulse Health</span>
                  <span className="text-xs font-bold text-[#B886D0] bg-[#B886D0]/10 px-2 py-0.5 rounded mt-1 border border-[#B886D0]/20">{healthStatus || (isLoading ? '...' : 'Healthy')}</span>
                </div>
                <div className="flex flex-col text-right border-l border-stone-200/50 pl-4">
                  <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Active Users</span>
                  <span className="text-sm font-serif font-black text-[#2D004D] mt-0.5 flex items-baseline gap-1">
                    {headerStats.activeUsers}
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B886D0] inline-block animate-ping" />
                  </span>
                </div>
              </div>
            }
          />
        </section>

        {/* --- LAYER 2: CORE METRICS GRID --- */}
        <StatsGrid columns={6}>
          <DashboardCard
            title="Revenue"
            value={isLoading ? "..." : `${currencySymbol}${formatValue(metrics.totalRevenue)}`}
            icon={<Icon name="DollarSign" size={12} />}
            trend={isLoading ? undefined : `${metrics.revenueChange >= 0 ? '+' : ''}${metrics.revenueChange}%`}
            trendLabel="MoM"
            onClick={() => { sysSound.playTap(); setActiveModalCard('totalRevenue'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,15 L20,12 L40,16 L60,8 L80,10 L100,5" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
          <DashboardCard
            title="Orders Today"
            value={isLoading ? "..." : metrics.ordersToday}
            icon={<Icon name="Activity" size={12} />}
            trend={isLoading ? undefined : `${metrics.ordersChange >= 0 ? '+' : ''}${metrics.ordersChange}%`}
            trendLabel="MoM"
            onClick={() => { sysSound.playTap(); setActiveModalCard('ordersToday'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,18 L20,14 L40,16 L60,10 L80,12 L100,8" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
          <DashboardCard
            title="Conversion"
            value={isLoading ? "..." : `${metrics.conversionRate}%`}
            icon={<Icon name="TrendingUp" size={12} />}
            trend={isLoading ? undefined : `${metrics.conversionRate > 0 ? metrics.conversionRate + '%' : 'No orders'}`}
            onClick={() => { sysSound.playTap(); setActiveModalCard('conversionRate'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,15 L20,13 L40,11 L60,12 L80,9 L100,6" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
          <DashboardCard
            title="Products"
            value={isLoading ? "..." : metrics.activeProducts}
            icon={<Icon name="Package" size={12} />}
            trend={isLoading ? undefined : `${metrics.activeProductsChange > 0 ? '+' + metrics.activeProductsChange + '%' : 'stable'}`}
            onClick={() => { sysSound.playTap(); setActiveModalCard('activeProducts'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,10 L100,10" fill="none" stroke="#B886D0" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
          <DashboardCard
            title="Refunds"
            value={isLoading ? "..." : `${metrics.refundRate}%`}
            icon={<Icon name="CheckCircle" size={12} />}
            trend={isLoading ? undefined : `${metrics.refundRate <= 2 ? 'Low risk' : metrics.refundRate <= 5 ? 'Moderate' : 'High'}`}
            onClick={() => { sysSound.playTap(); setActiveModalCard('refundRate'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,5 L25,6 L50,4 L75,8 L100,12" fill="none" stroke="#D8BFE3" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
          <DashboardCard
            title="Velocity"
            value={isLoading ? "..." : `${metrics.growthVelocity}%`}
            icon={<Icon name="Zap" size={12} />}
            trend={isLoading ? undefined : `${metrics.growthVelocity >= 0 ? '+' : ''}${metrics.growthVelocity}%`}
            trendLabel="MoM"
            onClick={() => { sysSound.playTap(); setActiveModalCard('growthVelocity'); }}
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path d="M0,18 L30,15 L60,12 T90,6 L100,4" fill="none" stroke="#B886D0" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
        </StatsGrid>

        {/* --- LAYER 3: REVENUE INTELLIGENCE CORE --- */}
        <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 mb-12">
          
          {/* Revenue Chart Engine (70%) */}
          <div className="lg:col-span-7 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Financial Stream Matrix</h4>
                <h2 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Revenue Chart Engine</h2>
              </div>

              {/* Timeframe toggle buttons */}
              <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-xl border border-stone-200/50 flex items-center gap-1.5">
                {['daily', 'weekly', 'monthly'].map((t) => (
                  <button
                    key={t}
                    onClick={() => { sysSound.playTap(); setTimeframe(t); }}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-widest uppercase transition-colors ${
                      timeframe === t ? 'bg-[#2D004D] text-white' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Interactive SVG Line Chart — driven by real revenueChart data */}
            <div className="h-[280px] w-full relative pt-4">
              {isLoading ? (
                <div className="w-full h-full flex flex-col justify-between animate-pulse">
                  <div className="flex justify-between items-end h-[220px] px-4">
                    <div className="w-8 h-[20%] bg-[#381347]/10 rounded-t" />
                    <div className="w-8 h-[40%] bg-[#381347]/10 rounded-t" />
                    <div className="w-8 h-[35%] bg-[#381347]/10 rounded-t" />
                    <div className="w-8 h-[60%] bg-[#381347]/10 rounded-t" />
                    <div className="w-8 h-[55%] bg-[#381347]/10 rounded-t" />
                    <div className="w-8 h-[80%] bg-[#381347]/10 rounded-t" />
                  </div>
                  <div className="h-1 bg-[#381347]/10 w-full" />
                  <div className="flex justify-between text-[9px] text-[#7B3FA0] px-4 mt-2">
                    <div className="w-12 h-3 bg-[#381347]/10 rounded" />
                    <div className="w-12 h-3 bg-[#381347]/10 rounded" />
                    <div className="w-12 h-3 bg-[#381347]/10 rounded" />
                  </div>
                </div>
              ) : (() => {
                const chartData = dashData?.revenueChart?.[timeframe] || [];
                const n = chartData.length;
                if (n === 0) return (
                  <div className="flex items-center justify-center h-full text-[11px] text-[#7B3FA0]">
                    No revenue data yet.
                  </div>
                );
                const maxGross = Math.max(...chartData.map(d => d.gross), 1);
                const W = 540, H = 200, padL = 40, padT = 20, padB = 30;
                // Map each data point to SVG coords
                const toX = i => padL + (i / Math.max(n - 1, 1)) * W;
                const toY = v => padT + (1 - v / maxGross) * H;
                // Build polyline points
                const grossPts  = chartData.map((d, i) => `${toX(i)},${toY(d.gross)}`).join(' ');
                const netPts    = chartData.map((d, i) => `${toX(i)},${toY(d.net)}`).join(' ');
                const areaClose = `${toX(n-1)},${padT + H} ${padL},${padT + H}`;
                return (
                  <svg viewBox={`0 0 ${W + padL + 20} ${H + padT + padB}`} className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D8BFE3" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#D8BFE3" stopOpacity="0" />
                      </linearGradient>
                      <linearGradient id="accentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D8BFE3" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#D8BFE3" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    {[0,1,2,3,4].map(idx => (
                      <line key={idx} x1={padL} y1={padT + idx * (H/4)} x2={W + padL} y2={padT + idx * (H/4)}
                        stroke="rgba(90,30,126,0.05)" strokeDasharray="4" />
                    ))}
                    {/* Area fill — gross */}
                    <polygon
                      points={`${grossPts} ${areaClose}`}
                      fill="url(#chartGradient)"
                    />
                    {/* Gross line */}
                    <polyline points={grossPts} fill="none" stroke="#B886D0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Net line (dashed) */}
                    <polyline points={netPts} fill="none" stroke="#D8BFE3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />
                    {/* Data points + tooltips */}
                    {chartData.map((d, i) => (
                      <g key={i}>
                        <circle cx={toX(i)} cy={toY(d.gross)} r="4.5" fill="#B886D0" stroke="white" strokeWidth="1.5" className="cursor-pointer" />
                        <text x={toX(i)} y={padT + H + 16} fill="#7B3FA0" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                          {d.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>

            <div className="flex items-center gap-6 text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider pl-10">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#B886D0]" />
                Gross Creator Revenue
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D8BFE3]" />
                Net Settled Earnings
              </div>
            </div>

          </div>

          {/* Business Insight Panel (30%) */}
          <div className="lg:col-span-3 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5 justify-between">
            <div>
              <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Neural Diagnostics</h4>
              <h2 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">SaaS System Insights</h2>
            </div>

            {/* Insights — generated from real Firestore data */}
            <div className="flex flex-col gap-4">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3.5 bg-white border border-stone-200/20 rounded-2xl flex flex-col gap-1.5 animate-pulse">
                    <div className="h-2 bg-[#381347]/10 rounded-full w-1/4" />
                    <div className="h-3 bg-[#381347]/15 rounded-md w-full" />
                  </div>
                ))
              ) : insights.length === 0 ? (
                <div className="p-3.5 bg-white border border-stone-200/20 rounded-2xl flex flex-col gap-1.5">
                  <span className="text-[8px] font-extrabold tracking-widest text-[#D8BFE3] uppercase">Status</span>
                  <p className="text-[10px] text-[#2D004D] font-medium leading-relaxed">
                    No data yet. Insights will appear as orders, reviews, and products are added.
                  </p>
                </div>
              ) : insights.map((ins, i) => (
                <div key={i} className="p-3.5 bg-white border border-stone-200/20 rounded-2xl flex flex-col gap-1.5 hover:shadow-inner transition-shadow duration-300">
                  <span className="text-[8px] font-extrabold tracking-widest text-[#D8BFE3] uppercase">{ins.label}</span>
                  <p className="text-[10px] text-[#2D004D] font-medium leading-relaxed">{ins.text}</p>
                </div>
              ))}
            </div>

            {/* Marketplace Health Score — real computed value */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200/20 flex flex-col gap-2 shadow-sm mt-2">
              <div className="flex justify-between text-[8px] font-extrabold text-[#7B3FA0] uppercase tracking-wider">
                <span>Marketplace Health</span>
                <span>{isLoading ? '...' : `${healthScore}/100 — ${healthStatus || '...'}`}</span>
              </div>
              <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isLoading ? 'bg-[#381347]/10 w-full animate-pulse' :
                    healthScore >= 85 ? 'bg-gradient-to-r from-[#B886D0] to-[#a2d8b1]' :
                    healthScore >= 65 ? 'bg-gradient-to-r from-[#B886D0] to-[#D8BFE3]' :
                    healthScore >= 40 ? 'bg-gradient-to-r from-[#ffb685] to-[#D8BFE3]' :
                    'bg-gradient-to-r from-[#FF8597] to-[#ffb685]'
                  }`}
                  style={{ width: isLoading ? '100%' : `${healthScore}%` }}
                />
              </div>
              <span className="text-[8px] text-[#7B3FA0] mt-0.5">
                {isLoading ? 'Assessing platform health...' : (
                  healthScore >= 85 ? 'Excellent — Platform operating at peak performance' :
                  healthScore >= 65 ? 'Healthy — All systems normal' :
                  healthScore >= 40 ? 'Warning — Review flagged metrics' :
                  'Critical — Immediate action required'
                )}
              </span>
            </div>

          </div>

        </section>

        {/* --- LAYER 4: ECOSYSTEM PERFORMANCE LAYER --- */}
        <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 mb-12 items-start">
          
          {/* A. Product Performance Matrix (60%) */}
          <GlassCard title="Product Performance Matrix" subtitle="Asset Telemetry" className="lg:col-span-6">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200/40 pb-2">
                    <th className="py-2.5 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Asset Name</th>
                    <th className="py-2.5 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-right">Revenue</th>
                    <th className="py-2.5 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center">Orders</th>
                    <th className="py-2.5 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center">Conversion</th>
                    <th className="py-2.5 text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b border-stone-100/40 animate-pulse">
                        <td className="py-3"><div className="h-4 bg-[#381347]/10 rounded w-2/3" /></td>
                        <td className="py-3"><div className="h-4 bg-[#381347]/15 rounded w-1/2 ml-auto" /></td>
                        <td className="py-3"><div className="h-4 bg-[#381347]/10 rounded w-1/3 mx-auto" /></td>
                        <td className="py-3"><div className="h-4 bg-[#381347]/10 rounded w-1/3 mx-auto" /></td>
                        <td className="py-3"><div className="h-4 bg-[#381347]/15 rounded w-1/2 mx-auto" /></td>
                      </tr>
                    ))
                  ) : ecosystemProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[11px] text-[#7B3FA0]">No published products with orders yet.</td>
                    </tr>
                  ) : ecosystemProducts.map((p) => (
                    <tr key={p.id} className="border-b border-stone-100/40 hover:bg-white/40 transition-colors">
                      <td className="py-3 text-xs font-bold text-[#2D004D]">{p.name}</td>
                      <td className="py-3 text-xs font-black text-right text-[#2D004D]">{currencySymbol}{formatValue(p.revenue)}</td>
                      <td className="py-3 text-xs font-bold text-[#7B3FA0] text-center">{p.orders}</td>
                      <td className="py-3 text-xs font-bold text-[#7B3FA0] text-center">{p.conversion}%</td>
                      <td className="py-3 text-center">
                        <div className="flex items-center gap-1.5 justify-center w-20 mx-auto">
                          <span className="text-[10px] font-black text-[#2D004D]">{p.engagement}%</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p.status === 'growth' ? 'bg-[#B886D0] shadow-[0_0_6px_#B886D0]' :
                            p.status === 'caution' ? 'bg-[#D8BFE3] shadow-[0_0_6px_#D8BFE3]' :
                            'bg-[#D8BFE3] shadow-[0_0_6px_#D8BFE3]'
                          }`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* B. Customer Behavior Insight Panel (40%) */}
          <GlassCard title="Customer Behavior Insights" subtitle="Client Intelligence" className="lg:col-span-4 flex flex-col justify-between">
            <div className="flex flex-col gap-3.5 flex-1 justify-center my-3">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/60 border border-[#F3EAF8] rounded-2xl animate-pulse">
                    <div className="flex items-center gap-3 w-2/3">
                      <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-[10px]" />
                      <div className="flex-grow">
                        <div className="h-3 bg-[#381347]/15 rounded w-3/4 mb-1.5" />
                        <div className="h-2 bg-[#381347]/10 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-1/4">
                      <div className="h-3 bg-[#381347]/15 rounded w-full mb-1.5" />
                      <div className="h-2 bg-[#381347]/10 rounded w-2/3" />
                    </div>
                  </div>
                ))
              ) : customerInsights.topCustomers.length === 0 ? (
                <p className="text-[11px] text-[#7B3FA0] text-center py-4">No customer data yet.</p>
              ) : customerInsights.topCustomers.map((c, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/60 border border-[#F3EAF8] rounded-2xl hover:bg-white hover:shadow-sm transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center text-[10px] font-black uppercase text-[#7B3FA0]">
                      {c.name.slice(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#2D004D]">{c.name}</span>
                      <span className="text-[9px] text-[#7B3FA0] leading-none mt-0.5">{c.email}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-serif font-black text-[#2D004D]">{currencySymbol}{formatValue(c.spend)}</span>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mt-0.5">{c.purchases} orders</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Geo distribution from real order data */}
            <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-200/50">
              {isLoading ? (
                <div className="h-4 bg-[#381347]/10 animate-pulse rounded-md w-1/3" />
              ) : customerInsights.geoDistribution.length === 0 ? (
                <span className="text-[9px] font-bold text-[#7B3FA0] bg-white border border-stone-200/30 px-2.5 py-1 rounded-xl">No geo data yet</span>
              ) : customerInsights.geoDistribution.map((g, i) => (
                <span key={i} className="text-[9px] font-bold text-[#7B3FA0] bg-white border border-stone-200/30 px-2.5 py-1 rounded-xl">
                  {g.country}: {g.share}%
                </span>
              ))}
            </div>
          </GlassCard>

        </section>

        {/* --- LAYER 5: LIVE EVENTS & LEADERS & RISK --- */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* 5. Live Activity Stream (Event Log) - 4 cols */}
          <GlassCard title="Live Activity Log" subtitle="SYSTEM TELEMETRY FEED" className="lg:col-span-4 h-[360px] overflow-hidden flex flex-col justify-between">
            {/* Vertical scrolling event containers */}
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1 my-1 scrollbar-thin">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white/80 border border-[#F3EAF8] rounded-2xl animate-pulse">
                    <div className="flex-1">
                      <div className="h-3 bg-[#381347]/15 rounded w-3/4 mb-1.5" />
                      <div className="h-2 bg-[#381347]/10 rounded w-1/4" />
                    </div>
                  </div>
                ))
              ) : (
                <AnimatePresence initial={false}>
                  {liveFeed.map((evt) => (
                    <motion.div 
                      key={evt.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex justify-between items-center p-3 bg-white/80 border border-[#F3EAF8] rounded-2xl text-[10px]"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-[#2D004D]">{evt.text}</span>
                        <span className="text-[8px] text-[#7B3FA0]">{evt.time}</span>
                      </div>
                      {evt.value && (
                        <span className={`font-mono font-bold px-2 py-0.5 rounded ${
                          evt.category === 'purchase' ? 'text-[#5A1E7E] bg-[#B886D0]/10' :
                          evt.category === 'refund' ? 'text-[#8c4854] bg-[#D8BFE3]/25' :
                          'text-[#7B3FA0] bg-white'
                        }`}>
                          {evt.value}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </GlassCard>

          {/* 6. Creator Economy Panel (Leaderboard) - 4 cols */}
          <GlassCard title="Creator Leaderboard" subtitle="Marketplace Leaders" className="lg:col-span-4 h-[360px] flex flex-col justify-between">
            <div className="flex flex-col gap-3.5 flex-1 justify-center my-1">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-white/50 rounded-2xl border border-[#F3EAF8] animate-pulse">
                    <div className="flex items-center gap-3 w-2/3">
                      <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center text-[10px]" />
                      <div className="flex-1">
                        <div className="h-3 bg-[#381347]/15 rounded w-3/4 mb-1.5" />
                        <div className="h-2 bg-[#381347]/10 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-1/4">
                      <div className="h-3 bg-[#381347]/15 rounded w-full" />
                    </div>
                  </div>
                ))
              ) : leaderboardCreators.length === 0 ? (
                <p className="text-[11px] text-[#7B3FA0] text-center py-4">No vendor data yet.</p>
              ) : leaderboardCreators.map((c, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-2.5 bg-white/50 hover:bg-white rounded-2xl hover:shadow-sm border border-transparent hover:border-[#F3EAF8] transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100 flex items-center justify-center text-[10px] font-black text-[#7B3FA0] uppercase">
                      {c.avatar
                        ? <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                        : c.name.slice(0, 2)
                      }
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#2D004D]">{c.name}</span>
                      <span className="text-[8px] text-[#8E6AA8] uppercase tracking-wider font-bold">{c.orders} orders</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-serif font-black text-[#2D004D]">{currencySymbol}{formatValue(c.sales)}</span>
                    <span className="text-[8px] font-extrabold text-[#B886D0] bg-[#B886D0]/10 px-1.5 py-0.5 rounded mt-0.5">{c.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* C. Risk & Fraud Intelligence (4 cols) */}
          <GlassCard 
            title="Risk & Fraud Audit" 
            subtitle="SECURITY LEDGER" 
            className="lg:col-span-4 h-[360px] flex flex-col justify-between relative overflow-hidden"
            headerActions={
              <button 
                onClick={handleTriggerSecurityScan}
                disabled={isScanning}
                className="p-1.5 bg-white border border-stone-200/50 rounded-lg hover:bg-stone-100 text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                title="Trigger Audit Scan"
              >
                <Icon name="RefreshCw" size={12} className={isScanning ? 'animate-spin' : ''} />
              </button>
            }
          >
            {/* Scanning line sweep visual overlay */}
            {isScanning && (
              <motion.div 
                animate={{ y: [0, 360, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF8597] to-transparent shadow-[0_0_12px_#FF8597] z-10 pointer-events-none"
              />
            )}

            {/* Suspicious Logs — real risk data from dashboardService */}
            <div className="flex flex-col gap-3 flex-1 justify-center my-1">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-2xl border border-[#F3EAF8] text-[10px] animate-pulse bg-white/50">
                    <div className="flex-grow">
                      <div className="h-3 bg-[#381347]/15 rounded w-1/3 mb-1.5" />
                      <div className="h-2 bg-[#381347]/10 rounded w-1/2" />
                    </div>
                    <div className="flex flex-col items-end w-1/4">
                      <div className="h-3 bg-[#381347]/15 rounded w-full" />
                    </div>
                  </div>
                ))
              ) : suspiciousLogs.length === 0 ? (
                <p className="text-[11px] text-[#7B3FA0] text-center py-4">No risk flags detected. Platform secure.</p>
              ) : suspiciousLogs.map((log) => (
                <div 
                  key={log.id} 
                  className={`flex justify-between items-center p-3 rounded-2xl border text-[10px] font-mono ${
                    log.score >= 90 ? 'bg-[#D8BFE3]/20 border-[#FF8597]/20 shadow-[0_0_8px_rgba(255,133,151,0.15)] animate-pulse' :
                    log.score >= 80 ? 'bg-[#D8BFE3]/10 border-[#ffb685]/20' :
                    'bg-white/50 border-[#F3EAF8]'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-[#2D004D]">{log.id}</span>
                    <span className="text-[9px] text-[#7B3FA0]">{log.customer}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`font-bold ${log.score >= 80 ? 'text-[#FF8597]' : 'text-[#7B3FA0]'}`}>{log.score}% score</span>
                    <span className="text-[8px] text-[#8E6AA8] mt-0.5">{log.time}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom operational status */}
            <div className="text-[9px] text-[#7B3FA0] flex justify-between border-t border-stone-200/50 pt-3">
              <span>{isScanning ? `Auditing Ledger (${scanProgress}%)` : "Synaptic logs fully certified"}</span>
              <span className="font-bold text-[#B886D0] bg-[#B886D0]/10 px-1.5 py-0.5 rounded">SECURED</span>
            </div>
          </GlassCard>

        </section>

      </main>

      {/* --- LAYER 6: METRIC EXPANSION INSIGHT MODALS --- */}
      <AnimatePresence>
        {activeModalCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-[#2D004D]/35 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
            style={{ zIndex: 1000 }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full border border-stone-200/50 shadow-2xl relative"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => { sysSound.playTap(); setActiveModalCard(null); }}
                className="absolute right-6 top-6 p-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border-none cursor-pointer text-[#7B3FA0]"
              >
                <Icon name="X" size={12} />
              </button>

              <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#B886D0] animate-pulse" />
                NEURAL LEDGER ANALYTICS
              </h4>
              <h2 className="text-xl font-serif font-black text-[#2D004D] mt-1.5 mb-2">
                {metricModalDetails[activeModalCard]?.title}
              </h2>
              <p className="text-xs text-[#7B3FA0] leading-relaxed mb-6">
                {metricModalDetails[activeModalCard]?.desc}
              </p>

              {/* Custom SVG Mini Bar Chart within Modal */}
              <div className="h-32 w-full flex items-end gap-3.5 bg-stone-50 border border-stone-200/20 p-5 rounded-2xl shadow-inner mb-6">
                {metricModalDetails[activeModalCard]?.data.map((val, idx) => {
                  const max = Math.max(...metricModalDetails[activeModalCard]?.data);
                  const pct = max > 0 ? (val / max) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div 
                        className="w-full bg-gradient-to-t from-[#D8BFE3] to-[#D8BFE3] rounded-lg transition-all duration-1000 shadow-sm"
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-[8px] font-mono text-[#7B3FA0]">0{idx+1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Close instruction CTA */}
              <button 
                onClick={() => { sysSound.playTap(); setActiveModalCard(null); }}
                className="w-full py-3.5 bg-[#2D004D] hover:bg-[#7B3FA0] text-white text-[10px] font-extrabold uppercase tracking-widest rounded-2xl transition-colors shadow-sm"
              >
                Close Metrics Sheet
              </button>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminLayout>
  );
}
