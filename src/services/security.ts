/**
 * Security utilities for the application
 * Provides input sanitization, validation, and security checks
 */

// Whitelist of trusted domains for model loading
const TRUSTED_DOMAINS = [
  'huggingface.co',
  'cdn.huggingface.co',
  'hf.co',
  'github.com',
  'raw.githubusercontent.com',
  'modelscope.cn',
];

// XSS dangerous patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
  /<iframe\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /<embed\b[^>]*>/gi,
  /<svg\b[^>]*>/gi,
];

// Control characters and dangerous Unicode
const DANGEROUS_CHARS = /[\x00-\x1F\x7F-\x9F\u2028\u2029]/g;

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
 * Lightweight sanitization for real-time input (preserves ALL spaces)
 * Only removes HTML tags to prevent XSS in real-time typing
 */
export const sanitizeInputLight = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  // Only remove HTML tags - preserve everything else including spaces
  return input.replace(/<[^>]*>/g, '');
};

/**
 * Full sanitization for storage (removes dangerous content)
 * Preserves ALL normal spaces between words - only removes dangerous content
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove all XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove dangerous control characters (but NOT spaces!)
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');

  // Only trim leading and trailing whitespace - preserve all spaces in between
  sanitized = sanitized.trim();

  return sanitized;
};

/**
 * Sanitize text for safe display (allows basic formatting but removes dangerous content)
 */
export const sanitizeForDisplay = (text: string): string => {
  if (typeof text !== 'string') {
    return '';
  }

  // First apply full sanitization
  let sanitized = sanitizeInput(text);

  // Then allow safe line breaks and basic formatting
  sanitized = sanitized
    .replace(/\n/g, '<br/>')
    .replace(/\*/g, '<strong>')
    .replace(/\*/g, '</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');

  return sanitized;
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

  // Check if file extension is allowed
  const fileExtension = fileName.slice(fileName.lastIndexOf('.'));
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
 * Validate file content for JSON files
 */
export const validateJsonContent = (content: string): { valid: boolean; error?: string } => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return { valid: false, error: 'Empty content' };
  }

  try {
    // Check for suspicious content
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /new\s+Function\s*\(/i,
      /document\.write\s*\(/i,
      /innerHTML\s*=/i,
      /require\s*\(/i,
      /import\s+.*\s+from\s+/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        return { valid: false, error: 'Suspicious content detected' };
      }
    }

    // Try to parse as JSON
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
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
 * Internal IP address patterns to block for SSRF prevention
 */
const INTERNAL_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^\[::1\]$/,
  /^::1$/,
  /^fe80:/i,
  /^link-local$/i,
];

/**
 * Validate URL to prevent SSRF and injection attacks
 * Note: This is for user-provided URLs only. Internal URLs (like HuggingFace)
 * should be validated separately or whitelisted.
 */
export const validateUrl = (url: string, allowLocalhost: boolean = false): boolean => {
  if (typeof url !== 'string') {
    return false;
  }

  // Trim and check for empty string
  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return false;
    }

    // Prevent localhost and internal IP addresses unless explicitly allowed
    if (!allowLocalhost) {
      const hostname = parsedUrl.hostname.toLowerCase();
      
      // Check against internal IP patterns
      for (const pattern of INTERNAL_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return false;
        }
      }
    }

    // Additional security checks
    if (parsedUrl.username || parsedUrl.password) {
      // URLs with credentials are not allowed
      return false;
    }

    // Check for suspicious query parameters
    if (parsedUrl.search.includes('redirect=') || 
        parsedUrl.search.includes('callback=') ||
        parsedUrl.search.includes('next=')) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validate if a URL is from a trusted source (for internal use)
 */
export const isTrustedUrl = (url: string): boolean => {
  if (typeof url !== 'string') {
    return false;
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    return false;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    
    // Allow localhost for development
    if (parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname === '127.0.0.1') {
      return true;
    }

    // Check against trusted domains
    const hostname = parsedUrl.hostname.toLowerCase();
    return TRUSTED_DOMAINS.some(domain => 
      hostname === domain || 
      hostname.endsWith(`.${domain}`)
    );
  } catch (error) {
    return false;
  }
};

/**
 * Validate model path for security
 * Only allows paths from trusted sources or specific patterns
 */
