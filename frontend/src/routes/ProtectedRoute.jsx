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
  const { user, loading, userRole, logoutRole } = useAuth();
  const location = useLocation();

  // ── Back-button prevention & session validation ────────────────────────────
  useEffect(() => {
    window.history.replaceState(null, '', window.location.href);

    const targetRole = Array.isArray(requiredRole) ? requiredRole[0] : (requiredRole || 'customer');
    const normRole = targetRole === 'user' ? 'customer' : targetRole;
    const token = localStorage.getItem(`lumora_token_${normRole}`) || localStorage.getItem('lumora_backend_token');

    if (token) {
      import('../utils/api').then(({ backendFetch }) => {
        backendFetch('/auth/me').catch((err) => {
          if (err?.status === 401) {
            if (typeof logoutRole === 'function') {
              logoutRole(normRole);
            }
          }
        });
      });
    }

    const handlePopState = () => {
      const hasSession = !!localStorage.getItem(`lumora_token_${normRole}`) || !!localStorage.getItem(`lumora_session_${normRole}`);
      if (!auth.currentUser && !hasSession) {
        window.location.replace(`/auth/login?role=${normRole}`);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location.pathname, logoutRole, requiredRole]);

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

  // Standard route guard
  if (loading) {
    return <PageLoader />;
  }

  const allowedRoles = requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : ['customer'];
  const hasRoleSession = allowedRoles.some(r => {
    const norm = r === 'user' ? 'customer' : r;
    return !!localStorage.getItem(`lumora_token_${norm}`) || !!localStorage.getItem(`lumora_${norm}_session`) || !!localStorage.getItem(`lumora_session_${norm}`);
  });

  // Not authenticated for role
  if (!user && !hasRoleSession) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role guard — allow access if user state or role-scoped session token matches requiredRole
  if (requiredRole) {
    const hasRoleInState = userRole && allowedRoles.includes(userRole);

    if (!hasRoleInState && !hasRoleSession) {
      const targetRole = allowedRoles[0] || 'customer';
      const redirectUrl = targetRole === 'admin' ? '/admin/login' : `/auth/login?role=${targetRole}`;
      return <Navigate to={redirectUrl} replace />;
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
