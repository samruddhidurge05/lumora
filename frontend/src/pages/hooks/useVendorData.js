/**
 * pages/hooks/useVendorData.js
 * ----------------------------
 * Re-export bridge so that vendor pages can import from '../hooks/useVendorData'
 * (relative to src/pages/vendor/) and still resolve to src/hooks/useVendorData.js.
 */
export {
  useDashboard,
  useOrders,
  useVendorProfile,
  useStoreSettings,
  useWithdrawals,
  useReviews,
  useVendorProducts,
  useEarnings,
} from '../../hooks/useVendorData';
