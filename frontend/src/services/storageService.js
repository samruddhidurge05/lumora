import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export const uploadFile = (file, path, onProgress) => {
  return new Promise((resolve, reject) => {
    const isImage = file.type?.startsWith('image/') || path.includes('preview') || path.includes('image') || path.includes('avatar');
    const endpoint = isImage ? '/uploads/image' : '/uploads/';
    
    // We construct the full URL for upload
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const uploadUrl = `${apiBase}${endpoint}`;
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    
    // Attach JWT Authorization token if present
    const token = localStorage.getItem('lumora_backend_token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resJson = JSON.parse(xhr.responseText);
          const relativeUrl = resJson.url; // e.g., "/uploads/..."
          const origin = apiBase.replace(/\/api\/?$/, '');
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `${origin}${relativeUrl}`;
          resolve(fullUrl);
        } catch (e) {
          reject(new Error('Invalid upload response from server.'));
        }
      } else {
        let errorMsg = 'Upload failed';
        try {
          const resJson = JSON.parse(xhr.responseText);
          errorMsg = resJson.detail || errorMsg;
        } catch (_) {}
        reject(new Error(`${xhr.status}: ${errorMsg}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload.'));
    });
    
    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
};

export const deleteFile = async (path) => {
  // Backend file deletion can be implemented here if needed; currently a safe no-op.
  console.log('[storageService] delete file request:', path);
};

export const getFileUrl = (path) => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const origin = apiBase.replace(/\/api\/?$/, '');
  return path.startsWith('http') ? path : `${origin}/${path.replace(/^\//, '')}`;
};

export const uploadProductFile = (file, onProgress) => {
  return uploadFile(file, 'products/files', onProgress);
};

export const uploadThumbnail = (file, onProgress) => {
  return uploadFile(file, 'products/thumbnails', onProgress);
};

