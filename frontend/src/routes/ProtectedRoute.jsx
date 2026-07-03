import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — wraps a route that requires authentication.
 *
 * Props:
 *   redirectTo  — where to send unauthenticated users (default: /auth/login-selection)
 *   requiredRole — if set, also checks the stored Firestore role matches
 *                  ('customer' | 'affiliate' | 'vendor'). Mismatch → redirect to that role's login.
 */
export default function ProtectedRoute({
  children,
  redirectTo = '/auth/login-selection',
  requiredRole = null,
}) {
  const { user, loading, userRole } = useAuth();
  const location = useLocation();

  // Still resolving auth state — show spinner
  if (loading) {
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

  // Not authenticated
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Role guard — only enforce once userRole is fully resolved from the backend.
  // If userRole is null the backend sync hasn't returned yet — keep showing the
  // spinner rather than redirecting, which would send the user to the wrong dashboard.
  if (requiredRole) {
    if (!userRole) {
      // Role is not yet known — wait rather than redirect
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

    if (userRole !== requiredRole) {
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
