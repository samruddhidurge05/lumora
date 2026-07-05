import { getAnalytics, logEvent } from 'firebase/analytics';
import { app } from '../firebase';

let analytics;
try { analytics = getAnalytics(app); } catch (e) { /* analytics not available */ }

export const trackEvent = (eventName, params = {}) => {
  try { if (analytics) logEvent(analytics, eventName, params); } catch (e) { /* silent */ }
};

export const trackPageView = (pageName) => trackEvent('page_view', { page_title: pageName });
export const trackPurchase = (items, total) => trackEvent('purchase', { items, value: total, currency: 'INR' });
export const trackAddToCart = (product) => trackEvent('add_to_cart', { item_id: product.id, item_name: product.title, value: product.price });
export const trackSearch = (query) => trackEvent('search', { search_term: query });

// --- Admin Analytics Services ---
import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';

export const getAnalyticsDashboard = async (range = 'all') => {
  return await backendFetch(`/admin/analytics/dashboard?range=${range}`);
};

export const subscribeToNewOrders = (callback) => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    }, (err) => {
      console.warn('[analyticsService] Firestore orders subscribe error:', err);
    });
  } catch (e) {
    console.warn('[analyticsService] Failed to bind orders listener:', e);
    return () => {};
  }
};

export const subscribeToNewReviews = (callback) => {
  try {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    }, (err) => {
      console.warn('[analyticsService] Firestore reviews subscribe error:', err);
    });
  } catch (e) {
    console.warn('[analyticsService] Failed to bind reviews listener:', e);
    return () => {};
  }
};
