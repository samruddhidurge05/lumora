export const generateDownloadLink = (productId) => {
  // Simple cryptographic simulation key or mock link generator
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `${window.location.origin}/downloads?product=${productId}&token=${token}`;
};

export const getDownloadErrorMessage = (code) => {
  switch (code) {
    case 'EXPIRED': return 'Download link has expired. Standard link lifespan is 24 hours.';
    case 'LIMIT_EXCEEDED': return 'Download attempt limit exceeded (maximum 5 times).';
    case 'INVALID_IP': return 'IP address mismatch. Downloads restricted to purchasing node IP.';
    default: return 'An unexpected download verification error occurred.';
  }
};
