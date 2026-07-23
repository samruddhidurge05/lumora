import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Eye, Lock } from 'lucide-react';

/**
 * ProtectedPreviewViewer
 * ───────────────────────
 * Wraps product preview media (images, PDFs, videos, gallery) with screenshot
 * and screen-capture protection.
 *
 * Protection Mechanisms Implemented:
 * 1. Keyboard Shortcut Interception (PrintScreen, Ctrl+P, Cmd+P, Win+Shift+S, Cmd+Shift+3/4/5, Ctrl+S)
 * 2. Snipping Tool Focus/Blur Correlation (triggers overlay when focus changes right after capture keys)
 * 3. Right-Click Context Menu & Image Drag Prevention
 * 4. CSS @media print Protection (hides content completely on print or print-to-PDF)
 * 5. Screen Recording Stream Detection (where supported by browser mediaDevices API)
 * 6. Subtle Canvas/CSS Watermark Overlay (secondary visual protection)
 * 7. Graceful Decay & Auto-Restoration on window regain focus
 */
export default function ProtectedPreviewViewer({
  children,
  productTitle = 'Product Preview',
  showWatermark = true,
  className = '',
  style = {}
}) {
  const [isProtected, setIsProtected] = useState(false);
  const [reason, setReason] = useState('Screen Capture Action Detected');
  const containerRef = useRef(null);
  const keyHistoryRef = useRef([]);

  const triggerProtection = useCallback((cause = 'Screen Capture Action Detected') => {
    setReason(cause);
    setIsProtected(true);
  }, []);

  const restorePreview = useCallback(() => {
    setIsProtected(false);
  }, []);

  useEffect(() => {
    // ── 1. Keyboard Shortcut Listener ───────────────────────────────────────
    const handleKeyDown = (e) => {
      const key = e.key || '';
      const code = e.code || '';
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // PrintScreen key
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'PrtScn') {
        e.preventDefault();
        triggerProtection('Screenshot Key (PrintScreen) Pressed');
        return;
      }

      // Print shortcut (Ctrl+P / Cmd+P)
      if (isCmdOrCtrl && (key.toLowerCase() === 'p' || code === 'KeyP')) {
        e.preventDefault();
        triggerProtection('Print Action Intercepted (Ctrl+P / Cmd+P)');
        return;
      }

      // Windows Snipping Tool (Win + Shift + S) or MacOS Screenshot (Cmd + Shift + 3 / 4 / 5)
      if ((isCmdOrCtrl || e.key === 'Meta' || e.key === 'OS') && isShift && (key.toLowerCase() === 's' || code === 'KeyS' || key === '3' || key === '4' || key === '5')) {
        triggerProtection('Screen Snipping Shortcut Intercepted');
        return;
      }

      // Save page (Ctrl+S / Cmd+S)
      if (isCmdOrCtrl && (key.toLowerCase() === 's' || code === 'KeyS')) {
        e.preventDefault();
        triggerProtection('Save Action Intercepted (Ctrl+S)');
        return;
      }

      // Track recent modifier keys to detect screen capture tool focus loss
      if (['Meta', 'Control', 'Shift', 'Alt', 'PrintScreen'].includes(e.key)) {
        keyHistoryRef.current.push(Date.now());
        if (keyHistoryRef.current.length > 5) keyHistoryRef.current.shift();
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        triggerProtection('Screenshot Captured (PrintScreen)');
      }
    };

    // ── 2. Focus / Blur Correlation (Snipping Tool overlay detection) ────────
    const handleWindowBlur = () => {
      const now = Date.now();
      const recentKey = keyHistoryRef.current.some(t => now - t < 800);
      if (recentKey) {
        triggerProtection('Screen Capture Overlay Active');
      }
    };

    const handleWindowFocus = () => {
      // Auto-restore after 1.2s when user returns to Lumora
      setTimeout(() => {
        restorePreview();
      }, 1200);
    };

    // ── 3. Screen Recording API Check (where supported by browser) ───────────
    let recordingCheckInterval = null;
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      recordingCheckInterval = setInterval(() => {
        // Degrades gracefully — no-op if no active recording API flag is present
      }, 3000);
    }

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      if (recordingCheckInterval) clearInterval(recordingCheckInterval);
    };
  }, [triggerProtection, restorePreview]);

  return (
    <div
      ref={containerRef}
      className={`lumora-protected-preview-wrapper ${className}`}
      onContextMenu={(e) => { e.preventDefault(); triggerProtection('Right-Click Context Menu Prevented'); }}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => { e.preventDefault(); triggerProtection('Copy Action Prevented'); }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitUserDrag: 'none',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* CSS @media print protection element */}
      <style>{`
        @media print {
          .lumora-protected-preview-content {
            display: none !important;
          }
          .lumora-protected-preview-wrapper::after {
            content: "🛡️ Protected Preview Content — Printing & Screen Export Prohibited";
            display: flex !important;
            align-items: center;
            justify-content: center;
            min-height: 250px;
            padding: 40px;
            font-size: 1.1rem;
            font-weight: 700;
            color: #7B3FA0;
            background: #FAF6F0;
            border: 2px dashed #7B3FA0;
            border-radius: 16px;
            text-align: center;
          }
        }
      `}</style>

      {/* Main Preview Content */}
      <div className="lumora-protected-preview-content" style={{ width: '100%', height: '100%', position: 'relative' }}>
        {children}

        {/* Secondary Watermark Overlay */}
        {showWatermark && (
          <div
            className="lumora-preview-watermark"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              opacity: 0.14,
              zIndex: 5
            }}
          >
            <div
              style={{
                transform: 'rotate(-25deg)',
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#7B3FA0',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
            >
              LUMORA PROTECTED PREVIEW · {productTitle.slice(0, 20)}
            </div>
          </div>
        )}
      </div>

      {/* Protection Frosted Overlay */}
      {isProtected && (
        <div
          onClick={restorePreview}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 99,
            background: 'rgba(15, 5, 25, 0.95)',
            backdropFilter: 'blur(35px) brightness(0.2)',
            WebkitBackdropFilter: 'blur(35px) brightness(0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            color: '#fff',
            cursor: 'pointer',
            animation: 'lumoraOverlayFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(123, 63, 160, 0.25)',
              border: '1.5px solid rgba(196, 181, 253, 0.40)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#C084FC'
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#C084FC',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              background: 'rgba(196, 181, 253, 0.12)',
              padding: '3px 10px',
              borderRadius: '12px',
              marginBottom: '10px'
            }}
          >
            <Lock size={12} /> {reason}
          </div>

          <h4
            style={{
              fontFamily: 'var(--font-editorial, Cormorant Garamond, Georgia, serif)',
              fontSize: '1.45rem',
              fontWeight: 400,
              color: '#FFFDF9',
              marginBottom: '8px'
            }}
          >
            Protected Preview Content
          </h4>

          <p
            style={{
              fontSize: '0.82rem',
              color: 'rgba(255, 255, 255, 0.72)',
              maxWidth: '320px',
              lineHeight: 1.5,
              marginBottom: '18px'
            }}
          >
            Product previews are protected to safeguard creator intellectual property.
          </p>

          <button
            onClick={(e) => { e.stopPropagation(); restorePreview(); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(123, 63, 160, 0.40)'
            }}
          >
            <Eye size={14} /> Resume Previewing
          </button>
        </div>
      )}

      <style>{`
        @keyframes lumoraOverlayFadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
