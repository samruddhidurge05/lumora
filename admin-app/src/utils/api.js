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
import { adminRefreshToken } from '../services/adminAuthService.js';

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

  let res;
  try {
    res = await fetch(`${BACKEND_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (netErr) {
    // Network failure (e.g. Render server cold-starting / un-routable connection)
    const isProduction = typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';
    const error = new Error(
      isProduction
        ? 'The server is warming up. Please wait a moment and try again.'
        : 'Backend server is not responding. Make sure the backend is running on http://localhost:8000'
    );
    error.status = 503;
    error.code = 'BACKEND_OFFLINE';
    throw error;
  }

  // ── 401 handling: attempt one silent token refresh ────────────────────────
  if (res.status === 401 && !_isRetry) {
    const firebaseUser = auth.currentUser;
    const activeRole = localStorage.getItem('lumora_active_role') || 'customer';

    if (activeRole === 'admin') {
      if (firebaseUser) {
        try {
          const synced = await adminRefreshToken(firebaseUser);
          if (synced?.access_token) {
            return backendFetch(endpoint, options, true);
          }
        } catch (refreshErr) {
          console.warn('[api.js] Admin silent token refresh failed:', refreshErr.message);
        }
      }
      localStorage.removeItem('lumora_backend_token');
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

  // Cold start gateway responses (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    const isProduction = typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';
    const error = new Error(
      isProduction
        ? 'The server is warming up. Please wait a moment and try again.'
        : 'Backend server returned gateway warmup status. Retrying...'
    );
    error.status = res.status;
    error.code = 'BACKEND_OFFLINE';
    throw error;
  }


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
 * backendFetchWithRetry
 * ─────────────────────
 * Wraps backendFetch with automatic retry for BACKEND_OFFLINE (Render cold-start).
 * Retries every 8 seconds for up to 90 seconds, then gives up.
 *
 * @param {string} endpoint
 * @param {RequestInit} options
 * @param {(secondsLeft: number) => void} [onWarmup]  called on each retry with countdown
 * @returns {Promise<any>}
 */
export const backendFetchWithRetry = async (endpoint, options = {}, onWarmup = null) => {
  const MAX_WAIT_MS = 90_000;
  const RETRY_INTERVAL_MS = 8_000;
  const start = Date.now();
  let attempt = 0;

  console.log(`[api.js] backendFetchWithRetry ENTERED for: ${endpoint}`);

  while (true) {
    attempt++;
    console.log(`[api.js] backendFetchWithRetry attempt #${attempt} starting for: ${endpoint}`);
    try {
      const result = await backendFetch(endpoint, options);
      console.log(`[api.js] backendFetchWithRetry SUCCESS on attempt #${attempt} for: ${endpoint}`);
      return result;
    } catch (err) {
      console.warn(`[api.js] backendFetchWithRetry caught error on attempt #${attempt} for: ${endpoint}:`, err.message, 'code:', err.code, 'status:', err.status);
      const elapsed = Date.now() - start;
      if (err.code !== 'BACKEND_OFFLINE' || elapsed >= MAX_WAIT_MS) {
        console.error(`[api.js] backendFetchWithRetry GIVING UP / THROWING for: ${endpoint}`);
        throw err;
      }
      const secondsLeft = Math.ceil((MAX_WAIT_MS - elapsed) / 1000);
      console.log(`[api.js] backendFetchWithRetry RETRYING in ${RETRY_INTERVAL_MS}ms (secondsLeft: ${secondsLeft})`);
      if (onWarmup) onWarmup(secondsLeft);
      await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
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

