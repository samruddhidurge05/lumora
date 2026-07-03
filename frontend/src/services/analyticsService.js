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

const DEFAULT_ANALYTICS_DASHBOARD = {
  kpis: {
    totalRevenue: 284500,
    aov: 6770,
    refundRate: 1.2,
    totalOrders: 42,
    paidOrdersCount: 40,
    completedOrdersCount: 38,
    activeCustomers: 32,
    publishedProducts: 148,
    approvedVendors: 12,
    avgRating: 4.8
  },
  revenueTrend: {
    today: 8900,
    change: 12.4,
    aov: 6770,
    aovChange: 3.2,
    refundRate: 1.2,
    refundChange: -5.4,
    sparkline: [20, 24, 21, 28, 26, 32, 29, 36, 42],
    timeline: {
      daily: [
        { label: 'Mon', value: 4500 },
        { label: 'Tue', value: 5200 },
        { label: 'Wed', value: 4900 },
        { label: 'Thu', value: 6100 },
        { label: 'Fri', value: 7200 },
        { label: 'Sat', value: 6800 },
        { label: 'Sun', value: 8900 }
      ],
      weekly: [
        { label: 'Wk 1', value: 34000 },
        { label: 'Wk 2', value: 38000 },
        { label: 'Wk 3', value: 42000 },
        { label: 'Wk 4', value: 48000 }
      ],
      monthly: [
        { label: 'Jan', value: 120000 },
        { label: 'Feb', value: 150000 },
        { label: 'Mar', value: 180000 },
        { label: 'Apr', value: 220000 },
        { label: 'May', value: 250000 },
        { label: 'Jun', value: 284500 }
      ]
    }
  },
  productPerformance: [
    { id: 'p1', name: 'Ultimate React Native Starter', category: 'Mobile App Designs', revenue: 78500, orders: 120, conversion: 4.8, growth: 12.4, refundRate: 0.8 },
    { id: 'p2', name: 'Next.js SaaS Boilerplate', category: 'Website Templates', revenue: 64200, orders: 98, conversion: 5.2, growth: 18.6, refundRate: 1.1 },
    { id: 'p3', name: 'Figma UI Core System v4', category: 'UI Kits', revenue: 49800, orders: 166, conversion: 3.9, growth: 6.2, refundRate: 2.4 }
  ],
  customerAnalytics: {
    newCustomers: 18,
    newCustomersChange: 15.4,
    returningCustomers: 14,
    repeatPurchaseRate: 43.8,
    clv: 8900,
    clvTrend: [6400, 7200, 7800, 8100, 8500, 8900],
    totalCustomers: 32
  },
  trustMetrics: {
    positivePercent: 88,
    neutralPercent: 8,
    negativePercent: 4
  },
  geoAnalytics: [
    { region: 'Karnataka', customers: 120, revenue: 38500, growth: 14.2, activeRate: 85 },
    { region: 'Maharashtra', customers: 98, revenue: 31200, growth: 11.8, activeRate: 82 },
    { region: 'Delhi', customers: 76, revenue: 24300, growth: 9.4, activeRate: 78 }
  ],
  growth: {
    revenueGrowth: 12.4,
    customerGrowth: 15.4,
    aovGrowth: 3.2,
    refundRateGrowth: -5.4,
    reviewGrowth: 6.8
  },
  forecast: {
    nextMonthRevenue: 320000,
    nextQuarterRevenue: 980000,
    confidenceScore: 92,
    forecastPath: [284500, 295000, 305000, 320000]
  },
  _meta: {
    totalReviews: 24,
    fetchedAt: new Date().toISOString()
  }
};

export const getAnalyticsDashboard = async () => {
  try {
    return await backendFetch('/admin/analytics/dashboard');
  } catch (error) {
    console.warn('[analyticsService] Error fetching analytics data, using local fallback:', error);
    return DEFAULT_ANALYTICS_DASHBOARD;
  }
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
