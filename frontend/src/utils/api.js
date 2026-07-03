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

const BACKEND_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

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

    if (firebaseUser) {
      // Refresh Firebase ID token and re-sync with backend
      const role = localStorage.getItem('lumora_active_role') || 'customer';
      const synced = await syncWithBackend(firebaseUser, role);

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
    const res = await fetch('http://localhost:8000/', { method: 'GET' });
    return res.ok;
  } catch (err) {
    return false;
  }
};
