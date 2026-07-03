/**
 * vendorService.js
 * ────────────────
 * Service for vendor and affiliate status administration.
 * Calls the FastAPI backend REST API instead of writing directly to Firestore.
 */

import { backendFetch } from '../utils/api';

export const approveVendor = async (uid) => {
  return await backendFetch(`/admin/vendors/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'active' })
  });
};

export const rejectVendor = async (uid) => {
  return await backendFetch(`/admin/vendors/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'rejected' })
  });
};

export const suspendVendor = async (uid) => {
  return await backendFetch(`/admin/vendors/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'disabled' })
  });
};

export const restrictVendor = async (uid) => {
  return await backendFetch(`/admin/vendors/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'restricted' })
  });
};

export const approveAffiliate = async (uid) => {
  return await backendFetch(`/admin/affiliates/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'active' })
  });
};

export const disableAffiliate = async (uid) => {
  return await backendFetch(`/admin/affiliates/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'disabled' })
  });
};

export const suspendAffiliate = async (uid) => {
  return await backendFetch(`/admin/affiliates/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'suspended' })
  });
};

export const restrictAffiliate = async (uid) => {
  return await backendFetch(`/admin/affiliates/${uid}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'restricted' })
  });
};
