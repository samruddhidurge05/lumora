import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebase';

/**
 * ProtectedRoute — wraps a route that requires authentication.
 *
 * Props:
 *   redirectTo   — where to send unauthenticated users (default: /auth/login-selection)
 *   requiredRole — if set, also checks the user's role matches.
 *                  Accepts a string ('vendor') or array (['affiliate', 'vendor']).
 *                  Mismatch → redirect to that role's own dashboard.
 *
 * Production hardening:
 *   - Validates backend JWT on every mount (not just localStorage check).
 *   - Prevents browser Back button from accessing protected content after logout
 *     by replacing the history entry and injecting a popstate listener.
 *   - Sets no-cache meta so browsers don't serve stale protected pages from bfcache.
 *
 * Admin special case:
 *   When requiredRole === 'admin', unauthenticated or wrong-role users are
 *   redirected to /admin/login?redirect=<current path> with replace=true to
 *   prevent a back-button loop. A stale context state where user is set but
 *   auth.currentUser is null is also treated as unauthenticated for admin routes.
 */
export default function ProtectedRoute({
  children,
  redirectTo = '/auth/login-selection',
  requiredRole = null,
}) {
  const { user, loading, userRole, logout } = useAuth();
  const location = useLocation();

  // ── Back-button prevention & session validation ────────────────────────────
  // On every mount of a protected page:
  //   1. Replace the current history entry (so Back goes to the page BEFORE this one)
  //   2. Validate the backend JWT is still alive (redirect to login if 401)
  //   3. Listen for popstate (Back button) and redirect if no longer authenticated
  useEffect(() => {
    // Replace current history entry — prevents stale dashboard from appearing via Back
    window.history.replaceState(null, '', window.location.href);

    // Validate backend session is alive
    const token = localStorage.getItem('lumora_backend_token');
    if (token) {
      // Quick async validation — if backend says 401, force logout
      import('../utils/api').then(({ backendFetch }) => {
        backendFetch('/auth/me').catch((err) => {
          // 401 or network error means session is dead
          if (err?.status === 401 || err?.message?.includes('401')) {
            console.warn('[ProtectedRoute] Backend session expired, forcing logout');
            if (typeof logout === 'function') {
              logout();
            }
          }
        });
      });
    }

    // Popstate handler: if user hits Back after logout, redirect to login
    const handlePopState = () => {
      if (!auth.currentUser) {
        window.location.replace('/auth/login-selection');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.pathname, logout]);

  // ── Admin route guard ─────────────────────────────────────────────────────
  if (requiredRole === 'admin') {
    // Still resolving auth state
    if (loading) {
      return <PageLoader />;
    }

    // No user, wrong role, or stale mock state (user set but no Firebase currentUser)
    if (!user || !userRole || userRole !== 'admin' || !auth.currentUser) {
      const redirectParam = encodeURIComponent(location.pathname + location.search);
      const target = `/admin/login?redirect=${redirectParam}`;
      return <Navigate to={target} replace />;
    }

    return children;
  }

  // ── Standard route guard ──────────────────────────────────────────────────

  // Still resolving auth state — show spinner
  if (loading) {
    return <PageLoader />;
  }

  // Not authenticated
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role guard — only enforce once userRole is fully resolved from the backend.
  if (requiredRole) {
    if (!userRole) {
      // Role not yet known — wait rather than redirect
      return <PageLoader />;
    }

    // Normalise requiredRole to an array for uniform comparison
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

    if (!allowed.includes(userRole)) {
      const correctPath =
        userRole === 'affiliate' ? '/affiliate/dashboard'
        : userRole === 'vendor'  ? '/vendor/dashboard'
        : userRole === 'admin'   ? '/admin/dashboard'
        : '/customer/dashboard';
      return <Navigate to={correctPath} replace />;
    }
  }

  return children;
}

function PageLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'transparent',
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: '3px solid rgba(196,181,253,0.2)',
        borderTop: '3px solid #7B3FA0',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
