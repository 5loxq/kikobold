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
 * Maximum file sizes by type (in MB). `maxSizeMB` in validateFileUpload is
 * the fallback for extensions that are allowed but not listed here.
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
 * Checks the extension (allowlist + blocklist) and the file size. The
 * browser-reported MIME type is NOT used: it is unreliable across
 * platforms (often empty or application/octet-stream), while the
 * extension allowlist is the actual gate - and the importers parse and
 * structurally validate the content anyway.
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
 * Check if WebAssembly is supported in the browser. Only the presence of
 * the global WebAssembly object matters: instantiateStreaming is an
 * optional convenience that the engines do not require (they fall back
 * to array-buffer instantiation).
 */
export const checkWASMSupport = (): boolean => {
    return typeof WebAssembly !== 'undefined';
};
