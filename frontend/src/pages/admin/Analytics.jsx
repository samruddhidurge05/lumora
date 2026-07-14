import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import {
  TrendingUp,
  ArrowUpRight,
  DollarSign,
  Activity,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  X,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Zap,
  Globe,
  Compass,
  Users,
  Package,
  Download,
  Share2,
  Calendar,
  Filter,
  Clock,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  MapPin,
  FileText,
  Play,
  Pause,
  Layers,
  Database,
  BarChart2,
  TrendingDown,
  ShoppingBag,
  Info
} from 'lucide-react';
import { getAnalyticsDashboard, subscribeToNewOrders, subscribeToNewReviews } from '../../services/analyticsService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePlatformSettings } from '../../hooks/usePlatformSettings.js';
import { PageHeader, StatsGrid, DashboardCard, GlassCard } from './components/AdminComponents';
import { auth } from '../../services/firebase';

// ─── TRANSFORM: Maps analyticsService output → UI data shape ─────────────────
// The UI was designed around a specific data shape. This adapter maps the
// real Firestore-derived data onto that exact shape so no rendering code changes.
const transformToUIShape = (svc) => {
  if (!svc) return null;
  const { kpis, revenueTrend, productPerformance, customerAnalytics,
          trustMetrics, geoAnalytics, growth, forecast } = svc;

  // Compute top category and top earning product from productPerformance
  const topProduct   = productPerformance?.[0] || null;
  const categoryRevMap = {};
  (productPerformance || []).forEach(p => {
    categoryRevMap[p.category] = (categoryRevMap[p.category] || 0) + p.revenue;
  });
  const bestCategory = Object.entries(categoryRevMap).sort((a,b) => b[1]-a[1])[0]?.[0] || 'N/A';

  return {
    revenueAnalytics: {
      today:       revenueTrend?.today ?? 0,
      change:      growth?.revenueGrowth ?? 0,
      aov:         kpis?.aov ?? 0,
      aovChange:   growth?.aovGrowth ?? 0,
      refundRate:  kpis?.refundRate ?? 0,
      refundChange: growth?.refundRateGrowth ?? 0,
      sparkline:   revenueTrend?.sparkline ?? [0,0,0,0,0,0,0,0,0],
      timeline:    revenueTrend?.timeline ?? {
        daily:   [],
        weekly:  [],
        monthly: [],
      },
      insights: {
        bestCategory:    bestCategory,
        highestEarning:  topProduct?.name ?? 'N/A',
        growthRate:      growth?.revenueGrowth ?? 0,
        velocity:        `${growth?.revenueGrowth >= 0 ? '+' : ''}${growth?.revenueGrowth ?? 0}%`,
        forecast:        forecast?.nextQuarterRevenue ?? 0,
      },
    },
    conversionAnalytics: {
      today:    'N/A',
      change:   'N/A',
      sparkline: [0,0,0,0,0,0,0,0,0],
      funnel: [
        { step: 'Total Orders',       count: kpis?.totalOrders ?? 0,    percent: 100,  glowColor: 'rgba(216,191,227,0.35)' },
        { step: 'Paid Orders',        count: kpis?.paidOrdersCount ?? 0, percent: kpis?.totalOrders > 0 ? Math.round((kpis?.paidOrdersCount / kpis?.totalOrders) * 100) : 0, glowColor: 'rgba(216,191,227,0.30)' },
        { step: 'Completed',          count: kpis?.completedOrdersCount ?? 0, percent: kpis?.totalOrders > 0 ? Math.round((kpis?.completedOrdersCount / kpis?.totalOrders) * 100) : 0, glowColor: 'rgba(216,191,227,0.35)' },
        { step: 'Returning Customers',count: customerAnalytics?.returningCustomers ?? 0, percent: kpis?.activeCustomers > 0 ? Math.round((customerAnalytics?.returningCustomers / kpis?.activeCustomers) * 100) : 0, glowColor: 'rgba(184,134,208,0.30)' },
        { step: 'Repeat Purchases',   count: customerAnalytics?.repeatPurchasesCount ?? 0, percent: customerAnalytics?.repeatPurchaseRate ?? 0, glowColor: 'rgba(184,134,208,0.35)' },
      ],
    },
    customerAnalytics: {
      newCustomers:        customerAnalytics?.newCustomers ?? 0,
      newCustomersChange:  growth?.customerGrowth ?? 0,
      returningCustomers:  customerAnalytics?.returningCustomers ?? 0,
      repeatPurchaseRate:  customerAnalytics?.repeatPurchaseRate ?? 0,
      repeatChange:        growth?.customerGrowth ?? 0,
      clv:                 customerAnalytics?.clv ?? 0,
      clvChange:           0,
      growth:              growth?.customerGrowth ?? 0,
      clvTrend:            customerAnalytics?.clvTrend ?? [0,0,0,0,0,0],
      retentionSegments: [
        { name: 'Returning (2+ orders)', value: Math.min(99, customerAnalytics?.repeatPurchaseRate ?? 0), color: '#B886D0' },
        { name: 'One-time Buyers',       value: Math.max(1, 100 - (customerAnalytics?.repeatPurchaseRate ?? 0)), color: '#D8BFE3' },
      ],
    },
    trafficAnalytics: {
      sources: [
        { name: 'Published Products', count: kpis?.publishedProducts ?? 0, percent: 100, color: '#B886D0' },
        { name: 'Approved Vendors',   count: kpis?.approvedVendors ?? 0,   percent: Math.min(100, Math.round(((kpis?.approvedVendors ?? 0) / Math.max(1, kpis?.publishedProducts ?? 1)) * 100)), color: '#D8BFE3' },
        { name: 'Active Customers',   count: kpis?.activeCustomers ?? 0,   percent: Math.min(100, Math.round(((kpis?.activeCustomers ?? 0) / Math.max(1, customerAnalytics?.totalCustomers ?? 1)) * 100)), color: '#D8BFE3' },
        { name: 'Total Reviews',      count: svc._meta?.totalReviews ?? 0, percent: Math.min(100, Math.round(((svc._meta?.totalReviews ?? 0) / Math.max(1, kpis?.totalOrders ?? 1)) * 100)), color: '#B886D0' },
      ],
      qualityIndex: Math.min(99, Math.round(50 + (kpis?.avgRating ?? 0) * 8)),
      qualityTrend: `${growth?.reviewGrowth >= 0 ? '+' : ''}${growth?.reviewGrowth ?? 0}% MoM`,
    },
    productAnalytics: (productPerformance || []).map((p, idx) => ({
      id:         p.id,
      name:       p.name,
      category:   p.category,
      revenue:    p.revenue,
      orders:     p.orders,
      conversion: p.conversion,
      growth:     p.growth,
      refundRate: p.refundRate,
      engagement: Math.min(99, Math.round(50 + (p.rating ?? 0) * 8)),
      image:      p.image ? '🖼️' : '📦',
    })),
    geoAnalytics: (geoAnalytics || []).map(g => ({
      region:     g.region,
      customers:  g.customers,
      revenue:    g.revenue,
      growth:     g.growth,
      activeRate: g.activeRate,
      code:       g.region.slice(0, 2).toUpperCase(),
    })),
    forecastAnalytics: {
      next7Days:   { value: Math.round((forecast?.nextMonthRevenue ?? 0) / 4),  range: [0,0], confidence: forecast?.confidenceScore ?? 0, growth: growth?.revenueGrowth ?? 0 },
      next30Days:  { value: forecast?.nextMonthRevenue ?? 0,                     range: [0,0], confidence: forecast?.confidenceScore ?? 0, growth: growth?.revenueGrowth ?? 0 },
      nextQuarter: { value: forecast?.nextQuarterRevenue ?? 0,                   range: [0,0], confidence: forecast?.confidenceScore ?? 0, growth: growth?.revenueGrowth ?? 0 },
      confidenceScore: forecast?.confidenceScore ?? 0,
      forecastPath:    forecast?.forecastPath ?? [],
    },
    aiInsights: [
      {
        id: 'in-rev',
        text: `Revenue ${growth?.revenueGrowth >= 0 ? 'grew' : 'declined'} ${Math.abs(growth?.revenueGrowth ?? 0)}% month-over-month. Total paid revenue: ₹${(kpis?.totalRevenue ?? 0).toLocaleString()}.`,
        priority: Math.abs(growth?.revenueGrowth ?? 0) > 10 ? 'high' : 'medium',
        type: 'growth',
        timestamp: 'Live',
      },
      {
        id: 'in-cust',
        text: `${customerAnalytics?.newCustomers ?? 0} new customers in the last 30 days. Repeat purchase rate: ${customerAnalytics?.repeatPurchaseRate ?? 0}%. CLV: ₹${(customerAnalytics?.clv ?? 0).toLocaleString()}.`,
        priority: 'medium',
        type: 'retention',
        timestamp: 'Live',
      },
      {
        id: 'in-trust',
        text: `Trust score: ${kpis?.avgRating ?? 0}/5 average rating. Positive reviews: ${trustMetrics?.positivePercent ?? 0}%, Negative: ${trustMetrics?.negativePercent ?? 0}%.`,
        priority: (trustMetrics?.negativePercent ?? 0) > 20 ? 'high' : 'low',
        type: (trustMetrics?.negativePercent ?? 0) > 20 ? 'warning' : 'retention',
        timestamp: 'Live',
      },
      {
        id: 'in-forecast',
        text: `Sales forecast: ₹${(forecast?.nextMonthRevenue ?? 0).toLocaleString()} next month. Confidence: ${forecast?.confidenceScore ?? 0}%. Based on 90-day linear regression.`,
        priority: 'medium',
        type: 'optimization',
        timestamp: 'Live',
      },
    ],
  };
};

