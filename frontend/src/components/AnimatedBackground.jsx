/**
 * AnimatedBackground — white base with animated purple orbs
 * z-index: -2 → sits under ThreeDBackground (-1) and all UI
 */
import React from 'react';

export default function AnimatedBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -2,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Warm cream base */}
        <div style={{ position: 'absolute', inset: 0, background: '#FAF6F0' }} />

        {/* Premium noise/grain overlay for speckled paper look */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
            opacity: 0.9,
            pointerEvents: 'none',
            mixBlendMode: 'multiply',
          }}
        />

        {/* Purple animated orbs */}
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(110px)', width:'700px', height:'700px', top:'-15%', right:'-8%',  background:'radial-gradient(circle, rgba(167,105,220,0.28) 0%, transparent 68%)', animation:'abBlob1 22s ease-in-out infinite alternate' }} />
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(100px)', width:'580px', height:'580px', bottom:'-10%', left:'-6%', background:'radial-gradient(circle, rgba(139,63,160,0.22) 0%, transparent 68%)', animation:'abBlob2 28s ease-in-out infinite alternate' }} />
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(90px)',  width:'460px', height:'460px', top:'35%', left:'36%',      background:'radial-gradient(circle, rgba(196,148,230,0.20) 0%, transparent 68%)', animation:'abBlob3 20s ease-in-out infinite alternate' }} />
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(80px)',  width:'380px', height:'380px', top:'8%',  left:'15%',      background:'radial-gradient(circle, rgba(180,120,215,0.18) 0%, transparent 68%)', animation:'abBlob4 24s ease-in-out infinite alternate' }} />
        <div style={{ position:'absolute', borderRadius:'50%', filter:'blur(120px)', width:'500px', height:'500px', bottom:'5%', right:'10%',   background:'radial-gradient(circle, rgba(216,191,227,0.22) 0%, transparent 68%)', animation:'abBlob5 18s ease-in-out infinite alternate-reverse' }} />
      </div>

      <style>{`
        @keyframes abBlob1 {
          0%   { transform: translate(0,   0)    scale(1);    }
          50%  { transform: translate(-40px, 55px) scale(1.09); }
          100% { transform: translate(25px, -28px) scale(0.93); }
        }
        @keyframes abBlob2 {
          0%   { transform: translate(0, 0)      scale(1);    }
          50%  { transform: translate(50px,-42px) scale(1.07); }
          100% { transform: translate(-22px,50px) scale(0.95); }
        }
        @keyframes abBlob3 {
          0%   { transform: translate(0, 0)       scale(1);    }
          50%  { transform: translate(-30px,-48px) scale(1.11); }
          100% { transform: translate(40px, 20px)  scale(0.91); }
        }
        @keyframes abBlob4 {
          0%   { transform: translate(0, 0)      scale(1);    }
          60%  { transform: translate(30px, 40px) scale(1.06); }
          100% { transform: translate(-24px,-20px) scale(0.96); }
        }
        @keyframes abBlob5 {
          0%   { transform: translate(0, 0)       scale(1);    }
          50%  { transform: translate(-35px,-30px) scale(1.08); }
          100% { transform: translate(20px,  45px) scale(0.94); }
        }
      `}</style>
    </>
  );
}
