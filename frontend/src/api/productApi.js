import { backendFetch } from '../utils/api';

// Public read-only endpoints — no auth required
export const getProductsApi = () => backendFetch('/products/');
export const getProductApi = (id) => backendFetch(`/products/${id}`);

// Admin CRUD endpoints — require admin JWT (attached automatically by backendFetch)
// These live at /api/admin/products/ where Firestore sync is executed on every write.
export const createProductApi = (data) => backendFetch('/admin/products/', { method: 'POST', body: JSON.stringify(data) });
export const updateProductApi = (id, data) => backendFetch(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProductApi = (id) => backendFetch(`/admin/products/${id}`, { method: 'DELETE' });
