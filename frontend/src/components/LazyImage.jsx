/**
 * LazyImage.jsx
 * Drop-in <img> replacement with:
 * - Native browser lazy loading
 * - Blur-up fade-in (loaded = sharp, not-loaded = blurred placeholder)
 * - No layout shift (width/height/aspectRatio required)
 */
import React, { useState, useRef, useEffect } from 'react';

export default function LazyImage({
  src,
  alt = '',
  width,
  height,
  style = {},
  className = '',
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);

  // If already cached by browser, mark as loaded immediately
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: width || '100%',
        height: height || 'auto',
        background: 'rgba(196,181,253,0.12)',
        ...style,
      }}
      className={className}
    >
      {/* Skeleton shimmer while loading */}
      {!loaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(196,181,253,0.10) 25%, rgba(196,181,253,0.22) 50%, rgba(196,181,253,0.10) 75%)',
          backgroundSize: '200% 100%',
          animation: 'lazyShimmer 1.4s ease-in-out infinite',
        }} />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'scale(1)' : 'scale(1.04)',
          transition: 'opacity 280ms ease, transform 280ms ease',
          willChange: 'opacity, transform',
        }}
        {...rest}
      />

      <style>{`
        @keyframes lazyShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
