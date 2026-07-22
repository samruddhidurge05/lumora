import { useState, useEffect } from 'react';

export function useResolvedProductMedia(product) {
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!product) return;

    const directUrl = product.preview || product.thumbnail;
    if (directUrl) {
      setResolvedUrl(directUrl);
      setLoading(false);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [product]);

  return { resolvedUrl, loading, failed };
}
