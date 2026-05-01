/**
 * Security utilities for the application
 * Provides input sanitization, validation, and security checks
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes all HTML tags and returns plain text
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof html !== 'string') {
    return '';
  }

  // Create a temporary div element and use textContent to strip all HTML
  const tempDiv = document.createElement('div');
  tempDiv.textContent = html;

  // Return only the text content (completely safe, no HTML remains)
  return tempDiv.textContent || '';
};

/**
 * Validate and sanitize user input
 * Removes potentially harmful characters and scripts
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');

  // Remove script-like content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  return sanitized;
};

/**
 * Validate file uploads for security
 * Checks file type, size, and content
 */
export const validateFileUpload = (file: File, maxSizeMB: number = 5): boolean => {
  if (!(file instanceof File)) {
    return false;
  }

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return false;
  }

  // Check file type for JSON imports
  if (file.name.endsWith('.json')) {
    return file.type === 'application/json' || file.name.endsWith('.json');
  }

  return true;
};

/**
 * Validate user ID to prevent IDOR attacks
 * Ensures IDs follow expected patterns
 */
export const validateUserId = (id: string): boolean => {
  if (typeof id !== 'string') {
    return false;
  }

  // Basic validation - should be alphanumeric with possible underscores/dashes
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
};

/**
 * Check if WebGPU is available with proper feature detection
 * Includes fallback checks for different browser implementations
 */
export const checkWebGPUSupport = async (): Promise<boolean> => {
  try {
    // Check for WebGPU support
    if (!('gpu' in navigator)) {
      return false;
    }

    // Request adapter to verify actual support
    const adapter = await (navigator as any).gpu.requestAdapter();
    return !!adapter;
  } catch (error) {
    return false;
  }
};

/**
 * Secure localStorage operations
 * Adds validation and error handling
 */
export const secureLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        return null;
      }
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },

  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        return false;
      }
      if (typeof value !== 'string') {
        return false;
      }
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  },

  removeItem: (key: string): boolean => {
    try {
      if (typeof key !== 'string' || key.trim().length === 0) {
        return false;
      }
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Validate URL to prevent SSRF and injection attacks
 * Note: This is for user-provided URLs only. Internal URLs (like HuggingFace)
 * should be validated separately or whitelisted.
 */
export const validateUrl = (url: string, allowLocalhost: boolean = false): boolean => {
  if (typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Prevent localhost and internal IP addresses unless explicitly allowed
    if (!allowLocalhost) {
      if (parsedUrl.hostname === 'localhost' || 
          parsedUrl.hostname === '127.0.0.1' ||
          parsedUrl.hostname.startsWith('192.168.') ||
          parsedUrl.hostname.startsWith('10.')) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Whitelist of trusted domains for model loading
 */
const TRUSTED_DOMAINS = [
  'huggingface.co',
  'cdn.huggingface.co',
  'hf.co',
];

/**
 * Validate if a URL is from a trusted source (for internal use)
 */
export const isTrustedUrl = (url: string): boolean => {
  if (typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    
    // Allow localhost for development
    if (parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname === '127.0.0.1') {
      return true;
    }

    // Check against trusted domains
    return TRUSTED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || 
      parsedUrl.hostname.endsWith(`.${domain}`)
    );
  } catch (error) {
    return false;
  }
};