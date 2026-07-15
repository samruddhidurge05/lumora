/**
 * AdminContext.jsx
 * ─────────────────
 * Provides the authenticated admin's profile and resolved RBAC permissions
 * to all admin pages. Fetched once on mount via GET /api/admin/me.
 *
 * Usage:
 *   const { adminProfile, hasPermission } = useAdminContext();
 *
 * adminProfile shape:
 *   { user_id, email, name, role_level, permissions: string[] }
 *
 * hasPermission(perm) — mirrors backend _has_permission() logic:
 *   "*" covers everything
 *   "read:*" covers "read:analytics", "read:orders", etc.
 *   exact match covers the permission string directly
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { backendFetch } from '../utils/api';

const AdminContext = createContext(null);

// ── RBAC permission string list (mirrors backend ROLE_PERMISSIONS keys) ────────
// Used by AdminSidebar to filter nav items without an extra API call.
export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'read:*',
    'write:products', 'write:orders', 'write:reviews',
    'write:reports', 'write:support', 'write:vendors', 'write:affiliates',
    'write:referral_links', 'write:platform_settings', 'write:team',
    'read:analytics', 'read:audit_logs',
  ],
  moderator:  ['read:*', 'write:reviews', 'write:reports', 'write:support'],
  support:    ['read:support', 'write:support', 'read:customers'],
  finance:    ['read:orders', 'read:payments', 'read:analytics', 'read:reports'],
  marketing:  ['read:products', 'write:products_limited', 'read:analytics', 'write:referral_links'],
  analyst:    ['read:analytics', 'read:reports', 'read:audit_logs'],
};

export function AdminContextProvider({ children }) {
  const [adminProfile, setAdminProfile] = useState(null);
  const [loadError, setLoadError]       = useState(false);

  useEffect(() => {
    backendFetch('/admin/me')
      .then(data => {
        setAdminProfile(data);
        setLoadError(false);
      })
      .catch(() => {
        // Non-fatal — sidebar shows all items as safe fallback when profile is null
        setLoadError(true);
      });
  }, []);

  /**
   * hasPermission(perm)
   * Returns true if the current admin's permissions include `perm`.
   * Mirrors backend _has_permission() logic exactly.
   * If adminProfile is null (still loading), returns true (safe default —
   * the backend will enforce 403 on any unauthorised request).
   */
  const hasPermission = (perm) => {
    if (!perm) return true;
    if (!adminProfile) return true; // loading — show all, server enforces
    const perms = adminProfile.permissions || ['*'];
    if (perms.includes('*')) return true;
    if (perms.includes(perm)) return true;
    const prefix = perm.split(':')[0];
    return perms.includes(`${prefix}:*`);
  };

  return (
    <AdminContext.Provider value={{ adminProfile, hasPermission, loadError }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdminContext = () => useContext(AdminContext);
