import { backendFetch } from '../utils/api';

export const getReviewsApi = (productId) => backendFetch(`/reviews/?product_id=${productId}`);
export const getMyReviewsApi = () => backendFetch('/reviews/me');
export const createReviewApi = (data) => backendFetch('/reviews/', { method: 'POST', body: JSON.stringify(data) });
export const updateReviewApi = (id, data) => backendFetch(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteReviewApi = (id) => backendFetch(`/reviews/${id}`, { method: 'DELETE' });
