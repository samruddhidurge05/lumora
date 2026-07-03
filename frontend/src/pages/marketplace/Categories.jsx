import React, { useMemo } from 'react';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';

const CAT_META = [
  { name: 'Website Templates',  emoji: '🌐', color: 'rgba(123,63,160,0.08)' },
  { name: 'Mobile App Designs', emoji: '📱', color: 'rgba(59,130,246,0.08)' },
  { name: 'AI Tools',           emoji: '🤖', color: 'rgba(16,185,129,0.08)' },
  { name: 'Design Assets',      emoji: '🎨', color: 'rgba(245,158,11,0.08)' },
  { name: 'E-books',            emoji: '📚', color: 'rgba(239,68,68,0.08)' },
  { name: 'Notion Templates',   emoji: '📋', color: 'rgba(99,102,241,0.08)' },
  { name: 'Productivity Tools', emoji: '⚡', color: 'rgba(20,184,166,0.08)' },
  { name: 'Social Media Kits',  emoji: '📸', color: 'rgba(236,72,153,0.08)' },
  { name: 'UI Kits',            emoji: '🎯', color: 'rgba(168,85,247,0.08)' },
  { name: 'React Templates',    emoji: '⚛️', color: 'rgba(6,182,212,0.08)' },
  { name: 'AI Prompt Packs',    emoji: '💬', color: 'rgba(251,191,36,0.08)' },
  { name: 'Icons & Illustrations', emoji: '✏️', color: 'rgba(34,197,94,0.08)' },
  { name: 'Resume Templates',   emoji: '📄', color: 'rgba(239,68,68,0.08)' },
  { name: 'Business Templates', emoji: '💼', color: 'rgba(99,102,241,0.08)' },
  { name: 'Productivity Systems', emoji: '🔧', color: 'rgba(20,184,166,0.08)' },
  { name: 'Figma Resources',    emoji: '🖌️', color: 'rgba(236,72,153,0.08)' },
];

export default function Categories() {
  const { setActiveCategory, navigateTo, products } = useApp();

  // Build dynamic counts from live products
  const catCounts = useMemo(() => {
    const m = {};
    products.forEach(p => {
      if (p.category) m[p.category] = (m[p.category] || 0) + 1;
    });
    return m;
  }, [products]);

  // Build the full list: known cats first (in order), then any extra cats from products
  const knownNames = new Set(CAT_META.map(c => c.name));
  const extraCats = [...new Set(products.map(p => p.category).filter(Boolean))]
    .filter(c => !knownNames.has(c))
    .map(name => ({ name, emoji: '✦', color: 'rgba(123,63,160,0.06)' }));

  const allCats = [...CAT_META, ...extraCats].filter(c => (catCounts[c.name] || 0) > 0);

  const handleSelect = (cat) => {
    setActiveCategory(cat);
    navigateTo('marketplace');
  };

  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: '100px', padding: '100px clamp(1.5rem,5vw,6rem) 80px', maxWidth: '1280px', margin: '0 auto' }}>
        <span className="caption-premium" style={{ color: '#7B3FA0' }}>Browse by Category</span>
        <h1 className="text-editorial" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px', marginBottom: '8px' }}>All Categories</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '48px' }}>
          {allCats.length} categories · {products.length} products
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: '20px' }}>
          {allCats.map(cat => (
            <button key={cat.name} onClick={() => handleSelect(cat.name)}
              className="glass-card"
              style={{ padding: '32px 24px', textAlign: 'left', background: cat.color, border: '1px solid rgba(196,181,253,0.22)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'transform 0.2s, box-shadow 0.2s', borderRadius: '20px' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(45,0,96,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{cat.emoji}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-espresso)', marginBottom: '6px' }}>{cat.name}</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {catCounts[cat.name] || 0} product{(catCounts[cat.name] || 0) !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
