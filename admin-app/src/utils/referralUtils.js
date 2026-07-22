/**
 * referralUtils.js — Single Source of Truth for Referral Links & Commission Calculations
 *
 * Provides identical calculation formulas and customer URL resolution across
 * Customer, Vendor, Affiliate, and Admin applications.
 */

export function calculateCommission(price, mode = 'percentage', value = 0) {
  const numPrice = Number(price) || 0;
  const numVal = Number(value) || 0;
  if (numPrice <= 0 || numVal <= 0) return 0;

  if (mode === 'fixed') {
    return Math.min(numPrice, Math.round(numVal * 100) / 100);
  }
  
  // Percentage mode
  const pct = Math.min(100, Math.max(0, numVal));
  return Math.round((numPrice * (pct / 100)) * 100) / 100;
}

export function getCustomerBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    const envUrl = 
      (import.meta.env && (import.meta.env.VITE_CUSTOMER_URL || import.meta.env.VITE_FRONTEND_URL || import.meta.env.VITE_SITE_URL || import.meta.env.VITE_MARKETPLACE_URL));

    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.replace(/\/+$/, '');
    }

    const origin = window.location.origin;

    if (origin.includes(':5174') || origin.includes(':5175')) {
      return 'http://localhost:5173';
    }

    if (origin.includes('lumora-admin') || origin.includes('-admin')) {
      return origin.replace('-admin-nine', '').replace('-admin', '');
    }

    return origin.replace(/\/+$/, '');
  }

  return 'https://lumora.vercel.app';
}

export function buildAffiliateReferralLink(product, affCode) {
  const baseUrl = getCustomerBaseUrl();
  let productId = '';
  if (product && typeof product === 'object') {
    productId = product.slug || product.id || product.productId || '';
  } else if (product) {
    productId = String(product);
  }

  const cleanRef = (affCode || '').trim();
  const refQuery = cleanRef ? `?ref=${encodeURIComponent(cleanRef)}` : '';

  if (productId) {
    return `${baseUrl}/#product/${productId}${refQuery}`;
  }

  return `${baseUrl}/#products${refQuery}`;
}

export function buildAdminReferralLink(product, adminCode) {
  const baseUrl = getCustomerBaseUrl();
  let productId = '';
  if (product && typeof product === 'object') {
    productId = product.slug || product.id || product.productId || '';
  } else if (product) {
    productId = String(product);
  }

  const cleanRef = (adminCode || '').trim();
  const refQuery = cleanRef ? `?ref=${encodeURIComponent(cleanRef)}` : '';

  if (productId) {
    return `${baseUrl}/#product/${productId}${refQuery}`;
  }

  return `${baseUrl}/#products${refQuery}`;
}
