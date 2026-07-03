/**
 * NavigationProgress.jsx
 * Thin top progress bar — fires on every view change.
 * Feels like Linear / GitHub / YouTube's red bar.
 */
import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

export default function NavigationProgress() {
  const { currentView } = useApp();
  const barRef   = useRef(null);
  const timerRef = useRef(null);
  const prevView = useRef(currentView);

  useEffect(() => {
    if (prevView.current === currentView) return;
    prevView.current = currentView;

    const bar = barRef.current;
    if (!bar) return;

    // Clear any in-progress animation
    clearTimeout(timerRef.current);

    // Reset & start
    bar.style.transition = 'none';
    bar.style.width = '0%';
    bar.style.opacity = '1';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bar.style.transition = 'width 200ms cubic-bezier(0.16,1,0.3,1)';
        bar.style.width = '85%';

        // Complete after 200ms
        timerRef.current = setTimeout(() => {
          bar.style.transition = 'width 120ms ease, opacity 200ms ease 80ms';
          bar.style.width = '100%';

          timerRef.current = setTimeout(() => {
            bar.style.opacity = '0';
            timerRef.current = setTimeout(() => {
              bar.style.transition = 'none';
              bar.style.width = '0%';
            }, 220);
          }, 120);
        }, 200);
      });
    });

    return () => clearTimeout(timerRef.current);
  }, [currentView]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100%',
      height: '2px',
      zIndex: 999999,
      pointerEvents: 'none',
    }}>
      <div
        ref={barRef}
        style={{
          height: '100%',
          width: '0%',
          opacity: 0,
          background: 'linear-gradient(90deg, #7B3FA0, #B886D0, #7B3FA0)',
          backgroundSize: '200% 100%',
          boxShadow: '0 0 8px rgba(123,63,160,0.60)',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}
