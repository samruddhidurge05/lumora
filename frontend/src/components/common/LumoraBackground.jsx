/**
 * LumoraBackground — rich animated background for the vendor dashboard.
 * White base with animated purple/lavender orbs — matches global theme.
 */
import React from 'react';

export default function LumoraBackground() {
  return (
    <>
      <div aria-hidden="true" style={{
        position: 'fixed', inset: 0, zIndex: -1,
        pointerEvents: 'none', overflow: 'hidden',
        background: '#ffffff',
      }}>
        {/* Purple orb — top right */}
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(100px)',
          width: '680px', height: '680px', top: '-160px', right: '-120px',
          background: 'radial-gradient(circle, rgba(167,105,220,0.32) 0%, rgba(140,80,200,0.15) 45%, transparent 70%)',
          animation: 'lbOrb1 22s ease-in-out infinite',
        }} />

        {/* Deep purple orb — bottom left */}
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(90px)',
          width: '580px', height: '580px', bottom: '-140px', left: '-100px',
          background: 'radial-gradient(circle, rgba(123,63,160,0.28) 0%, rgba(100,40,140,0.14) 45%, transparent 70%)',
          animation: 'lbOrb2 28s ease-in-out infinite',
        }} />

        {/* Mid orb — center */}
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(85px)',
          width: '440px', height: '440px', top: '38%', left: '38%',
          background: 'radial-gradient(circle, rgba(196,148,230,0.22) 0%, transparent 68%)',
          animation: 'lbOrb3 18s ease-in-out infinite',
          transform: 'translate(-50%, -50%)',
        }} />

        {/* Soft lavender orb — top left */}
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(80px)',
          width: '360px', height: '360px', top: '6%', left: '8%',
          background: 'radial-gradient(circle, rgba(216,191,227,0.26) 0%, transparent 68%)',
          animation: 'lbOrb1 32s ease-in-out infinite reverse',
        }} />

        {/* Bottom right accent */}
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(110px)',
          width: '480px', height: '480px', bottom: '5%', right: '8%',
          background: 'radial-gradient(circle, rgba(184,134,208,0.20) 0%, transparent 68%)',
          animation: 'lbOrb2 24s ease-in-out infinite alternate-reverse',
        }} />

        {/* Fine grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.025, pointerEvents: 'none',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }} />
      </div>

      <style>{`
        @keyframes lbOrb1 {
          0%   { transform: translate(0, 0) scale(1);      }
          33%  { transform: translate(-5%, 8%)  scale(1.07); }
          66%  { transform: translate( 4%,-5%)  scale(0.95); }
          100% { transform: translate(0, 0) scale(1);      }
        }
        @keyframes lbOrb2 {
          0%   { transform: translate(0, 0) scale(1);      }
          40%  { transform: translate( 6%,-7%)  scale(1.09); }
          80%  { transform: translate(-4%, 5%)  scale(0.94); }
          100% { transform: translate(0, 0) scale(1);      }
        }
        @keyframes lbOrb3 {
          0%,100% { transform: translate(-50%,-50%) scale(1);    }
          50%     { transform: translate(-50%,-50%) scale(1.10); }
        }
      `}</style>
    </>
  );
}
