/**
 * firestore.js  (vendor-page service shim)
 * ------------------------------------------
 * Provides functions that vendor pages import from '../services/firestore'.
 * Routes all calls through the FastAPI backend instead of Firestore directly,
 * so vendor pages work offline from Firebase.
 *
 * Usage in pages:
 *   import { getVendorProducts, getWithdrawalHistory } from '../services/firestore';
 */

import { backendFetch } from '../../utils/api';

function getVendorId() {
  return localStorage.getItem('lumora_backend_uid') || 'vendor-mock-001';
}

/**
 * Fetch all products belonging to the current vendor.
 * @returns {Promise<Array>} Array of product objects.
 */
export async function getVendorProducts() {
  const id = getVendorId();
  if (!id) return [];
  try {
    const data = await backendFetch(`/vendors/${id}/products`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[firestore shim] getVendorProducts failed:', err.message);
    return [];
  }
}

/**
 * Fetch withdrawal history for the current vendor.
 * @returns {Promise<Array>} Array of withdrawal objects.
 */
export async function getWithdrawalHistory() {
  const id = getVendorId();
  if (!id) return [];
  try {
    const data = await backendFetch(`/vendors/${id}/withdrawals`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[firestore shim] getWithdrawalHistory failed:', err.message);
    return [];
  }
}

/**
 * Fetch orders that contain products from the current vendor.
 * @returns {Promise<Array>} Array of order objects.
 */
export async function getVendorOrders() {
  const id = getVendorId();
  if (!id) return [];
  try {
    const data = await backendFetch(`/vendors/${id}/orders`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('[firestore shim] getVendorOrders failed:', err.message);
    return [];
  }
}

/**
 * Fetch vendor stats summary (revenue, sales, rating, etc.)
 * @returns {Promise<Object>} Stats object.
 */
export async function getVendorStats() {
  const id = getVendorId();
  if (!id) return {};
  try {
    return await backendFetch(`/vendors/${id}/stats`);
  } catch (err) {
    console.warn('[firestore shim] getVendorStats failed:', err.message);
    return {};
  }
}

/**
 * Fetch vendor profile.
 * @returns {Promise<Object>} Vendor profile object.
 */
export async function getVendorProfile() {
  const id = getVendorId();
  if (!id) return {};
  try {
    return await backendFetch(`/vendors/${id}/profile`);
  } catch (err) {
    console.warn('[firestore shim] getVendorProfile failed:', err.message);
    return {};
  }
}

/**
 * Save vendor profile fields.
 * @param {Object} data - Profile fields to update.
 * @returns {Promise<Object>} Updated profile.
 */
export async function saveVendorProfile(data) {
  const id = getVendorId();
  if (!id) return {};
  return backendFetch(`/vendors/${id}/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Request a withdrawal.
 * @param {Object} payload - { amount, method, upiId?, bankAccount? }
 * @returns {Promise<Object>} Withdrawal entry.
 */
export async function requestWithdrawal(payload) {
  const id = getVendorId();
  if (!id) throw new Error('Not authenticated');
  return backendFetch(`/vendors/${id}/withdrawals`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Alias — save store settings (used by StoreSettings.jsx).
 * @param {string} vendorId - Vendor ID (may be a mock string; real id pulled from localStorage).
 * @param {Object} data - Store settings fields.
 */
export async function saveStoreSettings(vendorIdOrData, data) {
  let id = getVendorId();
  let payload = data;
  if (!payload) {
    payload = vendorIdOrData;
  }
  if (!id) {
    id = typeof vendorIdOrData === 'string' ? vendorIdOrData : 'vendor-mock-001';
  }
  return backendFetch(`/vendors/${id}/store-settings`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}


