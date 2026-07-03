import { backendFetch } from '../utils/api';

export const getProductsApi = () => backendFetch('/products/');
export const getProductApi = (id) => backendFetch(`/products/${id}`);
export const createProductApi = (data) => backendFetch('/products/', { method: 'POST', body: JSON.stringify(data) });
export const updateProductApi = (id, data) => backendFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProductApi = (id) => backendFetch(`/products/${id}`, { method: 'DELETE' });
