/**
 * refundService.js
 * ─────────────────
 * Admin-side service for all Refund Request API calls.
 * All endpoints are under /api/admin/refunds/ and require an admin JWT.
 */

import { backendFetch } from '../utils/api';

/**
 * Fetch all refund requests (admin view).
 * @param {string|null} status  Optional status filter e.g. "PENDING"
 * @param {number} page         1-indexed page number
 * @param {number} pageSize     Items per page (max 100)
 * @returns {Promise<Array>}
 */
export async function fetchAllRefunds(status = null, page = 1, pageSize = 50) {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (status) params.set('status', status);
  const result = await backendFetch(`/admin/refunds/?${params.toString()}`);
  if (!Array.isArray(result)) {
    console.error('[refundService] fetchAllRefunds: expected array, got', typeof result);
    return [];
  }
  return result;
}

/**
 * Approve a refund request.
 * @param {number} requestId
 * @param {string|null} notes  Optional admin notes
 * @returns {Promise<Object>}  Updated RefundRequest
 */
export async function approveRefund(requestId, notes = null) {
  const result = await backendFetch(`/admin/refunds/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  console.log(`[refundService] Approved refund TKT-${requestId}`);
  return result;
}

/**
 * Reject a refund request.
 * @param {number} requestId
 * @param {string|null} notes  Optional admin notes / reason for rejection
 * @returns {Promise<Object>}  Updated RefundRequest
 */
export async function rejectRefund(requestId, notes = null) {
  const result = await backendFetch(`/admin/refunds/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  console.log(`[refundService] Rejected refund TKT-${requestId}`);
  return result;
}

/**
 * Update the status of a refund request to any valid status.
 * Valid statuses: PENDING | UNDER_REVIEW | APPROVED | PROCESSING | REFUNDED | FAILED | REJECTED | CANCELLED
 * @param {number} requestId
 * @param {string} status
 * @returns {Promise<Object>}  Updated RefundRequest
 */
export async function updateRefundStatus(requestId, status) {
  const result = await backendFetch(`/admin/refunds/${requestId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status_val: status }),
  });
  console.log(`[refundService] Updated refund TKT-${requestId} status → ${status}`);
  return result;
}
