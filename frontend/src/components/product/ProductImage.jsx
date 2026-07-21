import React, { useState, useEffect } from 'react';
import ProductGradientCover from './ProductGradientCover';

/**
 * Extracts the first valid pCloud public share URL from a product.
 * These are permanent links in the format: https://u.pcloud.link/publink/show?code=...
 */
function extractShareUrl(product) {
  const candidates = [
    ...(Array.isArray(product.preview_images) ? product.preview_images : []),
    ...(Array.isArray(product.image_urls) ? product.image_urls : []),
  ];
  return candidates.find(u => u && typeof u === 'string' && u.includes('u.pcloud.link')) || null;
}

/**
 * Resolve a pCloud share link to a direct download URL via the public API.
 */
async function resolvePCloudLink(shareUrl) {
  const parsed = new URL(shareUrl);
  const code = parsed.searchParams.get('code');
  if (!code) return null;

  const showRes = await fetch(`https://api.pcloud.com/showpublink?code=${code}`);
  const showData = await showRes.json();
  if (showData.result !== 0 || !showData.metadata) return null;

  const metadata = showData.metadata;

  if (metadata.isfolder) {
    const contents = metadata.contents || [];
    const img = contents.find(f => /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!img) return null;
    const dlRes = await fetch(`https://api.pcloud.com/getpublinkdownload?code=${code}&fileid=${img.fileid}`);
    const dlData = await dlRes.json();
    if (dlData.result !== 0 || !dlData.hosts || !dlData.path) return null;
    return `https://${dlData.hosts[0]}${dlData.path}`;
  } else {
    const dlRes = await fetch(`https://api.pcloud.com/getpublinkdownload?code=${code}`);
    const dlData = await dlRes.json();
    if (dlData.result !== 0 || !dlData.hosts || !dlData.path) return null;
    return `https://${dlData.hosts[0]}${dlData.path}`;
  }
}

/**
 * Returns true when a URL is a valid non-expired image URL we can try loading.
 * We exclude:
 *  - empty / nullish
 *  - localhost paths (only exist in development)
 *  - relative paths (e.g. /uploads/...)
 *  - direct pCloud CDN links (p-lux*.pcloud.com) which expire quickly
 */
function isDirectlyLoadable(url) {
  if (!url || typeof url !== 'string') return false;
  if (/p-lux\d*\.pcloud\.com/.test(url)) return false;
  return true;
}

/**
 * Smart image component for products.
 *
 * Priority order:
 *  1. Use product.preview if it looks like a stable, publicly-accessible URL.
 *  2. Resolve the pCloud share link from preview_images/image_urls.
 *  3. Fallback to <ProductGradientCover> (gradient card) on failure or missing images.
 */
export default function ProductImage({ product, isHovered = false, style, className }) {
  const [src, setSrc] = useState(() => {
    return isDirectlyLoadable(product?.preview) ? product.preview : null;
  });
  const [loaded, setLoaded] = useState(false);
  const [resolving, setResolving] = useState(false);
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

    // Try to resolve a pCloud share link
    const shareUrl = extractShareUrl(product);
    if (!shareUrl) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    setResolving(true);
    resolvePCloudLink(shareUrl)
      .then(resolvedUrl => {
        if (cancelled) return;
        if (resolvedUrl) {
          setSrc(resolvedUrl);
          setFailed(false);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => { cancelled = true; };
  }, [product?.id]);

  if (failed || (!displaySrc && !resolving)) {
    return <ProductGradientCover product={product} />;
  }

  if (resolving && !displaySrc) {
    // Show gradient with a subtle shimmer while resolving
    return (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#e8d5f5 0%,#c4b5fd 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '36px', height: '36px', border: '3px solid rgba(123,63,160,0.2)', borderTopColor: '#7B3FA0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
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
