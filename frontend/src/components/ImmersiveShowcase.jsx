import React, { useEffect, useRef, useState } from 'react';
import { Layers, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

export default function ImmersiveShowcase() {
  const containerRef = useRef(null);
  const [offsets, setOffsets] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      // Calculate normalized mouse positions (-0.5 to 0.5) relative to section
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      setOffsets({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section 
      ref={containerRef}
      className="section-padding flex-center"
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        zIndex: 10
      }}
    >
      {/* Cinematic grid lines in background */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.05,
          backgroundImage: 'linear-gradient(rgba(216,191,227,0.20) 1px, transparent 1px), linear-gradient(90deg, rgba(216,191,227,0.20) 1px, transparent 1px)',
          backgroundSize: '100px 100px',
          backgroundPosition: 'center center',
          pointerEvents: 'none'
        }}
      />

      {/* Layered Glow Sphere in Background */}
      <div 
        className="ambient-glow pulse-ambient" 
        style={{
          background: 'var(--color-peach)',
          width: '500px',
          height: '500px',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate3d(${offsets.x * -80}px, ${offsets.y * -80}px, 0)`,
          opacity: 0.15,
          filter: 'blur(120px)',
          transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      />

      <div 
        className="container-wide"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          height: '500px'
        }}
      >
        {/* Core Depth Element: Central Typography (Lowest depth coefficient) */}
        <div
          style={{
            textAlign: 'center',
            zIndex: 3,
            transform: `translate3d(${offsets.x * 20}px, ${offsets.y * 20}px, 0)`,
            transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
            pointerEvents: 'none'
          }}
        >
          <div className="caption-premium" style={{ marginBottom: '16px' }}>Atmospheric Depth</div>
          <h2 
            className="text-editorial title-large"
            style={{ 
              fontWeight: 400, 
              color: 'var(--color-espresso)',
              maxWidth: '800px',
              margin: '0 auto',
              lineHeight: 1.05
            }}
          >
            An Ethereal Ecosystem <br />
            <span style={{ fontStyle: 'italic', color: 'var(--color-mocha)', fontWeight: 300 }}>
              Formed For Elite Design
            </span>
          </h2>
        </div>

        {/* Layer 1: Left Floating Card (High depth) */}
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            left: '5%',
            top: '10%',
            width: '260px',
            padding: '24px',
            zIndex: 4,
            transform: `translate3d(${offsets.x * -60}px, ${offsets.y * -60}px, 0) rotate(-6deg)`,
            transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
            boxShadow: '0 20px 40px rgba(45,0,77,0.35)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>SYSTEM CHECK</span>
            <Sparkles size={12} style={{ color: 'var(--color-lilac-glow)' }} />
          </div>
          <div className="text-sans" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '4px' }}>
            99.98% Uptime
          </div>
          <div className="text-sans" style={{ fontSize: '0.75rem', color: 'var(--color-mocha)' }}>
            Highly optimized cloud infrastructure, distributing assets worldwide.
          </div>
        </div>

        {/* Layer 2: Right Floating Card (Medium depth) */}
        <div
          className="glass-card"
          style={{
            position: 'absolute',
            right: '8%',
            bottom: '12%',
            width: '280px',
            padding: '24px',
            zIndex: 5,
            transform: `translate3d(${offsets.x * 70}px, ${offsets.y * 70}px, 0) rotate(4deg)`,
            transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
            boxShadow: '0 25px 45px rgba(216,191,227,0.15)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="caption-premium" style={{ fontSize: '0.65rem', color: 'var(--color-mocha)' }}>GROWTH METRICS</span>
            <TrendingUp size={14} style={{ color: 'var(--color-mint)' }} />
          </div>
          <div className="text-sans" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '4px' }}>
            1.8M Downloads
          </div>
          <div className="text-sans" style={{ fontSize: '0.75rem', color: 'var(--color-mocha)' }}>
            Active builders accessing high-performance templates daily.
          </div>
        </div>

        {/* Layer 3: Top Right Tiny Floating Capsule (Very high depth) */}
        <div
          className="glass-card flex-center"
          style={{
            position: 'absolute',
            right: '25%',
            top: '5%',
            padding: '12px 24px',
            zIndex: 6,
            borderRadius: '50px',
            transform: `translate3d(${offsets.x * -90}px, ${offsets.y * -90}px, 0)`,
            transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
            boxShadow: '0 10px 25px rgba(45,0,77,0.30)'
          }}
        >
          <span className="text-sans" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-lilac-glow)' }} />
            Curated Creators Only
          </span>
        </div>

        {/* Layer 4: Bottom Left Small Floating Badge (Very high depth) */}
        <div
          className="glass-card flex-center"
          style={{
            position: 'absolute',
            left: '20%',
            bottom: '8%',
            padding: '12px 24px',
            zIndex: 6,
            borderRadius: '50px',
            transform: `translate3d(${offsets.x * 100}px, ${offsets.y * 100}px, 0)`,
            transition: 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)',
            boxShadow: '0 10px 25px rgba(45,0,77,0.30)'
          }}
        >
          <span className="text-sans" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-mint)' }} />
            Immutable Licenses
          </span>
        </div>
      </div>
    </section>
  );
}
