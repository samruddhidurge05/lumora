import { backendFetch } from '../utils/api';

// Public read-only endpoints — no auth required
export const getProductsApi = () => backendFetch('/products/');
export const getProductApi = (id) => backendFetch(`/products/${id}`);

// Admin Products endpoint — ISOLATED Platform-only listing (vendor_id='lumora-creator' or null).
// NEVER use getProductsApi() in the Admin Panel; it returns the public marketplace (all vendors).
export const getAdminProductsApi = ({ status, category, limit = 1000 } = {}) => {
  const params = new URLSearchParams({ limit });
  if (status)   params.set('status', status);
  if (category && category !== 'All') params.set('category', category);
  return backendFetch(`/admin/products/?${params.toString()}`);
};

// Admin CRUD endpoints — require admin JWT (attached automatically by backendFetch)
// These live at /api/admin/products/ where Firestore sync is executed on every write.
export const createProductApi = (data) => backendFetch('/admin/products/', { method: 'POST', body: JSON.stringify(data) });
export const updateProductApi = (id, data) => backendFetch(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProductApi = (id) => backendFetch(`/admin/products/${id}`, { method: 'DELETE' });

