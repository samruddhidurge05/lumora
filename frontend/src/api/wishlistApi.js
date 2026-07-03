import { backendFetch } from '../utils/api';

export const getWishlistApi = () => backendFetch('/wishlist/me');
export const addToWishlistApi = (productId) => backendFetch(`/wishlist/?product_id=${productId}`, { method: 'POST' });
export const removeFromWishlistApi = (productId) => backendFetch(`/wishlist/${productId}`, { method: 'DELETE' });
