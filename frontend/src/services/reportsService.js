import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export const getReportAnalytics = async () => {
  return await backendFetch('/admin/reports/analytics');
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
      console.warn('[reportsService] Real-time reports subscription error:', err);
      callback([]);
    });
  } catch (e) {
    console.warn('[reportsService] Failed to bind reports listener:', e);
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
