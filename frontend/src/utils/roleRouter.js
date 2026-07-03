/**
 * roleRouter.js
 * Utility to resolve the correct dashboard URL for a logged-in user.
 * Reads the role from Firestore so the route is always authoritative.
 */
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export async function getDashboardPath() {
  const user = auth.currentUser;
  if (!user) return '/auth/login-selection';
  try {
    const activeRole = localStorage.getItem('lumora_active_role');
    const snap = await getDoc(doc(db, 'users', user.uid));
    const role = activeRole || (snap.exists() ? snap.data().role : 'customer');
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'affiliate') return '/affiliate/dashboard';
    if (role === 'vendor') return '/vendor/dashboard';
    return '/customer/dashboard';
  } catch {
    return '/customer/dashboard';
  }
}

export function getDashboardPathByRole(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'affiliate') return '/affiliate/dashboard';
  if (role === 'vendor') return '/vendor/dashboard';
  return '/customer/dashboard';
}
