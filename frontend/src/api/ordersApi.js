import { backendFetch } from '../utils/api';

/**
 * Fetch all orders belonging to the current authenticated user.
 * Returns an array of order objects with .items (list of OrderItem).
 */
export const getMyOrdersApi = () => backendFetch('/orders/me');

/**
 * Create a new order in the SQLite database.
 * @param {object} orderData - { items, total_amount, payment_method, payment_id, promo_code, discount_amount }
 */
export const createOrderApi = (orderData) =>
  backendFetch('/orders/', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
