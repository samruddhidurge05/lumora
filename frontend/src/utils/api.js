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
 *
 * NOTE: authService is intentionally NOT statically imported here.
 * Static import of authService creates a circular dependency:
 *   api.js → authService.js → (indirectly) → api.js
 * This causes a TDZ (Temporal Dead Zone) crash in production minified builds.
 * Instead, authService functions are loaded via inline dynamic import() inside
 * backendFetch() only when a 401 occurs — which is an async code path anyway.
 */

import { auth } from '../firebase.js';
import { getRouteRoleHint } from './roleUtils.js';
import { PROD_BACKEND_ORIGIN, getBackendOrigin, BACKEND_URL, BACKEND_ORIGIN } from './urlUtils.js';

export { getRouteRoleHint, PROD_BACKEND_ORIGIN, getBackendOrigin, BACKEND_URL, BACKEND_ORIGIN };


let globalErrorListener = null;

export const registerGlobalErrorListener = (listener) => {
  globalErrorListener = listener;
};

/**
 * Safely resolves any relative or absolute endpoint into a clean backend URL
 * without double hostnames or duplicated /api prefixes.
 */
export function buildBackendUrl(endpoint = '') {
  let targetUrl = String(endpoint || '');

  // Strip leading slash if attached to a full URL (e.g. "/https://...")
  if (targetUrl.startsWith('/https://') || targetUrl.startsWith('/http://')) {
    targetUrl = targetUrl.substring(1);
  }

  // Handle malformed doubled URLs (e.g. "https://domain.com/https://domain.com/api/...")
  if (targetUrl.includes('://') && targetUrl.indexOf('://') !== targetUrl.lastIndexOf('://')) {
    const secondProtocolIndex = targetUrl.indexOf('http', 5);
    if (secondProtocolIndex !== -1) {
      targetUrl = targetUrl.substring(secondProtocolIndex);
    }
  }

  // If endpoint is relative, combine with BACKEND_URL
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    let cleanEndpoint = targetUrl;
    if (cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = cleanEndpoint.replace(/^\/api/, '');
    } else if (cleanEndpoint.startsWith('api/')) {
      cleanEndpoint = cleanEndpoint.replace(/^api\//, '/');
    }
    if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = '/' + cleanEndpoint;
    }
    const cleanBase = BACKEND_URL.replace(/\/$/, '');
    targetUrl = `${cleanBase}${cleanEndpoint}`;
  }

  return targetUrl;
}

/**
 * Make an authenticated request to the FastAPI backend.
 *
 * @param {string} endpoint  e.g. '/vendors/1/stats'
 * @param {RequestInit} options  fetch options (method, body, headers, …)
 * @param {boolean} _isRetry  internal flag to prevent infinite retry loop
 */

export const getRoleToken = (targetRole) => {
  const normRole = targetRole ? (targetRole === 'user' ? 'customer' : targetRole) : getRouteRoleHint();
  const roleToken = localStorage.getItem(`lumora_token_${normRole}`);
  if (roleToken) return roleToken;

  if (normRole === 'admin') {
    return localStorage.getItem('lumora_backend_token') || localStorage.getItem('lumora_token_admin');
  }

  try {
    const tabRole = sessionStorage.getItem('lumora_tab_role');
    if (tabRole && tabRole !== normRole) {
      const tabToken = localStorage.getItem(`lumora_token_${tabRole}`);
      if (tabToken) return tabToken;
    }
  } catch (_) {}

  return localStorage.getItem(`lumora_token_${normRole}`) || localStorage.getItem(`lumora_token_customer`) || localStorage.getItem('lumora_backend_token');
};

export const backendFetch = async (endpoint, options = {}, _isRetry = false) => {
  const routeRole = getRouteRoleHint();
  const token = getRoleToken(routeRole);

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

  const targetUrl = buildBackendUrl(endpoint);
  const res = await fetch(targetUrl, fetchOptions);

  // ── 401 handling: attempt one silent token refresh ────────────────────────
  if (res.status === 401 && !_isRetry) {
    const firebaseUser = auth.currentUser;

    if (routeRole === 'admin') {
      const { clearRoleSession } = await import('../services/authService.js');
      clearRoleSession('admin');
      const error = new Error('Admin session expired. Please log in again.');
      error.status = 401;
      throw error;
    }

    if (firebaseUser) {
      const { syncWithBackend } = await import('../services/authService.js');
      const synced = await syncWithBackend(firebaseUser, routeRole, true);

      if (synced?.access_token) {
        return backendFetch(endpoint, options, true);
      }
    }

    // Could not refresh — clear only this role's session
    const { clearRoleSession } = await import('../services/authService.js');
    clearRoleSession(routeRole);
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
