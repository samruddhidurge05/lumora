/**
 * referralUtils.js — Single Source of Truth for Referral Links & Commission Calculations
 *
 * Provides identical calculation formulas and customer URL resolution across
 * Customer, Vendor, Affiliate, and Admin applications.
 */

function slugify(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
      import.meta.env?.VITE_MARKETPLACE_URL ||
      import.meta.env?.VITE_CUSTOMER_URL ||
      import.meta.env?.VITE_FRONTEND_URL ||
      import.meta.env?.VITE_SITE_URL;

    if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
      return envUrl.replace(/\/+$/, '');
    }

    const origin = window.location.origin;

    if (origin.includes(':5174') || origin.includes(':5175')) {
      return 'http://localhost:5173';
    }

    if (origin.includes('lumora-admin') || origin.includes('-admin') || origin.includes('admin.')) {
      return origin.replace('-admin-nine', '').replace('-admin', '').replace('admin.', 'www.');
    }

    if (origin.includes('.vercel.app') && !origin.includes('lumora-lemon-seven')) {
      return 'https://lumora-lemon-seven.vercel.app';
    }

    return origin.replace(/\/+$/, '');
  }

  return 'https://lumora-lemon-seven.vercel.app';
}

export function buildProductUrl(product, options = {}) {
  const baseUrl = getCustomerBaseUrl();
  if (!product) return `${baseUrl}/#products`;

  let slugPart = '';
  if (typeof product === 'object') {
    slugPart = product.slug || slugify(product.title || product.name || '') || product.id || product.productId || '';
  } else if (product) {
    slugPart = String(product);
  }

  const cleanSlug = slugify(slugPart) || String((typeof product === 'object' ? (product.id || '') : product) || '');
  const refCode = options.refCode || (typeof product === 'object' ? (product.refCode || product.referralCode) : '');
  const cleanRef = (refCode || '').trim();

  const queryParams = [];
  if (cleanRef) queryParams.push(`ref=${encodeURIComponent(cleanRef)}`);
  if (options.qr) queryParams.push('src=qr');

  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

  if (cleanSlug) {
    return `${baseUrl}/product/${cleanSlug}${queryString}`;
  }

  return `${baseUrl}/#products${queryString}`;
}

export function buildAffiliateReferralLink(product, affCode) {
  return buildProductUrl(product, { refCode: affCode });
}

export function buildAdminReferralLink(product, adminCode) {
  return buildProductUrl(product, { refCode: adminCode });
}
