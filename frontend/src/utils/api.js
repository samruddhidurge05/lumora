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

const BACKEND_URL = (() => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  if (base.startsWith('/') && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const origin = import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:8000';
    return `${origin.replace(/\/$/, '')}${base}`;
  }
  return base;
})();

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
    ...options.headers,
  };

  let body = options.body;

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      delete headers['Content-Type'];
    } else if (typeof body === 'object' && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      body = JSON.stringify(body);
    } else if (typeof body === 'string') {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
  } else {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  if (body !== undefined && body !== null) {
    fetchOptions.body = body;
  } else {
    delete fetchOptions.body;
  }

  const res = await fetch(`${BACKEND_URL}${endpoint}`, fetchOptions);

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
      const synced = await syncWithBackend(firebaseUser, activeRole, true);

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
      // Not JSON or empty
    }
    
    const code = detail?.code || null;
    if (globalErrorListener && (code === 'ACCOUNT_DISABLED' || code === 'PLATFORM_PAUSED')) {
      globalErrorListener({ status: res.status, code, message: detail?.message || detail?.detail });
    }

    const error = new Error(
      detail?.message || `API error: ${res.status} ${errorText || res.statusText}`
    );
    error.status = res.status;
    error.code = code;
    error.detail = detail;
    throw error;
  }

  if (res.status === 204) {
    return null;
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
