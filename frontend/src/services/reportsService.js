import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const DEFAULT_REPORT_ANALYTICS = {
  total: 6,
  openCount: 2,
  criticalCount: 1,
  resolvedCount: 3,
  avgResolutionHours: 4.5,
  reportsPerDay: [
    { label: 'Mon', count: 1 },
    { label: 'Tue', count: 0 },
    { label: 'Wed', count: 2 },
    { label: 'Thu', count: 1 },
    { label: 'Fri', count: 2 }
  ],
  mostReportedProducts: [
    { title: 'Next.js SaaS Boilerplate', productId: 'p2', count: 3 },
    { title: 'Ultimate React Native Starter', productId: 'p1', count: 2 },
    { title: 'Figma UI Core System v4', productId: 'p3', count: 1 }
  ],
  categoryBreakdown: [
    { category: 'Licensing Violation', count: 3 },
    { category: 'Defective Product', count: 2 },
    { category: 'Spam/Fraud', count: 1 }
  ],
  insights: [
    { type: 'critical', text: 'Licensing violations increased by 50% this week. Audit of top-reported vendors recommended.' },
    { type: 'info', text: 'Average resolution time decreased from 6.2 hours to 4.5 hours.' }
  ]
};

export const getReportAnalytics = async () => {
  try {
    return await backendFetch('/admin/reports/analytics');
  } catch (error) {
    console.warn('[reportsService] Error fetching report analytics, using local fallback:', error);
    return DEFAULT_REPORT_ANALYTICS;
  }
};

export const subscribeToReports = (callback) => {
  try {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(reports);
    }, (err) => {
      console.warn('[reportsService] Real-time reports subscription error, fallback to mock lists:', err);
      callback([
        { id: 'rep1', reporterName: 'Alice Green', productTitle: 'Next.js SaaS Boilerplate', category: 'Licensing Violation', description: 'This vendor is re-selling an open-source template without modifications.', severity: 'critical', status: 'Open', createdAt: new Date().toISOString() },
        { id: 'rep2', reporterName: 'Bob White', productTitle: 'Ultimate React Native Starter', category: 'Defective Product', description: 'The starter project fails to compile out of the box with the latest React version.', severity: 'medium', status: 'Open', createdAt: new Date().toISOString() }
      ]);
    });
  } catch (e) {
    console.warn('[reportsService] Failed to bind reports listener:', e);
    // Return empty unsubscribe hook
    return () => {};
  }
};

export const resolveReport = async (reportId) => {
  try {
    return await backendFetch('/admin/reports/resolve', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId })
    });
  } catch (error) {
    console.error('[reportsService] Error resolving report:', error);
    throw error;
  }
};

export const rejectReport = async (reportId) => {
  try {
    return await backendFetch('/admin/reports/reject', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId })
    });
  } catch (error) {
    console.error('[reportsService] Error rejecting report:', error);
    throw error;
  }
};

export const assignReport = async (reportId, adminId) => {
  try {
    return await backendFetch('/admin/reports/assign', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId, assignee: adminId })
    });
  } catch (error) {
    console.error('[reportsService] Error assigning report:', error);
    throw error;
  }
};

export const deleteReport = async (reportId) => {
  try {
    return await backendFetch('/admin/reports/delete', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId })
    });
  } catch (error) {
    console.error('[reportsService] Error deleting report:', error);
    throw error;
  }
};
