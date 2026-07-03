import { backendFetch } from '../utils/api';

/** Return list of product IDs in the logged-in user's cart. */
export const getCartApi = () => backendFetch('/cart/me');

/** Add product to server-side cart (duplicate-safe). */
export const addCartItemApi = (productId) =>
  backendFetch(`/cart/?product_id=${productId}`, { method: 'POST' });

/** Remove one product from server-side cart. */
export const removeCartItemApi = (productId) =>
  backendFetch(`/cart/${productId}`, { method: 'DELETE' });

/** Clear all items from server-side cart (called after checkout). */
export const clearCartApi = () =>
  backendFetch('/cart/clear', { method: 'DELETE' });
