import { backendFetch } from '../utils/api';

export const getOrdersApi = () => backendFetch('/orders/');
export const getOrderApi = (id) => backendFetch(`/orders/${id}`);
export const createOrderApi = (data) => backendFetch('/orders/', { method: 'POST', body: JSON.stringify(data) });
export const updateOrderApi = (id, data) => backendFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
