import React from 'react';
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
  const { user, loading, userRole } = useAuth();
  const location = useLocation();

  // ── Admin route guard ─────────────────────────────────────────────────────
  if (requiredRole === 'admin') {
    // Still resolving auth state
    if (loading) {
      return <PageLoader />;
    }

    // No user, wrong role, or stale mock state (user set but no Firebase currentUser)
    if (!user || !userRole || userRole !== 'admin' || !auth.currentUser) {
      const redirectParam = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/admin/login?redirect=${redirectParam}`} replace />;
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
      // Role confirmed — redirect to the correct dashboard
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
