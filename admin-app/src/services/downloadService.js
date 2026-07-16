/**
 * Download link utilities.
 * Secure download tokens are issued by the backend via
 * GET /api/products/{productId}/download-file?token=...
 * This service provides only error message helpers.
 * Never generate tokens client-side — they must come from the backend.
 */

export const getDownloadErrorMessage = (code) => {
  switch (code) {
    case 'EXPIRED': return 'Download link has expired. Standard link lifespan is 24 hours.';
    case 'LIMIT_EXCEEDED': return 'Download attempt limit exceeded (maximum 5 times).';
    case 'INVALID_IP': return 'IP address mismatch. Downloads restricted to purchasing node IP.';
    default: return 'An unexpected download verification error occurred.';
  }
};
