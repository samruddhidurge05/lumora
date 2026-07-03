import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase.js';
import { backendFetch } from '../../../utils/api';

const docRef = doc(db, 'platformSettings', 'global');

export const DEFAULT_PLATFORM_STATUS = {
  isPlatformPaused: false,
  pauseMessage: 'Lumora is temporarily paused by the platform administrators',
  lastUpdated: new Date().toISOString(),
  updatedBy: 'system'
};

/**
 * Enables the platform (resumes normal operations)
 */
export async function enablePlatform() {
  try {
    await backendFetch('/admin/settings/resume', {
      method: 'POST'
    });
    return { success: true };
  } catch (error) {
    console.error('[platformService] Error enabling platform:', error);
    throw error;
  }
}

/**
 * Disables the platform (activates maintenance/pause mode)
 * @param {string} message - Custom message to show users
 */
export async function disablePlatform(message) {
  try {
    await backendFetch('/admin/settings/pause', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    return { success: true };
  } catch (error) {
    console.error('[platformService] Error disabling platform:', error);
    throw error;
  }
}

export async function getPlatformStatus() {
  try {
    return await backendFetch('/admin/settings/');
  } catch (error) {
    console.error('[platformService] Error fetching platform settings via REST:', error);
    throw error;
  }
}

/**
 * Subscribes to platformSettings/global real-time changes
 * @param {function} callback - Callback function receives the status data
 * @param {function} onError - Optional callback for error fallback handling
 */
export function subscribePlatformStatus(callback, onError) {
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback(DEFAULT_PLATFORM_STATUS);
    }
  }, (error) => {
    if (onError) {
      onError(error);
    } else {
      console.warn('[platformService] Error subscribing to global platform settings:', error.message);
    }
  });
}
