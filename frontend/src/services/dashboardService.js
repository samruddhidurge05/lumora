import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';

// Production empty-state — shown only when backend is unreachable.
// All values are zero/empty so the UI shows real empty states rather than
// fabricated business metrics.
const EMPTY_DASHBOARD_STATE = {
  kpis: {
    totalRevenue: 0,
    ordersToday: 0,
    conversionRate: 0,
    activeProducts: 0,
    refundRate: 0,
    growthVelocity: 0,
    revenueChange: 0,
    ordersChange: 0,
    activeProductsChange: 0,
    modalData: {
      totalRevenue: [],
      ordersToday: [],
      conversionRate: [],
      activeProducts: [],
      refundRate: [],
      growthVelocity: [],
    },
  },
  liveFeed: [],
  productPerf: [],
  leaderboard: [],
  riskPanel: [],
  customerInsights: { topCustomers: [], geoDistribution: [] },
  insights: [],
  headerStats: {
    activeUsers: 0,
    greeting: 'Welcome back',
    marketStatus: 'Connecting…',
  },
  healthScore: 0,
  healthStatus: 'Connecting',
  revenueChart: { daily: [], weekly: [], monthly: [] },
  _meta: { fetchedAt: new Date().toISOString(), offline: true },
};

export const getDashboardData = async () => {
  try {
    return await backendFetch('/admin/analytics/dashboard-full');
  } catch (error) {
    console.warn('[dashboardService] Backend unreachable — showing empty state:', error);
    return {
      ...EMPTY_DASHBOARD_STATE,
      _meta: { fetchedAt: new Date().toISOString(), offline: true },
    };
  }
};

// buildActivityFeed is a no-op — live feed is driven by Firestore onSnapshot
// listeners (subscribeToOrders, subscribeToReviews, subscribeToDashboardReports).
// Simulated events were removed in production hardening.
export const buildActivityFeed = (_callback) => {
  return () => {}; // Returns a no-op unsubscribe function
};

export const subscribeToOrders = (callback) => {
  try {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Map structure for feed
          callback({
            id: change.doc.id,
            customerName: data.customerName || data.customerEmail || 'A customer',
            total: data.total || data.price || 0,
            items: data.items || [{ snapshot: { title: data.productName || 'product' } }]
          });
        }
      });
    }, (err) => {
      console.warn('[dashboardService] Firestore order subscription error:', err);
    });
  } catch (e) {
    console.warn('[dashboardService] Failed to set up Firestore orders listener:', e);
    return () => {};
  }
};

export const subscribeToReviews = (callback) => {
  try {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          callback({
            id: change.doc.id,
            rating: data.rating || 5,
            productTitle: data.productTitle || 'Digital Product'
          });
        }
      });
    }, (err) => {
      console.warn('[dashboardService] Firestore review subscription error:', err);
    });
  } catch (e) {
    console.warn('[dashboardService] Failed to set up Firestore reviews listener:', e);
    return () => {};
  }
};

export const subscribeToDashboardReports = (callback) => {
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(1));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          callback({
            id: change.doc.id,
            severity: data.severity || data.priority || 'medium',
            category: data.category || 'report',
            productTitle: data.productTitle || 'Product Asset'
          });
        }
      });
    }, (err) => {
      console.warn('[dashboardService] Firestore reports subscription error:', err);
    });
  } catch (e) {
    console.warn('[dashboardService] Failed to set up Firestore reports listener:', e);
    return () => {};
  }
};