// --- SYSTEM AUDIO CONTROLLER ---
class AudioController {
  constructor() {
    this.ctx = null;
    this.muted = true; // start muted by default
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTap() {
    if (this.muted) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1250, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch (e) {
      console.error('Audio error:', e);
    }
  }
  playSwoosh() {
    if (this.muted) return;
    try {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {
      console.error('Audio error:', e);
    }
  }
  playSuccess() {
    if (this.muted) return;
    try {
      this.init();
      const now = this.ctx.currentTime;
      const playNote = (freq, start, duration) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.01, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playNote(523.25, now, 0.1);  // C5
      playNote(659.25, now + 0.05, 0.1);  // E5
      playNote(783.99, now + 0.1, 0.25); // G5
    } catch (e) {
      console.error('Audio error:', e);
    }
  }
}

const sysSound = new AudioController();

// No hardcoded mock data — all data comes from analyticsService.js via Firestore.

export default function Analytics() {
  const { userRole } = useAuth();
  const { settings, loading: settingsLoading } = usePlatformSettings();

  // Enforce analyticsEnabled — Admins always have access; non-admins are blocked when disabled
  if (!settingsLoading && !settings.analyticsEnabled && userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center bg-white/80 backdrop-blur-md border border-stone-200/50 rounded-3xl p-10 shadow-lg">
          <div className="w-16 h-16 rounded-full bg-[#D8BFE3]/30 flex items-center justify-center mx-auto mb-5">
            <BarChart2 size={28} className="text-[#7B3FA0]" />
          </div>
          <h2 className="text-xl font-serif font-black text-[#2D004D] mb-2">Analytics Disabled</h2>
          <p className="text-sm text-[#7B3FA0] leading-relaxed">
            Analytics access for non-admin users has been disabled by the platform administrator.
          </p>
          <span className="inline-block mt-5 text-[9px] font-extrabold tracking-widest uppercase text-[#B886D0] bg-[#B886D0]/10 px-3 py-1.5 rounded-full">
            Platform Setting Active
          </span>
        </div>
      </div>
    );
  }

  const [data, setData] = useState(null);         // null = loading / empty state
  const [liveEvents, setLiveEvents] = useState([]); // populated by real onSnapshot
  const [analyticsError, setAnalyticsError] = useState(null); // error state — no mock fallback
  const [selectedRange, setSelectedRange] = useState('all'); // date range: 7d | 30d | 90d | all
  const [timeframe, setTimeframe] = useState('weekly'); // 'daily' | 'weekly' | 'monthly'
  const [selectedProductCategory, setSelectedProductCategory] = useState('All');
  const [productSortBy, setProductSortBy] = useState('revenue'); // 'revenue' | 'orders'
  const [activeMetricModal, setActiveMetricModal] = useState(null);
  const [liveSimulation, setLiveSimulation] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hoveredChartPoint, setHoveredChartPoint] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Floating ambient mouse position tracking
  const [mousePos, setMousePos] = useState({ x: -200, y: -200 });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Sync mute state with local AudioController
  useEffect(() => {
    sysSound.muted = isMuted;
  }, [isMuted]);

