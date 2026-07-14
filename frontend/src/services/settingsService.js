import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { backendFetch } from '../utils/api';

export const DEFAULT_PLATFORM_SETTINGS = {
  vendorSellingEnabled: true,
  vendorRegistrationEnabled: true,
  affiliateProgramEnabled: true,
  marketplaceMaintenanceMode: false,
  reviewSystemEnabled: true,
  reportsSystemEnabled: true,
  notificationsEnabled: true,
  analyticsEnabled: true,
  affiliateCommissionBaseRate: 30,
  maxProductsPerVendor: 100,
  payoutMinimumLimit: 1000,
  allowedFileTypes: ['zip', 'rar', 'pdf', 'png', 'jpg'],
  themeIntensity: 'rich',
  animationLevel: 'cinematic',
  glowEffects: true
};

const docRef = doc(db, 'platformSettings', 'global');

export const subscribeToPlatformSettings = (callback) => {
  try {
    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        // Fallback to local default if no Firestore document exists
        callback(DEFAULT_PLATFORM_SETTINGS);
      }
    }, (error) => {
      console.warn('[settingsService] Subscription error, fallback to defaults:', error);
      callback(DEFAULT_PLATFORM_SETTINGS);
    });
  } catch (error) {
    console.warn('[settingsService] Subscription setup failed:', error);
    callback(DEFAULT_PLATFORM_SETTINGS);
    return () => {};
  }
};

export const initPlatformSettings = async () => {
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, DEFAULT_PLATFORM_SETTINGS);
      return DEFAULT_PLATFORM_SETTINGS;
    }
    return snap.data();
  } catch (error) {
    console.warn('[settingsService] Init failed (non-fatal):', error);
    return DEFAULT_PLATFORM_SETTINGS;
  }
};

export const updatePlatformSetting = async (key, val) => {
  try {
    await backendFetch('/admin/settings/', { method: 'PUT', body: JSON.stringify({ [key]: val }) });
  } catch (error) {
    console.error('[settingsService] Error updating setting via backend:', error);
    throw error;
  }
};
