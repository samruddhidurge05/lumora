/**
 * vendorApi.js
 * ------------
 * API functions that talk to the FastAPI backend vendor endpoints.
 * All base calls go through backendFetch (adds auth token automatically).
 *
 * Backend base: http://localhost:8000/api/vendors/{id}/...
 */
import { backendFetch } from '../utils/api';

// ── Profile ──────────────────────────────────────────────────────────────────
export const getVendorProfileApi    = (id)       => backendFetch(`/vendors/${id}/profile`);
export const updateVendorProfileApi = (id, data) => backendFetch(`/vendors/${id}/profile`, {
  method: 'PUT', body: JSON.stringify(data),
});

// ── Store Settings ────────────────────────────────────────────────────────────
export const updateStoreSettingsApi = (id, data) => backendFetch(`/vendors/${id}/store-settings`, {
  method: 'PUT', body: JSON.stringify(data),
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────
export const getVendorStatsApi = (id) => backendFetch(`/vendors/${id}/stats`);

// ── Products ──────────────────────────────────────────────────────────────────
export const getVendorProductsApi  = (id)      => backendFetch(`/vendors/${id}/products`);
export const deleteVendorProductApi = (prodId) => backendFetch(`/products/${prodId}`, { method: 'DELETE' });

// ── Orders ────────────────────────────────────────────────────────────────────
export const getVendorOrdersApi   = (id)              => backendFetch(`/vendors/${id}/orders`);
export const fulfillVendorOrderApi = (id, orderId)    => backendFetch(`/vendors/${id}/orders/${orderId}/fulfill`, { method: 'POST' });

// ── Reviews ───────────────────────────────────────────────────────────────────
export const getVendorReviewsApi = (id) => backendFetch(`/vendors/${id}/reviews`);

// ── Withdrawals ───────────────────────────────────────────────────────────────
export const getVendorWithdrawalsApi   = (id)       => backendFetch(`/vendors/${id}/withdrawals`);
export const requestVendorWithdrawalApi = (id, data) => backendFetch(`/vendors/${id}/withdrawals`, {
  method: 'POST', body: JSON.stringify(data),
});

// ── Legacy aliases (backwards compat) ─────────────────────────────────────────
export const getVendorApi    = getVendorProfileApi;
export const updateVendorApi = updateVendorProfileApi;
export const getVendorEarningsApi = getVendorStatsApi;
