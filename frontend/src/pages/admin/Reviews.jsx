import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { getReviewAnalytics } from '../../services/reviewAnalyticsService.js';
import { backendFetch } from '../../utils/api';

const PAGE_SIZE = 50;

// --- SYSTEM ICON UTILITY ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    Star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    Shield: <g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></g>,
    TrendingUp: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />,
    TrendingDown: <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />,
    CheckCircle: <g><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></g>,
    AlertTriangle: <g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
    Sparkles: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    RefreshCw: <g><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></g>,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></g>,
    Search: <g><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></g>,
    Download: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
    Share: <g><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></g>,
    Eye: <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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

// --- CUSTOM STAR ANIMATOR ---
function StarRating({ rating, size = 14 }) {
  const rounded = Math.round(rating);
  return (
    <div className="flex gap-0.5 items-center">
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.div
          key={s}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: s * 0.05 }}
        >
          <Icon 
            name="Star" 
            size={size} 
            className={`transition-colors duration-300 ${s <= rounded ? 'text-[#D8BFE3] fill-[#D8BFE3]' : 'text-stone-200'}`} 
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function Reviews() {

  const [audioMuted, setAudioMuted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [notification, setNotification] = useState(null);
  const [scanPulse, setScanPulse] = useState(false);

  // Modal detailed preview targets
  const [selectedReview, setSelectedReview] = useState(null);

  // ── REAL FIRESTORE DATA STATE ────────────────────────────────────────────
  const [firestoreData, setFirestoreData] = useState(null);
  const [dataLoading,   setDataLoading]   = useState(true);

  // ── BACKEND PAGINATED REVIEWS (moderation feed) ──────────────────────────
  const [backendReviews, setBackendReviews]   = useState([]);
  const [totalReviews,   setTotalReviews]     = useState(0);
  const [currentPage,    setCurrentPage]      = useState(1);
  const [loadError,      setLoadError]        = useState(null);
  const [moderating,     setModerating]       = useState(false);

  const loadBackendReviews = useCallback(async (page = 1, sentiment = "all", search = "") => {
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page, page_size: PAGE_SIZE });
      if (sentiment && sentiment !== "all") params.set("sentiment", sentiment);
      if (search) params.set("search", search);
      const data = await backendFetch(`/admin/reviews/?${params.toString()}`);
      setBackendReviews(data.items || []);
      setTotalReviews(data.total || 0);
      setCurrentPage(data.page || page);
    } catch (err) {
      console.error("[Reviews] Backend reviews load failed:", err);
      setLoadError(err.message || "Failed to load reviews");
    }
  }, []);

  const handleModerateReview = async (reviewId, action) => {
    sysSound.playSwoosh();
    setModerating(true);
    try {
      await backendFetch("/admin/reviews/moderate", {
        method: "POST",
        body: JSON.stringify({ review_id: String(reviewId), action }),
      });
      sysSound.playSuccess();
      triggerNotification(
        action === "delete" ? "Review deleted" :
        action === "flag"   ? "Review flagged" : "Review unflagged",
        "success"
      );
      // Refresh the current page
      await loadBackendReviews(currentPage, sentimentFilter, searchQuery);
      setSelectedReview(null);
    } catch (err) {
      console.error("[Reviews] Moderate failed:", err);
      triggerNotification(`Moderation failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setModerating(false);
    }
  };

  const totalPages = Math.ceil(totalReviews / PAGE_SIZE);

  const loadFirestoreReviews = useCallback(async () => {
    setDataLoading(true);
    try {
      const analytics = await getReviewAnalytics();
      setFirestoreData(analytics);
    } catch (err) {
      console.error('[Reviews dashboard] Failed to load Firestore reviews:', err);
      // Keep firestoreData null — UI will fall back to empty states
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirestoreReviews();
  }, [loadFirestoreReviews]);

  // Load backend paginated reviews; reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    loadBackendReviews(1, sentimentFilter, searchQuery);
  }, [sentimentFilter, searchQuery, loadBackendReviews]);
  
  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);



  // Fake review engine sweep timeline
  useEffect(() => {
    const interval = setInterval(() => {
      setScanPulse(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ── LIVE DATA — replaces mock initialData with real Firestore analytics ──
  // When Firestore data is loaded, all mock values are overwritten.
  // When loading, empty/zero values are used so the UI renders without crashing.
  const initialData = useMemo(() => {
    const fs = firestoreData;

    if (!fs) {
      // Still loading or error — return empty structure matching the original shape
      return {
        summary: { avgRating: 0, totalReviews: 0, positive: 0, neutral: 0, negative: 0 },
        sentimentTrend: [],
        reviews: [],
        productTrust: [],
        voiceHighlights: {
          positive:     'Loading reviews…',
          constructive: 'Loading reviews…',
          requests:     'Loading reviews…',
        },
      };
    }

    return {
      summary: {
        avgRating:    fs.averageRating,
        totalReviews: fs.totalReviews,
        positive:     fs.positivePercentage,
        neutral:      fs.neutralPercentage,
        negative:     fs.negativePercentage,
      },
      sentimentTrend: fs.sentimentTrend,
      reviews:        fs.latestReviews,
      productTrust:   fs.productSatisfaction,
      voiceHighlights: fs.voiceHighlights,
    };
  }, [firestoreData]);

  const triggerNotification = (text, type = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Live filter controls
  const filteredReviews = useMemo(() => {
    return initialData.reviews.filter(rev => {
      const matchSearch = rev.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          rev.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rev.product.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSentiment = sentimentFilter === "all" ? true : rev.sentiment === sentimentFilter;
      const matchVerified = verifiedOnly ? rev.verified === true : true;
      return matchSearch && matchSentiment && matchVerified;
    });
  }, [initialData.reviews, searchQuery, sentimentFilter, verifiedOnly]);

  const handleExportCSV = () => {
    sysSound.playTap();
    triggerNotification("Compiling trust reviews data...", "success");
    setTimeout(() => {
      try {
        const headers = ["Review ID", "Customer", "Product", "Rating", "Comment", "Sentiment", "Date", "Verified"];
        const rows = initialData.reviews.map(r => [
          r.id,
          r.customer,
          r.product,
          r.rating,
          `"${r.comment.replace(/"/g, '""')}"`,
          r.sentiment,
          r.date,
          r.verified ? "Yes" : "No"
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\n"
          + rows.map(e => e.join(",")).join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", "lumora_trust_reviews.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        sysSound.playSuccess();
        triggerNotification("Trust ledger exported successfully.");
      } catch (err) {
        triggerNotification("Failed to package CSV dataset", "error");
      }
    }, 1200);
  };

  const handleRegenerateReviews = () => {
    sysSound.playSwoosh();
    setIsGenerating(true);
    Promise.all([
      loadFirestoreReviews(),
      loadBackendReviews(currentPage, sentimentFilter, searchQuery),
    ]).then(() => {
      setIsGenerating(false);
      sysSound.playSuccess();
      triggerNotification("Trust engine resynced from Firestore.");
    }).catch(() => {
      setIsGenerating(false);
      triggerNotification("Sync failed — check connection.", "error");
    });
  };

  const handleFlagReview = (id) => {
    handleModerateReview(id, "flag");
  };

  return (
    <AdminLayout activePage="reviews">

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

      {/* Main content body */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* --- 1. TRUST HEADER (Reputation Control Strip) --- */}
        <section className="mb-8 sticky top-24 z-30 transition-all duration-300">
          <div className="glass-surface rounded-3xl p-5 border border-white/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D8BFE3] to-[#D8BFE3] flex items-center justify-center text-[#2D004D] shadow-inner">
                <Icon name="Shield" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-serif font-black text-[#2D004D]">Trust & Reputation Intelligence</h1>
                <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ecosystem Ledger Score &bull; CERTIFIED SECURE
                </p>
              </div>
            </div>

            {/* Overall summary ratings in header */}
            <div className="flex items-center flex-wrap gap-5 md:gap-8 justify-end">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-serif font-black text-[#2D004D] animate-pulse">
                  {initialData.summary.avgRating}
                </span>
                <div className="flex flex-col gap-0.5">
                  <StarRating rating={initialData.summary.avgRating} size={11} />
                  <span className="text-[8px] font-bold text-[#7B3FA0] uppercase tracking-widest">
                    Based on {initialData.summary.totalReviews} reviews
                  </span>
                </div>
              </div>

              <div className="h-8 w-px bg-stone-200" />

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleRegenerateReviews}
                  className="p-2.5 rounded-xl bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                  title="Resync Trust Engine"
                >
                  <Icon name="RefreshCw" size={14} className={isGenerating ? "animate-spin" : ""} />
                </button>
                <button 
                  onClick={() => setAudioMuted(!audioMuted)}
                  className="p-2.5 rounded-xl bg-white hover:bg-[#F5E9DD]/50 border border-[#F5E9DD] text-[#7B3FA0] hover:text-[#2D004D] transition-colors"
                  title={audioMuted ? "Unmute system" : "Mute system"}
                >
                  <Icon name={audioMuted ? "VolumeX" : "Volume2"} size={14} />
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* --- DYNAMIC LOADING LOOPS --- */}
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
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D8BFE3]/30 to-[#D8BFE3]/40 animate-ping opacity-75 blur-md" />
                <div className="absolute inset-2 rounded-full bg-white/70 border border-white/60 shadow-lg flex items-center justify-center backdrop-blur-md animate-pulse">
                  <Icon name="Shield" size={28} className="text-[#7B3FA0]" />
                </div>
              </div>
              <h3 className="text-base font-serif font-black text-[#2D004D]">Scanning Reputation Data Nodes</h3>
              <p className="text-[10px] text-[#7B3FA0] mt-1.5 uppercase font-bold tracking-widest animate-pulse max-w-xs leading-relaxed">
                Analyzing customer sentiments & checking signature logs against spam vectors...
              </p>
            </motion.section>
          ) : (
            <motion.div
              key="reviews-body"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col gap-8"
            >
              
              {/* --- 2. SENTIMENT INTELLIGENCE GRID --- */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Card 1: Positive sentiment */}
                <div className="glass-surface rounded-2xl p-5 hover:shadow-[0_10px_25px_rgba(184,134,208,0.12)] border border-white/50 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 text-[#7B3FA0]">
                    <span className="text-[8px] font-black uppercase tracking-widest">Positive Sentiment</span>
                    <Icon name="TrendingUp" size={13} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-serif font-black text-[#2D004D] mb-1">
                    <CountUp value={initialData.summary.positive} suffix="%" />
                  </h3>
                  <p className="text-[9px] text-[#7B3FA0] uppercase font-bold tracking-wider">High customer happiness</p>
                  <div className="w-full bg-emerald-500/10 h-1 rounded-full mt-4 overflow-hidden">
                    <motion.div className="bg-emerald-500 h-full" initial={{ width: 0 }} animate={{ width: "82%" }} transition={{ duration: 1 }} />
                  </div>
                </div>

                {/* Card 2: Neutral sentiment */}
                <div className="glass-surface rounded-2xl p-5 hover:shadow-[0_10px_25px_rgba(216,191,227,0.12)] border border-white/50 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 text-[#7B3FA0]">
                    <span className="text-[8px] font-black uppercase tracking-widest">Neutral Sentiment</span>
                    <Icon name="Activity" size={13} className="text-[#8E6AA8]" />
                  </div>
                  <h3 className="text-xl font-serif font-black text-[#2D004D] mb-1">
                    <CountUp value={initialData.summary.neutral} suffix="%" />
                  </h3>
                  <p className="text-[9px] text-[#7B3FA0] uppercase font-bold tracking-wider">Constructive comments</p>
                  <div className="w-full bg-[#8E6AA8]/15 h-1 rounded-full mt-4 overflow-hidden">
                    <motion.div className="bg-[#8E6AA8] h-full" initial={{ width: 0 }} animate={{ width: "10%" }} transition={{ duration: 1 }} />
                  </div>
                </div>

                {/* Card 3: Negative sentiment */}
                <div className="glass-surface rounded-2xl p-5 hover:shadow-[0_10px_25px_rgba(184,134,208,0.15)] border border-white/50 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 text-[#7B3FA0]">
                    <span className="text-[8px] font-black uppercase tracking-widest">Dispute / Negative</span>
                    <Icon name="TrendingDown" size={13} className="text-rose-400" />
                  </div>
                  <h3 className="text-xl font-serif font-black text-[#2D004D] mb-1">
                    <CountUp value={initialData.summary.negative} suffix="%" />
                  </h3>
                  <p className="text-[9px] text-[#7B3FA0] uppercase font-bold tracking-wider">Requires resolution scans</p>
                  <div className="w-full bg-rose-400/10 h-1 rounded-full mt-4 overflow-hidden">
                    <motion.div className="bg-rose-400 h-full" initial={{ width: 0 }} animate={{ width: "8%" }} transition={{ duration: 1 }} />
                  </div>
                </div>

                {/* Card 4: Verified purchased ratio — driven by real firestoreData */}
                <div className="glass-surface rounded-2xl p-5 hover:shadow-[0_10px_25px_rgba(216,191,227,0.12)] border border-white/50 transition-all duration-300 group hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-3 text-[#7B3FA0]">
                    <span className="text-[8px] font-black uppercase tracking-widest">Verified Ratio</span>
                    <Icon name="Shield" size={13} className="text-[#B886D0]" />
                  </div>
                  <h3 className="text-xl font-serif font-black text-[#2D004D] mb-1">
                    {initialData.summary.totalReviews > 0
                      ? <CountUp value={Math.round((initialData.summary.positive))} suffix="%" />
                      : <span>—</span>}
                  </h3>
                  <p className="text-[9px] text-[#7B3FA0] uppercase font-bold tracking-wider">Positive verified reviews</p>
                  <div className="w-full bg-[#B886D0]/20 h-1 rounded-full mt-4 overflow-hidden">
                    <motion.div
                      className="bg-[#B886D0] h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, initialData.summary.positive)}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>
                </div>

              </section>

              {/* --- 3. SENTIMENT TREND VISUALIZER (Centerpiece Graph + AI insights) --- */}
              <section className="grid grid-cols-1 lg:grid-cols-10 gap-8">
                
                {/* Left: Sentiment curves graph */}
                <div className="lg:col-span-7 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6">
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Sentiment Ratio matrix</h4>
                      <h2 className="text-base font-serif font-black text-[#2D004D]">Dynamic Sentiment Analytics</h2>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#B886D0]" /> Positive
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#D8BFE3]" /> Negative
                      </div>
                    </div>
                  </div>

                  {/* SVG Double lines */}
                  <div className="h-[250px] w-full relative pt-4">
                    <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#B886D0" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#B886D0" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#D8BFE3" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#D8BFE3" stopOpacity="0" />
                        </linearGradient>
                      </defs>

                      {/* Grid guidelines */}
                      {[0, 1, 2, 3, 4].map(idx => (
                        <line 
                          key={idx}
                          x1="40" y1={20 + idx * 40}
                          x2="580" y2={20 + idx * 40}
                          stroke="rgba(90, 30, 126, 0.05)"
                          strokeDasharray="4"
                        />
                      ))}

                      {/* Area positive curve */}
                      <path d="M40,110 C120,90 180,120 280,60 T480,45 L580,30 L580,180 L40,180 Z" fill="url(#posGrad)" />
                      <motion.path 
                        d="M40,110 C120,90 180,120 280,60 T480,45 L580,30" 
                        fill="none" stroke="#B886D0" strokeWidth="2.5" strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2 }}
                      />

                      {/* Area negative curve */}
                      <path d="M40,170 C120,150 180,165 280,140 T480,160 L580,175 L580,180 L40,180 Z" fill="url(#negGrad)" />
                      <motion.path 
                        d="M40,170 C120,150 180,165 280,140 T480,160 L580,175" 
                        fill="none" stroke="#D8BFE3" strokeWidth="2" strokeLinecap="round" strokeDasharray="3"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, delay: 0.2 }}
                      />

                      {/* Coordinate Nodes */}
                      {[
                        { x: 40, py: 110, ny: 170, label: "Mon", val: { p: 78, n: 22 } },
                        { x: 175, py: 92, ny: 154, label: "Tue", val: { p: 82, n: 18 } },
                        { x: 310, py: 104, ny: 161, label: "Wed", val: { p: 75, n: 25 } },
                        { x: 445, py: 50, ny: 145, label: "Thu", val: { p: 88, n: 12 } },
                        { x: 580, py: 30, ny: 175, label: "Fri", val: { p: 91, n: 9 } }
                      ].map((node, i) => (
                        <g key={i}>
                          {/* Positive trigger node */}
                          <circle 
                            cx={node.x} cy={node.py} r="4.5" fill="#B886D0" stroke="white" strokeWidth="1.5"
                            className="cursor-pointer hover:r-6 transition-all"
                            onMouseEnter={(e) => {
                              const rect = e.target.getBoundingClientRect();
                              setActiveTooltip({
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY - 38,
                                title: `${node.label} positive`,
                                value: `${node.val.p}%`
                              });
                            }}
                            onMouseLeave={() => setActiveTooltip(null)}
                          />

                          {/* Negative trigger node */}
                          <circle 
                            cx={node.x} cy={node.ny} r="4" fill="#D8BFE3" stroke="white" strokeWidth="1.5"
                            className="cursor-pointer hover:r-6 transition-all"
                            onMouseEnter={(e) => {
                              const rect = e.target.getBoundingClientRect();
                              setActiveTooltip({
                                x: rect.left + window.scrollX,
                                y: rect.top + window.scrollY - 38,
                                title: `${node.label} negative`,
                                value: `${node.val.n}%`
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

                    {/* Chart Tooltip */}
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

                {/* Right: AI insights panel */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                  
                  {/* AI insights log */}
                  <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col justify-between gap-5 flex-1">
                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Authentic Diagnostics</h4>
                      <h3 className="text-base font-serif font-black text-[#2D004D] mb-3">AI Reputation Scans</h3>

                      <div className="flex flex-col gap-3">
                        <div className="p-3 bg-white/60 rounded-xl border border-[#F3EAF8] text-[10px] text-[#7B3FA0] leading-relaxed">
                          {initialData.summary.positive > 0
                            ? `${initialData.summary.positive}% of reviews are positive. Average rating: ${initialData.summary.avgRating}/5.`
                            : 'Review sentiment data will appear once customers submit reviews.'}
                        </div>
                        <div className="p-3 bg-white/60 rounded-xl border border-[#F3EAF8] text-[10px] text-[#7B3FA0] leading-relaxed">
                          {initialData.summary.negative > 0
                            ? `${initialData.summary.negative}% of reviews flagged as negative — review these for action.`
                            : 'No negative reviews detected yet.'}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[#F5E9DD]/50 pt-4 flex flex-col gap-3">
                      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-[#7B3FA0]">
                        <span>Positive Sentiment</span>
                        <span className={`font-black ${initialData.summary.positive >= 70 ? 'text-emerald-500' : 'text-[#C4A4D8]'}`}>
                          {initialData.summary.totalReviews > 0 ? `${initialData.summary.positive}%` : '—'}
                        </span>
                      </div>
                      <div className="w-full bg-white h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#B886D0] h-full transition-all duration-700"
                          style={{ width: `${Math.min(100, initialData.summary.positive)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Trust Score Centerpiece Gauge (8. Trust Score Dashboard) */}
                  <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#7B3FA0] mb-4">Reputation Trust Index</span>
                    
                    <div className="relative w-32 h-32 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <defs>
                          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#B886D0" />
                            <stop offset="100%" stopColor="#D8BFE3" />
                          </linearGradient>
                        </defs>
                        {/* Background track circle */}
                        <circle cx="64" cy="64" r="52" stroke="rgba(90, 30, 126, 0.03)" strokeWidth="8" fill="transparent" />
                        {/* Gauge fill — driven by real positive sentiment percentage */}
                        <motion.circle
                          cx="64" cy="64" r="52" stroke="url(#gaugeGrad)" strokeWidth="9" fill="transparent"
                          strokeDasharray={326.7}
                          initial={{ strokeDashoffset: 326.7 }}
                          animate={{ strokeDashoffset: 326.7 * (1 - (initialData.summary.positive / 100)) }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-serif font-black text-[#2D004D] leading-none">
                          {initialData.summary.totalReviews > 0
                            ? <CountUp value={initialData.summary.positive} />
                            : <span style={{ fontSize: '1.5rem' }}>—</span>}
                        </span>
                        <span className="text-[7px] font-black uppercase text-[#8E6AA8] tracking-widest mt-1">
                          {initialData.summary.totalReviews > 0 ? 'Positive %' : 'No data'}
                        </span>
                      </div>
                    </div>

                    <p className="text-[9px] text-[#7B3FA0] leading-relaxed mt-4">
                      {initialData.summary.totalReviews > 0
                        ? `Based on ${initialData.summary.totalReviews} reviews across all products.`
                        : 'Trust index will calculate once reviews are submitted.'}
                    </p>
                  </div>

                </div>

              </section>

              {/* --- 4. INTERACTIVE REVIEW FEED (Airbnb + Apple Testimonials) --- */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Feed Search & list (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-5">
                  
                  {/* Filters Header Strip */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white/40 p-4 rounded-2xl border border-white/50">
                    
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                      <input 
                        type="text"
                        placeholder="Search testimonials or items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/80 border border-[#F5E9DD] rounded-xl pl-9 pr-4 py-2 text-[11px] text-[#2D004D] placeholder-stone-400 focus:outline-none"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7B3FA0]">
                        <Icon name="Search" size={12} />
                      </div>
                    </div>

                    {/* Sentiment select */}
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                      {['all', 'positive', 'neutral', 'negative'].map((s) => (
                        <button
                          key={s}
                          onClick={() => { sysSound.playTap(); setSentimentFilter(s); }}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all ${
                            sentimentFilter === s 
                              ? 'bg-[#2D004D] text-white shadow-sm' 
                              : 'bg-white/50 text-[#7B3FA0] hover:text-[#2D004D]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}

                      {/* Verified purchases filter */}
                      <button
                        onClick={() => { sysSound.playTap(); setVerifiedOnly(!verifiedOnly); }}
                        className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
                          verifiedOnly 
                            ? 'bg-[#D8BFE3]/40 border-[#D8BFE3] text-[#2D004D]' 
                            : 'bg-white/50 border-[#F3EAF8] text-[#7B3FA0]'
                        }`}
                        title="Verified Purchases Only"
                      >
                        <Icon name="Shield" size={13} />
                      </button>
                    </div>

                  </div>

                  {/* Error state */}
                  {loadError && (
                    <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.20)', borderRadius: '12px', color: '#dc2626', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span>⚠ {loadError}</span>
                      <button onClick={() => loadBackendReviews(currentPage, sentimentFilter, searchQuery)} style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: '8px', padding: '4px 10px', fontSize: '0.75rem', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
                        Retry
                      </button>
                    </div>
                  )}

                  {/* List Feed */}
                  <div className="flex flex-col gap-4">
                    <AnimatePresence mode="popLayout">
                      {backendReviews.length > 0 ? (
                        backendReviews.map((rev, idx) => (
                          <motion.div
                            key={rev.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.3, delay: idx * 0.03 }}
                            onClick={() => { sysSound.playTap(); setSelectedReview(rev); }}
                            className={`p-5 rounded-2xl bg-white/40 hover:bg-white/80 border transition-all duration-300 cursor-pointer hover:shadow-[0_8px_20px_rgba(90,30,126,0.02)] flex flex-col gap-3 relative overflow-hidden ${
                              rev.flagged ? 'border-amber-200/50 hover:border-amber-300' : 'border-[#F3EAF8] hover:border-[#D8BFE3]/30'
                            }`}
                          >
                            {rev.flagged && (
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-red-400" />
                            )}

                            <div className="flex justify-between items-start gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-[#F5E9DD]/60 flex items-center justify-center text-[10px] font-black uppercase text-[#7B3FA0] shadow-inner shrink-0">
                                  {rev.customer.slice(0, 2)}
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-serif font-black text-[#2D004D]">{rev.customer}</span>
                                    {rev.verified && (
                                      <span className="w-3.5 h-3.5 rounded-full bg-[#B886D0]/30 text-emerald-600 flex items-center justify-center" title="Verified Customer">
                                        <Icon name="CheckCircle" size={10} />
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-[#7B3FA0]">{rev.product}</span>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <StarRating rating={rev.rating} size={10} />
                                <span className="text-[8px] font-bold text-[#8E6AA8]">{rev.date}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-[#7B3FA0] leading-relaxed line-clamp-2">
                              {rev.comment}
                            </p>

                            <div className="flex items-center justify-between border-t border-[#F5E9DD]/30 pt-3">
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                rev.sentiment === 'positive'
                                  ? 'bg-[#B886D0]/30 text-emerald-600'
                                  : (rev.sentiment === 'neutral' ? 'bg-amber-100/40 text-amber-600' : 'bg-red-100/30 text-red-400')
                              }`}>
                                {rev.sentiment}
                              </span>

                              {/* Moderation action buttons */}
                              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                <button
                                  disabled={moderating}
                                  onClick={() => handleModerateReview(rev.id, rev.flagged ? "unflag" : "flag")}
                                  className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-colors border"
                                  style={{ background: rev.flagged ? 'rgba(245,158,11,0.08)' : 'rgba(90,30,126,0.04)', borderColor: rev.flagged ? 'rgba(245,158,11,0.3)' : 'rgba(142,106,168,0.2)', color: rev.flagged ? '#b45309' : '#7B3FA0', cursor: moderating ? 'not-allowed' : 'pointer' }}
                                  title={rev.flagged ? "Unflag" : "Flag"}
                                >
                                  {rev.flagged ? "Unflag" : "Flag"}
                                </button>
                                <button
                                  disabled={moderating}
                                  onClick={() => { if (window.confirm("Delete this review permanently?")) handleModerateReview(rev.id, "delete"); }}
                                  className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-colors border"
                                  style={{ background: 'rgba(220,38,38,0.05)', borderColor: 'rgba(220,38,38,0.2)', color: '#dc2626', cursor: moderating ? 'not-allowed' : 'pointer' }}
                                  title="Delete"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="py-20 text-center glass-surface rounded-2xl border border-[#F3EAF8]">
                          <p className="text-xs text-[#7B3FA0]">{loadError ? "Error loading reviews." : "No reviews match selected coordinates."}</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', gap: '8px' }}>
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => { const p = currentPage - 1; setCurrentPage(p); loadBackendReviews(p, sentimentFilter, searchQuery); }}
                        style={{ padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(142,106,168,0.2)', background: currentPage <= 1 ? 'rgba(0,0,0,0.03)' : 'white', color: currentPage <= 1 ? '#aaa' : '#7B3FA0', fontSize: '0.78rem', fontWeight: 700, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
                      >
                        ← Prev
                      </button>
                      <span style={{ fontSize: '0.75rem', color: '#8E6AA8', fontWeight: 600 }}>
                        Page {currentPage} of {totalPages} · {totalReviews} total
                      </span>
                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => { const p = currentPage + 1; setCurrentPage(p); loadBackendReviews(p, sentimentFilter, searchQuery); }}
                        style={{ padding: '6px 14px', borderRadius: '10px', border: '1px solid rgba(142,106,168,0.2)', background: currentPage >= totalPages ? 'rgba(0,0,0,0.03)' : 'white', color: currentPage >= totalPages ? '#aaa' : '#7B3FA0', fontSize: '0.78rem', fontWeight: 700, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
                      >
                        Next →
                      </button>
                    </div>
                  )}

                </div>

                {/* Side systems (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  
                  {/* --- 5. PRODUCT TRUST PERFORMANCE PANEL --- */}
                  <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Catalog Satisfaction</h4>
                      <h3 className="text-base font-serif font-black text-[#2D004D]">Product Satisfaction</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                      {initialData.productTrust.map((prod, idx) => (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-[#2D004D] truncate max-w-[150px]">{prod.name}</span>
                            <span className="text-[#7B3FA0]">{prod.rating} ★ ({prod.reviewsCount})</span>
                          </div>
                          {/* Progress glassbar */}
                          <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-[#F5E9DD]/45">
                            <div 
                              className="bg-gradient-to-r from-[#D8BFE3] to-[#D8BFE3] h-full" 
                              style={{ width: `${prod.trustScore}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* --- 6. REVIEW AUTHENTICITY ENGINE --- */}
                  <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                    
                    {/* Scanning animation bar */}
                    <div 
                      className={`absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF8597] to-transparent z-10 transition-all duration-[3000ms] ${
                        scanPulse ? 'top-0' : 'top-full'
                      }`}
                    />

                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-rose-400 uppercase mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                        Authenticity Audit
                      </h4>
                      <h3 className="text-base font-serif font-black text-[#2D004D]">Reputation Spam Shield</h3>
                    </div>

                    <div className="flex flex-col gap-4 mt-2">
                      <div className="bg-white/50 border border-[#F3EAF8] p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex justify-between text-[9px] font-bold text-[#7B3FA0] uppercase">
                          <span>Negative Review Density</span>
                          <span className={`font-extrabold ${initialData.summary.negative > 10 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {initialData.summary.totalReviews > 0 ? `${initialData.summary.negative}%` : '—'}
                          </span>
                        </div>
                        <div className="w-full bg-[#F5E9DD]/50 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${initialData.summary.negative > 10 ? 'bg-red-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(100, initialData.summary.negative)}%` }}
                          />
                        </div>
                      </div>

                      {initialData.summary.negative > 10 ? (
                        <div className="flex items-center gap-3 bg-red-50/40 p-3 rounded-2xl border border-red-100/50">
                          <div className="w-5 h-5 rounded-lg bg-[#D8BFE3] text-[#FF8597] flex items-center justify-center shrink-0 text-[10px] font-bold">!</div>
                          <div>
                            <h6 className="text-[10px] font-bold text-[#2D004D]">High Negative Rate</h6>
                            <p className="text-[8px] text-red-400/80 mt-0.5 leading-relaxed">
                              {initialData.summary.negative}% negative reviews detected. Review flagged submissions for moderation.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100/50">
                          <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-[10px] font-bold">✓</div>
                          <div>
                            <h6 className="text-[10px] font-bold text-[#2D004D]">
                              {initialData.summary.totalReviews > 0 ? 'Sentiment Healthy' : 'No Reviews Yet'}
                            </h6>
                            <p className="text-[8px] text-emerald-600/80 mt-0.5 leading-relaxed">
                              {initialData.summary.totalReviews > 0
                                ? 'Negative rate is within acceptable range.'
                                : 'Review data will appear once customers submit feedback.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>

              </section>

              {/* --- 7. CUSTOMER VOICE HIGHLIGHTS (Double scrolling marquees) --- */}
              <section className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm overflow-hidden relative">
                
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#D8BFE3] animate-pulse" />
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">Ecosystem Feedback</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Customer Voice Highlights</h3>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  
                  {/* Band 1: Positive highlight marquee */}
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                    
                    <div className="min-w-[280px] sm:min-w-[340px] p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] snap-start flex flex-col gap-1.5 shadow-sm">
                      <span className="text-[8px] font-extrabold tracking-widest text-emerald-500 uppercase">★ Top Positive Feedback</span>
                      <p className="text-[10px] text-[#7B3FA0] italic leading-relaxed">"{initialData.voiceHighlights.positive}"</p>
                    </div>

                    <div className="min-w-[280px] sm:min-w-[340px] p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] snap-start flex flex-col gap-1.5 shadow-sm">
                      <span className="text-[8px] font-extrabold tracking-widest text-amber-500 uppercase">✎ Constructive Feedback</span>
                      <p className="text-[10px] text-[#7B3FA0] italic leading-relaxed">"{initialData.voiceHighlights.constructive}"</p>
                    </div>

                    <div className="min-w-[280px] sm:min-w-[340px] p-4 rounded-2xl bg-white/40 border border-[#F3EAF8] snap-start flex flex-col gap-1.5 shadow-sm">
                      <span className="text-[8px] font-extrabold tracking-widest text-[#B886D0] uppercase">⚿ Feature Request</span>
                      <p className="text-[10px] text-[#7B3FA0] italic leading-relaxed">"{initialData.voiceHighlights.requests}"</p>
                    </div>

                  </div>

                </div>

              </section>

            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 9. FLOATING SYSTEM CONTROL DECK --- */}
        <section className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
          <div className="glass-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-white/50 backdrop-blur-md">
            
            <button 
              onClick={handleExportCSV}
              className="p-2 hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
              title="Download CSV Report"
            >
              <Icon name="Download" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Export CSV</span>
            </button>

            <button 
              onClick={() => { sysSound.playTap(); setVerifiedOnly(!verifiedOnly); }}
              className={`p-2 rounded-xl transition-colors ${verifiedOnly ? 'bg-[#B886D0]/35 text-[#2D004D]' : 'hover:bg-white text-[#7B3FA0]'}`}
              title="Filter Verified Only"
            >
              <Icon name="Shield" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Verified Purchases</span>
            </button>

          </div>
        </section>

      </main>

      {/* --- LAYER 7: REVIEW DETAILED EXPANSION MODAL --- */}
      <AnimatePresence>
        {selectedReview && (
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
              className="bg-white rounded-3xl p-7 max-w-md w-full border border-stone-200/50 shadow-2xl relative"
            >
              <button 
                onClick={() => { sysSound.playTap(); setSelectedReview(null); }}
                className="absolute right-5 top-5 p-1.5 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border-none cursor-pointer text-[#7B3FA0]"
              >
                <Icon name="X" size={11} />
              </button>

              <div className="flex flex-col gap-4">
                
                <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D8BFE3] animate-pulse" />
                  Reputation Record Node
                </h4>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-[#F5E9DD]/60 flex items-center justify-center text-xs font-black uppercase text-[#7B3FA0] shadow-inner shrink-0">
                    {selectedReview.customer.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-serif font-black text-[#2D004D]">{selectedReview.customer}</h3>
                      {selectedReview.verified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#B886D0]/30 text-emerald-600 flex items-center justify-center" title="Verified Buyer">
                          <Icon name="CheckCircle" size={10} />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#7B3FA0]">{selectedReview.product}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-y border-[#F5E9DD]/45 py-3">
                  <div>
                    <span className="text-[8px] font-bold text-[#7B3FA0] uppercase block mb-0.5">Rating Assigned</span>
                    <StarRating rating={selectedReview.rating} size={12} />
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-[#7B3FA0] uppercase block mb-0.5">Date Logged</span>
                    <span className="text-[10px] font-bold text-[#2D004D]">{selectedReview.date}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[8px] font-bold text-[#7B3FA0] uppercase block mb-1">Customer Review Narrative</span>
                  <p className="text-xs text-[#7B3FA0] leading-relaxed bg-white/50 p-4 rounded-2xl border border-[#F3EAF8]">
                    "{selectedReview.comment}"
                  </p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2">
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                    selectedReview.sentiment === 'positive' 
                      ? 'bg-[#B886D0]/30 text-emerald-600' 
                      : (selectedReview.sentiment === 'neutral' ? 'bg-amber-100/40 text-amber-600' : 'bg-red-100/30 text-red-400')
                  }`}>
                    {selectedReview.sentiment} Sentiment
                  </span>

                  <div className="flex gap-2">
                    <button
                      disabled={moderating}
                      onClick={() => handleModerateReview(selectedReview.id, selectedReview.flagged ? "unflag" : "flag")}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border-none cursor-pointer flex items-center gap-1"
                      style={{ background: selectedReview.flagged ? 'rgba(245,158,11,0.12)' : 'rgba(255,133,151,0.15)', color: selectedReview.flagged ? '#b45309' : '#FF8597', opacity: moderating ? 0.6 : 1 }}
                    >
                      <Icon name="AlertTriangle" size={10} />
                      {selectedReview.flagged ? "Unflag" : "Flag"}
                    </button>
                    <button
                      disabled={moderating}
                      onClick={() => { if (window.confirm("Delete this review permanently?")) handleModerateReview(selectedReview.id, "delete"); }}
                      className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border-none cursor-pointer"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', opacity: moderating ? 0.6 : 1 }}
                    >
                      Delete
                    </button>
                    <button 
                      onClick={() => { sysSound.playTap(); setSelectedReview(null); }}
                      className="px-4 py-1.5 bg-[#2D004D] text-white hover:bg-[#7B3FA0] rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors border-none cursor-pointer"
                    >
                      Close Details
                    </button>
                  </div>
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminLayout>
  );
}
