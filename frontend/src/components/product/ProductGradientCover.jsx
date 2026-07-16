import React from 'react';

const gradients = {
  'UI Kits':             'linear-gradient(135deg, #7B3FA0 0%, #C084FC 100%)',
  'Mobile App Designs':  'linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)',
  'React Templates':     'linear-gradient(135deg, #0F766E 0%, #2DD4BF 100%)',
  'Website Templates':   'linear-gradient(135deg, #0369A1 0%, #38BDF8 100%)',
  'Design Assets':       'linear-gradient(135deg, #B45309 0%, #FBBF24 100%)',
  'E-books':             'linear-gradient(135deg, #047857 0%, #34D399 100%)',
  'Notion Templates':    'linear-gradient(135deg, #4B5563 0%, #9CA3AF 100%)',
  'Social Media Kits':   'linear-gradient(135deg, #BE185D 0%, #F472B6 100%)',
  'AI Tools':            'linear-gradient(135deg, #4338CA 0%, #818CF8 100%)',
  'AI Prompt Packs':     'linear-gradient(135deg, #6D28D9 0%, #A78BFA 100%)',
  'Icons & Illustrations':'linear-gradient(135deg, #7C3AED 0%, #C084FC 100%)',
  'Resume Templates':    'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
  'Business Templates':  'linear-gradient(135deg, #B91C1C 0%, #F87171 100%)',
  'Productivity Tools':  'linear-gradient(135deg, #059669 0%, #10B981 100%)',
  'Graphics & UI':       'linear-gradient(135deg, #BE185D 0%, #7C3AED 100%)',
  'Templates':           'linear-gradient(135deg, #2563EB 0%, #0F766E 100%)',
};

export default function ProductGradientCover({ product }) {
  const gradient = product.gradient || gradients[product.category] || 'linear-gradient(135deg, #7B3FA0 0%, #E8B4C8 100%)';
  
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: gradient,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '24px',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle background circles for depth */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '130px', height: '130px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(10px)' }} />
      <div style={{ position: 'absolute', bottom: '-10%', left: '-10%', width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(8px)' }} />
      
      <span style={{ fontSize: '0.54rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', marginBottom: '8px', zIndex: 1 }}>
        {product.category}
      </span>
      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.25, margin: '0 0 6px 0', textShadow: '0 1.5px 3px rgba(0,0,0,0.15)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', zIndex: 1 }}>
        {product.title}
      </h4>
      <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: 1.35, zIndex: 1 }}>
        {product.short_desc || product.shortDesc || product.description}
      </p>
    </div>
  );
}
