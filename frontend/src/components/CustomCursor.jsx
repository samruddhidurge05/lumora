import React, { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isHidden, setIsHidden] = useState(true);

  // Position coordinates
  const mouseCoords = useRef({ x: 0, y: 0 });
  const ringCoords = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Hide default cursor on desktop
    const handleMouseMove = (e) => {
      mouseCoords.current.x = e.clientX;
      mouseCoords.current.y = e.clientY;
      setIsHidden(false);

      // Check if hovering over interactive elements
      const target = e.target;
      if (target) {
        const isInteractive = target.closest('a, button, input, textarea, select, [role="button"], .glass-card, .clickable');
        setIsHovered(!!isInteractive);
      }
    };

    const handleMouseLeave = () => {
      setIsHidden(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Lerp loop for smooth elastic movement
    let animationFrameId;
    const updatePosition = () => {
      // Lerp calculations: Ring coordinates approach mouse coordinates
      // Ring X/Y moves 10% of the distance each frame, creating lag/elasticity
      ringCoords.current.x += (mouseCoords.current.x - ringCoords.current.x) * 0.12;
      ringCoords.current.y += (mouseCoords.current.y - ringCoords.current.y) * 0.12;

      // Update actual DOM elements directly for maximum performance (no React state lag)
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseCoords.current.x}px, ${mouseCoords.current.y}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringCoords.current.x}px, ${ringCoords.current.y}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (isHidden) return null;

  return (
    <>
      {/* 1. Core Dot (Exact Position) */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: -4,
          left: -4,
          width: '8px',
          height: '8px',
          backgroundColor: '#B886D0', // Soft Purple
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 999999,
          willChange: 'transform',
          transition: 'width 0.2s, height 0.2s, background-color 0.2s'
        }}
      />

      {/* 2. Magnetic Glow Ring (Lerped Follower) */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: -24,
          left: -24,
          width: '48px',
          height: '48px',
          border: '1.5px solid rgba(139, 107, 91, 0.4)', // Mocha Brown translucent
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 999998,
          willChange: 'transform',
          transformOrigin: 'center center',
          background: isHovered 
            ? 'radial-gradient(circle, rgba(220,198,255,0.2) 0%, rgba(255,214,186,0.1) 100%)' 
            : 'transparent',
          boxShadow: isHovered 
            ? '0 0 20px rgba(184, 134, 208, 0.45)' 
            : 'none',
          borderColor: isHovered ? '#D8BFE3' : 'rgba(184, 134, 208, 0.35)',
          transform: `scale(${isHovered ? 1.5 : 1})`,
          transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s, border-color 0.3s, box-shadow 0.3s'
        }}
      />
    </>
  );
}
