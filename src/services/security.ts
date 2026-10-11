/**
 * Security utilities for the application
 * Provides input sanitization, upload validation, and capability checks.
 *
 * Kept deliberately small: everything that had no callers was removed in
 * v4.2.3 (full-sanitizer, URL/model-path validators, session storage
 * wrapper, duplicate formatBytes, memory estimation, ...). The full
 * sanitizeInput() was never imported anywhere - storage layers all use
 * sanitizeInputLight because the aggressive patterns mangled everyday
 * text (see the comments in ChatStorage/MemoryStorage/LibraryStorage).
 */

/**
 * Minimal structural type for the WebGPU adapter probe in checkWebGPUSupport.
 */
interface WebGPUAdapterLike {
    requestDevice: () => Promise<{ destroy: () => void } | null>;
}

/**
 * Lightweight sanitization for stored user text.
 * Only removes HTML tags - everything else (including "data:" or "on x ="
 * in normal sentences) is preserved.
 */
export const sanitizeInputLight = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  // Only remove HTML tags - preserve everything else including spaces
  return input.replace(/<[^>]*>/g, '');
};

/**
 * Allowed file types and their MIME types
 */
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.json': ['application/json', 'text/plain'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
};

/**
 * Maximum file sizes by type (in MB)
 */
const MAX_FILE_SIZES: Record<string, number> = {
  '.json': 10,  // 10MB for JSON files
  '.txt': 1,   // 1MB for text files
  '.md': 2,    // 2MB for markdown files
  'default': 5, // 5MB default
};

/**
 * Dangerous file extensions to block
 */
const DANGEROUS_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.php', '.py',
  '.sh', '.bat', '.cmd', '.ps1', '.vbs', '.exe', '.dll', '.so',
  '.jar', '.class', '.war', '.ear', '.msi', '.com', '.pif',
  '.application', '.gadget', '.msu', '.msp', '.mst', '.cpl'
];

/**
 * Validate file uploads for security
 * Checks file type, size, extension, and content
 */
export const validateFileUpload = (
  file: File,
  maxSizeMB: number = 5,
  allowedExtensions: string[] = ['.json']
): { valid: boolean; error?: string } => {
  if (!(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  // Check file name for dangerous patterns
  const fileName = file.name.toLowerCase();

  // Block files with dangerous extensions
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return { valid: false, error: `Dangerous file extension: ${ext}` };
    }
  }

  // Check if file extension is allowed. A name without a dot would make
  // lastIndexOf return -1 and slice(-1) yield the last character as a
  // bogus "extension".
  const dotIndex = fileName.lastIndexOf('.');
  const fileExtension = dotIndex === -1 ? '' : fileName.slice(dotIndex);
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: `File extension not allowed: ${fileExtension}` };
  }

  // Check file size
  const maxSize = MAX_FILE_SIZES[fileExtension] || maxSizeMB;
  if (file.size > maxSize * 1024 * 1024) {
    return { valid: false, error: `File too large. Maximum size: ${maxSize}MB` };
  }

  // Check file type for known extensions
  if (fileExtension in ALLOWED_FILE_TYPES) {
    const allowedTypes = ALLOWED_FILE_TYPES[fileExtension];
    if (!allowedTypes.includes(file.type)) {
      // Some browsers may not set the correct MIME type, so we also check by extension
      if (!fileName.endsWith(fileExtension)) {
        return { valid: false, error: `Invalid file type for extension: ${fileExtension}` };
      }
    }
  }

  // Additional check: prevent files with multiple extensions
  if (fileName.split('.').length > 2) {
    const parts = fileName.split('.');
    const lastPart = parts[parts.length - 1];

    // Check if the last part is a dangerous extension
    for (const ext of DANGEROUS_EXTENSIONS) {
      if (lastPart === ext.replace('.', '')) {
        return { valid: false, error: 'Dangerous file extension detected' };
      }
    }
  }

  return { valid: true };
};

/**
 * Check if WebGPU is supported in the browser
 */
export const checkWebGPUSupport = async (): Promise<boolean> => {
    try {
        if (!('gpu' in navigator)) {
            return false;
        }

        const gpu = (navigator as Navigator & {
            gpu?: { requestAdapter: () => Promise<WebGPUAdapterLike | null> };
        }).gpu;
        const adapter = await gpu?.requestAdapter();
        if (!adapter) {
            return false;
        }

        const device = await adapter.requestDevice();
        const supported = !!device;
        // Release the device again: this check runs several times per app
        // start (GPU detection, feature detection) and every requestDevice()
        // otherwise leaks a GPU device until page reload.
        device?.destroy();

        return supported;
    } catch {
        return false;
    }
};

/**
 * Check if WASM is supported in the browser
 * Note: Returns true even if instantiateStreaming is not available,
 * as basic WebAssembly is still functional
 */
export const checkWASMSupport = (): boolean => {
    try {
        if (typeof WebAssembly === 'undefined') {
            return false;
        }

        // Some older browsers don't support streaming but still support basic WASM
        if (typeof WebAssembly.instantiateStreaming === 'undefined') {
            return true; // WASM is still supported, just not streaming
        }

        return true;
    } catch {
        return false;
    }
};
