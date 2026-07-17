import React from 'react';
import ProductGrid from '../product/ProductGrid';
import { useApp } from '../../context/AppContext';

export default function FeaturedProducts() {
  const { products } = useApp();
  const seen = new Set();
  const featured = products
    .filter(p => { const k = String(p.id); if (seen.has(k)) return false; seen.add(k); return p.featured; })
    .slice(0, 8);
  return (
    <section style={{ padding: '80px clamp(1.5rem,5vw,6rem)', position: 'relative', zIndex: 10 }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <span className="caption-premium" style={{ color: '#7B3FA0' }}>Editor's Choice</span>
        <h2 className="text-editorial" style={{ fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 400, color: 'var(--color-espresso)', marginTop: '4px', marginBottom: '40px' }}>Featured Products</h2>
        <ProductGrid products={featured} />
      </div>
    </section>
  );
}
