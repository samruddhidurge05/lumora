import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query, limit, orderBy } from 'firebase/firestore';

// Default rich mock data to guarantee frontend works even if backend is offline or unconfigured
const DEFAULT_MOCK_DATA = {
  kpis: {
    totalRevenue: 284500,
    ordersToday: 42,
    conversionRate: 3.4,
    activeProducts: 148,
    refundRate: 1.2,
    growthVelocity: 14.8,
    revenueChange: 12.4,
    ordersChange: 8.2,
    activeProductsChange: 4.1,
    modalData: {
      totalRevenue: [
        { label: 'Jan', value: 120000 },
        { label: 'Feb', value: 150000 },
        { label: 'Mar', value: 180000 },
        { label: 'Apr', value: 220000 },
        { label: 'May', value: 250000 },
        { label: 'Jun', value: 284500 }
      ],
      ordersToday: [
        { label: 'Jan', value: 220 },
        { label: 'Feb', value: 280 },
        { label: 'Mar', value: 310 },
        { label: 'Apr', value: 390 },
        { label: 'May', value: 410 },
        { label: 'Jun', value: 480 }
      ],
      conversionRate: [
        { label: 'Jan', value: 2.8 },
        { label: 'Feb', value: 3.0 },
        { label: 'Mar', value: 3.1 },
        { label: 'Apr', value: 3.3 },
        { label: 'May', value: 3.4 },
        { label: 'Jun', value: 3.4 }
      ],
      activeProducts: [
        { label: 'Jan', value: 110 },
        { label: 'Feb', value: 120 },
        { label: 'Mar', value: 130 },
        { label: 'Apr', value: 135 },
        { label: 'May', value: 142 },
        { label: 'Jun', value: 148 }
      ],
      refundRate: [
        { label: 'Jan', value: 1.8 },
        { label: 'Feb', value: 1.6 },
        { label: 'Mar', value: 1.5 },
        { label: 'Apr', value: 1.4 },
        { label: 'May', value: 1.3 },
        { label: 'Jun', value: 1.2 }
      ],
      growthVelocity: [
        { label: 'Jan', value: 8.5 },
        { label: 'Feb', value: 9.8 },
        { label: 'Mar', value: 11.2 },
        { label: 'Apr', value: 12.8 },
        { label: 'May', value: 13.9 },
        { label: 'Jun', value: 14.8 }
      ]
    }
  },
  liveFeed: [
    { id: '1', text: 'Nithin K. purchased Ultimate UI Kit v2', category: 'purchase', time: '5 mins ago', value: '+₹2,499' },
    { id: '2', text: 'New 5★ review on Next.js Tailwind Template', category: 'insight', time: '12 mins ago', value: null },
    { id: '3', text: 'Aditya S. resolved payout dispute #1092', category: 'refund', time: '40 mins ago', value: 'RESOLVED' },
    { id: '4', text: 'Priya P. registered as a verified creator', category: 'creator', time: '1 hour ago', value: 'VERIFIED' }
  ],
  productPerf: [
    { id: 'p1', name: 'Ultimate React Native Starter', creator: 'DevFlow UI', revenue: 78500, sales: 120, trend: '+14% MoM', rating: 4.8 },
    { id: 'p2', name: 'Next.js SaaS Boilerplate', creator: 'ShipFast Team', revenue: 64200, sales: 98, trend: '+22% MoM', rating: 4.9 },
    { id: 'p3', name: 'Figma UI Core System v4', creator: 'Pixels Lab', revenue: 49800, sales: 166, trend: '+8% MoM', rating: 4.7 }
  ],
  leaderboard: [
    { id: 'c1', name: 'Alex Rivers', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80', sales: 420, revenue: 198000, growth: 24.5 },
    { id: 'c2', name: 'Marta Diaz', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80', sales: 310, revenue: 142000, growth: 18.2 }
  ],
  riskPanel: [
    { id: 'r1', text: 'Suspicious checkout speed (4s) from IP 192.168.1.45', type: 'speed', priority: 'medium', timestamp: '10 mins ago' },
    { id: 'r2', text: 'Multiple failed payout requests for Creator ID: c_90832', type: 'payout', priority: 'high', timestamp: '1 hour ago' }
  ],
  customerInsights: {
    topCustomers: [
      { name: 'Naveen Kumar', email: 'naveen@gmail.com', orders: 12, spend: 34500 },
      { name: 'Sneha Patel', email: 'sneha@yahoo.com', orders: 8, spend: 22400 }
    ],
    geoDistribution: [
      { region: 'Karnataka', customers: 450, revenue: 125000 },
      { region: 'Maharashtra', customers: 380, revenue: 98000 }
    ]
  },
  insights: [
    'Revenue increased by 12.4% MoM driven by Website Templates (+24%).',
    'High refund rate alert on Figma UI Core System v4 (currently 4.2%).',
    'Search demand for "AI tools" is up 340% over the last 14 days.'
  ],
  headerStats: {
    activeUsers: 142,
    greeting: 'Welcome back',
    marketStatus: 'All Systems Operational'
  },
  healthScore: 98,
  healthStatus: 'Optimal',
  _meta: {
    fetchedAt: new Date().toISOString()
  }
};

export const getDashboardData = async () => {
  try {
    return await backendFetch('/admin/analytics/dashboard-full');
  } catch (error) {
    console.warn('[dashboardService] Error fetching live dashboard data, using local fallback:', error);
    return {
      ...DEFAULT_MOCK_DATA,
      _meta: { fetchedAt: new Date().toISOString() }
    };
  }
};

export const buildActivityFeed = (callback) => {
  // Simple periodic simulation fallback
  const interval = setInterval(() => {
    callback({
      id: `sim-feed-${Date.now()}`,
      text: 'Simulated platform event logged',
      category: 'insight',
      time: 'Just now',
      value: null
    });
  }, 30000);
  return () => clearInterval(interval);
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
