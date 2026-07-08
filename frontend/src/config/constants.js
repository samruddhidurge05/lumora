export const SITE_NAME = 'Lumora';
export const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
export const CURRENCY = 'INR';
export const USD_TO_INR = 80;

export const PRODUCT_CATEGORIES = [
  'All',
  'Website Templates',
  'Landing Pages',
  'Mobile App Designs',
  'UI Kits',
  'AI Tools',
  'Design Assets',
  'E-books',
  'Notion Templates',
  'Productivity Tools',
  'Social Media Kits',
];

export const USER_ROLES = {
  CUSTOMER: 'customer',
  VENDOR:   'vendor',
  AFFILIATE: 'affiliate',
  ADMIN:    'admin',
};

export const ORDER_STATUS = {
  PENDING:   'pending',
  COMPLETED: 'completed',
  REFUNDED:  'refunded',
  CANCELLED: 'cancelled',
};

export const AFFILIATE_COMMISSION_RATES = {
  'Website Templates': 20,
  'Mobile Templates':  18,
  'UI Kits':           22,
  'AI Creator Tools':  25,
  'Branding Assets':   20,
  'Presets':           15,
  'Courses':           30,
  'Productivity Systems': 18,
};
