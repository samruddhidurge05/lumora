import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products = [] }) {
  if (products.length === 0) return (
    <div className="glass-card" style={{ padding: '60px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)' }}>
      <p style={{ color: 'var(--color-mocha)', fontWeight: 600 }}>No products found.</p>
    </div>
  );
  return (
    <div className="lumora-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '24px' }}>
      {products.map((p, idx) => (
        <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 0.07, 0.35)}s`, animationFillMode: 'both' }}>
          <ProductCard product={p} />
        </div>
      ))}
    </div>
  );
}
