import JSZip from 'jszip';

// Direct pass-through formats (single file upload -> no ZIP packaging needed)
const DIRECT_PASSTHROUGH_EXTENSIONS = new Set([
  'zip', 'pdf', 'epub', 'docx', 'doc', 'ppt', 'pptx',
  'mp4', 'mov', 'webm', 'avi', 'mp3', 'wav',
  'fig', 'psd', 'ai', 'sketch', 'blend'
]);

// Large video extensions to prompt for confirmation if total size > 100MB
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v']);

export const HYBRID_LIMITS = {
  MAX_FILE_COUNT: 1000,
  MAX_TOTAL_SIZE_BYTES: 500 * 1024 * 1024, // 500MB
  LARGE_VIDEO_WARN_BYTES: 100 * 1024 * 1024, // 100MB
};

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * User-friendly error message formatter for upload operations.
 * Safely parses string errors, HTTP status codes (503, 500, 405, timeouts),
 * network failures, or Error objects without throwing exceptions.
 */
export function formatUserFriendlyError(rawErr) {
  if (!rawErr) return null;
  
  const errStr = typeof rawErr === 'string' 
    ? rawErr 
    : (rawErr?.message || String(rawErr || ''));
  const str = errStr.toLowerCase();

  // Storage Service Unavailable / Timeout / Backblaze 503
  if (str.includes('503') || str.includes('unavailable') || str.includes('timed out') || str.includes('timeout') || str.includes('backblaze')) {
    return 'Upload failed. Storage service is temporarily unavailable. Please try again.';
  }
  // File size limit
  if (str.includes('too large') || str.includes('exceeds')) {
    return 'This file is too large.';
  }
  // Unsupported file type
  if (str.includes('unsupported') || str.includes('invalid file type')) {
    return "This file type isn't supported.";
  }
  // Network connection error / offline
  if (str.includes('network') || str.includes('failed to fetch') || str.includes('offline') || str.includes('abort')) {
    return "Couldn't upload. Check your connection.";
  }
  // Storage quota
  if (str.includes('storage') || str.includes('quota')) {
    return 'Storage is temporarily unavailable.';
  }
  // Server error / HTTP 405 / HTTP 500
  if (str.includes('405') || str.includes('500') || str.includes('server') || str.includes('upload failed')) {
    return 'Upload failed. Please try again.';
  }
  
  // Safe fallback to raw string message if available, or generic message
  return errStr.length < 80 ? errStr : 'Upload failed. Please try again.';
}

/**
 * Returns a human-friendly badge label for uploaded assets.
 */
export function getFileBadgeLabel(fileName, packaging) {
  if (packaging?.isFolder) return 'Folder Uploaded';
  if (packaging?.isPackaged) return 'Prepared Automatically';
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) return 'Video';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  if (['psd', 'fig', 'ai', 'sketch', 'docx', 'doc', 'epub', 'ppt', 'pptx'].includes(ext)) return 'Template';
  return 'Ready';
}

/**
 * Inspects and validates files before packaging or uploading.
 */
