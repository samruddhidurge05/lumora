/**
 * storageService.js
 * -----------------
 * Uploads product assets (images, ZIP files) to the FastAPI backend.
 * Returns a result object compatible with the ProductsManagement form.
 *
 * Backend endpoints:
 *   POST /api/uploads/image  → { url, filename, size_bytes }
 *   POST /api/uploads/       → { url, filename, size_bytes }
 *
 * FUTURE MIGRATION NOTE:
 * To switch to Cloudflare R2 / AWS S3 / Firebase Storage, replace the
 * _uploadToBackend() function body. The returned object shape and all
 * call sites remain unchanged.
 */

import { buildBackendUrl, BACKEND_ORIGIN } from '../utils/api';
import { auth } from './firebase';
import { syncWithBackend, clearBackendToken } from './authService';

/**
 * Core upload helper — POSTs a file to the backend with JWT auth and progress.
 * Includes automatic token readiness check and silent 401 token refresh & retry.
 *
 * @param {File}     file        - File object to upload
 * @param {string}   endpoint    - e.g. '/api/uploads/image' or '/api/uploads/'
 * @param {Function} [onProgress] - optional (percent: number) => void callback
 * @param {boolean}  [_isRetry]  - internal retry flag for 401 token refresh
 * @returns {Promise<{ downloadUrl: string, storagePath: string, fileName: string, fileSize: number }>}
 */
async function _uploadToBackend(file, endpoint, onProgress, _isRetry = false) {
  const firebaseUser = auth?.currentUser;
  const activeRole = localStorage.getItem('lumora_active_role') || 'vendor';
  let token = localStorage.getItem('lumora_backend_token');

  // If token is missing but user is logged in, attempt a sync before initiating upload
  if (!token && firebaseUser) {
    try {
      const synced = await syncWithBackend(firebaseUser, activeRole);
      if (synced?.access_token) {
        token = synced.access_token;
      }
    } catch (_) {
      // Sync failed — proceed and let server respond
    }
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const uploadUrl = buildBackendUrl(endpoint);
    xhr.open('POST', uploadUrl);

    // Attach JWT token
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    // NOTE: Do NOT set Content-Type — the browser sets it with the correct boundary for FormData

    // Progress reporting
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          const rawUrl = res.url || '';
          // Resolve relative storage URLs to the real backend server origin.
          // Uses BACKEND_ORIGIN (http://localhost:8000) — NOT the Vite proxy path —
          // so the stored URL is always a fully-qualified absolute URL that works
          // in dev AND production without relying on the proxy.
          const downloadUrl = rawUrl.startsWith('http')
            ? rawUrl
            : `${BACKEND_ORIGIN}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

          resolve({
            downloadUrl,
            storagePath: res.saved_as || rawUrl,
            fileName:    res.filename || file.name,
            fileSize:    res.size_bytes || file.size,
          });
        } catch {
          reject(new Error('Invalid upload response from server.'));
        }
      } else if (xhr.status === 401 && !_isRetry && firebaseUser) {
        // Handle 401 Unauthorized — attempt silent token refresh and retry upload once
        try {
          const synced = await syncWithBackend(firebaseUser, activeRole, true);
          if (synced?.access_token) {
            const retryRes = await _uploadToBackend(file, endpoint, onProgress, true);
            return resolve(retryRes);
          }
        } catch (_) {}

        clearBackendToken();
        reject(new Error('Session expired. Please log in again.'));
      } else {
        let detail = 'Upload failed';
        try { detail = JSON.parse(xhr.responseText).detail || detail; } catch (_) {}
        reject(new Error(`HTTP ${xhr.status}: ${detail}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));

    const formData = new FormData();
    const isImgEndpoint = String(endpoint).includes('/image');
    const rawName = file.name || (isImgEndpoint ? 'image.jpg' : 'file.bin');
    const safeName = rawName.includes('.') ? rawName : `${rawName}${isImgEndpoint ? '.jpg' : '.bin'}`;
    formData.append('file', file, safeName);
    xhr.send(formData);
  });
}

/**
 * Upload a product thumbnail / preview image.
 * Accepts the old 3-arg signature (file, tempId, onProgress) used by ProductsManagement.
 * tempId is accepted but not used (kept for API compatibility).
 */
export function uploadThumbnail(file, tempIdOrProgress, onProgress) {
  // Support both (file, onProgress) and (file, tempId, onProgress) call styles
  const cb = typeof tempIdOrProgress === 'function' ? tempIdOrProgress : onProgress;
  return _uploadToBackend(file, '/api/uploads/image', cb);
}

/**
 * Upload a product ZIP / deliverable file.
 * Accepts the old 3-arg signature (file, tempId, onProgress).
 */
export function uploadProductFile(file, tempIdOrProgress, onProgress) {
  const cb = typeof tempIdOrProgress === 'function' ? tempIdOrProgress : onProgress;
  return _uploadToBackend(file, '/api/uploads/', cb);
}

/**
 * Upload a generic gallery image (used for multi-image gallery in ProductsManagement).
 * Returns { downloadUrl, fileName, fileSize }
 */
export function uploadGalleryImage(file, onProgress) {
  return _uploadToBackend(file, '/api/uploads/image', onProgress);
}

/**
 * Upload any file by explicit type ('image' | 'file').
 */
export function uploadFile(file, type, onProgress) {
  const endpoint = type === 'image' ? '/api/uploads/image' : '/api/uploads/';
  return _uploadToBackend(file, endpoint, onProgress);
}

/**
 * Delete a file by path (no-op stub — backend deletion not yet implemented).
 */
export const deleteFile = (path) => {
  // No-op: backend file deletion not yet implemented
  return Promise.resolve();
};

/**
 * Resolve a relative storage path to a full URL.
 */
export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${BACKEND_ORIGIN}/${path.replace(/^\//, '')}`;
};