export const validateModelPath = (path: string): boolean => {
  if (typeof path !== 'string') {
    return false;
  }

  const trimmedPath = path.trim();
  if (trimmedPath.length === 0) {
    return false;
  }

  // Allow HuggingFace model paths (Xenova/ prefix)
  // This is specifically for @xenova/transformers model identifiers
  if (trimmedPath.startsWith('Xenova/')) {
    // Validate that it only contains safe characters for model names
    const modelPart = trimmedPath.substring('Xenova/'.length);
    return /^[a-zA-Z0-9._\-/]+$/.test(modelPart);
  }

  // Allow full HuggingFace URLs
  if (trimmedPath.includes('huggingface.co/')) {
    return isTrustedUrl(trimmedPath);
  }

  // Allow HuggingFace protocol prefix
  if (trimmedPath.startsWith('huggingface:')) {
    const modelPart = trimmedPath.substring('huggingface:'.length);
    return /^[a-zA-Z0-9._\-/]+$/.test(modelPart);
  }

  // Allow local paths (for development) - but be more restrictive
  if (trimmedPath.startsWith('/models/') || 
      trimmedPath.startsWith('./models/') ||
      trimmedPath.startsWith('../models/')) {
    // Sanitize path to prevent directory traversal
    const sanitized = sanitizeFilePath(trimmedPath);
    return sanitized.startsWith('/models/') || 
           sanitized.startsWith('./models/') ||
           sanitized.startsWith('../models/');
  }

  // Validate as URL - but only allow trusted domains
  // Don't allow localhost or internal IPs for model loading
  return isTrustedUrl(trimmedPath);
};

/**
 * Check if a URL uses HTTPS
 */
export const checkHTTPS = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

/**
 * Check if a URL is from a trusted domain
 */
export const isTrustedDomain = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        
        // Check if domain or any of its subdomains are trusted
        return TRUSTED_DOMAINS.some(trusted => {
            // Exact match
            if (hostname === trusted) return true;
            // Subdomain match
            if (hostname.endsWith(`.${trusted}`)) return true;
            return false;
        });
    } catch {
        return false;
    }
};

/**
 * Validate a model ID
 */
export const validateModelId = (id: string): boolean => {
    if (!id || typeof id !== 'string') {
        return false;
    }

    // Basic validation - should be alphanumeric with possible underscores/dashes
    return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
};

/**
 * Sanitize model name for display
 */
