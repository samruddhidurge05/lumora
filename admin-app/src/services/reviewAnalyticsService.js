import { backendFetch } from '../utils/api';

export const getReviewAnalytics = async () => {
  return await backendFetch('/admin/reviews/dashboard');
};
