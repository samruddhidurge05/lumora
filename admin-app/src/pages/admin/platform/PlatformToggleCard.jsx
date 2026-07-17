import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, CheckCircle, RefreshCw } from 'lucide-react';

/**
 * PlatformToggleCard - Control component to toggle platform pause status and customize message.
 */
export default function PlatformToggleCard({ 
  isPlatformPaused, 
  pauseMessage, 
  onToggle, 
  onSaveMessage,
  isToggling,
  isSavingMessage
}) {
  const [localMessage, setLocalMessage] = useState(pauseMessage || '');

  // Keep local input in sync with external DB state shifts
  useEffect(() => {
    setLocalMessage(pauseMessage || '');
  }, [pauseMessage]);

  const handleSave = () => {
    onSaveMessage(localMessage);
  };

  return (
    <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-5">
      <div className="flex justify-between items-start">
        <div className="max-w-[70%]">
          <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase mb-1">Global System Control</h4>
          <h3 className="text-base font-serif font-black text-[#2D004D]">Global Platform Pause</h3>
          <p className="text-[9px] text-[#7B3FA0] mt-1">
            Instantly freeze all marketplace operations. All vendor, affiliate, and marketplace routes will be locked down immediately.
          </p>
        </div>
        
        {/* Toggle Switch */}
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={`w-14 h-8 rounded-full transition-colors relative flex items-center p-1 flex-shrink-0 ml-4 ${
            isPlatformPaused ? 'bg-[#FF8597]' : 'bg-stone-200'
          } ${isToggling ? 'opacity-60' : 'cursor-pointer'}`}
          style={{ cursor: 'pointer', border: 'none', outline: 'none' }}
        >
          <motion.div
            className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center"
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{ marginLeft: isPlatformPaused ? '24px' : '0px' }}
          >
            {isToggling ? (
              <RefreshCw size={10} className="animate-spin text-[#7B3FA0]" />
            ) : isPlatformPaused ? (
              <div className="w-2 h-2 rounded-full bg-[#FF8597]" />
            ) : null}
          </motion.div>
        </button>
      </div>

      <div className="h-px bg-stone-200/40" />

      {/* Real-time status display */}
      <div className="flex items-center gap-3">
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: isPlatformPaused ? 'rgba(255, 133, 151, 0.1)' : 'rgba(34, 197, 94, 0.1)',
          border: `1px solid ${isPlatformPaused ? 'rgba(255, 133, 151, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isPlatformPaused ? '#FF8597' : '#22c55e'
        }}>
          <ShieldAlert size={20} />
        </div>
        <div>
          <span className="text-xs font-bold text-[#2D004D] block">
            Status: {isPlatformPaused ? 'Platform Paused' : 'Platform Active'}
          </span>
          <span className="text-[9px] text-[#7B3FA0]">
            {isPlatformPaused 
              ? 'Marketplace is locked down. Users see the blocked overlay screen.' 
              : 'Marketplace is operating normally. All routes are open.'}
          </span>
        </div>
      </div>

      <div className="h-px bg-stone-200/40" />

      {/* Custom message field */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-[#2D004D]">Custom Pause Message</label>
        <span className="text-[9px] text-[#7B3FA0] -mt-1">
          Specify the message shown on the fullscreen overlay.
        </span>
        <textarea
          value={localMessage}
          onChange={(e) => setLocalMessage(e.target.value)}
          disabled={isSavingMessage}
          placeholder="Lumora is temporarily paused by the platform administrators"
          className="w-full text-xs p-3 rounded-xl border border-stone-200/60 bg-white/50 focus:outline-none focus:ring-1 focus:ring-[#7B3FA0] focus:border-[#7B3FA0] transition-all resize-none h-20"
        />
        
        <div className="flex justify-end mt-1">
          <button
            onClick={handleSave}
            disabled={isSavingMessage || localMessage.trim() === ''}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#7B3FA0] to-[#5A1E7E] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer border-none"
            style={{ cursor: 'pointer' }}
          >
            {isSavingMessage ? (
              <>
                <RefreshCw size={12} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle size={12} /> Save Pause Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
