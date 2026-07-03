import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, TableContainer } from './components/AdminComponents';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  subscribeToPlatformSettings,
  initPlatformSettings,
  updatePlatformSetting,
  DEFAULT_PLATFORM_SETTINGS,
} from '../../services/settingsService.js';

// --- SYSTEM ICON SELECTOR ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    Settings: <g><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.5 1z" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    RefreshCw: <g><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></g>,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></g>,
    Shield: <g><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></g>,
    Sparkles: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    TrendingUp: <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />,
    Zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    Download: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
    CheckCircle: <g><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></g>
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

const DEFAULT_SETTINGS = {
  themeIntensity: "rich",
  animationLevel: "cinematic",
  dashboardDensity: "balanced",
  currencyDisplay: "INR",
  realtimeUpdates: true,
  chartStyle: "smooth",
  reviewVisibility: "all",
  orderAutoRefresh: true,
  aiInsightsLevel: "balanced",
  glowEffects: true,
  glassmorphismLevel: "standard"
};

export default function Settings() {

  const [audioMuted, setAudioMuted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());

  // Global Configuration State
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("lumora-settings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // ─── PLATFORM SETTINGS (Firestore-backed feature flags) ──────────────────
  const { user } = useAuth();
  const [platformSettings, setPlatformSettings] = useState({ ...DEFAULT_PLATFORM_SETTINGS });
  const [platformLoading, setPlatformLoading]   = useState(true);
  const [togglingKey, setTogglingKey]           = useState(null); // which toggle is saving

  // Subscribe to real-time platform settings
  useEffect(() => {
    // Step 1: init ensures the document exists (creates with defaults on first boot only)
    // Step 2: subscribe for real-time updates — the subscription itself does NOT write
    let unsub = () => {};

    initPlatformSettings()
      .then((initial) => {
        // Seed state with the confirmed Firestore values
        setPlatformSettings(initial || DEFAULT_PLATFORM_SETTINGS);
        setPlatformLoading(false);
        // Now start the real-time listener
        unsub = subscribeToPlatformSettings((data) => {
          setPlatformSettings(data || DEFAULT_PLATFORM_SETTINGS);
          setPlatformLoading(false);
        });
      })
      .catch(() => {
        // Failed to init — start listener anyway, it will populate state
        unsub = subscribeToPlatformSettings((data) => {
          setPlatformSettings(data || DEFAULT_PLATFORM_SETTINGS);
          setPlatformLoading(false);
        });
      });

    return () => unsub();
  }, []);

  const handlePlatformToggle = async (key) => {
    if (!user?.uid) {
      console.warn('[Settings] handlePlatformToggle called without authenticated user');
      triggerNotification('You must be logged in as Admin to change platform settings.', 'error');
      return;
    }
    const newValue = !platformSettings[key];
    // Optimistic UI update
    setPlatformSettings(prev => ({ ...prev, [key]: newValue }));
    setTogglingKey(key);
    sysSound.playTap();
    try {
      await updatePlatformSetting(key, newValue, user.uid, user.name || user.displayName || 'Admin');
      setLastSaved(new Date().toLocaleTimeString());
      const label = key.replace(/([A-Z])/g, ' $1').trim();
      triggerNotification(`${label} ${newValue ? 'enabled' : 'disabled'}.`);
      sysSound.playSuccess();
    } catch (err) {
      console.error('[Settings] platform toggle FAILED — reverting UI:', err.message);
      // Revert to actual Firestore value by re-running init
      const current = await initPlatformSettings().catch(() => platformSettings);
      setPlatformSettings(current);
      triggerNotification(`Failed to save: ${err.message}`, 'error');
    } finally {
      setTogglingKey(null);
    }
  };

  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);



  // Sync to local storage on change
  const updateSetting = (key, value) => {
    sysSound.playTap();
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem("lumora-settings", JSON.stringify(updated));
    setLastSaved(new Date().toLocaleTimeString());
    
    // Dispatch custom event to notify other open tabs / components
    window.dispatchEvent(new Event("lumoraSettingsUpdated"));
  };

  const handleRestoreDefaults = () => {
    sysSound.playSwoosh();
    setIsSyncing(true);
    setTimeout(() => {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem("lumora-settings", JSON.stringify(DEFAULT_SETTINGS));
      setLastSaved(new Date().toLocaleTimeString());
      setIsSyncing(false);
      sysSound.playSuccess();
      triggerNotification("Preferences restored to factory defaults.");
      window.dispatchEvent(new Event("lumoraSettingsUpdated"));
    }, 1200);
  };

  const triggerNotification = (text, type = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };



  const handleExportJSON = () => {
    sysSound.playTap();
    triggerNotification("Packing systems config...", "success");
    setTimeout(() => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "lumora_settings_config.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      sysSound.playSuccess();
      triggerNotification("System configuration downloaded.");
    }, 1000);
  };

  // Currency helper formatting
  const currencySymbol = settings.currencyDisplay === "INR" ? "₹" : (settings.currencyDisplay === "EUR" ? "€" : "$");

  // Dynamic preview classes mapping
  const densityPadding = settings.dashboardDensity === "compact" ? "p-3 gap-2" : (settings.dashboardDensity === "spacious" ? "p-8 gap-5" : "p-5 gap-3.5");
  const glowStyle = settings.glowEffects ? "shadow-[0_8px_25px_rgba(216,191,227,0.22)]" : "shadow-none border-stone-200/50";
  const transitionTime = settings.animationLevel === "minimal" ? "duration-0" : (settings.animationLevel === "ultra" ? "duration-700" : "duration-300");

  return (
    <AdminLayout activePage="settings">

      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_12px_40px_rgba(90,30,126,0.08)]"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#B886D0] shadow-[0_0_8px_#B886D0]" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2D004D]">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* --- 1. SYSTEM HEADER --- */}
        <PageHeader
          title="System Preferences"
          subtitle="Global Lumora Configuration Engine • Sync Active"
          actions={
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-mono text-[#7B3FA0]">Last updated: {lastSaved}</span>
              <button
                onClick={handleRestoreDefaults}
                className="btn-admin-secondary"
              >
                Restore Defaults
              </button>
            </div>
          }
        />

        {/* --- MAIN PREFERENCE LAYOUT SPLIT --- */}
        <AnimatePresence mode="wait">
          {isSyncing ? (
            <motion.section 
              key="loader"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="py-32 flex flex-col items-center justify-center text-center"
            >
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#D8BFE3]/20 to-[#D8BFE3]/30 animate-ping blur-md" />
                <div className="absolute inset-2 rounded-full bg-white/70 border border-white/60 shadow flex items-center justify-center backdrop-blur-md animate-pulse">
                  <Icon name="RefreshCw" size={22} className="text-[#7B3FA0]" />
                </div>
              </div>
              <h3 className="text-base font-serif font-black text-[#2D004D]">Recalibrating UI Design Core</h3>
              <p className="text-[9px] text-[#7B3FA0] mt-1.5 uppercase font-bold tracking-widest animate-pulse max-w-xs">
                Synchronizing local settings variables & clearing layout overrides...
              </p>
            </motion.section>
          ) : (
            <motion.div 
              key="settings-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              
              {/* Controls Column (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                
                {/* 2. THEME CONTROL SYSTEM */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                  
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Visual Tone</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Theme & Palette Engine</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Theme intensity */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Theme Intensity</span>
                        <span className="text-[9px] text-[#7B3FA0]">Controls visual gradients richness.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['soft', 'medium', 'rich'].map((t) => (
                          <button
                            key={t}
                            onClick={() => updateSetting("themeIntensity", t)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.themeIntensity === t ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-stone-200/40" />

                    {/* Glow Effects toggle */}
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Glow Effects</span>
                        <span className="text-[9px] text-[#7B3FA0]">Enables/Disables visual glow shadows under cards.</span>
                      </div>
                      <button
                        onClick={() => updateSetting("glowEffects", !settings.glowEffects)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          settings.glowEffects ? 'bg-[#B886D0]' : 'bg-stone-200'
                        }`}
                      >
                        <motion.div 
                          className="w-5 h-5 rounded-full bg-white shadow-sm"
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{ marginLeft: settings.glowEffects ? '20px' : '0px' }}
                        />
                      </button>
                    </div>

                    <div className="h-px bg-stone-200/40" />

                    {/* Glassmorphism level */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Glassmorphism Depth</span>
                        <span className="text-[9px] text-[#7B3FA0]">Controls backing blur intensity.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['light', 'standard', 'heavy'].map((g) => (
                          <button
                            key={g}
                            onClick={() => updateSetting("glassmorphismLevel", g)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.glassmorphismLevel === g ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>

                {/* 3. MOTION & ANIMATION ENGINE */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Kinetic Systems</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Motion & Haptic Settings</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Animation Level */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Transitions Complexity</span>
                        <span className="text-[9px] text-[#7B3FA0]">Ultra scales up parallax & drifting objects.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['minimal', 'cinematic', 'ultra'].map((a) => (
                          <button
                            key={a}
                            onClick={() => updateSetting("animationLevel", a)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.animationLevel === a ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* 4. LAYOUT INTELLIGENCE CONTROL */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Structure spacing</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Layout Spacing & Density</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">UI Spacing Density</span>
                        <span className="text-[9px] text-[#7B3FA0]">Compact reduces table padding. Spacious allows breathing room.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['compact', 'balanced', 'spacious'].map((d) => (
                          <button
                            key={d}
                            onClick={() => updateSetting("dashboardDensity", d)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.dashboardDensity === d ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>

                {/* 5. DATA INTELLIGENCE & COMMERCE SYSTEMS */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Systems Config</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Data Systems & Payout Currency</h3>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Currency Display Selector */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Ecosystem Currency</span>
                        <span className="text-[9px] text-[#7B3FA0]">Overrides currency signs across all dashboards.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['USD', 'EUR', 'INR'].map((cur) => (
                          <button
                            key={cur}
                            onClick={() => updateSetting("currencyDisplay", cur)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.currencyDisplay === cur ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-stone-200/40" />

                    {/* Realtime update simulations toggle */}
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Real-time Telemetry Updates</span>
                        <span className="text-[9px] text-[#7B3FA0]">Simulates active websocket updates on metrics cards.</span>
                      </div>
                      <button
                        onClick={() => updateSetting("realtimeUpdates", !settings.realtimeUpdates)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                          settings.realtimeUpdates ? 'bg-[#B886D0]' : 'bg-stone-200'
                        }`}
                      >
                        <motion.div 
                          className="w-5 h-5 rounded-full bg-white shadow-sm"
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={{ marginLeft: settings.realtimeUpdates ? '20px' : '0px' }}
                        />
                      </button>
                    </div>

                    <div className="h-px bg-stone-200/40" />

                    {/* AI insight levels */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">AI Insights Verbosity</span>
                        <span className="text-[9px] text-[#7B3FA0]">Controls text diagnosis amounts.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['low', 'balanced', 'aggressive'].map((ai) => (
                          <button
                            key={ai}
                            onClick={() => updateSetting("aiInsightsLevel", ai)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.aiInsightsLevel === ai ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {ai}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-stone-200/40" />

                    {/* Review Visibility */}
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#2D004D]">Review Exposure</span>
                        <span className="text-[9px] text-[#7B3FA0]">Filters visible testimonials inside reviews portal.</span>
                      </div>
                      <div className="bg-white p-1 rounded-xl border border-[#F5E9DD]/60 flex gap-1 self-start sm:self-auto">
                        {['all', 'verified-only', 'high-rating-only'].map((rev) => (
                          <button
                            key={rev}
                            onClick={() => updateSetting("reviewVisibility", rev)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition-colors ${
                              settings.reviewVisibility === rev ? 'bg-[#2D004D] text-white shadow-sm' : 'text-[#7B3FA0] hover:text-[#2D004D]'
                            }`}
                          >
                            {rev.split('-')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>

                </div>

                {/* 6. PLATFORM FEATURE CONTROLS — Firestore-backed, admin-only */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Platform Control</h4>
                      <h3 className="text-base font-serif font-black text-[#2D004D]">Marketplace Feature Flags</h3>
                      <p className="text-[9px] text-[#7B3FA0] mt-1">Changes apply platform-wide in real time. All toggles are enforced at the service layer — not just the UI.</p>
                    </div>
                    <Link
                      to="/admin/platform"
                      className="px-4 py-2.5 bg-gradient-to-r from-[#FF8597] to-[#7B3FA0] text-white text-[9px] font-extrabold uppercase tracking-widest rounded-xl shadow-sm hover:shadow transition-all text-center flex-shrink-0 cursor-pointer"
                      style={{ cursor: 'pointer' }}
                    >
                      Global Pause
                    </Link>
                  </div>

                  {platformLoading ? (
                    <div className="flex items-center gap-2 text-[10px] text-[#7B3FA0]">
                      <span className="w-3 h-3 border-2 border-[#B886D0] border-t-transparent rounded-full animate-spin inline-block" />
                      Loading platform settings...
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">

                      {[
                        { key: 'vendorSellingEnabled',       label: 'Vendor Selling',         desc: 'Allow vendors to upload, publish and sell products.' },
                        { key: 'vendorRegistrationEnabled',  label: 'Vendor Registration',    desc: 'Accept new vendor applications from users.' },
                        { key: 'affiliateProgramEnabled',    label: 'Affiliate Program',      desc: 'Enable the global affiliate system and referral commission earnings.' },
                        { key: 'marketplaceMaintenanceMode', label: 'Maintenance Mode',       desc: 'Block purchases, reviews and reports. Browsing still allowed.', danger: true },
                        { key: 'reviewSystemEnabled',        label: 'Review System',          desc: 'Allow customers to submit new product reviews.' },
                        { key: 'reportsSystemEnabled',       label: 'Reports System',         desc: 'Allow customers to report products to admins.' },
                        { key: 'notificationsEnabled',       label: 'Notifications',          desc: 'Enable notification creation and real-time delivery.' },
                        { key: 'analyticsEnabled',           label: 'Analytics (Non-Admin)',  desc: 'Show analytics to vendors and staff. Admins always have access.' },
                      ].map((item, i, arr) => (
                        <React.Fragment key={item.key}>
                          <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#2D004D] flex items-center gap-2">
                                {item.label}
                                {item.danger && platformSettings[item.key] && (
                                  <span className="text-[8px] font-extrabold text-[#FF8597] bg-[#FF8597]/10 px-1.5 py-0.5 rounded uppercase tracking-wider">ACTIVE</span>
                                )}
                              </span>
                              <span className="text-[9px] text-[#7B3FA0]">{item.desc}</span>
                            </div>
                            <button
                              onClick={() => handlePlatformToggle(item.key)}
                              disabled={togglingKey === item.key}
                              className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 flex-shrink-0 ml-4 ${
                                platformSettings[item.key]
                                  ? (item.danger ? 'bg-[#FF8597]' : 'bg-[#B886D0]')
                                  : 'bg-stone-200'
                              } ${togglingKey === item.key ? 'opacity-60' : ''}`}
                            >
                              <motion.div
                                className="w-5 h-5 rounded-full bg-white shadow-sm"
                                layout
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                style={{ marginLeft: platformSettings[item.key] ? '20px' : '0px' }}
                              />
                            </button>
                          </div>
                          {i < arr.length - 1 && <div className="h-px bg-stone-200/40" />}
                        </React.Fragment>
                      ))}

                    </div>
                  )}
                </div>

              </div>

              {/* Live Preview Panel (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                
                {/* 8. PREVIEW IMPACT PANEL */}
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5 sticky top-24">
                  <div>
                    <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Real-time Simulation</h4>
                    <h3 className="text-base font-serif font-black text-[#2D004D]">Live Ecosystem Preview</h3>
                  </div>

                  <div className="flex flex-col gap-5">
                    
                    {/* Preview 1: Dashboard Card */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-black uppercase text-[#7B3FA0] tracking-wider">1. Dashboard metric card</span>
                      
                      <div className={`glass-surface rounded-2xl flex flex-col border border-white/60 bg-white/30 backdrop-blur-md ${densityPadding} ${glowStyle} ${transitionTime}`}>
                        <div className="flex justify-between items-center text-[9px] text-[#7B3FA0] font-bold uppercase tracking-wider">
                          <span>Total Revenue</span>
                          <span className="text-[8px] font-black text-emerald-400">+12%</span>
                        </div>
                        <h4 className="text-2xl font-serif font-black text-[#2D004D] leading-none">
                          {currencySymbol}1,28,450
                        </h4>
                      </div>
                    </div>

                    {/* Preview 2: Orders Row */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-black uppercase text-[#7B3FA0] tracking-wider">2. Order transaction row</span>
                      
                      <div className={`glass-surface rounded-xl flex items-center justify-between border border-white/60 bg-white/30 backdrop-blur-md ${densityPadding} ${glowStyle} ${transitionTime}`}>
                        <div className="flex flex-col">
                          <span className="text-xs font-serif font-black text-[#2D004D]">Marcus Vance</span>
                          <span className="text-[9px] text-[#7B3FA0]">Instant Download</span>
                        </div>
                        <span className="text-xs font-black text-[#2D004D]">
                          {currencySymbol}189.00
                        </span>
                      </div>
                    </div>

                    {/* Preview 3: Review testimonial card */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[8px] font-black uppercase text-[#7B3FA0] tracking-wider">3. Customer Review Card</span>
                      
                      <div className={`glass-surface rounded-2xl flex flex-col border border-white/60 bg-white/30 backdrop-blur-md ${densityPadding} ${glowStyle} ${transitionTime}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-bold text-[#2D004D] block">Aarav Mehta</span>
                            <span className="text-[8px] text-[#7B3FA0]">Lumora UI Kit Pro</span>
                          </div>
                          <div className="flex gap-0.5 text-[#D8BFE3]">
                            ★ ★ ★ ★ ★
                          </div>
                        </div>
                        <p className="text-[10px] text-[#7B3FA0] leading-relaxed mt-1 italic">
                          "Extremely polished design system. Worth every single currency unit."
                        </p>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* --- 9. GLOBAL SYNC STATUS BAR --- */}
        <section className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
          <div className="glass-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-white/50 backdrop-blur-md">
            
            <button 
              onClick={handleExportJSON}
              className="p-2 hover:bg-white text-[#7B3FA0] hover:text-[#2D004D] rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
              title="Download Systems config (JSON)"
            >
              <Icon name="Download" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Export Config</span>
            </button>

            <div className="w-px h-6 bg-stone-200" />

            <button 
              onClick={handleRestoreDefaults}
              className="p-2 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-xl transition-colors border-none cursor-pointer flex items-center gap-1.5"
              title="Reset config to factory defaults"
            >
              <Icon name="X" size={13} />
              <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Reset Preferences</span>
            </button>

          </div>
        </section>

      </main>
    </AdminLayout>
  );
}