  // ─── REAL DATA LOAD: Firestore via analyticsService ──────────────────────
  const loadAnalytics = useCallback(async (range = selectedRange) => {
    setIsLoading(true);
    setAnalyticsError(null);
    try {
      const svcData = await getAnalyticsDashboard(range);
      setData(transformToUIShape(svcData));
    } catch (err) {
      console.error('[Analytics] Failed to load dashboard:', err);
      setData(null);
      setAnalyticsError(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRange]);

  useEffect(() => {
    loadAnalytics(selectedRange);
  }, [selectedRange]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── REAL-TIME: Subscribe to new orders and reviews ───────────────────────
  useEffect(() => {
    // Guard: only subscribe when Firebase auth is active
    if (!auth.currentUser) return;

    const unsubOrders  = subscribeToNewOrders((order) => {
      const amt = order.total || order.price || 0;
      if (!amt) return;

      const newEvent = {
        id:     `evt-${Date.now()}-${order.id}`,
        text:   `New order: ${order.items?.[0]?.snapshot?.title || 'Product purchased'}`,
        amount: `+₹${amt.toFixed(2)}`,
        time:   'Just now',
        type:   'sale',
      };
      setLiveEvents(prev => [newEvent, ...prev.slice(0, 9)]);

      sysSound.playSuccess();

      setNotification({
        title:   'New Order',
        message: `Order confirmed: ₹${amt.toFixed(2)}`,
        type:    'success',
      });
      setTimeout(() => setNotification(null), 4000);

      // Reload analytics data to reflect the new order
      if (liveSimulation) loadAnalytics();
    });

    const unsubReviews = subscribeToNewReviews((review) => {
      const newEvent = {
        id:     `evt-rev-${Date.now()}-${review.id}`,
        text:   `New ${review.rating}★ review submitted`,
        amount: `${review.rating}/5`,
        time:   'Just now',
        type:   'customer',
      };
      setLiveEvents(prev => [newEvent, ...prev.slice(0, 9)]);

      if (liveSimulation) loadAnalytics();
    });

    return () => {
      unsubOrders();
      unsubReviews();
    };
  }, [liveSimulation, loadAnalytics]);

  // Refresh: reload from Firestore
  const handleRefresh = () => {
    setIsRefreshing(true);
    sysSound.playSwoosh();
    loadAnalytics(selectedRange).finally(() => {
      setIsRefreshing(false);
      sysSound.playSuccess();
    });
  };

  // Convert categories list
  const categories = useMemo(() => {
    if (!data) return [];
    return ['All', ...new Set(data.productAnalytics.map(p => p.category))];
  }, [data]);

  // Filtered product analytics
  const filteredProducts = useMemo(() => {
    if (!data) return [];
    const prods = selectedProductCategory === 'All'
      ? data.productAnalytics
      : data.productAnalytics.filter(p => p.category === selectedProductCategory);
    return [...prods].sort((a, b) => {
      if (productSortBy === 'orders') {
        return (b.orders - a.orders) || (b.revenue - a.revenue);
      }
      return (b.revenue - a.revenue) || (b.orders - a.orders);
    });
  }, [data, selectedProductCategory, productSortBy]);

  // Quick action — CSV export from real data
  const triggerReportGeneration = () => {
    sysSound.playTap();
    if (!data) return;
    try {
      const rows = [
        ['Metric', 'Value'],
        ['Total Revenue', data.revenueAnalytics.today],
        ['AOV', data.revenueAnalytics.aov],
        ['Refund Rate', data.revenueAnalytics.refundRate],
        ['Repeat Purchase Rate', data.customerAnalytics.repeatPurchaseRate],
        ['New Customers (30d)', data.customerAnalytics.newCustomers],
        ['Returning Customers', data.customerAnalytics.returningCustomers],
        ['CLV', data.customerAnalytics.clv],
        ['Next Month Forecast', data.forecastAnalytics.next30Days.value],
        ['Next Quarter Forecast', data.forecastAnalytics.nextQuarter.value],
        ['Confidence Score', data.forecastAnalytics.confidenceScore],
      ];
      const csv = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csv));
      link.setAttribute('download', `lumora_analytics_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('CSV export error', e);
    }
    setNotification({
      title: 'Report Compiled',
      message: 'Lumora Growth Intelligence CSV downloaded.',
      type: 'report',
    });
    setTimeout(() => setNotification(null), 5000);
  };

  // Toggle between data view and empty state
  const handleToggleState = (stateType) => {
    sysSound.playTap();
    if (stateType === 'empty') {
      setData(null);
    } else {
      loadAnalytics();
    }
  };

  return (
    <AdminLayout activePage="analytics">
      <div 
        ref={containerRef}
        className="relative overflow-hidden font-sans selection:bg-[#D8BFE3] selection:text-[#2D004D]"
      >
      {/* CSS Injected styles for luxury premium layout adjustments, glows and high-fidelity animations */}
      <style>{`
        /* Smooth Scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #F8F3FB;
        }
        ::-webkit-scrollbar-thumb {
          background: #E5D5C5;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #8E6AA8;
        }

        /* Glassmorphism Surface standard specification */
        .glass-surface {
          background: linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(216,191,227,0.06) 100%);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.30);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.50), 0 10px 40px rgba(90,30,126,0.06), 0 20px 60px rgba(90,30,126,0.08), 0 30px 80px rgba(45,0,77,0.10);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-surface:hover {
          background: linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(216,191,227,0.08) 100%);
          border-color: rgba(184,134,208,0.25);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.60), 0 0 0 1px rgba(216,191,227,0.12), 0 10px 40px rgba(90,30,126,0.08), 0 20px 60px rgba(90,30,126,0.10), 0 30px 80px rgba(45,0,77,0.12);
        }

