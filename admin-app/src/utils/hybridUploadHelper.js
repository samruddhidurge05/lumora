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
