import { useState, useEffect } from 'react';

/**
 * Extracts a public pCloud share link from the product's preview_images or image_urls.
 */
function extractPCloudShareUrl(product) {
  if (!product) return null;
  const urls = [];
  if (Array.isArray(product.preview_images)) urls.push(...product.preview_images);
  if (Array.isArray(product.image_urls)) urls.push(...product.image_urls);
  
  // Also check if preview/thumbnail itself contains u.pcloud.link
  if (typeof product.preview === 'string') urls.push(product.preview);
  if (typeof product.thumbnail === 'string') urls.push(product.thumbnail);

  return urls.find(u => u && typeof u === 'string' && u.includes('u.pcloud.link')) || null;
}

export function useResolvedProductMedia(product) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!product) return;

    // Check if the product already has a valid direct image URL
    // (i.e. not an expired p-lux.pcloud.com link, not localhost, and not empty)
    const directUrl = product.preview || product.thumbnail;
    const isPCloudDirectUrl = directUrl && (directUrl.includes('pcloud.com') && !directUrl.includes('u.pcloud.link'));
    const isLocalhost = directUrl && (directUrl.includes('localhost') || directUrl.startsWith('/'));

    if (directUrl && !isPCloudDirectUrl && !isLocalhost) {
      setResolvedUrl(directUrl);
      setLoading(false);
      setFailed(false);
      return;
    }

    const shareUrl = extractPCloudShareUrl(product);
    if (!shareUrl) {
      // No pCloud share URL to resolve, and direct URL is expired/local -> fallback to failure/gradient
      setFailed(true);
      return;
    }

    let isMounted = true;
    async function resolve() {
      try {
        setLoading(true);
        const parsed = new URL(shareUrl);
        const code = parsed.searchParams.get('code');
        if (!code) {
          if (isMounted) setFailed(true);
          return;
        }

        // Call pCloud API to get the download info
        const showRes = await fetch(`https://api.pcloud.com/showpublink?code=${code}`);
        const showData = await showRes.json();
        if (showData.result === 0 && showData.metadata && isMounted) {
          const metadata = showData.metadata;
          if (metadata.isfolder) {
            const contents = metadata.contents || [];
            // Find first image
            const img = contents.find(f => {
              const name = f.name.toLowerCase();
              return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
            });
            if (img) {
              const dlRes = await fetch(`https://api.pcloud.com/getpublinkdownload?code=${code}&fileid=${img.fileid}`);
              const dlData = await dlRes.json();
              if (dlData.result === 0 && dlData.hosts && dlData.path && isMounted) {
                setResolvedUrl(`https://${dlData.hosts[0]}${dlData.path}`);
                setFailed(false);
              } else {
                if (isMounted) setFailed(true);
              }
            } else {
              if (isMounted) setFailed(true);
            }
          } else {
            const dlRes = await fetch(`https://api.pcloud.com/getpublinkdownload?code=${code}`);
            const dlData = await dlRes.json();
            if (dlData.result === 0 && dlData.hosts && dlData.path && isMounted) {
              setResolvedUrl(`https://${dlData.hosts[0]}${dlData.path}`);
              setFailed(false);
            } else {
              if (isMounted) setFailed(true);
            }
          }
        } else {
          if (isMounted) setFailed(true);
        }
      } catch (err) {
        console.warn('[pCloud Client Resolve Failed]:', err);
        if (isMounted) setFailed(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    resolve();
    return () => { isMounted = false; };
  }, [product]);

  return { resolvedUrl, loading, failed };
}
