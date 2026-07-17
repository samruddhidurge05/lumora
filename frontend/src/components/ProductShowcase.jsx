import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ProductCard from './product/ProductCard';

export default function ProductShowcase() {
  const { products, navigateTo } = useApp();

  // Filter featured products, fallback to first 4 if none are marked featured
  const featuredProducts = products.filter(p => p.featured);
  const displayProducts = featuredProducts.length > 0 ? featuredProducts : products;

  return (
    <section 
      id="products" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <div className="container-wide">
        {/* Section Header */}
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '64px',
            flexWrap: 'wrap',
            gap: '24px'
          }}
        >
          <div>
            <div className="caption-premium" style={{ marginBottom: '12px' }}>Curated Selections</div>
            <h2 className="text-editorial title-medium" style={{ fontWeight: 400, color: 'var(--color-espresso)' }}>Featured Digital Artifacts</h2>
          </div>
          <button 
            onClick={() => navigateTo('marketplace')}
            className="text-sans"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--color-espresso)',
              background: 'none',
              border: 'none',
              borderBottom: '1.5px solid var(--color-espresso)',
              paddingBottom: '4px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'none',
              transition: 'opacity 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Browse All Artifacts
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Product Cards Grid */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '32px'
          }}
        >
          {displayProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

