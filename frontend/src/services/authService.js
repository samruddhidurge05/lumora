/**
 * authService.js
 * ──────────────
 * Firebase ↔ FastAPI authentication bridge.
 *
 * syncWithBackend(firebaseUser, role)
 *   - Gets a fresh Firebase ID Token from the Firebase user object
 *   - POSTs it to POST /api/auth/firebase-sync
 *   - On success: stores lumora_backend_token and lumora_backend_uid in localStorage
 *   - On failure: logs a warning and returns null (non-fatal — Firebase auth still works)
 *
 * refreshBackendToken(firebaseUser, role)
 *   - Forces a Firebase token refresh (getIdToken(true)) then re-syncs
 *   - Used when backendFetch gets a 401
 *
 * clearBackendToken()
 *   - Removes backend JWT and uid from localStorage on logout
 */

import { getBackendOrigin, getRouteRoleHint } from '../utils/api.js';

const BACKEND_URL = (() => {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${getBackendOrigin()}/api`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
})();


/**
 * Exchange a Firebase ID Token for a Lumora backend JWT.
 * Stores the result in localStorage and returns the response data.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @param {string} role  'customer' | 'vendor' | 'affiliate'
 * @returns {Promise<object|null>}
 */
let activeSyncPromise = null;

export const syncWithBackend = async (firebaseUser, role = 'customer', forceRefresh = false) => {
  if (!firebaseUser) return null;

  if (activeSyncPromise && !forceRefresh) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      // Get Firebase ID Token — pass forceRefresh boolean
      const idToken = await firebaseUser.getIdToken(forceRefresh);

      const res = await fetch(`${BACKEND_URL}/auth/firebase-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, role }),
      });

      if (!res.ok) {
        // Backend may be offline — this is non-fatal
        console.warn('[authService] firebase-sync responded:', res.status);
        return null;
      }

      const data = await res.json();

      if (data.access_token) {
        const normRole = role === 'user' ? 'customer' : role;
        const sessionPayload = JSON.stringify({
          role: normRole,
          user: data.user,
          uid: firebaseUser.uid,
          token: data.access_token,
          updatedAt: Date.now()
        });

        // Independent role-scoped storage
        localStorage.setItem(`lumora_token_${normRole}`, data.access_token);
        if (data.user?.id != null) {
          localStorage.setItem(`lumora_uid_${normRole}`, String(data.user.id));
        }
        localStorage.setItem(`lumora_session_${normRole}`, sessionPayload);
        localStorage.setItem(`lumora_${normRole}_session`, sessionPayload);

        // Only update active pointers if current window route matches normRole or active role is unset
        const currentRouteRole = getRouteRoleHint();
        if (currentRouteRole === normRole || !localStorage.getItem('lumora_active_role')) {
          localStorage.setItem('lumora_backend_token', data.access_token);
          if (data.user?.id != null) {
            localStorage.setItem('lumora_backend_uid', String(data.user.id));
          }
          localStorage.setItem('lumora_active_role', normRole);
        }

        // Signal hooks that are waiting for the backend session to be ready
        window.dispatchEvent(new Event('lumora_backend_ready'));
      }
      return data;
    } catch (err) {
      // Network error (backend offline) — non-fatal
      console.warn('[authService] firebase-sync error (non-fatal):', err.message);
      return null;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
};

/**
 * Clear session for a SPECIFIC role without destroying sessions of other roles.
 * @param {string} role  'customer' | 'affiliate' | 'vendor' | 'admin'
 */
export const clearRoleSession = (role) => {
  const normRole = (role === 'user' ? 'customer' : role) || 'customer';
  localStorage.removeItem(`lumora_token_${normRole}`);
  localStorage.removeItem(`lumora_uid_${normRole}`);
  localStorage.removeItem(`lumora_session_${normRole}`);
  localStorage.removeItem(`lumora_${normRole}_session`);

  const currentActive = localStorage.getItem('lumora_active_role');
  if (currentActive === normRole) {
    localStorage.removeItem('lumora_active_role');
    localStorage.removeItem('lumora_backend_token');
    localStorage.removeItem('lumora_backend_uid');

    // Find any remaining active role token to set as active fallback
    const roles = ['customer', 'affiliate', 'vendor', 'admin'];
    const remainingRole = roles.find(r => !!localStorage.getItem(`lumora_token_${r}`));
    if (remainingRole) {
      localStorage.setItem('lumora_active_role', remainingRole);
      localStorage.setItem('lumora_backend_token', localStorage.getItem(`lumora_token_${remainingRole}`));
      const remainingUid = localStorage.getItem(`lumora_uid_${remainingRole}`);
      if (remainingUid) localStorage.setItem('lumora_backend_uid', remainingUid);
    }
  }
};

/**
 * Force-refresh the Firebase ID Token and re-sync with the backend.
 * Called automatically by backendFetch when a 401 is received.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @param {string} role
 * @returns {Promise<object|null>}
 */
export const refreshBackendToken = async (firebaseUser, role = 'customer') => {
  if (!firebaseUser) return null;

  try {
    // Force Firebase to issue a fresh token (bypasses 1-hour cache)
    await firebaseUser.getIdToken(true);
    return await syncWithBackend(firebaseUser, role);
  } catch (err) {
    console.warn('[authService] Token refresh failed:', err.message);
    return null;
  }
};

/**
 * Remove ALL backend auth tokens and user identity from localStorage on global logout.
 * This is the single authoritative function for clearing all auth state.
 */
export const clearBackendToken = () => {
  const backendUid = localStorage.getItem('lumora_backend_uid');
  const keysToClear = [
    'lumora_backend_token',
    'lumora_backend_uid',
    'lumora_backend_user',
    'lumora_active_role',
    'lumora_user',
    'lumora_token_customer',
    'lumora_uid_customer',
    'lumora_session_customer',
    'lumora_token_affiliate',
    'lumora_uid_affiliate',
    'lumora_session_affiliate',
    'lumora_token_vendor',
    'lumora_uid_vendor',
    'lumora_session_vendor',
    'lumora_token_admin',
    'lumora_uid_admin',
    'lumora_session_admin',
    'lumora_cart',
    'lumora_wishlist',
    'lumora_owned',
    'lumora_support_tickets',
    'lumora_saved_addr',
    'lumora_theme',
    'lumora_glass',
    'lumora_glow',
    'lumora-settings',
    'lumora_recently_viewed',
    'admin-sidebar-collapsed',
    'lumora_aff_cart',
    'lumora_search_history'
  ];
  if (backendUid) {
    keysToClear.push(`lumora_cart_user_${backendUid}`);
    keysToClear.push(`lumora_wishlist_user_${backendUid}`);
    keysToClear.push(`lumora_owned_user_${backendUid}`);
  }
  keysToClear.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
};

