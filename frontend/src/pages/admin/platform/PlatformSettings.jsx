import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from '../components/AdminLayout';
import PlatformToggleCard from './PlatformToggleCard';
import { enablePlatform, disablePlatform, subscribePlatformStatus, getPlatformStatus } from './platformService';
import { Shield, RefreshCw } from 'lucide-react';

/**
 * PlatformSettings - Admin control panel for global platform pause/maintenance mode.
 */
export default function PlatformSettings() {

  const [isSyncing, setIsSyncing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastSaved, setLastSaved] = useState(() => new Date().toLocaleTimeString());

  // Firestore status state
  const [platformStatus, setPlatformStatus] = useState({
    isPlatformPaused: false,
    pauseMessage: 'Lumora is temporarily paused by the platform administrators'
  });
  const [loading, setLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSavingMessage, setIsSavingMessage] = useState(false);

  // Subscribe to real-time status changes
  useEffect(() => {
    let hasFailed = false;
    const unsub = subscribePlatformStatus(
      (data) => {
        setPlatformStatus(data);
        setLoading(false);
        setLastSaved(new Date().toLocaleTimeString());
      },
      async (err) => {
        unsub(); // Kill listener immediately!
        if (hasFailed) return;
        hasFailed = true;
        console.warn('[PlatformSettings] Firestore subscribe error, falling back to REST:', err.message);
        try {
          const data = await getPlatformStatus();
          setPlatformStatus(data);
        } catch (restErr) {
          console.error('[PlatformSettings] REST fallback failed:', restErr);
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const triggerNotification = (text, type = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Toggle platform state
  const handleToggle = async () => {
    setIsToggling(true);
    const currentlyPaused = platformStatus.isPlatformPaused;
    try {
      if (currentlyPaused) {
        await enablePlatform();
        setPlatformStatus(prev => ({ ...prev, isPlatformPaused: false }));
        triggerNotification("Platform resumed successfully.");
      } else {
        await disablePlatform(platformStatus.pauseMessage);
        setPlatformStatus(prev => ({ ...prev, isPlatformPaused: true }));
        triggerNotification("Platform paused. All client routes are locked.", "warning");
      }
    } catch (err) {
      console.error(err);
      triggerNotification("Operation failed. Try again.", "error");
    } finally {
      setIsToggling(false);
    }
  };

  // Save custom message
  const handleSaveMessage = async (newMessage) => {
    setIsSavingMessage(true);
    try {
      // If the platform is paused, update/disable with the new message
      // If it is active, we can still write it so it is prepared for the next pause
      await disablePlatform(newMessage);
      setPlatformStatus(prev => ({ ...prev, pauseMessage: newMessage }));
      triggerNotification("Pause message updated successfully.");
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to update message.", "error");
    } finally {
      setIsSavingMessage(false);
    }
  };





  return (
    <AdminLayout activePage="platform">

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

        {/* Header Block */}
        <section className="mb-8 sticky top-24 z-30">
          <div className="glass-surface rounded-3xl p-5 border border-white/50 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D8BFE3] to-[#D8BFE3] flex items-center justify-center text-[#2D004D]">
                <Shield size={20} className={isSyncing ? "animate-spin" : ""} />
              </div>
              <div>
                <h1 className="text-xl font-serif font-black text-[#2D004D]">Platform Pause Settings</h1>
                <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Ecosystem Platform Lockdown Console &bull; Realtime
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <span className="text-[9px] font-mono text-[#7B3FA0]">Telemetry: Sync Active</span>
              <div className="h-4 w-px bg-stone-200" />
              <span className="text-[9px] font-mono text-[#7B3FA0]">Last Sync: {lastSaved}</span>
            </div>

          </div>
        </section>

        {/* Content Body */}
        <AnimatePresence mode="wait">
          {loading ? (
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
                  <RefreshCw size={22} className="animate-spin text-[#7B3FA0]" />
                </div>
              </div>
              <h3 className="text-base font-serif font-black text-[#2D004D]">Connecting to Firestore Database</h3>
              <p className="text-[9px] text-[#7B3FA0] mt-1.5 uppercase font-bold tracking-widest animate-pulse">
                Fetching global platform parameters...
              </p>
            </motion.section>
          ) : (
            <motion.div 
              key="settings-grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-7 flex flex-col gap-6">
                <PlatformToggleCard 
                  isPlatformPaused={platformStatus.isPlatformPaused}
                  pauseMessage={platformStatus.pauseMessage}
                  onToggle={handleToggle}
                  onSaveMessage={handleSaveMessage}
                  isToggling={isToggling}
                  isSavingMessage={isSavingMessage}
                />
              </div>

              {/* Side column explaining parameters */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-4">
                  <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Architecture Rules</h4>
                  <h3 className="text-base font-serif font-black text-[#2D004D]">Pause Mode Overview</h3>
                  <div className="text-xs text-[#7B3FA0] flex flex-col gap-3">
                    <p>
                      Global Platform Pause takes full priority over all individual vendor/affiliate suspension states.
                    </p>
                    <p>
                      When paused, all routing is instantly intercepted by the app's root listener. Users are blocked with a fullscreen cover and cannot make API requests or interact with components.
                    </p>
                    <p className="font-bold text-[#FF8597]">
                      Only the admin settings dashboard pages remain accessible so administrators can restore normal platform operations.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </AdminLayout>
  );
}
