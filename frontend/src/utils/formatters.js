export const formatPrice = (priceINR) => {
  if (typeof priceINR !== 'number') {
    const parsed = parseFloat(String(priceINR).replace(/[^0-9.]/g, ''));
    if (isNaN(parsed)) return priceINR;
    priceINR = parsed;
  }
  // Prices in Lumora are stored and entered in INR (₹) by vendors.
  // Do NOT multiply by any conversion factor — format directly as INR.
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Math.round(priceINR));
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(n);

export const truncate = (str, len = 80) => str && str.length > len ? str.substring(0, len) + '…' : str;

export const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
