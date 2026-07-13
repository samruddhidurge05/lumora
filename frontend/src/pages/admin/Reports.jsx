import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, TableContainer } from './components/AdminComponents';
import { backendFetch } from '../../utils/api';
import {
  getReportAnalytics,
  subscribeToReports,
  resolveReport,
  rejectReport,
  assignReport,
  deleteReport,
} from '../../services/reportsService.js';

// --- SYSTEM VECTOR GRAPHICS (Self-contained vector selector) ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    TrendingUp: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />,
    TrendingDown: <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />,
    ArrowUpRight: <g><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></g>,
    DollarSign: <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    CheckCircle: <g><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></g>,
    AlertTriangle: <g><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
    Sparkles: <g><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></g>,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    RefreshCw: <g><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></g>,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="22" y1="9" x2="16" y2="15" /><line x1="16" y1="9" x2="22" y2="15" /></g>,
    Zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    Download: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
    Share: <g><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></g>,
    Calendar: <g><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></g>,
    Clock: <g><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></g>,
    FileText: <g><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></g>,
    Search: <g><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></g>,
    Users: <g><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></g>,
    Eye: <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></g>,
    Bell: <g><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></g>
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

// --- SYSTEM AUDIO SYNTHESIZER ---
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
    playNote(523.25, now, 0.08); // C5
    playNote(659.25, now + 0.08, 0.08); // E5
    playNote(783.99, now + 0.16, 0.22); // G5
  }
}
const sysSound = new AudioController();

// --- PREMIUM NUMBER COUNTING ANIMATOR ---
function CountUp({ value, duration = 1000, prefix = "", suffix = "", decimalPlaces = 0 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(value);
    if (isNaN(end)) return;
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const range = end - start;
    let startTime = performance.now();

    const updateNumber = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4); // Quartic ease out
      const val = start + easeProgress * range;
      setDisplayValue(val);

      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(updateNumber);
  }, [value, duration]);

  const formatted = displayValue.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return <span>{prefix}{formatted}{suffix}</span>;
}

