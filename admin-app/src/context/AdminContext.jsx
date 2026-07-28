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

const DEFAULT_SETTINGS = {
  themeIntensity: "rich",
  animationLevel: "cinematic",
  dashboardDensity: "balanced",
  currencyDisplay: "INR",
  realtimeUpdates: true,
  chartStyle: "smooth",
  reviewVisibility: "all",
  orderAutoRefresh: true,
  aiInsightsLevel: "balanced",
  glowEffects: true,
  glassmorphismLevel: "standard"
};

export function AdminContextProvider({ children }) {
  const [adminProfile, setAdminProfile] = useState(null);
  const [loadError, setLoadError]       = useState(false);
  const [settings, setSettings]         = useState(() => {
    try {
      const saved = localStorage.getItem("lumora-settings");
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

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

  useEffect(() => {
    const handleSettingsUpdate = () => {
      try {
        const saved = localStorage.getItem("lumora-settings");
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (err) {
        console.warn("[AdminContext] Error loading settings:", err);
      }
    };
    window.addEventListener("lumoraSettingsUpdated", handleSettingsUpdate);
    return () => window.removeEventListener("lumoraSettingsUpdated", handleSettingsUpdate);
  }, []);

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem("lumora-settings", JSON.stringify(updated));
    window.dispatchEvent(new Event("lumoraSettingsUpdated"));
  };

  const currencySymbol = settings.currencyDisplay === "INR" ? "₹" : (settings.currencyDisplay === "EUR" ? "€" : "$");
  
  const formatCurrency = (val) => {
    let factor = settings.currencyDisplay === "INR" ? 1 : (settings.currencyDisplay === "EUR" ? 1 / 92 : 1 / 85);
    const amount = (val || 0) * factor;
    return `${currencySymbol}${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

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
    <AdminContext.Provider value={{
      adminProfile,
      hasPermission,
      loadError,
      settings,
      updateSetting,
      currencySymbol,
      formatCurrency
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdminContext = () => {
  const ctx = useContext(AdminContext);
  // Return safe defaults when used outside AdminContextProvider (non-admin routes).
  if (!ctx) return {
    adminProfile: null,
    hasPermission: () => false,
    loadError: false,
    settings: DEFAULT_SETTINGS,
    updateSetting: () => {},
    currencySymbol: "₹",
    formatCurrency: (val) => `₹${val || 0}`
  };
  return ctx;
};
