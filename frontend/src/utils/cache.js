/**
 * cache.js
 * Lightweight in-memory cache with TTL.
 * Prevents repeated Firestore reads for products, categories, user profile.
 *
 * Usage:
 *   import { cache } from '../utils/cache';
 *
 *   const products = cache.get('products');
 *   if (!products) {
 *     const fetched = await getProducts();
 *     cache.set('products', fetched, 5 * 60 * 1000); // 5 min TTL
 *   }
 */

class InMemoryCache {
  constructor() {
    this._store = new Map();
  }

  /** Get a cached value. Returns null if missing or expired. */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  /** Set a value. ttl in milliseconds (default 5 minutes). */
  set(key, value, ttl = 5 * 60 * 1000) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /** Invalidate a specific key. */
  invalidate(key) {
    this._store.delete(key);
  }

  /** Clear everything. */
  clear() {
    this._store.clear();
  }

  /** Check if a valid (non-expired) entry exists. */
  has(key) {
    return this.get(key) !== null;
  }
}

// Singleton — shared across the whole app
export const cache = new InMemoryCache();

// ── Cache keys ─────────────────────────────────────────────────────
export const CACHE_KEYS = {
  PRODUCTS:       'products',
  USER_PROFILE:   (uid) => `user_profile_${uid}`,
  CATEGORIES:     'categories',
  DASHBOARD_DATA: (uid) => `dashboard_${uid}`,
  ORDER_HISTORY:  (uid) => `orders_${uid}`,
};
