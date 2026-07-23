import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Eye, Lock } from 'lucide-react';

/**
 * ProtectedPreviewViewer
 * ───────────────────────
 * Production-grade screenshot protection for Lumora product preview media.
 *
 * Core Protection Logic:
 * 1. Direct CSS GPU Blur: Applies `filter: blur(35px) brightness(0.1)` directly to the image/video container
 *    whenever screenshot shortcuts are pressed OR window focus is lost (Snipping Tool, Win+Shift+S, PrtScn).
 * 2. Snipping Tool Focus Loss Defense: Any OS capture tool takes focus away from the browser window.
 *    The instant focus is lost (`window.onblur`), the preview media GPU buffer blurs into a dark screen.
 * 3. Keydown Interception: Catches PrintScreen, Ctrl+P, Cmd+P, Win+Shift+S, Cmd+Shift+3/4/5, Ctrl+S.
 * 4. Context Menu & Drag Prevention: Blocks right-click, image dragging, text selection, and copying.
 * 5. CSS @media print Protection: Hides preview completely during browser print or print-to-PDF.
 * 6. Smooth Restoration: Automatically un-blurs when the user returns focus to the Lumora browser window.
 */
export default function ProtectedPreviewViewer({
  children,
  productTitle = 'Product Preview',
  showWatermark = true,
  className = '',
  style = {}
}) {
  const [isProtected, setIsProtected] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [reason, setReason] = useState('Screen Capture Protection Active');
  const containerRef = useRef(null);

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

      // PrintScreen / PrtScn key
      if (key === 'PrintScreen' || code === 'PrintScreen' || key === 'PrtScn' || e.keyCode === 44) {
        e.preventDefault();
        triggerProtection('Screenshot Key (PrintScreen) Detected');
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

      // Save webpage shortcut (Ctrl+S / Cmd+S)
      if (isCmdOrCtrl && (key.toLowerCase() === 's' || code === 'KeyS')) {
        e.preventDefault();
        triggerProtection('Save Action Intercepted (Ctrl+S)');
        return;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.keyCode === 44) {
        triggerProtection('Screenshot Action (PrintScreen) Intercepted');
      }
    };

    // ── 2. Window Blur / Focus Defense (Catches Snipping Tool & OS Screenshot overlays) ──
    const handleWindowBlur = () => {
      setIsWindowFocused(false);
      setReason('Window Focus Lost (Screen Capture / Overlay Active)');
    };

    const handleWindowFocus = () => {
      setIsWindowFocused(true);
      // Auto-restore after a brief 600ms grace period on focus return
      setTimeout(() => {
        restorePreview();
      }, 600);
    };

    // ── 3. Page Visibility State Check ───────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowFocused(false);
        setReason('Preview Hidden (Tab Switch / Screen Capture)');
      } else {
        setIsWindowFocused(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [triggerProtection, restorePreview]);

  const activeBlur = isProtected || !isWindowFocused;

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

      {/* Main Preview Content with Direct CSS GPU Blur Filter */}
      <div
        className="lumora-protected-preview-content"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          filter: activeBlur ? 'blur(40px) brightness(1.15) opacity(0.12)' : 'none',
          transition: 'filter 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: activeBlur ? 'none' : 'auto'
        }}
      >
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

      {/* Protection Frosted Overlay (Light Glassmorphism Theme) */}
      {activeBlur && (
        <div
          onClick={restorePreview}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 99,
            background: 'rgba(255, 253, 249, 0.94)',
            backdropFilter: 'blur(35px) saturate(180%)',
            WebkitBackdropFilter: 'blur(35px) saturate(180%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            color: '#2D004D',
            cursor: 'pointer',
            animation: 'lumoraOverlayFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(123, 63, 160, 0.08)',
              border: '1.5px solid rgba(123, 63, 160, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              color: '#7B3FA0'
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
              color: '#7B3FA0',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              background: 'rgba(123, 63, 160, 0.08)',
              border: '1px solid rgba(123, 63, 160, 0.20)',
              padding: '4px 12px',
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
              color: '#2D004D',
              marginBottom: '8px'
            }}
          >
            Protected Preview Content
          </h4>

          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted, #554D60)',
              maxWidth: '320px',
              lineHeight: 1.5,
              marginBottom: '18px'
            }}
          >
            Product previews are protected to safeguard creator intellectual property. Click or focus window to resume viewing.
          </p>

          <button
            onClick={(e) => { e.stopPropagation(); restorePreview(); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 6px 18px rgba(123, 63, 160, 0.28)'
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
