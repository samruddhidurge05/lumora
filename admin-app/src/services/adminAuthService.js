/**
 * adminAuthService.js
 * ────────────────────
 * Admin-specific Firebase ↔ FastAPI authentication bridge.
 *
 * adminLogin(firebaseUser)
 *   - Gets a Firebase ID Token from the Firebase user object
 *   - POSTs it to POST /api/admin/auth/login
 *   - On success: stores lumora_backend_token, lumora_backend_uid, and
 *     lumora_active_role ('admin') in localStorage
 *   - Dispatches window event 'lumora_backend_ready'
 *   - On failure: throws Error with backend detail message
 *   - NOTE: The raw idToken is NEVER stored in localStorage
 *
 * adminRefreshToken(firebaseUser)
 *   - Forces a fresh Firebase ID Token (getIdToken(true))
 *   - Re-runs adminLogin() with the refreshed user
 *   - Returns the result
 */

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Exchange a Firebase ID Token for a Lumora admin backend JWT.
 * Stores the JWT and user info in localStorage, dispatches the ready event,
 * and returns the full response payload.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @returns {Promise<object>}
 * @throws {Error} with backend detail message on failure
 */
export const adminLogin = async (firebaseUser) => {
  // Obtain the current (possibly cached) Firebase ID Token — expires in 1 hour
  const idToken = await firebaseUser.getIdToken();

  const res = await fetch(`${BACKEND_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await res.json();

  if (!res.ok) {
    // Throw using the backend's detail message so callers can surface it to users
    throw new Error(data.detail || 'Admin login failed');
  }

  // Store backend JWT — NOT the Firebase idToken
  if (data.access_token) {
    localStorage.setItem('lumora_backend_token', data.access_token);
  }

  // Store backend integer user ID for API calls that need it
  if (data.user?.id != null) {
    localStorage.setItem('lumora_backend_uid', String(data.user.id));
  }

  // Mark the active role as admin so other parts of the app can branch on it
  localStorage.setItem('lumora_active_role', 'admin');

  // Signal hooks/components that are waiting for the backend session to be ready
  window.dispatchEvent(new Event('lumora_backend_ready'));

  return data;
};

/**
 * Force-refresh the Firebase ID Token and re-run admin login.
 * Called when a 401 is received on admin API requests.
 *
 * @param {import('firebase/auth').User} firebaseUser
 * @returns {Promise<object>}
 * @throws {Error} if token refresh or login fails
 */
export const adminRefreshToken = async (firebaseUser) => {
  // Force Firebase to issue a fresh token, bypassing the 1-hour cache
  await firebaseUser.getIdToken(true);

  // Re-run the full login flow with the refreshed user
  return adminLogin(firebaseUser);
};
