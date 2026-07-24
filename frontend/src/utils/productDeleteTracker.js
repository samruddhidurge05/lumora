/**
 * productDeleteTracker.js
 * Tracks deleted product IDs and titles across session/localStorage so deleted products
 * are NEVER resurrected by static json fallbacks or legacy in-memory arrays.
 */

const STORAGE_KEY = 'lumora_deleted_product_ids';

export const getDeletedProductIds = () => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set();
  }
};

export const addDeletedProductId = (idOrTitle) => {
  if (!idOrTitle || typeof window === 'undefined') return;
  try {
    const current = getDeletedProductIds();
    const val = String(idOrTitle).trim();
    current.add(val);
    current.add(val.toLowerCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(current)));
  } catch (e) {
    console.warn('[productDeleteTracker] Failed to record deleted product:', e);
  }
};

export const isProductDeleted = (product) => {
  if (!product) return false;
  const deletedSet = getDeletedProductIds();
  if (deletedSet.size === 0) return false;

  const idStr = String(product.id || '');
  const titleStr = String(product.title || product.name || '').trim().toLowerCase();

  return (idStr && deletedSet.has(idStr)) || (titleStr && deletedSet.has(titleStr));
};
