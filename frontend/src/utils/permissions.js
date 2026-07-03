export const ROLES = { CUSTOMER: 'customer', VENDOR: 'vendor', AFFILIATE: 'affiliate', ADMIN: 'admin' };

export const canAccessDashboard = (role) => !!role;
export const canSellProducts = (role) => [ROLES.VENDOR, ROLES.ADMIN].includes(role);
export const canAccessAdmin = (role) => role === ROLES.ADMIN;
export const canEarnCommissions = (role) => role === ROLES.AFFILIATE;
export const canManageUsers = (role) => role === ROLES.ADMIN;
