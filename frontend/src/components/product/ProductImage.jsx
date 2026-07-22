import React, { useState, useEffect } from 'react';
import ProductGradientCover from './ProductGradientCover';

/**
 * Returns true when a URL is a valid image URL we can try loading.
 */
function isDirectlyLoadable(url) {
  if (!url || typeof url !== 'string') return false;
  return true;
}

/**
 * Smart image component for products.
 *
 * Priority order:
 *  1. Use product.preview if it looks like a stable, publicly-accessible URL.
 *  2. Fallback to <ProductGradientCover> (gradient card) on failure or missing images.
 */
export default function ProductImage({ product, isHovered = false, style, className }) {
  const [src, setSrc] = useState(() => {
    return isDirectlyLoadable(product?.preview) ? product.preview : null;
  });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Extract all available valid image URLs
  const allImages = React.useMemo(() => {
    const list = [];
    if (isDirectlyLoadable(product?.preview)) list.push(product.preview);
    if (isDirectlyLoadable(product?.thumbnail) && !list.includes(product.thumbnail)) list.push(product.thumbnail);
    if (Array.isArray(product?.preview_images)) {
      product.preview_images.forEach(img => {
        if (isDirectlyLoadable(img) && !list.includes(img)) list.push(img);
      });
    }
    if (Array.isArray(product?.image_urls)) {
      product.image_urls.forEach(img => {
        if (isDirectlyLoadable(img) && !list.includes(img)) list.push(img);
      });
    }
    return list;
  }, [product]);

  // Determine displayed image URL with hover support if multiple images exist
  const displaySrc = React.useMemo(() => {
    if (isHovered && allImages.length > 1) {
      return allImages[1];
    }
    return src || allImages[0] || null;
  }, [isHovered, allImages, src]);

  // Reset smooth loaded state whenever displaySrc changes
  useEffect(() => {
    setLoaded(false);
  }, [displaySrc]);

  useEffect(() => {
    if (!product) { setFailed(true); return; }

    const direct = product.preview || product.thumbnail;

    if (isDirectlyLoadable(direct)) {
      setSrc(direct);
      setFailed(false);
      return;
    }

    setFailed(true);
  }, [product?.id]);

  if (failed || !displaySrc) {
    return <ProductGradientCover product={product} />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: 'rgba(240, 235, 245, 0.4)' }}>
      <img
        src={displaySrc}
        alt={product?.title || ''}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: 'opacity, transform',
          ...style
        }}
        className={className}
      />
    </div>
  );
}
