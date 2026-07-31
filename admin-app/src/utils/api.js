/**
 * utils/api.js
 * ────────────
 * Central HTTP utility for all FastAPI backend calls.
 *
 * backendFetch(endpoint, options)
 *   - Automatically attaches the JWT from localStorage as Bearer token
 *   - On 401: attempts one silent token refresh (Firebase → re-sync) then retries
 *   - On persistent 401 or missing token after refresh: clears stored token
 *
 * checkBackendOnline()
 *   - Quick health check for the FastAPI server
 */

import { auth } from '../firebase.js';
import { syncWithBackend, clearBackendToken } from '../services/authService.js';

export const PROD_BACKEND_ORIGIN = 'https://lumora-backend-8mf6.onrender.com';

/**
 * On production (Vercel), use a RELATIVE /api path so all requests flow through
 * the Vercel proxy rewrite (vercel.json) → backend, keeping them same-origin
 * and completely eliminating CORS preflight issues.
 *
 * On localhost, use absolute http://localhost:8000/api (Vite proxy handles it).
 */
const BACKEND_URL = (() => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Vercel proxy: /api/:path* → https://lumora-backend-8mf6.onrender.com/api/:path*
    return '/api';
  }
  return 'http://localhost:8000/api';
})();

/** Backend origin for media/download URLs on production */
export const getBackendOrigin = () => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return PROD_BACKEND_ORIGIN;
  }
  return 'http://localhost:8000';
};

let globalErrorListener = null;

export const registerGlobalErrorListener = (listener) => {
  globalErrorListener = listener;
};

/**
 * Make an authenticated request to the FastAPI backend.
 *
 * @param {string} endpoint  e.g. '/vendors/1/stats'
 * @param {RequestInit} options  fetch options (method, body, headers, …)
 * @param {boolean} _isRetry  internal flag to prevent infinite retry loop
 */
export const backendFetch = async (endpoint, options = {}, _isRetry = false) => {
  const token = localStorage.getItem('lumora_backend_token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // ── 401 handling: attempt one silent token refresh ────────────────────────
  if (res.status === 401 && !_isRetry) {
    const firebaseUser = auth.currentUser;
    const activeRole = localStorage.getItem('lumora_active_role') || 'customer';

    // Admin sessions use a separate JWT flow — never attempt syncWithBackend
    // for admin tokens. Clear the token and let AuthContext redirect to /admin/login.
    if (activeRole === 'admin') {
      clearBackendToken();
      const error = new Error('Admin session expired. Please log in again.');
      error.status = 401;
      throw error;
    }

    if (firebaseUser) {
      // Refresh Firebase ID token and re-sync with backend
      const synced = await syncWithBackend(firebaseUser, activeRole);

      if (synced?.access_token) {
        // Retry the original request with the new token
        return backendFetch(endpoint, options, true);
      }
    }

    // Could not refresh — clear stale token
    clearBackendToken();
    const error = new Error('Session expired. Please log in again.');
    error.status = 401;
    throw error;
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (!res.ok) {
    let detail = null;
    let errorText = '';
    try {
      errorText = await res.text();
      detail = JSON.parse(errorText);
    } catch (_) {
      // Not JSON or empty — check if we got HTML (Render cold-start, reverse proxy error, or wrong route)
      const isHtml = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html');
      if (isHtml) {
        const isProduction = typeof window !== 'undefined' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1';
        const error = new Error(
          isProduction
            ? 'The server is warming up. Please wait a moment and try again.'
            : 'Backend server is not responding. Make sure the backend is running on http://localhost:8000'
        );
        error.status = res.status;
        error.code = 'BACKEND_OFFLINE';
        throw error;
      }
    }

    const code = detail?.code || null;
    if (globalErrorListener && (code === 'ACCOUNT_DISABLED' || code === 'PLATFORM_PAUSED')) {
      globalErrorListener({ status: res.status, code, message: detail?.message || detail?.detail });
    }

    // Extract human readable detail string from FastAPI error response
    const extractedMessage = typeof detail?.detail === 'string'
      ? detail.detail
      : (detail?.message || (typeof detail === 'string' ? detail : null));

    const error = new Error(
      extractedMessage || `API error: ${res.status} ${errorText || res.statusText}`
    );
    error.status = res.status;
    error.code = code;
    error.detail = detail;
    throw error;
  }

  if (res.status === 204) {
    return null;
  }

  // Guard against the Vite dev server SPA fallback returning index.html as 200
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      const isProduction = typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';
      const error = new Error(
        isProduction
          ? 'The server is warming up. Please wait a moment and try again.'
          : 'Backend server returned an HTML page. Make sure the backend is running and the route exists.'
      );
      error.status = res.status;
      error.code = 'BACKEND_OFFLINE';
      throw error;
    }
    // Try parsing anyway in case Content-Type header is wrong
    try {
      return JSON.parse(text);
    } catch (_) {
      const error = new Error(`Unexpected non-JSON response from server (status ${res.status})`);
      error.status = res.status;
      error.code = 'INVALID_RESPONSE';
      throw error;
    }
  }

  return res.json();
};

/**
 * Check whether the FastAPI backend server is reachable.
 * Returns true if online, false if offline.
 */
export const checkBackendOnline = async () => {
  try {
    const res = await fetch(`${BACKEND_URL.replace('/api', '')}/`, { method: 'GET' });
    return res.ok;
  } catch (err) {
    return false;
  }
};

/**
 * Resolves a backend media/thumbnail relative path to a full backend URL.
 *
 * @param {string} path  e.g. '/api/products/media/xyz.png'
 * @returns {string}      e.g. 'https://lumora-backend-lmfa.onrender.com/api/products/media/xyz.png'
 */
export const getMediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const origin = BACKEND_URL.replace(/\/api\/?$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${cleanPath}`;
};

