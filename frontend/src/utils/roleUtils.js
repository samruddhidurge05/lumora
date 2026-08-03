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
      const norm = roleParam.toLowerCase() === 'user' ? 'customer' : roleParam.toLowerCase();
      try { sessionStorage.setItem('lumora_tab_role', norm); } catch (_) {}
      return norm;
    }
  } catch (_) {}

  try {
    const tabRole = sessionStorage.getItem('lumora_tab_role');
    if (tabRole && ['customer', 'affiliate', 'vendor', 'admin'].includes(tabRole)) {
      return tabRole;
    }
  } catch (_) {}

  return 'customer';
}