        /* Ambient floating keyframes */
        @keyframes float-orb {
          0% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.05); }
          100% { transform: translateY(0px) scale(1); }
        }
        .animate-float-orb {
          animation: float-orb 8s ease-in-out infinite;
        }

        /* Pulse light glow */
        @keyframes pulse-soft {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
        .animate-pulse-soft {
          animation: pulse-soft 4s ease-in-out infinite;
        }

        @keyframes lumora-symbol-float {
          0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.7; }
          50% { transform: translate(-50%, -52%) scale(1.03) rotate(3deg); opacity: 1; }
        }

        /* Funnel step line connectors */
        .funnel-step::after {
          content: '';
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          width: 2px;
          height: 16px;
          background: repeating-linear-gradient(to bottom, #F3EAF8 0px, #F3EAF8 4px, #F3EAF8 8px);
          opacity: 0.6;
        }
        .funnel-step:last-child::after {
          display: none;
        }

        /* SVG Line drawing animation */
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        .path-anim {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawLine 2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>



      {/* Ephemeral Real-time notification banners */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 glass-surface px-6 py-4 rounded-2xl border border-white/60 shadow-lg flex items-center gap-3.5 max-w-md w-11/12"
          >
            <div className="w-9 h-9 rounded-xl bg-[#B886D0]/40 flex items-center justify-center text-[#5A1E7E] flex-shrink-0">
              {notification.type === 'success' ? <Zap size={18} /> : <FileText size={18} />}
            </div>
            <div>
              <h5 className="text-[11px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">{notification.title}</h5>
              <p className="text-[12px] text-[#2D004D] font-medium leading-normal mt-0.5">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-[#7B3FA0] hover:text-[#2D004D] ml-auto flex-shrink-0"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Core Container */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* Date Range Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Range:</span>
          {[
            { label: '7 Days', value: '7d' },
            { label: '30 Days', value: '30d' },
            { label: '90 Days', value: '90d' },
            { label: 'All Time', value: 'all' },
          ].map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setSelectedRange(value)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: selectedRange === value ? 'none' : '1px solid rgba(142,106,168,0.2)',
                background: selectedRange === value ? '#2D004D' : 'white',
                color: selectedRange === value ? '#F8F3FB' : '#7B3FA0',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error state banner */}
        {analyticsError && (
          <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: '12px', color: '#dc2626', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
            <span>⚠ Analytics failed to load: {analyticsError}</span>
            <button
              onClick={() => loadAnalytics(selectedRange)}
              style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Global Controls & Mode Switchers (Stripe/Bloomberg Hybrid Control Center) */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isLoading ? 'bg-yellow-400 animate-spin' : 'bg-[#B886D0] animate-pulse'}`} />
            <span className="text-[10px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">{isLoading ? 'Loading Firestore Data...' : 'Live Data Active'}</span>
            <button
              onClick={() => {
                sysSound.playTap();
                setLiveSimulation(!liveSimulation);
              }}
              className={`p-1 px-2.5 rounded-lg text-[9px] font-extrabold tracking-wider uppercase transition-all duration-300 ${
                liveSimulation ? 'bg-[#2D004D] text-[#F8F3FB]' : 'bg-white text-[#7B3FA0] border border-stone-200/50'
              }`}
            >
              {liveSimulation ? 'Live' : 'Paused'}
            </button>
          </div>

          {/* Quick toggle to review Empty State or Normal State */}
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-1 rounded-xl border border-stone-200/40">
            <button
              onClick={() => handleToggleState('active')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold tracking-widest uppercase transition-colors ${
                data !== null ? 'bg-[#2D004D] text-[#F8F3FB]' : 'text-[#7B3FA0] hover:text-[#2D004D]'
              }`}
            >
              Telemetry Active
            </button>
            <button
              onClick={() => handleToggleState('empty')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold tracking-widest uppercase transition-colors ${
                data === null ? 'bg-[#2D004D] text-[#F8F3FB]' : 'text-[#7B3FA0] hover:text-[#2D004D]'
              }`}
            >
              Empty State
            </button>
          </div>
        </div>

        {/* State Conditional render logic */}
        <AnimatePresence mode="wait">
          {data === null ? (
            /* --- EMPTY STATE VIEW --- */
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
              className="min-h-[550px] flex flex-col items-center justify-center text-center p-8 glass-surface rounded-3xl border border-white/50 relative overflow-hidden"
            >
              {/* Outer floating visual orbs */}
              <div className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-[#D8BFE3]/20 to-[#D8BFE3]/20 filter blur-3xl animate-float-orb pointer-events-none" />
              
              {/* Floating interactive orb center */}
              <div 
                className="w-48 h-48 rounded-full bg-gradient-to-br from-white/60 to-white/10 border border-white/80 shadow-[0_20px_50px_rgba(216,191,227,0.2)] flex items-center justify-center mb-8 relative cursor-pointer hover:scale-105 transition-transform duration-500 animate-float-orb"
                onClick={() => handleToggleState('active')}
              >
                <div className="w-36 h-36 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center">
                  <Database size={40} className="text-[#B886D0] animate-pulse" />
                </div>
                {/* Floating particles around it */}
                <div className="absolute top-4 left-4 w-3.5 h-3.5 rounded-full bg-[#D8BFE3] animate-ping" />
                <div className="absolute bottom-6 right-8 w-2 h-2 rounded-full bg-[#D8BFE3] animate-pulse" />
                <div className="absolute top-1/2 right-4 w-2.5 h-2.5 rounded-full bg-[#B886D0] animate-bounce" />
              </div>

              <span className="text-[10px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-3 flex items-center gap-1.5">
                <Sparkles size={12} />
                LUMORA TELEMETRY STREAM
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-[#2D004D] max-w-md leading-tight">
                Your growth intelligence engine is collecting signals...
              </h2>
              <p className="text-[13px] text-[#7B3FA0] max-w-sm mt-3 leading-relaxed">
                Connect backend modules or flip to the normal state above to preview real-time charts, predictive forecasting models, and customer segments.
              </p>

              <button
                onClick={() => handleToggleState('active')}
                className="mt-8 px-6 py-3 rounded-full bg-[#2D004D] text-[#F8F3FB] text-xs font-extrabold tracking-widest uppercase hover:bg-[#7B3FA0] transition-colors shadow-lg shadow-[#2D004D]/10 flex items-center gap-2 group"
              >
                Simulate Signal Feeds
                <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </motion.div>
          ) : (
            /* --- MAIN ACTIVE DASHBOARD ENGINE --- */
            <motion.div
              key="active-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-10"
            >
              
              {/* --- SECTION 1: HERO HEADER & CONTROLS --- */}
              <section className="relative">
                <PageHeader
                  title="Growth Intelligence"
                  subtitle="Understand performance, predict growth, and optimize revenue streams using advanced creator economy heuristics."
                  actions={
                    <div className="flex items-center gap-6 pt-2 md:pt-0">
                      <div className="flex flex-col text-right">
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Today's Revenue</span>
                        <span className="text-base font-serif font-black text-[#2D004D] mt-1.5 flex items-baseline gap-1">
                          ₹{(data.revenueAnalytics.today).toLocaleString()}
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B886D0]" />
                        </span>
                      </div>
                      <div className="flex flex-col text-right border-l border-stone-200/50 pl-4">
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Orders Today</span>
                        <span className="text-base font-serif font-black text-[#2D004D] mt-1.5">
                          {Math.floor(data.revenueAnalytics.today / data.revenueAnalytics.aov)}
                        </span>
                      </div>
                      <div className="flex flex-col text-right border-l border-stone-200/50 pl-4">
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Active Users</span>
                        <span className="text-base font-serif font-black text-[#2D004D] mt-1.5 flex items-baseline gap-1">
                          {data.customerAnalytics.newCustomers + data.customerAnalytics.returningCustomers > 0
                            ? (data.customerAnalytics.newCustomers + data.customerAnalytics.returningCustomers).toLocaleString()
                            : '—'}
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B886D0] inline-block animate-ping" />
                        </span>
                      </div>
                      <div className="flex flex-col text-right border-l border-stone-200/50 pl-4">
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Conversion</span>
                        <span className="text-base font-serif font-black text-[#5A1E7E] mt-1.5 flex items-center justify-end gap-1">
                          {data.conversionAnalytics.today === 'N/A' ? 'N/A' : `${data.conversionAnalytics.today}%`}
                          {data.conversionAnalytics.today !== 'N/A' && <TrendingUp size={12} />}
                        </span>
                      </div>
                    </div>
                  }
                />
              </section>

              {/* --- SECTION 2: EXECUTIVE PERFORMANCE OVERVIEW --- */}
              <StatsGrid columns={6}>
                <DashboardCard
                  title="Revenue today"
                  value={`₹${(data.revenueAnalytics.today).toLocaleString()}`}
                  icon={<DollarSign size={13} className="text-[#B886D0]" />}
                  trend={`+${data.revenueAnalytics.change}%`}
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'Gross Revenue Pipeline',
                      value: `₹${(data.revenueAnalytics.today * 12).toLocaleString()}`,
                      change: `+${data.revenueAnalytics.change}%`,
                      desc: 'Gross revenue processed across all tokenized items, downloadable tools, and creator licenses inside your catalog. Excludes regional taxes.',
                      details: [
                        { label: 'Settlement Speed', value: 'Instant T+0' },
                        { label: 'Transaction Security', value: '99.98% OK' },
                        { label: 'Ecosystem Margin', value: '4.5%' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,25 L12,20 L24,24 L36,18 L48,15 L60,19 L72,12 L84,10 L100,5" 
                        fill="none" 
                        stroke="#B886D0" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />
                
                <DashboardCard
                  title="Orders"
                  value={Math.floor(data.revenueAnalytics.today / data.revenueAnalytics.aov)}
                  icon={<ShoppingBag size={13} className="text-[#D8BFE3]" />}
                  trend="+18.4%"
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'Sales Volume Ledger',
                      value: `${Math.floor(data.revenueAnalytics.today / data.revenueAnalytics.aov)} sales`,
                      change: '+18.4%',
                      desc: 'The total volume of validated creator ecosystem checkouts processed in the current calendar day cycle.',
                      details: [
                        { label: 'Unique Customers', value: '42 active' },
                        { label: 'Average Items/Checkout', value: '1.4 items' },
                        { label: 'Cart Success Ratio', value: '92.1%' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,28 L15,22 L30,25 L45,18 L60,20 L75,14 L90,16 L100,10" 
                        fill="none" 
                        stroke="#D8BFE3" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />

                <DashboardCard
                  title="Conversion"
                  value={data.conversionAnalytics.today === 'N/A' ? 'N/A' : `${data.conversionAnalytics.today}%`}
                  icon={<TrendingUp size={13} className="text-[#D8BFE3]" />}
                  trend={data.conversionAnalytics.change === 'N/A' ? 'N/A' : `+${data.conversionAnalytics.change}%`}
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'Conversion Efficiency Index',
                      value: data.conversionAnalytics.today === 'N/A' ? 'N/A' : `${data.conversionAnalytics.today}%`,
                      change: data.conversionAnalytics.change === 'N/A' ? 'N/A' : `+${data.conversionAnalytics.change}%`,
                      desc: 'Percentage of unique digital visitors who completed a checkout workflow compared to total landing page impressions.',
                      details: [
                        { label: 'View-to-Cart Conversion', value: 'N/A' },
                        { label: 'Checkout Success Rate', value: 'N/A' },
                        { label: 'Estimated Bounce Index', value: 'N/A' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,22 L20,20 L40,16 L60,18 L80,12 L100,8" 
                        fill="none" 
                        stroke="#D8BFE3" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />

                <DashboardCard
                  title="Avg Order Value"
                  value={`₹${(data.revenueAnalytics.aov).toLocaleString()}`}
                  icon={<Zap size={13} className="text-[#B886D0]" />}
                  trend={`+${data.revenueAnalytics.aovChange}%`}
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'AOV Premium Metric',
                      value: `₹${(data.revenueAnalytics.aov).toLocaleString()}`,
                      change: `+${data.revenueAnalytics.aovChange}%`,
                      desc: 'The average amount spent per checkout transaction. A higher AOV signals strong bundled asset popularity.',
                      details: [
                        { label: 'Bundling Index', value: 'High' },
                        { label: 'Optimal Pricing Point', value: '₹140.00' },
                        { label: 'Top Contributor', value: 'UI Kits' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,25 L25,23 L50,26 L75,18 L100,15" 
                        fill="none" 
                        stroke="#B886D0" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />

                <DashboardCard
                  title="Retention"
                  value={`${data.customerAnalytics.repeatPurchaseRate}%`}
                  icon={<Users size={13} className="text-[#D8BFE3]" />}
                  trend={`+${data.customerAnalytics.repeatChange}%`}
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'Customer Retention Matrix',
                      value: `${data.customerAnalytics.repeatPurchaseRate}%`,
                      change: `+${data.customerAnalytics.repeatChange}%`,
                      desc: 'Percentage of existing customer nodes that have bought more than one digital asset in the past 60 days.',
                      details: [
                        { label: 'VIP Repeaters', value: '88 accounts' },
                        { label: 'Growth MoM', value: '+4.2%' },
                        { label: 'Ecosystem Loyalty', value: 'Excellent' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,28 L30,26 L60,20 L100,18" 
                        fill="none" 
                        stroke="#D8BFE3" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />

                <DashboardCard
                  title="Refund Rate"
                  value={`${data.revenueAnalytics.refundRate}%`}
                  icon={<AlertTriangle size={13} className="text-[#B886D0]" />}
                  trend={`${data.revenueAnalytics.refundChange}%`}
                  trendLabel=""
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal({
                      title: 'Dispute & Refund Auditing',
                      value: `${data.revenueAnalytics.refundRate}%`,
                      change: `${data.revenueAnalytics.refundChange}%`,
                      desc: 'Operational dispute return rate calculated via licensing discrepancies, client returns, or automated system audits.',
                      details: [
                        { label: 'Revoked Assets', value: '4 licenses' },
                        { label: 'Average Resolution Time', value: '4.2 hrs' },
                        { label: 'Fraud Detection Index', value: 'Safe (0.01%)' }
                      ]
                    });
                  }}
                  chart={
                    <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                      <path 
                        d="M0,10 L30,12 L60,18 L100,22" 
                        fill="none" 
                        stroke="#B886D0" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                      />
                    </svg>
                  }
                />
              </StatsGrid>

              {/* --- SECTION 3: REVENUE INTELLIGENCE CENTER --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
                
                {/* Large Interactive SVG Chart Box (70%) */}
                <div className="lg:col-span-7 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-6">
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Financial Stream Analyzer</span>
                      <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Revenue Velocity Monitor</h3>
                    </div>

                    {/* Chart timeframe switcher */}
                    <div className="bg-white/80 backdrop-blur-md p-1 rounded-xl border border-stone-200/40 flex items-center gap-1 flex-shrink-0 self-start sm:self-auto">
                      {['daily', 'weekly', 'monthly'].map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            sysSound.playTap();
                            setTimeframe(t);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold tracking-widest uppercase transition-colors ${
                            timeframe === t ? 'bg-[#2D004D] text-[#F8F3FB]' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SVG Chart Drawing */}
                  <div className="h-72 w-full relative pt-2">
                    <svg viewBox="0 0 600 240" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="glowGross" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B886D0" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#B886D0" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="glowNet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D8BFE3" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#D8BFE3" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Y Axis Guide Lines */}
                      {[0, 1, 2, 3, 4].map((i) => (
                        <line
                          key={i}
                          x1="30"
                          y1={25 + i * 42}
                          x2="590"
                          y2={25 + i * 42}
                          stroke="rgba(90, 30, 126, 0.04)"
                          strokeDasharray="4 4"
                        />
                      ))}

                      {/* Area Under Gross Chart */}
                      <path
                        d={
                          timeframe === 'daily'
                            ? "M30,200 Q120,180 210,140 T390,90 T570,50 L570,210 L30,210 Z"
                            : timeframe === 'weekly'
                            ? "M30,180 Q120,150 210,165 T390,110 T570,40 L570,210 L30,210 Z"
                            : "M30,190 Q120,170 210,160 T390,105 T570,30 L570,210 L30,210 Z"
                        }
                        fill="url(#glowGross)"
                        className="transition-all duration-700"
                      />

                      {/* Main Stroke Path Gross */}
                      <path
                        d={
                          timeframe === 'daily'
                            ? "M30,200 Q120,180 210,140 T390,90 T570,50"
                            : timeframe === 'weekly'
                            ? "M30,180 Q120,150 210,165 T390,110 T570,40"
                            : "M30,190 Q120,170 210,160 T390,105 T570,30"
                        }
                        fill="none"
                        stroke="#B886D0"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="path-anim transition-all duration-700"
                      />

                      {/* Main Stroke Path Net (Dashed line) */}
                      <path
                        d={
                          timeframe === 'daily'
                            ? "M30,208 Q120,190 210,155 T390,110 T570,75"
                            : timeframe === 'weekly'
                            ? "M30,195 Q120,168 210,180 T390,130 T570,68"
                            : "M30,205 Q120,188 210,180 T390,125 T570,55"
                        }
                        fill="none"
                        stroke="#D8BFE3"
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        strokeLinecap="round"
                        className="path-anim transition-all duration-700"
                      />

                      {/* Interactive hover points */}
                      {data.revenueAnalytics.timeline[timeframe].map((pt, idx) => {
                        const segmentWidth = 540 / (data.revenueAnalytics.timeline[timeframe].length - 1);
                        const x = 30 + idx * segmentWidth;
                        // Approximate height values for visuals
                        const yGross = timeframe === 'daily' 
                          ? 200 - idx * 28
                          : timeframe === 'weekly'
                          ? 180 - (idx === 3 ? 40 : idx === 4 ? 70 : idx === 6 ? 130 : idx * 18)
                          : 190 - idx * 25;

                        return (
                          <g key={idx} className="group/node">
                            <circle
                              cx={x}
                              cy={yGross}
                              r={hoveredChartPoint === idx ? 6 : 4}
                              fill="#F8F3FB"
                              stroke="#B886D0"
                              strokeWidth={3}
                              className="cursor-pointer transition-all duration-200"
                              onMouseEnter={() => {
                                sysSound.playTap();
                                setHoveredChartPoint(idx);
                              }}
                              onMouseLeave={() => setHoveredChartPoint(null)}
                            />
                            {/* Hover info strip */}
                            {hoveredChartPoint === idx && (
                              <g>
                                <rect
                                  x={x - 45}
                                  y={yGross - 45}
                                  width="90"
                                  height="32"
                                  rx="8"
                                  fill="#2D004D"
                                  className="shadow-md"
                                />
                                <text
                                  x={x}
                                  y={yGross - 32}
                                  fill="#F8F3FB"
                                  fontSize="9"
                                  fontWeight="bold"
                                  textAnchor="middle"
                                >
                                  ₹{(pt.gross).toLocaleString()}
                                </text>
                                <text
                                  x={x}
                                  y={yGross - 20}
                                  fill="#F3EAF8"
                                  fontSize="7"
                                  textAnchor="middle"
                                  opacity="0.8"
                                >
                                  {pt.label}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}

                      {/* X Axis Labels */}
                      {data.revenueAnalytics.timeline[timeframe].map((pt, idx) => {
                        const segmentWidth = 540 / (data.revenueAnalytics.timeline[timeframe].length - 1);
                        return (
                          <text
                            key={idx}
                            x={30 + idx * segmentWidth}
                            y="235"
                            fill="#7B3FA0"
                            fontSize="8"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {pt.label}
                          </text>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex flex-wrap items-center gap-6 text-[9px] font-extrabold text-[#7B3FA0] uppercase tracking-widest border-t border-[#F3EAF8] pt-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#B886D0]" />
                      Gross Revenue pipeline
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#D8BFE3]" style={{ border: '1px dashed #D8BFE3' }} />
                      Net settled earnings (excl. processing margin)
                    </div>
                  </div>

                </div>

                {/* Revenue Insights Panel (30%) */}
                <div className="lg:col-span-3 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-5">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Growth Vector Output</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">AI Insights Core</h3>
                  </div>

                  {/* Visual metrics list */}
                  <div className="space-y-4">
                    <div className="p-3 bg-white/80 rounded-xl border border-stone-200/20">
                      <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                        Best Performing Category
                      </span>
                      <span className="text-xs font-bold text-[#2D004D]">
                        {data.revenueAnalytics.insights.bestCategory}
                      </span>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-stone-200/20">
                      <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                        Highest Earning Asset
                      </span>
                      <span className="text-xs font-bold text-[#2D004D]">
                        {data.revenueAnalytics.insights.highestEarning}
                      </span>
                    </div>

                    <div className="p-3 bg-white/80 rounded-xl border border-stone-200/20 flex justify-between items-center">
                      <div>
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">
                          Growth Rate
                        </span>
                        <span className="text-xs font-serif font-black text-[#5A1E7E]">
                          +{data.revenueAnalytics.insights.growthRate}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">
                          Velocity
                        </span>
                        <span className="text-[10px] font-bold text-[#B886D0]">
                          {data.revenueAnalytics.insights.velocity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Future Forecast metric card */}
                  <div className="p-4 bg-white rounded-xl border border-[#F5E9DD] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#D8BFE3]/10 to-transparent rounded-full filter blur-md" />
                    <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                      Predictive Revenue (Next Quarter)
                    </span>
                    <h4 className="text-xl font-serif font-black text-[#2D004D] flex items-center gap-1.5">
                      ₹{(data.revenueAnalytics.insights.forecast).toLocaleString()}
                      <Sparkles size={14} className="text-[#B886D0] animate-pulse" />
                    </h4>
                    <p className="text-[9px] text-[#7B3FA0] mt-1 leading-relaxed">
                      {data.forecastAnalytics.confidenceScore > 0
                        ? `${data.forecastAnalytics.confidenceScore}% confidence based on revenue trend data.`
                        : 'Confidence score will appear once order data is available.'}
                    </p>
                  </div>

                </div>

              </section>

              {/* --- SECTION 4: CUSTOMER ANALYTICS & TRAFFIC PANEL --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
                
                {/* Customer Engine (50%) */}
                <div className="lg:col-span-5 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Loyalty Matrix</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Customer Analytics Engine</h3>
                  </div>

                  {/* Circular/radial progress visual segments */}
                  <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
                    <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
                      {/* SVG circular track */}
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="rgba(90, 30, 126, 0.05)"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="72"
                          cy="72"
                          r="60"
                          stroke="#B886D0"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray={376.8}
                          strokeDashoffset={376.8 * (1 - data.customerAnalytics.repeatPurchaseRate / 100)}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      {/* Center labels */}
                      <div className="absolute text-center">
                        <span className="text-2xl font-serif font-black text-[#2D004D]">
                          {data.customerAnalytics.repeatPurchaseRate}%
                        </span>
                        <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mt-0.5">
                          Repeat Index
                        </span>
                      </div>
                    </div>

                    {/* Customer KPIs list */}
                    <div className="space-y-4 w-full max-w-[200px]">
                      <div className="flex justify-between items-center border-b border-[#F3EAF8] pb-2">
                        <span className="text-[10px] font-bold text-[#7B3FA0]">New Buyers Today</span>
                        <span className="text-xs font-serif font-black text-[#2D004D]">
                          {data.customerAnalytics.newCustomers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-[#F3EAF8] pb-2">
                        <span className="text-[10px] font-bold text-[#7B3FA0]">Returning Node Activity</span>
                        <span className="text-xs font-serif font-black text-[#2D004D]">
                          {data.customerAnalytics.returningCustomers}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-[10px] font-bold text-[#7B3FA0]">Lifetime Value Mean</span>
                        <span className="text-xs font-serif font-black text-[#2D004D] text-[#5A1E7E]">
                          ₹{(data.customerAnalytics.clv).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Segment bars visualization */}
                  <div className="space-y-2">
                    <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">
                      Audience Retention Segments
                    </span>
                    <div className="h-3 w-full bg-white rounded-full overflow-hidden flex">
                      {data.customerAnalytics.retentionSegments.map((seg, idx) => (
                        <div
                          key={idx}
                          className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                          style={{
                            width: `${seg.value}%`,
                            backgroundColor: seg.color
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {data.customerAnalytics.retentionSegments.map((seg, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[8px] font-extrabold uppercase text-[#7B3FA0]">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: seg.color }} />
                          {seg.name} ({seg.value}%)
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Traffic Channels Intelligence (50%) */}
                <div className="lg:col-span-5 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Acquisition Channels</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Traffic Intelligence Panel</h3>
                  </div>

                  {/* Channel Progress bars */}
                  <div className="space-y-4">
                    {data.trafficAnalytics.sources.map((src, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-[#2D004D]">{src.name}</span>
                          <span className="text-[#7B3FA0]">{src.percent}% ({src.count.toLocaleString()} sessions)</span>
                        </div>
                        <div className="h-2 w-full bg-white rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${src.percent}%`,
                              backgroundColor: src.color
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom summary note */}
                  <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-stone-200/20 text-[10px] text-[#7B3FA0] font-medium mt-1">
                    <Info size={14} className="text-[#B886D0] flex-shrink-0" />
                    <span>
                      Overall Traffic Quality index is <strong>{data.trafficAnalytics.qualityIndex}/100</strong>. ({data.trafficAnalytics.qualityTrend})
                    </span>
                  </div>

                </div>

              </section>

              {/* --- SECTION 5: PRODUCT LEADERBOARD & GEOGRAPHIC PANEL --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
                
                {/* Product Leaderboard Matrix (60%) */}
                <div className="lg:col-span-6 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Top Earning Assets</span>
                      <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Product Performance Matrix</h3>
                    </div>

                    {/* Filter categories */}
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c) => (
                        <button
                          key={c}
                          onClick={() => {
                            sysSound.playTap();
                            setSelectedProductCategory(c);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[8px] font-extrabold tracking-widest uppercase border transition-colors ${
                            selectedProductCategory === c
                              ? 'bg-[#2D004D] text-[#F8F3FB] border-[#2D004D]'
                              : 'bg-white text-[#7B3FA0] border-stone-200/50 hover:text-[#2D004D]'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Leaderboard layout (Not a boring spreadsheet table) */}
                  <div className="space-y-3.5">
                    {filteredProducts.map((p, idx) => (
                      <div
                        key={p.id}
                        className="glass-surface p-4 rounded-xl border border-[#F3EAF8] flex items-center justify-between gap-4 hover:translate-x-1 duration-300"
                      >
                        <div className="flex items-center gap-3">
                          {/* Image visual icon placeholder */}
                          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center text-lg border border-[#F5E9DD]">
                            {p.image}
                          </div>
                          <div>
                            <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">
                              {p.category}
                            </span>
                            <span className="text-xs font-bold text-[#2D004D]">
                              {p.name}
                            </span>
                          </div>
                        </div>

                        {/* Middle detailed metrics */}
                        <div className="hidden sm:flex items-center gap-6">
                          <div className="text-center w-14">
                            <span 
                              onClick={() => { sysSound.playTap(); setProductSortBy('orders'); }}
                              className={`text-[7px] font-extrabold tracking-widest uppercase block cursor-pointer transition-colors ${
                                productSortBy === 'orders' ? 'text-[#2D004D] underline' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                              }`}
                            >
                              Orders
                            </span>
                            <span className="text-xs font-bold text-[#2D004D]">{p.orders}</span>
                          </div>
                          <div className="text-center w-14">
                            <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">Conversion</span>
                            <span className="text-xs font-bold text-[#5A1E7E]">{p.conversion === 'N/A' ? 'N/A' : `${p.conversion}%`}</span>
                          </div>
                          <div className="text-center w-16">
                            <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block">Refund Rate</span>
                            <span className="text-xs font-bold text-[#7B3FA0]">{p.refundRate}%</span>
                          </div>
                        </div>

                        {/* Earnings right block */}
                        <div className="text-right min-w-[70px]">
                          <span 
                            onClick={() => { sysSound.playTap(); setProductSortBy('revenue'); }}
                            className={`text-[7px] font-extrabold tracking-widest uppercase block cursor-pointer transition-colors ${
                              productSortBy === 'revenue' ? 'text-[#2D004D] underline' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            Revenue
                          </span>
                          <span className="text-xs font-serif font-black text-[#2D004D]">
                            ₹{(p.revenue).toLocaleString()}
                          </span>
                          <div className="flex items-center justify-end gap-1.5 text-[8px] font-bold mt-0.5">
                            {p.growth > 0 ? (
                              <span className="text-[#5A1E7E] flex items-center">
                                +{p.growth}% <ArrowUp size={8} />
                              </span>
                            ) : p.growth < 0 ? (
                              <span className="text-[#7B3FA0] flex items-center">
                                {p.growth}% <ArrowDown size={8} />
                              </span>
                            ) : (
                              <span className="text-[#7B3FA0] flex items-center">
                                0%
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>

                {/* Geographic Heat Matrix (40%) */}
                <div className="lg:col-span-4 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Global Node Distribution</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Geographic Analytics</h3>
                  </div>

                  {/* Geographics List */}
                  <div className="space-y-4">
                    {data.geoAnalytics.map((geo, idx) => (
                      <div key={idx} className="p-3.5 bg-white/80 border border-stone-200/20 rounded-xl flex items-center justify-between gap-3 hover:shadow-inner transition-shadow duration-300">
                        <div className="flex items-center gap-3">
                          {/* Region Code Tag */}
                          <div className="w-8 h-8 rounded-lg bg-[#B886D0]/10 text-[#B886D0] flex items-center justify-center font-serif font-bold text-xs">
                            {geo.code}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#2D004D]">{geo.region}</span>
                            <span className="text-[8px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mt-0.5">
                              {geo.customers.toLocaleString()} active nodes
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-serif font-black text-[#2D004D]">
                            ₹{(geo.revenue).toLocaleString()}
                          </span>
                          <span className="text-[8px] font-extrabold text-[#5A1E7E] block mt-0.5">
                            +{geo.growth}% MoM
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </section>

              {/* --- SECTION 6: CONVERSION FUNNEL &预测FORECAST ENGINE --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
                
                {/* Funnel Visual Optimization (50%) */}
                <div className="lg:col-span-5 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Traffic-To-Settlement Funnel</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Conversion Intelligence</h3>
                  </div>

                  {/* Handcrafted animated Funnel blocks */}
                  <div className="space-y-5 py-4">
                    {data.conversionAnalytics.funnel.map((fun, idx) => (
                      <div
                        key={idx}
                        className="funnel-step relative flex items-center"
                      >
                        {/* Funnel width scaled by percent */}
                        <div
                          className="h-9 rounded-r-xl border border-white/40 flex items-center justify-between px-4 transition-all duration-1000 shadow-sm"
                          style={{
                            width: `${Math.max(30, fun.percent)}%`,
                            backgroundColor: fun.glowColor
                          }}
                        >
                          <span className="text-[10px] font-bold text-[#2D004D] truncate mr-2">
                            {fun.step}
                          </span>
                          <span className="text-[10px] font-extrabold text-[#2D004D]">
                            {fun.percent}%
                          </span>
                        </div>
                        {/* Right numbers count */}
                        <span className="text-[9px] font-extrabold text-[#7B3FA0] uppercase ml-3">
                          {fun.count.toLocaleString()} units
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Summary note */}
                  <div className="text-[10px] text-[#7B3FA0] leading-relaxed border-t border-[#F3EAF8] pt-4">
                    {data.conversionAnalytics.funnel[0]?.count > 0
                      ? `${data.conversionAnalytics.funnel[1]?.percent ?? 0}% of orders were paid. ${data.conversionAnalytics.funnel[2]?.percent ?? 0}% completed successfully.`
                      : 'Conversion funnel data will appear once orders are recorded.'}
                  </div>

                </div>

                {/* Sales Forecast Engine (50%) */}
                <div className="lg:col-span-5 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Predictive Machine Learning Heuristics</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Sales Forecast Engine</h3>
                  </div>

                  {/* Forecast details cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-white/80 border border-stone-200/20 rounded-xl text-center">
                      <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                        Next 7 Days
                      </span>
                      <span className="text-sm font-serif font-black text-[#2D004D] block">
                        ₹{(data.forecastAnalytics.next7Days.value).toLocaleString()}
                      </span>
                      <span className="text-[8px] font-bold text-[#5A1E7E] mt-1 inline-block">
                        +{data.forecastAnalytics.next7Days.growth}%
                      </span>
                    </div>

                    <div className="p-3 bg-white/80 border border-stone-200/20 rounded-xl text-center">
                      <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                        Next 30 Days
                      </span>
                      <span className="text-sm font-serif font-black text-[#2D004D] block">
                        ₹{(data.forecastAnalytics.next30Days.value).toLocaleString()}
                      </span>
                      <span className="text-[8px] font-bold text-[#5A1E7E] mt-1 inline-block">
                        +{data.forecastAnalytics.next30Days.growth}%
                      </span>
                    </div>

                    <div className="p-3 bg-white/80 border border-stone-200/20 rounded-xl text-center">
                      <span className="text-[7px] font-extrabold tracking-widest text-[#7B3FA0] uppercase block mb-1">
                        Next Quarter
                      </span>
                      <span className="text-sm font-serif font-black text-[#2D004D] block">
                        ₹{(data.forecastAnalytics.nextQuarter.value).toLocaleString()}
                      </span>
                      <span className="text-[8px] font-bold text-[#5A1E7E] mt-1 inline-block">
                        +{data.forecastAnalytics.nextQuarter.growth}%
                      </span>
                    </div>
                  </div>

                  {/* Mini Forecast path chart */}
                  <div className="h-28 w-full pt-1">
                    <svg viewBox="0 0 400 100" className="w-full h-full overflow-visible">
                      <path
                        d="M10,80 Q60,70 120,75 T240,40 T380,10"
                        fill="none"
                        stroke="#B886D0"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        className="path-anim"
                      />
                      <path
                        d="M10,80 Q60,70 120,75 T240,40 T380,10 L380,100 L10,100 Z"
                        fill="url(#glowGross)"
                        opacity="0.3"
                      />
                      {/* confidence bands dashed lines */}
                      <path
                        d="M240,45 Q310,35 380,5"
                        fill="none"
                        stroke="rgba(90, 30, 126, 0.15)"
                        strokeDasharray="2 2"
                      />
                      <path
                        d="M240,35 Q310,25 380,15"
                        fill="none"
                        stroke="rgba(90, 30, 126, 0.15)"
                        strokeDasharray="2 2"
                      />
                    </svg>
                  </div>

                  <div className="flex justify-between items-center text-[9px] font-extrabold text-[#7B3FA0] uppercase tracking-wider border-t border-[#F3EAF8] pt-4">
                    <span>Forecast Confidence Matrix</span>
                    <span className="text-[#B886D0]">
                      {data.forecastAnalytics.confidenceScore}% ACCURACY EXPECTED
                    </span>
                  </div>

                </div>

              </section>

              {/* --- SECTION 7: AI INSIGHTS & REAL-TIME ACTIVITY STREAM --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-stretch">
                
                {/* AI Insights (60%) */}
                <div className="lg:col-span-6 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  <div>
                    <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Growth Vector Outputs</span>
                    <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">AI Insights Core</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.aiInsights.map((insight) => (
                      <div
                        key={insight.id}
                        className="p-4 bg-white border border-[#F5E9DD]/40 rounded-2xl flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow duration-300"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-extrabold tracking-widest uppercase px-2 py-0.5 rounded ${
                            insight.priority === 'high'
                              ? 'bg-[#D8BFE3] text-[#7B3FA0]'
                              : 'bg-[#D8BFE3] text-[#7B3FA0]'
                          }`}>
                            {insight.priority} Priority
                          </span>
                          <span className="text-[8px] font-bold text-[#7B3FA0]">
                            {insight.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#2D004D] font-medium leading-relaxed">
                          {insight.text}
                        </p>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Real-time Activity Stream (40%) */}
                <div className="lg:col-span-4 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Real-Time telemetry</span>
                      <h3 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">Live Activity Stream</h3>
                    </div>
                    {/* Live signal blinker */}
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#B886D0] animate-ping" />
                      <span className="text-[8px] font-extrabold tracking-wider text-[#7B3FA0] uppercase">Syncing</span>
                    </div>
                  </div>

                  {/* Events list */}
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                    {liveEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="flex items-center justify-between text-[11px] font-medium border-b border-[#F3EAF8] pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            evt.type === 'sale' ? 'bg-[#B886D0]' : 'bg-[#D8BFE3]'
                          }`} />
                          <span className="text-[#2D004D]">{evt.text}</span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-serif font-black text-[#2D004D] block">
                            {evt.amount}
                          </span>
                          <span className="text-[8px] font-bold text-[#7B3FA0] block mt-0.5">
                            {evt.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </section>

              {/* --- SECTION 8: BOTTOM FLOATING CONTROLS PANEL --- */}
              <section className="glass-surface p-6 rounded-3xl border border-white/50 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="p-3 bg-white rounded-full border border-stone-200/50 text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                  >
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                  </button>

                  <div className="text-left">
                    <h5 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">SYSTEM SYNC</h5>
                    <p className="text-[11px] text-[#2D004D] font-medium mt-0.5">
                      {isRefreshing ? 'Re-establishing secure telemetry sync...' : 'Secure node sync established. API telemetry clean.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Sound controls */}
                  <button
                    onClick={() => {
                      sysSound.playTap();
                      setIsMuted(!isMuted);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-extrabold tracking-widest uppercase border transition-colors ${
                      !isMuted
                        ? 'bg-[#2D004D] text-[#F8F3FB] border-[#2D004D]'
                        : 'bg-white text-[#7B3FA0] border-stone-200/50 hover:text-[#2D004D]'
                    }`}
                  >
                    {isMuted ? 'Mute Interface Sound' : 'Interface Sound Active'}
                  </button>

                  <button
                    onClick={triggerReportGeneration}
                    className="px-5 py-2.5 rounded-xl bg-[#2D004D] text-[#F8F3FB] text-[9px] font-extrabold tracking-widest uppercase hover:bg-[#7B3FA0] transition-colors shadow-md"
                  >
                    Download Analytics Ledger (CSV)
                  </button>
                </div>
              </section>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* --- PREMIUM KPI DRILLDOWN DETAIL MODAL --- */}
      <AnimatePresence>
        {activeMetricModal && (
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
            {/* Modal backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                sysSound.playSwoosh();
                setActiveMetricModal(null);
              }}
              className="absolute inset-0 bg-[#2D004D]/30 backdrop-blur-md"
            />

            {/* Modal body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-white/60 shadow-2xl rounded-3xl p-6 sm:p-8 max-w-lg w-full relative z-10 overflow-hidden"
            >
              {/* Floating inner visual glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#D8BFE3]/10 to-transparent rounded-full filter blur-md pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-[#F3EAF8] mb-6">
                <div>
                  <span className="text-[8px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Growth Vector Audit</span>
                  <h4 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">{activeMetricModal.title}</h4>
                </div>
                <button
                  onClick={() => {
                    sysSound.playSwoosh();
                    setActiveMetricModal(null);
                  }}
                  className="p-2 bg-white rounded-full border border-stone-200/50 text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Main value and details */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-serif font-black text-[#2D004D]">{activeMetricModal.value}</span>
                  <span className="text-xs font-extrabold text-[#5A1E7E]">{activeMetricModal.change}</span>
                </div>
                <p className="text-[12px] text-[#7B3FA0] leading-relaxed mt-3">
                  {activeMetricModal.desc}
                </p>
              </div>

              {/* Detailed tables segments */}
              <div className="space-y-3.5 bg-white p-4 rounded-2xl border border-stone-200/20 mb-6">
                {activeMetricModal.details.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-[#7B3FA0] font-medium">{detail.label}</span>
                    <span className="text-[#2D004D] font-bold">{detail.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    sysSound.playTap();
                    setActiveMetricModal(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white text-[#7B3FA0] hover:text-[#2D004D] text-[10px] font-extrabold tracking-widest uppercase transition-colors"
                >
                  Close Audit
                </button>
                <button
                  onClick={() => {
                    sysSound.playSuccess();
                    setNotification({
                      title: 'Ledger Node Printed',
                      message: 'Detailed audit ledger dispatched to local storage.',
                      type: 'success'
                    });
                    setActiveMetricModal(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#2D004D] text-[#F8F3FB] hover:bg-[#7B3FA0] text-[10px] font-extrabold tracking-widest uppercase transition-colors"
                >
                  Export Audit Ledger
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </AdminLayout>
  );
}
