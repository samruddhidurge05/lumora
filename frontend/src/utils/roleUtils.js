/**
 * roleUtils.js
 * ────────────
 * Utility helpers for resolving active route role namespaces.
 * Uses hoisted function declarations and has ZERO external imports.
 */

export function getRouteRoleHint() {
  if (typeof window === 'undefined') return 'customer';
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith('/affiliate')) return 'affiliate';
  if (path.startsWith('/vendor')) return 'vendor';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/customer')) return 'customer';

  try {
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam && ['customer', 'affiliate', 'vendor', 'admin', 'user'].includes(roleParam.toLowerCase())) {
      return roleParam.toLowerCase() === 'user' ? 'customer' : roleParam.toLowerCase();
    }
  } catch (_) {}

  const activeRole = localStorage.getItem('lumora_active_role');
  if (activeRole && ['customer', 'affiliate', 'vendor', 'admin'].includes(activeRole)) {
    return activeRole;
  }
  return 'customer';
}