export const sanitizeModelName = (name: string): string => {
    if (!name || typeof name !== 'string') {
        return 'Unknown Model';
    }

    // Limit length
    if (name.length > 100) {
        return name.substring(0, 100);
    }

    // Remove potentially dangerous characters
    return name.replace(/[<>"'`]/g, '');
};

/**
 * Format bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.min(
        units.length - 1,
        Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const value = bytes / Math.pow(1024, idx);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
};

/**
 * Sanitize file path
 */
export const sanitizeFilePath = (path: string): string => {
    if (!path || typeof path !== 'string') {
        return '';
    }

    // Remove path traversal attempts
    return path
        .replace(/\.\./g, '')
        .replace(/\.\//g, '')
        .replace(/[<>:"|?*]/g, '');
};

/**
 * Validate and sanitize chat message content
 */
export const sanitizeMessageContent = (content: string): string => {
    if (!content || typeof content !== 'string') {
        return '';
    }

    // Limit message length
    if (content.length > 50000) {
        console.warn(`Message too long (${content.length} chars), truncating to 50000`);
        content = content.substring(0, 50000);
    }

    // Use existing sanitization
    return sanitizeInput(content);
};

/**
 * Check if WebGPU is supported in the browser
 */
export const checkWebGPUSupport = async (): Promise<boolean> => {
    try {
        if (!('gpu' in navigator)) {
            return false;
        }

        const adapter = await (navigator as any).gpu.requestAdapter();
        if (!adapter) {
            return false;
        }

        const device = await adapter.requestDevice();
        return !!device;
        
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
    } catch (err) {
        console.warn('WASM check failed:', err);
        return false;
    }
};

// Alias for backward compatibility
export const isWASMSupported = checkWASMSupport;

/**
 * Check if the browser supports required features for LLM inference
 */
export const checkBrowserCompatibility = async (): Promise<{
    webgpu: boolean;
    wasm: boolean;
    offline: boolean;
    storage: boolean;
    allRequired: boolean;
}> => {
    const webgpu = await checkWebGPUSupport();
    const wasm = checkWASMSupport();
    const offline = 'serviceWorker' in navigator;
    const storage = 'indexedDB' in window || 'caches' in window;

    const allRequired = webgpu && wasm && storage;

    return {
        webgpu,
        wasm,
        offline,
        storage,
        allRequired,
    };
};

/**
 * Get browser-specific security recommendations
 */
export const getSecurityRecommendations = async (): Promise<string[]> => {
    const recommendations: string[] = [];
    const compatibility = await checkBrowserCompatibility();

    if (!compatibility.webgpu) {
        recommendations.push('WebGPU is not supported. Some models may not work or will be slower.');
    }

    if (!compatibility.wasm) {
        recommendations.push('WebAssembly is not supported. LLM inference will not work.');
    }

    if (!compatibility.storage) {
        recommendations.push('Storage APIs are not available. Model caching will be limited.');
    }

    // Check if we're in a secure context
    if (!window.isSecureContext) {
        recommendations.push('Not in a secure context. Some features may be limited.');
    }

    return recommendations;
};

/**
 * Create a secure URL for model downloads
 */
export const createSecureModelUrl = (baseUrl: string, modelPath: string): string | null => {
    try {
        // Validate both parts
        if (!validateModelPath(baseUrl) || !validateModelPath(modelPath)) {
            return null;
        }

        // Combine URLs
        const url = new URL(modelPath, baseUrl);
        
        // Ensure HTTPS
        if (url.protocol !== 'https:') {
            url.protocol = 'https:';
        }

        return url.toString();
    } catch {
        return null;
    }
};

/**
 * Check if a file is a valid GGUF file based on extension
 */
export const isGgufFile = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    return lower.endsWith('.gguf') || lower.includes('.gguf?');
};

/**
 * Check if a file is a valid ONNX file based on extension
 */
export const isOnnxFile = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    return lower.endsWith('.onnx') || lower.includes('.onnx?');
};

/**
 * Validate file extension for model files
 */
export const validateModelFileExtension = (filename: string): boolean => {
    const lower = filename.toLowerCase();
    const validExtensions = ['.gguf', '.bin', '.onnx', '.safetensors', '.json'];
    return validExtensions.some(ext => lower.endsWith(ext) || lower.includes(ext + '?'));
};

/**
 * Secure session storage wrapper
 */
export const secureSessionStorage = {
    getItem: <T>(key: string): T | null => {
        try {
            if (!key || typeof key !== 'string' || key.length > 100) {
                throw new Error('Invalid storage key');
            }

            const item = sessionStorage.getItem(key);
            return item ? JSON.parse(item) as T : null;
        } catch (err) {
            console.warn(`Failed to get item from sessionStorage: ${key}`, err);
            return null;
        }
    },

    setItem: <T>(key: string, value: T): void => {
        try {
            if (!key || typeof key !== 'string' || key.length > 100) {
                throw new Error('Invalid storage key');
            }

            const stringValue = JSON.stringify(value);
            if (stringValue.length > 5 * 1024 * 1024) {
                throw new Error('Value too large for sessionStorage');
            }

            sessionStorage.setItem(key, stringValue);
        } catch (err) {
            console.error(`Failed to set item in sessionStorage: ${key}`, err);
            throw err;
        }
    },

    removeItem: (key: string): void => {
        try {
            if (!key || typeof key !== 'string' || key.length > 100) {
                throw new Error('Invalid storage key');
            }

            sessionStorage.removeItem(key);
        } catch (err) {
            console.warn(`Failed to remove item from sessionStorage: ${key}`, err);
        }
    },
};

// ============================================================================
// System Information
// ============================================================================

/**
 * Memory information interface
 */
export interface MemoryInfo {
    totalMB: number;
    availableMB: number;
    usedMB: number;
}

/**
 * Get system memory information
 */
export const getSystemMemoryInfo = (): MemoryInfo => {
    if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
        // Chrome/Edge provide deviceMemory in GB
        const totalGB = (navigator as any).deviceMemory;
        const totalMB = totalGB * 1024;
        
        // Estimate available memory (rough approximation)
        // In browsers, we can't get exact available memory, so we estimate based on total
        const availableMB = totalMB * 0.7; // Assume 70% available for safety
        const usedMB = totalMB - availableMB;
        
        return { totalMB, availableMB, usedMB };
    }
    
    // Fallback: use performance.memory if available (Chrome)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
        const mem = (performance as any).memory;
        return {
            totalMB: mem.jsHeapSizeLimit ? Math.round(mem.jsHeapSizeLimit / (1024 * 1024)) : 4096,
            availableMB: mem.jsHeapSizeLimit ? Math.round((mem.jsHeapSizeLimit - mem.usedJSHeapSize) / (1024 * 1024)) : 2048,
            usedMB: mem.usedJSHeapSize ? Math.round(mem.usedJSHeapSize / (1024 * 1024)) : 512,
        };
    }
    
    // Default fallback values
    return {
        totalMB: 4096,   // 4GB default
        availableMB: 2048, // 2GB available
        usedMB: 1024,     // 1GB used
    };
};