import React from 'react';
import { Layers, Monitor, BookOpen, Cpu, Image, Layout } from 'lucide-react';
import { useApp } from '../context/AppContext';

const popularCategories = [
  {
    name: "Website Templates",
    icon: <Monitor size={24} />,
    glowColor: "rgba(221,214,254,0.45)",
    gradient: "linear-gradient(135deg, rgba(221,214,254,0.12) 0%, rgba(196,181,253,0.06) 100%)",
    description: "Production-ready website mockups & landing pages."
  },
  {
    name: "UI Kits",
    icon: <Layers size={24} />,
    glowColor: "rgba(196,181,253,0.40)",
    gradient: "linear-gradient(135deg, rgba(196,181,253,0.12) 0%, rgba(167,139,250,0.06) 100%)",
    description: "Premium Figma libraries & user interface screens."
  },
  {
    name: "React Templates",
    icon: <Layout size={24} />,
    glowColor: "rgba(196,181,253,0.35)",
    gradient: "linear-gradient(135deg, rgba(196,181,253,0.10) 0%, rgba(167,139,250,0.05) 100%)",
    description: "Advanced React, Vite, and Next.js templates."
  },
  {
    name: "AI Tools",
    icon: <Cpu size={24} />,
    glowColor: "rgba(123,63,160,0.25)",
    gradient: "linear-gradient(135deg, rgba(123,63,160,0.10) 0%, rgba(90,30,126,0.05) 100%)",
    description: "Futuristic AI code helpers & automation node scripts."
  },
  {
    name: "Notion Templates",
    icon: <BookOpen size={24} />,
    glowColor: "rgba(167,139,250,0.30)",
    gradient: "linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(123,63,160,0.05) 100%)",
    description: "Task trackers, CRM systems, and planners."
  },
  {
    name: "Design Assets",
    icon: <Image size={24} />,
    glowColor: "rgba(221,214,254,0.40)",
    gradient: "linear-gradient(135deg, rgba(221,214,254,0.12) 0%, rgba(196,181,253,0.06) 100%)",
    description: "Luxury logo marks, 3D assets, vector packages."
  }
];

export default function TrendingCategories() {
  const { products, setActiveCategory, navigateTo } = useApp();

  // Dynamic asset counts calculation
  const categoryCounts = products.reduce((acc, p) => {
    if (p.category) {
      acc[p.category] = (acc[p.category] || 0) + 1;
    }
    return acc;
  }, {});
  
  const handleMouseMove = (e, glowColor) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Soft 3D rotation
    const rx = ((y / rect.height) - 0.5) * 10;
    const ry = ((x / rect.width) - 0.5) * -10;
    card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;

    const glow = card.querySelector('.cat-glow');
    if (glow) {
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
      glow.style.opacity = '1';
      glow.style.background = `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`;
    }
  };

  const handleMouseLeave = (e) => {
    const card = e.currentTarget;
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    
    const glow = card.querySelector('.cat-glow');
    if (glow) {
      glow.style.opacity = '0';
    }
  };

  const handleCategoryClick = (catName) => {
    setActiveCategory(catName);
    navigateTo('marketplace');
  };

  return (
    <section 
      id="categories" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10 }}
    >
      {/* Decorative backdrop glow for category section */}
      <div 
        className="ambient-glow pulse-ambient" 
        style={{
          background: 'var(--purple-200)',
          width: '500px',
          height: '500px',
          right: '10%',
          top: '20%',
          opacity: 0.15,
          filter: 'blur(100px)'
        }}
      />

      <div className="container-wide">
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '72px' }}>
          <div className="caption-premium" style={{ marginBottom: '12px' }}>Taxonomy of Design</div>
          <h2 className="text-editorial title-medium" style={{ fontWeight: 400, color: 'var(--color-espresso)' }}>Trending Architectures</h2>
        </div>

        {/* Categories Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px'
          }}
        >
          {popularCategories.map((cat, i) => {
            const count = categoryCounts[cat.name] || 0;
            return (
              <div
                key={i}
                className="glass-card clickable"
                onMouseMove={(e) => handleMouseMove(e, cat.glowColor)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleCategoryClick(cat.name)}
                style={{
                  padding: '32px',
                  height: '240px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: cat.gradient,
                  willChange: 'transform, box-shadow',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
              >
                {/* Radial custom glow spot */}
                <div 
                  className="cat-glow"
                  style={{
                    position: 'absolute',
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    opacity: 0,
                    transition: 'opacity 0.4s',
                    zIndex: 0
                  }}
                />

                {/* Icon & Count */}
                <div 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    zIndex: 1
                  }}
                >
                  <div 
                    style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      color: 'var(--color-espresso)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 20px rgba(45,0,77,0.30)'
                    }}
                  >
                    {cat.icon}
                  </div>
                  <span 
                    className="text-sans"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--color-mocha)',
                      letterSpacing: '0.05em',
                      padding: '4px 12px',
                      borderRadius: '30px',
                      background: 'rgba(255, 255, 255, 0.4)',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}
                  >
                    {count} {count === 1 ? 'Asset' : 'Assets'}
                  </span>
                </div>

                {/* Title & Description */}
                <div style={{ zIndex: 1, marginTop: '24px' }}>
                  <h3 
                    className="text-editorial"
                    style={{ 
                      fontSize: '1.6rem', 
                      fontWeight: 500, 
                      color: 'var(--color-espresso)',
                      marginBottom: '8px'
                    }}
                  >
                    {cat.name}
                  </h3>
                  <p 
                    className="text-sans"
                    style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--color-mocha)', 
                      lineHeight: 1.4,
                      fontWeight: 500
                    }}
                  >
                    {cat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