export function validateUploadSelection(fileList) {
  if (!fileList || fileList.length === 0) {
    return { valid: false, error: 'No files selected for upload.' };
  }

  // Filter out OS junk files
  const validFiles = Array.from(fileList).filter(
    f => !f.name.startsWith('.') && f.name !== 'Thumbs.db' && f.name !== 'desktop.ini'
  );

  if (validFiles.length === 0) {
    return { valid: false, error: 'The selected folder contains no valid asset files.' };
  }

  // Limit 1: File Count Limit
  if (validFiles.length > HYBRID_LIMITS.MAX_FILE_COUNT) {
    return {
      valid: false,
      error: `Selection exceeds maximum limit of ${HYBRID_LIMITS.MAX_FILE_COUNT} files (${validFiles.length} files selected).`
    };
  }

  // Limit 2: Memory & Total Size Limit
  let totalSize = 0;
  const nameSet = new Set();
  let duplicateCount = 0;
  let hasVideo = false;

  for (const file of validFiles) {
    totalSize += file.size;
    const relPath = file.webkitRelativePath || file.name;
    if (nameSet.has(relPath)) {
      duplicateCount++;
    }
    nameSet.add(relPath);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) {
      hasVideo = true;
    }
  }

  if (totalSize > HYBRID_LIMITS.MAX_TOTAL_SIZE_BYTES) {
    return {
      valid: false,
      error: `Total package size (${formatBytes(totalSize)}) exceeds browser limit of ${formatBytes(HYBRID_LIMITS.MAX_TOTAL_SIZE_BYTES)}. Please compress manually into a ZIP before uploading.`
    };
  }

  // Warning check for large video bundles
  const requiresVideoConfirm = hasVideo && validFiles.length > 1 && totalSize > HYBRID_LIMITS.LARGE_VIDEO_WARN_BYTES;

  return {
    valid: true,
    files: validFiles,
    totalSize,
    duplicateCount,
    requiresVideoConfirm,
    fileCount: validFiles.length
  };
}

/**
 * Normalizes input selection into a single File ready for backend upload.
 */
export async function prepareUploadPayload(input, options = {}) {
  const {
    bundleName = 'product_package',
    onPackagingProgress,
    skipVideoConfirm = false
  } = options;

  let rawList = [];
  if (input instanceof File) rawList = [input];
  else if (input instanceof FileList) rawList = Array.from(input);
  else if (Array.isArray(input)) rawList = input;

  const validation = validateUploadSelection(rawList);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { files, totalSize, requiresVideoConfirm } = validation;

  if (requiresVideoConfirm && !skipVideoConfirm) {
    throw new Error('LARGE_VIDEO_CONFIRM_REQUIRED');
  }

  // CASE 1 & 4-6: Single file uploaded
  if (files.length === 1) {
    const singleFile = files[0];
    const ext = (singleFile.name.split('.').pop() || '').toLowerCase();

    if (DIRECT_PASSTHROUGH_EXTENSIONS.has(ext)) {
      return {
        file: singleFile,
        isPackaged: false,
        originalCount: 1,
        originalSizeBytes: singleFile.size,
        finalSizeBytes: singleFile.size,
        formattedSize: formatBytes(singleFile.size),
        fileName: singleFile.name,
        compressionRatio: '100% (Original)'
      };
    }
  }

  // CASE 2, 3 & 7: Package multiple files or folder into ZIP with structure preservation
  const zip = new JSZip();

  for (const file of files) {
    // Preserve subfolder structure via webkitRelativePath
    const relativePath = file.webkitRelativePath || file.name;
    zip.file(relativePath, file);
  }

  let zipFileName = `${bundleName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.zip`;
  if (files[0]?.webkitRelativePath) {
    const rootFolder = files[0].webkitRelativePath.split('/')[0];
    if (rootFolder) zipFileName = `${rootFolder.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.zip`;
  } else if (files.length === 1) {
    const baseName = files[0].name.replace(/\.[^/.]+$/, '');
    zipFileName = `${baseName}.zip`;
  }

  // Compress to Blob with progress callback
  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    },
    (metadata) => {
      if (onPackagingProgress && metadata.percent) {
        onPackagingProgress(Math.round(metadata.percent));
      }
    }
  );

  const packagedFile = new File([zipBlob], zipFileName, {
    type: 'application/zip',
    lastModified: Date.now()
  });

  const ratio = totalSize > 0 ? Math.round((packagedFile.size / totalSize) * 100) : 100;

  return {
    file: packagedFile,
    isPackaged: true,
    originalCount: files.length,
    originalSizeBytes: totalSize,
    finalSizeBytes: packagedFile.size,
    formattedSize: formatBytes(packagedFile.size),
    fileName: zipFileName,
    compressionRatio: `${ratio}% of original`
  };
}
