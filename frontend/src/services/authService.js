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

const BACKEND_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Exchange a Firebase ID Token for a Lumora backend JWT.
 * Stores the result in localStorage and returns the response data.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @param {string} role  'customer' | 'vendor' | 'affiliate'
 * @returns {Promise<object|null>}
 */
export const syncWithBackend = async (firebaseUser, role = 'customer') => {
  if (!firebaseUser) return null;

  try {
    // Get (possibly cached) Firebase ID Token — 1-hour expiry
    const idToken = await firebaseUser.getIdToken(false);

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
      localStorage.setItem('lumora_backend_token', data.access_token);
      // Store backend integer user ID so vendor API calls use the correct ID
      // The backend vendor routes compare vendor.uid (str(user.id)) with the
      // vendor_id path param — both must be the SQLite integer cast to string.
      if (data.user?.id != null) {
        localStorage.setItem('lumora_backend_uid', String(data.user.id));
      }
      // Signal hooks that are waiting for the backend session to be ready
      window.dispatchEvent(new Event('lumora_backend_ready'));
    }

    return data;
  } catch (err) {
    // Network error (backend offline) — non-fatal
    console.warn('[authService] firebase-sync error (non-fatal):', err.message);
    return null;
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
 * Remove ALL backend auth tokens and user identity from localStorage on logout.
 * This is the single authoritative function for clearing auth state.
 * Called from: AuthContext.logout(), AuthContext.onAuthStateChanged (no-user branch),
 *              adminAuthService, and any other sign-out path.
 */
export const clearBackendToken = () => {
  const backendUid = localStorage.getItem('lumora_backend_uid');
  const keysToClear = [
    'lumora_backend_token',
    'lumora_backend_uid',
    'lumora_backend_user',
    'lumora_active_role',
    'lumora_user',
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

