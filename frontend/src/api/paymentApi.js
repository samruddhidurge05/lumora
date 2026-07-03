import { backendFetch } from '../utils/api';

export const createPaymentApi = (data) => backendFetch('/payments/', { method: 'POST', body: JSON.stringify(data) });
export const verifyPaymentApi = (data) => backendFetch('/payments/verify', { method: 'POST', body: JSON.stringify(data) });