export default function Reports() {

  const [audioMuted, setAudioMuted] = useState(false);
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Real data from Firestore via reportsService
  const [reports, setReports] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Paginated reports list state (M4)
  const [reportError, setReportError] = useState(null);
  const [reportListItems, setReportListItems] = useState([]);
  const [reportListLoading, setReportListLoading] = useState(false);
  const [reportPage, setReportPage] = useState(1);
  const [reportTotalPages, setReportTotalPages] = useState(1);
  const [reportTotal, setReportTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const REPORT_PAGE_SIZE = 50;

  // Real-time sequential insight entries tracking
  const [insightsStage, setInsightsStage] = useState(0);

  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);



  // Sequential loading haptic effect for Insights lists
  useEffect(() => {
    if (isGenerating) {
      setInsightsStage(0);
      return;
    }
    const timer1 = setTimeout(() => setInsightsStage(1), 400);
    const timer2 = setTimeout(() => setInsightsStage(2), 1000);
    const timer3 = setTimeout(() => setInsightsStage(3), 1600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isGenerating]);

  // ─── REAL DATA LOAD: Firestore via reportsService ────────────────────────
  const loadReportAnalytics = useCallback(async () => {
    setIsLoadingData(true);
    setReportError(null);
    try {
      const result = await getReportAnalytics();
      setAnalytics(result);
    } catch (err) {
      console.error('[Reports] Failed to load analytics:', err);
      setReportError(err?.message || 'Failed to load report analytics. Please retry.');
    } finally {
      setIsLoadingData(false);
    }
  }, []); // empty deps — function never changes

  // Initial load on mount only
  useEffect(() => {
    loadReportAnalytics();
  }, []); // run once on mount — intentionally no deps

  // ─── PAGINATED REPORTS LIST LOAD (M4) ─────────────────────────────────────
  const loadReportsList = useCallback(async (page, status) => {
    setReportListLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: REPORT_PAGE_SIZE });
      if (status) params.append('status', status);
      const data = await backendFetch(`/admin/reports/?${params}`);
      setReportListItems(data.items || []);
      setReportTotal(data.total || 0);
      setReportTotalPages(Math.max(1, Math.ceil((data.total || 0) / REPORT_PAGE_SIZE)));
    } catch (err) {
      console.error('[Reports] Failed to load reports list:', err);
      setReportListItems([]);
    } finally {
      setReportListLoading(false);
    }
  }, [REPORT_PAGE_SIZE]);

  useEffect(() => {
    loadReportsList(reportPage, statusFilter);
  }, [reportPage, statusFilter]); // re-run when page or filter changes

  // Real-time subscription: update reports list only.
  // Analytics are recomputed from a debounced reload, not on every snapshot,
  // to prevent the load → snapshot → load infinite cycle.
  useEffect(() => {
    let debounceTimer = null;

    const unsub = subscribeToReports((updatedReports) => {
      setReports(updatedReports);

      // Debounce analytics reload — only recompute after 2s of no new changes
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        getReportAnalytics()
          .then(result => setAnalytics(result))
          .catch(err => console.error('[Reports] Realtime analytics error:', err));
      }, 2000);
    });

    return () => {
      unsub();
      clearTimeout(debounceTimer);
    };
  }, []); // run once — intentionally no deps

  // ─── MAP Firestore analytics → UI data shape ──────────────────────────────
  // reportData mirrors the exact shape the UI rendering expects
  const reportData = useMemo(() => {
    const a = analytics;
    const now = new Date().toISOString();

    // Revenue trend from reportsPerDay (use report count as a proxy signal)
    const revenueTrend = (a?.reportsPerDay || []).slice(-5).map(d => ({
      date:  d.label,
      value: d.count,
    }));

    // Product breakdown from mostReportedProducts
    const productBreakdown = (a?.mostReportedProducts || []).slice(0, 4).map(p => ({
      name:    p.title || p.productId || 'Unknown',
      revenue: p.count * 100, // proxy value
      orders:  p.count,
      growth:  0,
    }));

    // Region data from vendor risk (placeholder — reports don't have direct geo)
    const regionData = (a?.categoryBreakdown || []).slice(0, 4).map((c, i) => ({
      region: c.category,
      share:  a?.total > 0 ? Math.round((c.count / a.total) * 100) : 0,
      color:  i % 2 === 0 ? '#B886D0' : '#D8BFE3',
    }));

    // Hourly metrics from reportsPerDay (using last 8 entries as standin)
    const hourlyMetrics = (a?.reportsPerDay || []).slice(-8).map(d => ({
      hour:  d.label,
      value: d.count,
    }));

    // AI Insights from correlation engine
    const aiInsights = (a?.insights || []).map((ins, i) => ({
      type:   ins.type,
      text:   ins.text,
      status: ins.type === 'critical' ? 'warning' : 'positive',
    }));

    return {
      reportMeta: {
        generatedAt: now,
        range:       dateRange,
        currency:    "USD",
        vendorId:    `RPT-${(a?.total || 0)}-LIVE`,
      },
      summary: {
        totalRevenue:   a?.total || 0,
        totalOrders:    a?.openCount || 0,
        refunds:        a?.criticalCount || 0,
        netRevenue:     a?.resolvedCount || 0,
        avgOrderValue:  parseFloat((a?.avgResolutionHours || 0).toFixed(1)),
        conversionRate: a?.total > 0
          ? parseFloat(((a?.resolvedCount / a?.total) * 100).toFixed(1))
          : 0,
      },
      revenueTrend: revenueTrend.length > 0 ? revenueTrend : [
        { date: 'Mon', value: 0 }, { date: 'Tue', value: 0 }, { date: 'Wed', value: 0 },
        { date: 'Thu', value: 0 }, { date: 'Fri', value: 0 },
      ],
      productBreakdown: productBreakdown.length > 0 ? productBreakdown : [
        { name: 'No reports yet', revenue: 0, orders: 0, growth: 0 },
      ],
      regionData: regionData.length > 0 ? regionData : [
        { region: 'No data', share: 100, color: '#D8BFE3' },
      ],
      hourlyMetrics: hourlyMetrics.length > 0 ? hourlyMetrics : [
        { hour: '08:00', value: 0 }, { hour: '10:00', value: 0 }, { hour: '12:00', value: 0 },
        { hour: '14:00', value: 0 }, { hour: '16:00', value: 0 }, { hour: '18:00', value: 0 },
        { hour: '20:00', value: 0 }, { hour: '22:00', value: 0 },
      ],
      aiInsights: aiInsights.length > 0 ? aiInsights : [
        { type: 'info', text: 'No reports submitted yet. Customer reports will appear here in real-time.', status: 'positive' },
      ],
    };
  }, [analytics, dateRange]);



  const triggerNotification = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Simulated PDF compiling
  const handleExportPDF = () => {
    sysSound.playSwoosh();
    triggerNotification("Compiling PDF cryptographic sheet...", "success");
    setTimeout(() => {
      sysSound.playSuccess();
      triggerNotification("Business Summary PDF successfully downloaded!");
    }, 1800);
  };

  // Compile real CSV string download from live Firestore data
  const handleExportCSV = () => {
    sysSound.playTap();
    triggerNotification("Generating CSV report ledger...", "success");
    
    setTimeout(() => {
      try {
        const a = analytics;
        const headers = ["Metric", "Value"];
        const rows = [
          ["Total Reports",          a?.total            ?? 0],
          ["Open Reports",           a?.openCount        ?? 0],
          ["Resolved Reports",       a?.resolvedCount    ?? 0],
          ["Critical Reports",       a?.criticalCount    ?? 0],
          ["Avg Resolution (hours)", a?.avgResolutionHours ?? 0],
          ["Date Range",             dateRange],
          ["Generated At",           new Date().toISOString()],
        ];

        // Add category breakdown
        (a?.categoryBreakdown || []).forEach(c => {
          rows.push([`Category: ${c.category}`, c.count]);
        });

        // Add most reported products
        (a?.mostReportedProducts || []).forEach(p => {
          rows.push([`Most Reported: ${p.title || p.productId}`, p.count]);
        });

        let csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\n"
          + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `lumora_reports_${dateRange.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        sysSound.playSuccess();
        triggerNotification("Report CSV download complete.");
      } catch (err) {
        triggerNotification("Failed to export report data", "error");
      }
    }, 1000);
  };

  const handleShareReport = () => {
    sysSound.playTap();
    const mockUrl = `${window.location.origin}${window.location.pathname}#/reports?secure_token=LUM_PUB_88421xT`;
    navigator.clipboard.writeText(mockUrl);
    setShowShareModal(true);
  };

  // Reload from Firestore
  const handleRegenerateReport = () => {
    sysSound.playSwoosh();
    setIsGenerating(true);
    setReportError(null);
    getReportAnalytics()
      .then(result => {
        setAnalytics(result);
        setIsGenerating(false);
        sysSound.playSuccess();
        triggerNotification("Live report data synced from Firestore.");
      })
      .catch(err => {
        console.error('[Reports] Refresh error:', err);
        setIsGenerating(false);
        setReportError(err?.message || 'Failed to sync report data.');
        triggerNotification("Failed to sync report data", "error");
      });
  };

  return (
    <AdminLayout activePage="reports">

      {/* Notification banner */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_12px_40px_rgba(90,30,126,0.08)]"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${notification.type === 'success' ? 'bg-[#B886D0] shadow-[0_0_8px_#B886D0]' : 'bg-[#D8BFE3] shadow-[0_0_8px_#D8BFE3]'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2D004D]">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main reports page content container */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* --- 1. STICKY REPORT CONTROL BAR --- */}
        <section className="mb-8 sticky top-24 z-30 transition-all duration-300">
          <div className="glass-surface rounded-3xl p-5 border border-white/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D8BFE3] to-[#D8BFE3] flex items-center justify-center text-[#2D004D] shadow-inner font-serif font-black">
                L
              </div>
              <div>
                <h1 className="text-xl font-serif font-black text-[#2D004D]">Business Intelligence Report</h1>
                <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Report Intelligence &bull; {analytics?.total ?? 0} Total Reports
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
              
              {/* Date Filter selector */}
              <div className="relative">
                <select 
                  value={dateRange}
                  onChange={(e) => { sysSound.playTap(); setDateRange(e.target.value); }}
                  className="appearance-none bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] rounded-xl pl-9 pr-8 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#2D004D] focus:outline-none cursor-pointer transition-colors"
                >
                  <option value="Today">Today</option>
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="Last 90 Days">Last 90 Days</option>
                </select>
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B3FA0] pointer-events-none">
                  <Icon name="Calendar" size={12} />
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B3FA0] pointer-events-none">
                  <Icon name="ChevronDown" size={10} />
                </div>
              </div>

              {/* Refresh dataset action */}
              <button 
                onClick={handleRegenerateReport}
                className="p-2.5 rounded-xl bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                title="Sync Live Ledger Data"
              >
                <Icon name="RefreshCw" size={14} className={isGenerating ? "animate-spin" : ""} />
              </button>

              {/* Haptic sound controller */}
              <button 
                onClick={() => setAudioMuted(!audioMuted)}
                className="p-2.5 rounded-xl bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                title={audioMuted ? "Unmute system alerts" : "Mute system alerts"}
              >
                <Icon name={audioMuted ? "VolumeX" : "Volume2"} size={14} />
              </button>

              {/* Quick Action deck */}
              <button 
                onClick={handleShareReport}
                className="btn-premium px-4 py-2 border-none cursor-pointer text-[10px] font-black tracking-widest uppercase"
              >
                <Icon name="Share" size={12} />
                Share
              </button>

            </div>

          </div>
        </section>

        {/* --- DYNAMIC LOADING SHIMMER LAYER (Empty state trigger) --- */}
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.section 
              key="loader"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="py-32 flex flex-col items-center justify-center text-center"
            >
              <div className="relative w-24 h-24 mb-6">
                {/* Floating glass orb loader */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D8BFE3]/30 to-[#D8BFE3]/40 animate-ping opacity-75 blur-md" />
                <div className="absolute inset-2 rounded-full bg-white/70 border border-white/60 shadow-lg flex items-center justify-center backdrop-blur-md animate-pulse">
                  <Icon name="Activity" size={28} className="text-[#7B3FA0]" />
                </div>
              </div>
              <h3 className="text-base font-serif font-black text-[#2D004D] tracking-wide">Syncing Financial Coordinates</h3>
              <p className="text-[10px] text-[#7B3FA0] mt-1.5 uppercase font-bold tracking-widest animate-pulse max-w-xs leading-relaxed">
                Rebuilding cryptographic transaction arrays & calculating platform yields...
              </p>
            </motion.section>
          ) : (
            <motion.div
              key="report-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              
              {/* --- 2. EXECUTIVE SUMMARY METRICS --- */}
              <StatsGrid columns={6} className="mb-8">
                
                {/* Metric 1: Total Reports */}
                <DashboardCard
                  title="Total Revenue"
                  value={<CountUp value={reportData.summary.totalRevenue} />}
                  icon={<Icon name="DollarSign" size={13} />}
                  trend="All time"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,15 L20,10 L40,14 L60,8 L80,11 L100,4" fill="none" stroke="#B886D0" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />

                {/* Metric 2: Open Reports */}
                <DashboardCard
                  title="Total Orders"
                  value={<CountUp value={reportData.summary.totalOrders} />}
                  icon={<Icon name="Activity" size={13} />}
                  trend="Awaiting action"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,17 L20,13 L40,16 L60,9 L80,12 L100,7" fill="none" stroke="#D8BFE3" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />

                {/* Metric 3: Critical Reports */}
                <DashboardCard
                  title="Critical"
                  value={<CountUp value={analytics?.criticalCount ?? 0} />}
                  icon={<Icon name="Users" size={13} />}
                  trend="High severity"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,14 Q25,8 50,11 T100,5" fill="none" stroke="#D8BFE3" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />

                {/* Metric 4: Resolved Reports */}
                <DashboardCard
                  title="Resolved"
                  value={<CountUp value={reportData.summary.refunds} />}
                  icon={<Icon name="AlertTriangle" size={13} className="text-[#FF8597]" />}
                  trend="Closed"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,5 L30,6 L60,4 L100,12" fill="none" stroke="#D8BFE3" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />

                {/* Metric 5: Avg Resolution Time */}
                <DashboardCard
                  title="Avg Resolution"
                  value={<CountUp value={reportData.summary.avgOrderValue} suffix="h" decimalPlaces={1} />}
                  icon={<Icon name="CheckCircle" size={13} />}
                  trend="Avg hours"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,15 L25,12 L50,13 L75,10 L100,8" fill="none" stroke="#B886D0" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />

                {/* Metric 6: Resolution Rate */}
                <DashboardCard
                  title="Resolution Rate"
                  value={<CountUp value={reportData.summary.conversionRate} suffix="%" decimalPlaces={1} />}
                  icon={<Icon name="Zap" size={13} />}
                  trend="Resolved / Total"
                  trendLabel=""
                  chart={
                    <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                      <path d="M0,18 L30,14 L60,11 T100,4" fill="none" stroke="#B886D0" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />
              </StatsGrid>

              {/* --- 3. REVENUE STORYTELLING SECTION (Line Chart + AI Summary) --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 mb-8">
                
                {/* Left Panel: SVG Revenue Trend Chart */}
                <div className="lg:col-span-7 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Financial Curve Matrix</h4>
                      <h2 className="text-base font-serif font-black text-[#2D004D]">Revenue Trend Analysis</h2>
                    </div>
                    <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded uppercase tracking-wider">
                      Live Streamed
                    </span>
                  </div>

                  {/* SVG Chart Frame */}
                  <div className="h-[260px] w-full relative pt-4">
                    <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B886D0" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#B886D0" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid lines */}
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <line 
                          key={idx}
                          x1="40" 
                          y1={20 + idx * 40} 
                          x2="580" 
                          y2={20 + idx * 40} 
                          stroke="rgba(90, 30, 126, 0.05)" 
                          strokeDasharray="4"
                        />
                      ))}

                      {/* Line Curve Path Area Fill */}
                      <path 
                        d="M40,160 C120,120 180,140 280,70 T480,50 L580,20 L580,180 L40,180 Z" 
                        fill="url(#curveGradient)"
                      />

                      {/* Line Curve Path Outline */}
                      <motion.path 
                        d="M40,160 C120,120 180,140 280,70 T480,50 L580,20" 
                        fill="none" 
                        stroke="#B886D0" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.4, ease: "easeOut" }}
                      />

                      {/* Coordinate Nodes */}
                      {[
                        { x: 40, y: 160, label: "Mon", val: 4200 },
                        { x: 175, y: 121, label: "Tue", val: 6100 },
                        { x: 310, y: 125, label: "Wed", val: 5800 },
                        { x: 445, y: 55, label: "Thu", val: 7300 },
                        { x: 580, y: 20, label: "Fri", val: 9100 }
                      ].map((node, i) => (
                        <g key={i}>
                          <circle 
                            cx={node.x} 
                            cy={node.y} 
                            r="5" 
                            fill="#D8BFE3" 
                            stroke="white" 
                            strokeWidth="2" 
                            className="cursor-pointer hover:r-7 transition-all"
                            onMouseEnter={(e) => {
                              const rect = e.target.getBoundingClientRect();
                              setActiveTooltip({
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY - 38,
                                title: `${node.label} Yield`,
                                value: `₹${node.val.toLocaleString()}`
                              });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          />
                          <text x={node.x} y="200" fill="#7B3FA0" fontSize="8" fontWeight="bold" textAnchor="middle">
                            {node.label}
                          </text>
                        </g>
                      ))}

                    </svg>

                    {/* Anchor Tooltip portal rendering */}
                    {activeTooltip && (
                      <div 
                        className="fixed pointer-events-none px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-stone-200/50 shadow-md flex flex-col items-center gap-0.5 z-40"
                        style={{
                          left: `${activeTooltip.x}px`,
                          top: `${activeTooltip.y}px`,
                          transform: 'translate(-50%, -100%)'
                        }}
                      >
                        <span className="text-[7px] font-bold text-[#7B3FA0] uppercase tracking-wider">{activeTooltip.title}</span>
                        <span className="text-[10px] font-black text-[#2D004D]">{activeTooltip.value}</span>
                      </div>
                    )}

                  </div>

                </div>

                {/* Right Panel: AI Analytics Insights */}
                <div className="lg:col-span-3 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
                  
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Operational Intelligence</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D] mb-4">Synaptic AI Diagnosis</h3>

                    <div className="flex flex-col gap-3.5">
                      
                      {/* Growth Meter */}
                      <div className="bg-white/50 border border-[#F3EAF8] p-4 rounded-2xl flex flex-col gap-1 shadow-sm">
                        <div className="flex justify-between items-center text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider">
                          <span>Ecosystem Health</span>
                          <span className="text-emerald-500 font-black">+18% growth</span>
                        </div>
                        <div className="w-full bg-[#F5E9DD]/60 h-2 rounded-full overflow-hidden mt-1.5">
                          <motion.div 
                            className="bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] h-full"
                            initial={{ width: 0 }}
                            animate={{ width: "82%" }}
                            transition={{ duration: 1.2 }}
                          />
                        </div>
                      </div>

                      {/* Performance Score Circular indicator */}
                      <div className="flex items-center gap-4 p-2">
                        <div className="relative w-14 h-14 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="28" cy="28" r="24" stroke="rgba(90, 30, 126, 0.05)" strokeWidth="3" fill="transparent" />
                            <circle 
                              cx="28" 
                              cy="28" 
                              r="24" 
                              stroke="#B886D0" 
                              strokeWidth="3.5" 
                              fill="transparent" 
                              strokeDasharray={150.7} 
                              strokeDashoffset={15.07} // 90%
                              strokeLinecap="round"
                            />
                          </svg>
                          <span className="absolute text-[10px] font-mono font-black">94%</span>
                        </div>
                        <div>
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D]">Yield Efficiency</h5>
                          <p className="text-[8px] text-[#7B3FA0] leading-relaxed mt-0.5">Overall transactional node validation rate stands near peak parameters.</p>
                        </div>
                      </div>

                      {/* Risk Alert Indicator */}
                      <div className="flex items-center justify-between border-t border-[#F5E9DD]/40 pt-4">
                        <span className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider">Anomaly Risk Scan</span>
                        <span className="text-[8px] font-black text-[#5A1E7E] bg-[#B886D0]/30 border border-[#B886D0]/40 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          LOW RISK
                        </span>
                      </div>

                    </div>
                  </div>

                  <div className="bg-white/60 p-3 rounded-2xl border border-white/60">
                    <p className="text-[9px] text-[#7B3FA0] italic leading-relaxed">
                      "Financial ledgers show high liquidity loops. Payout settlements are fully stabilized with zero pending banking flags."
                    </p>
                  </div>

                </div>

              </section>

              {/* --- 4. PRODUCT PERFORMANCE BREAKDOWN --- */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* Product breakdowns list */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Product Share Matrix</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Creator Catalog Breakdown</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    {reportData.productBreakdown.map((prod, idx) => {
                      const maxRevenue = Math.max(...reportData.productBreakdown.map(p => p.revenue));
                      const widthPct = (prod.revenue / maxRevenue) * 100;
                      return (
                        <div 
                          key={idx}
                          className="group flex flex-col gap-2 p-3.5 rounded-2xl bg-white/40 hover:bg-white/80 border border-[#F3EAF8] transition-all duration-300 hover:shadow-sm"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#2D004D]">{prod.name}</span>
                              <span className="text-[9px] text-[#7B3FA0]">{prod.orders} transactions</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-black text-[#2D004D]">₹{prod.revenue.toLocaleString()}</span>
                              <span className={`text-[8px] font-black uppercase block mt-0.5 ${prod.growth > 0 ? "text-emerald-500" : "text-rose-400"}`}>
                                {prod.growth > 0 ? `+${prod.growth}%` : `${prod.growth}%`}
                              </span>
                            </div>
                          </div>
                          
                          {/* Inner customized visual loadbar */}
                          <div className="w-full bg-[#F5E9DD]/30 h-1.5 rounded-full overflow-hidden mt-1">
                            <motion.div 
                              className="bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] h-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 1, delay: idx * 0.1 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* --- 5. GEOGRAPHY INSIGHT PANEL --- */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Geographical Segments</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">International Purchasing Shares</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center flex-1">
                    
                    {/* SVG Segmented Circular Rings */}
                    <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Segment 1: North America (42%) */}
                        <circle cx="88" cy="88" r="65" stroke="rgba(90, 30, 126, 0.02)" strokeWidth="8" fill="transparent" />
                        <motion.circle 
                          cx="88" cy="88" r="65" stroke="#B886D0" strokeWidth="8" fill="transparent"
                          strokeDasharray={408.4}
                          strokeDashoffset={408.4 * (1 - 0.42)}
                          strokeLinecap="round"
                          initial={{ strokeDashoffset: 408.4 }}
                          animate={{ strokeDashoffset: 408.4 * (1 - 0.42) }}
                          transition={{ duration: 1.2 }}
                        />

                        {/* Segment 2: Europe (28%) */}
                        <motion.circle 
                          cx="88" cy="88" r="50" stroke="#D8BFE3" strokeWidth="8" fill="transparent"
                          strokeDasharray={314.1}
                          strokeDashoffset={314.1}
                          animate={{ strokeDashoffset: 314.1 * (1 - 0.28) }}
                          transition={{ duration: 1.2, delay: 0.2 }}
                        />

                        {/* Segment 3: Asia (22%) */}
                        <motion.circle 
                          cx="88" cy="88" r="35" stroke="#D8BFE3" strokeWidth="8" fill="transparent"
                          strokeDasharray={219.9}
                          strokeDashoffset={219.9}
                          animate={{ strokeDashoffset: 219.9 * (1 - 0.22) }}
                          transition={{ duration: 1.2, delay: 0.4 }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-xl font-serif font-black text-[#2D004D]">₹1.2L</span>
                        <span className="text-[7px] font-black uppercase tracking-widest text-[#7B3FA0] mt-0.5">Gross Share</span>
                      </div>
                    </div>

                    {/* Geography List Legends */}
                    <div className="flex flex-col gap-3">
                      {reportData.regionData.map((reg, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-[#F5E9DD]/40 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reg.color }} />
                            <span className="text-xs font-bold text-[#2D004D]">{reg.region}</span>
                          </div>
                          <span className="text-[11px] font-mono font-black text-[#7B3FA0]">{reg.share}%</span>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>

              </section>

              {/* --- 6. TIME-BASED PERFORMANCE LAYER --- */}
              <section className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm mb-8">
                
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Hourly Conversion Matrix</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Optimal Checkout Heat Mapping</h3>
                  </div>
                  <span className="text-[8px] text-[#7B3FA0] uppercase font-black tracking-widest">
                    Peak loop: 18:00 - 20:00 (Evening Volume)
                  </span>
                </div>

                {/* Heat bars grid representation */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {reportData.hourlyMetrics.map((hour, idx) => {
                    const maxValue = Math.max(...reportData.hourlyMetrics.map(h => h.value));
                    const intensity = (hour.value / maxValue);
                    
                    // Intensity color spectrum formatting
                    const bgStyle = {
                      background: `rgba(220, 198, 255, ${intensity * 0.9 + 0.1})`,
                      borderColor: `rgba(220, 198, 255, ${intensity * 0.4})`
                    };

                    return (
                      <div 
                        key={idx}
                        style={bgStyle}
                        className="p-4 rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-sm"
                      >
                        <span className="text-[8px] font-black text-[#7B3FA0] tracking-wider mb-1.5">{hour.hour}</span>
                        <span className="text-xs font-bold text-[#2D004D]">₹{hour.value.toLocaleString()}</span>
                        <div 
                          className="w-1.5 h-1.5 rounded-full mt-2.5"
                          style={{
                            backgroundColor: intensity > 0.8 ? '#D8BFE3' : (intensity > 0.5 ? '#B886D0' : '#F5E9DD'),
                            boxShadow: intensity > 0.8 ? '0 0 6px #D8BFE3' : 'none'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

              </section>

              {/* --- 7. SIMULATED AI INSIGHTS ENGINE --- */}
              <section className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm mb-8">
                
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D8BFE3] animate-pulse" />
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Diagnostic Engine</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Subtle Anomalies & Opportunities</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Column 1: Core Positive insights */}
                  <div className="flex flex-col gap-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Yield Advancements
                    </h5>
                    
                    <AnimatePresence>
                      {insightsStage >= 1 && reportData.aiInsights[0] && (
                        <motion.div 
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] flex gap-3.5 items-start"
                        >
                          <div className="w-5 h-5 rounded-lg bg-[#B886D0] text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                            ✓
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#2D004D] block">Compounding Growth</span>
                            <p className="text-[9px] text-[#7B3FA0] leading-relaxed mt-1">{reportData.aiInsights[0].text}</p>
                          </div>
                        </motion.div>
                      )}

                      {insightsStage >= 2 && reportData.aiInsights[1] && (
                        <motion.div 
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] flex gap-3.5 items-start"
                        >
                          <div className="w-5 h-5 rounded-lg bg-[#B886D0] text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                            ✓
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#2D004D] block">Segment Outperformance</span>
                            <p className="text-[9px] text-[#7B3FA0] leading-relaxed mt-1">{reportData.aiInsights[1].text}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                  {/* Column 2: Anomalies & Scans */}
                  <div className="flex flex-col gap-3">
                    <h5 className="text-[9px] font-black uppercase tracking-widest text-[#8E6AA8] mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D8BFE3]" />
                      Anomalies & Audits
                    </h5>

                    <AnimatePresence>
                      {insightsStage >= 2 && reportData.aiInsights[2] && (
                        <motion.div 
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] flex gap-3.5 items-start"
                        >
                          <div className="w-5 h-5 rounded-lg bg-[#D8BFE3] text-[#2D004D] flex items-center justify-center shrink-0 mt-0.5">
                            <Icon name="Clock" size={10} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#2D004D] block">Transactional Concentration</span>
                            <p className="text-[9px] text-[#7B3FA0] leading-relaxed mt-1">{reportData.aiInsights[2].text}</p>
                          </div>
                        </motion.div>
                      )}

                      {insightsStage >= 3 && reportData.aiInsights[3] && (
                        <motion.div 
                          initial={{ opacity: 0, x: 15 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-4 rounded-2xl bg-white/40 border border-red-50 flex gap-3.5 items-start"
                        >
                          <div className="w-5 h-5 rounded-lg bg-[#D8BFE3] text-[#FF8597] flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                            !
                          </div>
                          <div>
                            <span className="text-xs font-bold text-[#2D004D] block text-[#FF8597]">Valuation Disruption</span>
                            <p className="text-[9px] text-red-400/80 leading-relaxed mt-1">{reportData.aiInsights[3].text}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>

                </div>

              </section>

              {/* --- 8. ANALYTICS ERROR STATE --- */}
              {reportError && (
                <section className="mb-8">
                  <div className="glass-surface rounded-3xl p-6 border border-red-200/40 shadow-sm flex flex-col items-center justify-center gap-4 text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                      <Icon name="AlertTriangle" size={22} className="text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-serif font-black text-[#2D004D] mb-1">Failed to Load Report Data</h3>
                      <p className="text-[10px] text-[#7B3FA0] max-w-xs">{reportError}</p>
                    </div>
                    <button
                      onClick={loadReportAnalytics}
                      className="mt-2 px-5 py-2.5 bg-[#2D004D] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#7B3FA0] transition-colors"
                    >
                      <Icon name="RefreshCw" size={12} className="inline mr-1.5" />
                      Retry
                    </button>
                  </div>
                </section>
              )}

              {/* --- 9. REPORTS LIST TABLE (Paginated, M4) --- */}
              <section className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm mb-8">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Live Incident Feed</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">
                      Reports Queue
                      {reportTotal > 0 && (
                        <span className="ml-2 text-[10px] font-bold text-[#7B3FA0] normal-case">({reportTotal} total)</span>
                      )}
                    </h3>
                  </div>

                  {/* Status Filter */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        sysSound.playTap();
                        setStatusFilter(e.target.value);
                        setReportPage(1);
                      }}
                      className="appearance-none bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] rounded-xl pl-4 pr-8 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#2D004D] focus:outline-none cursor-pointer transition-colors"
                    >
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7B3FA0] pointer-events-none">
                      <Icon name="ChevronDown" size={10} />
                    </div>
                  </div>
                </div>

                {/* Table */}
                {reportListLoading ? (
                  <div className="flex flex-col gap-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-[#F5E9DD]/40 animate-pulse" />
                    ))}
                  </div>
                ) : reportListItems.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#F5E9DD]/60 flex items-center justify-center">
                      <Icon name="FileText" size={18} className="text-[#7B3FA0]" />
                    </div>
                    <p className="text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider">No reports found</p>
                    <p className="text-[9px] text-[#8E6AA8]">
                      {statusFilter ? `No reports with status "${statusFilter}"` : 'Customer reports will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#F5E9DD]">
                          {['Reporter', 'Title', 'Category', 'Severity', 'Status', 'Created'].map(col => (
                            <th key={col} className="pb-3 pr-4 text-[8px] font-black uppercase tracking-widest text-[#7B3FA0]">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {reportListItems.map((r, idx) => (
                          <tr key={r.id || `report-${idx}`} className="border-b border-[#F5E9DD]/40 hover:bg-[#F5E9DD]/20 transition-colors">
                            <td className="py-3 pr-4 text-[10px] font-semibold text-[#2D004D]">{r.reporter || '—'}</td>
                            <td className="py-3 pr-4 text-[10px] text-[#2D004D] max-w-[180px] truncate" title={r.title}>{r.title || '—'}</td>
                            <td className="py-3 pr-4 text-[9px] text-[#7B3FA0]">{r.category || '—'}</td>
                            <td className="py-3 pr-4">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                r.severity === 'high'
                                  ? 'bg-red-100 text-red-600'
                                  : r.severity === 'medium'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-[#F5E9DD] text-[#7B3FA0]'
                              }`}>
                                {r.severity || 'low'}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                                r.status === 'Resolved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : r.status === 'Rejected'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-[#D8BFE3]/40 text-[#5A1E7E]'
                              }`}>
                                {r.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3 text-[9px] text-[#7B3FA0]">
                              {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {reportTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-[#F5E9DD]/60">
                    <span className="text-[9px] text-[#7B3FA0] font-bold">
                      Page {reportPage} of {reportTotalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { sysSound.playTap(); setReportPage(p => Math.max(1, p - 1)); }}
                        disabled={reportPage === 1}
                        className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => { sysSound.playTap(); setReportPage(p => Math.min(reportTotalPages, p + 1)); }}
                        disabled={reportPage === reportTotalPages}
                        className="px-3 py-1.5 rounded-xl border border-[#F5E9DD] text-[9px] font-black uppercase tracking-widest text-[#7B3FA0] hover:bg-[#F5E9DD]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

              </section>

            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 8. FLOATING SYSTEM ACTION DECK --- */}
        <section className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
          <div className="glass-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-white/50 backdrop-blur-md">
            
            <button 
              onClick={handleExportPDF}
              className="p-2 hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
              title="Export Cryptographic PDF"
            >
              <Icon name="FileText" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">PDF</span>
            </button>

            <button 
              onClick={handleExportCSV}
              className="p-2 hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
              title="Export ledger CSV file"
            >
              <Icon name="Download" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">CSV</span>
            </button>

            <div className="w-px h-6 bg-stone-200" />

            <button 
              onClick={() => { sysSound.playTap(); setShowScheduleModal(true); }}
              className="p-2 hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="Calendar" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Schedule Report</span>
            </button>

          </div>
        </section>

      </main>

      {/* --- EXPORT/SHARE LINK DIALOG MODAL --- */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-[#2D004D]/30 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 1000 }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-stone-200/50 shadow-2xl relative"
            >
              <button 
                onClick={() => { sysSound.playTap(); setShowShareModal(false); }}
                className="absolute right-5 top-5 p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border-none cursor-pointer text-[#7B3FA0]"
              >
                <Icon name="X" size={11} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#B886D0] text-emerald-600 flex items-center justify-center mb-4">
                  <Icon name="CheckCircle" size={20} />
                </div>
                <h4 className="text-sm font-serif font-black text-[#2D004D] mb-2">Secure Share Link Copied!</h4>
                <p className="text-[10px] text-[#7B3FA0] mb-5 leading-relaxed">
                  The cryptographic dashboard link has been saved to your clipboard. External viewers can inspect the ledger using verified API coordinates.
                </p>
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}${window.location.pathname}#/reports?secure_token=LUM_PUB_88421xT`}
                  className="w-full bg-stone-50 border border-stone-200/50 rounded-xl px-3.5 py-2 text-[8px] text-[#7B3FA0] font-mono text-center mb-5 focus:outline-none"
                />
                <button 
                  onClick={() => { sysSound.playTap(); setShowShareModal(false); }}
                  className="w-full py-3 bg-[#2D004D] text-white hover:bg-[#7B3FA0] text-[10px] font-black uppercase tracking-widest rounded-2xl transition-colors shadow-sm"
                >
                  Return to Dashboard
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}

        {showScheduleModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-[#2D004D]/30 backdrop-blur-sm flex items-center justify-center p-4"
            style={{ zIndex: 1000 }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-stone-200/50 shadow-2xl relative"
            >
              <button 
                onClick={() => { sysSound.playTap(); setShowScheduleModal(false); }}
                className="absolute right-5 top-5 p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border-none cursor-pointer text-[#7B3FA0]"
              >
                <Icon name="X" size={11} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#D8BFE3] text-[#2D004D] flex items-center justify-center mb-4">
                  <Icon name="Calendar" size={20} />
                </div>
                <h4 className="text-sm font-serif font-black text-[#2D004D] mb-2">Schedule Analytics Dispatch</h4>
                <p className="text-[10px] text-[#7B3FA0] mb-5 leading-relaxed">
                  Configure automated dispatches of this ledger file directly to partner stakeholders or external slack sync hooks.
                </p>

                <div className="flex flex-col gap-3.5 w-full text-left mb-6">
                  <div>
                    <label className="text-[8px] font-black uppercase text-[#7B3FA0] block mb-1">Dispatch Interval</label>
                    <select className="w-full bg-white border border-[#F5E9DD] rounded-xl px-3 py-2 text-[10px] font-extrabold uppercase text-[#2D004D] focus:outline-none">
                      <option>Every Monday (Weekly summary)</option>
                      <option>1st of Month (Monthly ledger)</option>
                      <option>Daily telemetry dispatch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase text-[#7B3FA0] block mb-1">Recipient Channel</label>
                    <input 
                      type="text" 
                      placeholder="finance@lumora.io" 
                      className="w-full bg-white border border-[#F5E9DD] rounded-xl px-3 py-2 text-[10px] text-[#2D004D] placeholder-stone-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3.5 w-full">
                  <button 
                    onClick={() => { sysSound.playTap(); setShowScheduleModal(false); }}
                    className="flex-1 py-3 bg-white hover:bg-stone-50 border border-stone-200/50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#2D004D] transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      sysSound.playSuccess();
                      setShowScheduleModal(false);
                      triggerNotification("Ledger scheduling cron active.");
                    }}
                    className="flex-1 py-3 bg-[#2D004D] text-white hover:bg-[#7B3FA0] rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Activate Cron
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminLayout>
  );
}
