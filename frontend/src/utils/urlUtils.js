/**
 * urlUtils.js
 * ───────────
 * Utilities for resolving production and local backend URLs.
 * Uses function declarations to guarantee 100% hoisting in JS engines.
 */

export const PROD_BACKEND_ORIGIN = 'https://lumora-backend-8mf6.onrender.com';

export function getBackendOrigin() {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const raw = import.meta.env.VITE_BACKEND_ORIGIN;
    if (raw && typeof raw === 'string' && raw.startsWith('http') && raw.includes('.onrender.com') && !raw.endsWith('lumora-backend-onrender.com')) {
      return raw.replace(/\/$/, '');
    }
    return PROD_BACKEND_ORIGIN;
  }
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  if (base.startsWith('/')) {
    return 'http://localhost:8000';
  }
  return base.replace(/\/api\/?$/, '');
}

export function getBackendUrl() {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${getBackendOrigin()}/api`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
}

export const BACKEND_URL = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ? `${PROD_BACKEND_ORIGIN}/api`
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api');

export const BACKEND_ORIGIN = BACKEND_URL.replace(/\/api\/?$/, '');
