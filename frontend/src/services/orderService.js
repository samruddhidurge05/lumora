import { createOrderApi, getOrdersApi } from '../api/orderApi';
import { backendFetch } from '../utils/api';

export const createOrder = async (userId, items, total, paymentMethod = 'upi') => {
  try {
    const payload = {
      items: items.map(item => ({
        product_id: parseInt(item.id),
        price_paid: parseFloat(item.price),
      })),
      total_amount: parseFloat(total),
      payment_method: paymentMethod,
    };
    return await createOrderApi(payload);
  } catch (error) {
    console.error('[orderService] Error creating order:', error);
    throw error;
  }
};

export const getUserOrders = async (userId) => {
  try {
    const orders = await getOrdersApi();
    return orders;
  } catch (error) {
    console.error('[orderService] Error fetching orders:', error);
    return [];
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    // If needed in frontend, update order status via API
    console.log('[orderService] updating order status locally/via API', orderId, status);
  } catch (error) {
    console.error('[orderService] Error updating order status:', error);
    throw error;
  }
};

export const getOrders = async () => {
  try {
    const data = await backendFetch('/admin/orders/');
    // Normalize: handle both legacy bare array and M6 paginated wrapper {total, page, page_size, items:[]}
    return Array.isArray(data) ? data : (data?.items ?? []);
  } catch (error) {
    console.error('[orderService] Error fetching orders:', error);
    return [];
  }
};

export const fetchAllOrders = async () => {
  try {
    const data = await backendFetch('/admin/orders/');
    // Normalize: handle both legacy bare array and M6 paginated wrapper {total, page, page_size, items:[]}
    return Array.isArray(data) ? data : (data?.items ?? []);
  } catch (error) {
    console.error('[orderService] Error fetching all orders:', error);
    return [];
  }
};

export const refundOrder = async (orderId) => {
  try {
    return await backendFetch(`/admin/orders/${orderId}/refund`, { method: 'POST' });
  } catch (error) {
    console.error('[orderService] Error refunding order:', error);
    throw error;
  }
};

export const disputeOrder = async (orderId) => {
  try {
    return await backendFetch(`/admin/orders/${orderId}/dispute`, { method: 'POST' });
  } catch (error) {
    console.error('[orderService] Error disputing order:', error);
    throw error;
  }
};

