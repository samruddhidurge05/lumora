import { backendFetch } from '../utils/api';
import { db } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

export const getReportAnalytics = async () => {
  return await backendFetch('/admin/reports/analytics');
};

export const subscribeToReports = (callback) => {
  try {
    // NOTE: Do NOT use orderBy('createdAt') here.
    // Firestore silently excludes documents that are missing the ordered field.
    // Older reports only have `created_at` (snake_case), so they would vanish
    // from the snapshot entirely. We fetch all docs and sort client-side instead.
    const q = query(collection(db, 'reports'));
    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          // Support both camelCase and snake_case timestamp fields
          const aTime = a.createdAt || a.created_at || '';
          const bTime = b.createdAt || b.created_at || '';
          return bTime.localeCompare(aTime); // descending (newest first)
        });
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

export const resolveReport = async (reportId, note = '') => {
  try {
    return await backendFetch('/admin/reports/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, note }),
    });
  } catch (error) {
    console.error('[reportsService] Error resolving report:', error);
    throw error;
  }
};

export const rejectReport = async (reportId, note = '') => {
  try {
    return await backendFetch('/admin/reports/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, note }),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId, assignee: adminId }),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id: reportId }),
    });
  } catch (error) {
    console.error('[reportsService] Error deleting report:', error);
    throw error;
  }
};
