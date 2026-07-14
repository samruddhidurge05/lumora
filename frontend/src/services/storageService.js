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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// Separate constant for the backend server origin used to resolve upload response URLs.
// VITE_API_BASE_URL may be '/api' (proxy path) in dev — but uploaded file URLs must
// always resolve to the real backend server, not the Vite dev server.
const BACKEND_ORIGIN = (() => {
  const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  // If base is a relative path ('/api'), fall back to the explicit backend URL.
  if (base.startsWith('/')) {
    const origin = import.meta.env.VITE_BACKEND_ORIGIN;
    if (origin && origin !== 'http://localhost:8000') {
      return origin;
    }
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return base.replace(/\/api\/?$/, '');
})();

/**
 * Core upload helper — POSTs a file to the backend with JWT auth and progress.
 * Returns a result object: { downloadUrl, storagePath, fileName, fileSize }
 *
 * @param {File}     file        - File object to upload
 * @param {string}   endpoint    - e.g. '/api/uploads/image' or '/api/uploads/'
 * @param {Function} [onProgress] - optional (percent: number) => void callback
 * @returns {Promise<{ downloadUrl: string, storagePath: string, fileName: string, fileSize: number }>}
 */
function _uploadToBackend(file, endpoint, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Use a root-relative path so the request routes through Vite's /api proxy.
    // This avoids CORS issues when the dev server runs on any port (5173, 5174, 5175…)
    // because the browser sees it as same-origin. In production the reverse proxy handles it.
    xhr.open('POST', endpoint);

    // Attach JWT token
    const token = localStorage.getItem('lumora_backend_token');
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

    xhr.addEventListener('load', () => {
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
      } else {
        let detail = 'Upload failed';
        try { detail = JSON.parse(xhr.responseText).detail || detail; } catch (_) {}
        reject(new Error(`HTTP ${xhr.status}: ${detail}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));

    const formData = new FormData();
    formData.append('file', file);
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
  console.log('[storageService] delete request (no-op):', path);
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
