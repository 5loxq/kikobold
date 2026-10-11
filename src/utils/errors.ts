/**
 * Centralized error handling for the application
 */

// Error codes for different types of errors
export enum ErrorCodes {
    // Network errors
    NETWORK_ERROR = 'NETWORK_ERROR',
    TIMEOUT = 'TIMEOUT',
    CONNECTION_FAILED = 'CONNECTION_FAILED',
    
    // Model errors
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
    MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
    MODEL_INFERENCE_FAILED = 'MODEL_INFERENCE_FAILED',
    MODEL_DOWNLOAD_FAILED = 'MODEL_DOWNLOAD_FAILED',
    MODEL_VALIDATION_FAILED = 'MODEL_VALIDATION_FAILED',
    
    // Storage errors
    STORAGE_ERROR = 'STORAGE_ERROR',
    STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
    STORAGE_NOT_AVAILABLE = 'STORAGE_NOT_AVAILABLE',
    
    // Security errors
    SECURITY_ERROR = 'SECURITY_ERROR',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INVALID_INPUT = 'INVALID_INPUT',
    
    // Browser compatibility errors
    WEBGPU_NOT_SUPPORTED = 'WEBGPU_NOT_SUPPORTED',
    WASM_NOT_SUPPORTED = 'WASM_NOT_SUPPORTED',
    FEATURE_NOT_SUPPORTED = 'FEATURE_NOT_SUPPORTED',
    NOT_SUPPORTED = 'NOT_SUPPORTED',
    
    // Validation errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
    
    // General errors
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
    INFERENCE_FAILED = 'INFERENCE_FAILED',
    GENERIC_ERROR = 'GENERIC_ERROR',
}

// User-friendly error messages for each error code
const ERROR_MESSAGES: Record<string, string> = {
    [ErrorCodes.NETWORK_ERROR]: 'Network error. Please check your internet connection.',
    [ErrorCodes.TIMEOUT]: 'Request timed out. Please try again.',
    [ErrorCodes.CONNECTION_FAILED]: 'Failed to connect to the server. Please try again.',
    
    [ErrorCodes.MODEL_NOT_FOUND]: 'Model not found. Please select a different model.',
    [ErrorCodes.MODEL_LOAD_FAILED]: 'Failed to load the model. Please try again or select a different model.',
    [ErrorCodes.MODEL_INFERENCE_FAILED]: 'Failed to generate a response. Please try again.',
    [ErrorCodes.MODEL_DOWNLOAD_FAILED]: 'Failed to download the model. Please check your connection and try again.',
    [ErrorCodes.MODEL_VALIDATION_FAILED]: 'The model file is invalid or corrupted.',
    
    [ErrorCodes.STORAGE_ERROR]: 'Failed to save data. Please try again.',
    [ErrorCodes.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded. Please free up some space and try again.',
    [ErrorCodes.STORAGE_NOT_AVAILABLE]: 'Storage is not available. Some features may be limited.',
    
    [ErrorCodes.SECURITY_ERROR]: 'Security error. The operation was blocked for security reasons.',
    [ErrorCodes.PERMISSION_DENIED]: 'Permission denied. Please grant the required permissions.',
    [ErrorCodes.INVALID_INPUT]: 'Invalid input. Please check your input and try again.',
    
    [ErrorCodes.WEBGPU_NOT_SUPPORTED]: 'WebGPU is not supported in your browser. Some models may not work or will be slower.',
    [ErrorCodes.WASM_NOT_SUPPORTED]: 'WebAssembly is not supported in your browser. LLM inference will not work.',
    [ErrorCodes.FEATURE_NOT_SUPPORTED]: 'This feature is not supported in your browser.',
    [ErrorCodes.NOT_SUPPORTED]: 'This feature is not supported in your current environment.',
    
    [ErrorCodes.VALIDATION_ERROR]: 'Validation error. Please check your input.',
    [ErrorCodes.CONFIGURATION_ERROR]: 'Configuration error. Please check your settings.',
    
    [ErrorCodes.UNKNOWN_ERROR]: 'An unknown error occurred. Please try again.',
    [ErrorCodes.INTERNAL_ERROR]: 'An internal error occurred. Please try again later.',
    [ErrorCodes.NOT_IMPLEMENTED]: 'This feature is not yet implemented.',
    [ErrorCodes.INFERENCE_FAILED]: 'Inference failed. Please try again.',
    [ErrorCodes.GENERIC_ERROR]: 'A generic error occurred. Please try again.',
};

// Error context interface
export interface ErrorContext {
    [key: string]: unknown;
    timestamp?: number;
    userAgent?: string;
    url?: string;
    modelId?: string;
    operation?: string;
    retryCount?: number;
}

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly code: ErrorCodes;
  public readonly details?: unknown;
  public readonly timestamp: number;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly userMessage: string;
  public cause?: unknown;

  constructor(
    message: string,
    code: ErrorCodes = ErrorCodes.UNKNOWN_ERROR,
    details?: unknown,
    context: ErrorContext = {},
    isRetryable: boolean = false,
    cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    this.context = {
        timestamp: this.timestamp,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        ...context,
    };
    this.isRetryable = isRetryable;
    this.userMessage = ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCodes.UNKNOWN_ERROR as string];
    this.cause = cause;
    
    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack?.split('\n'),
    };
  }

  /**
   * Check if error is an AppError
   */
  static isAppError(error: unknown): error is AppError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      'code' in error &&
      (error as { name: string }).name === 'AppError'
    );
  }
}

/**
 * Type for error codes
 */
export type ErrorCode = ErrorCodes;

/**
 * Central error handler
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private handlers: Map<ErrorCode, (error: AppError) => void> = new Map();
  private globalHandlers: Array<(error: AppError, context: ErrorContext) => void> = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Register handler for specific error code
   */
  on(code: ErrorCode, handler: (error: AppError) => void): void {
    this.handlers.set(code, handler);
  }

  /**
   * Register global error handler
   */
  onGlobal(handler: (error: AppError, context: ErrorContext) => void): void {
    this.globalHandlers.push(handler);
  }

  /**
   * Remove handler for specific error code
   */
  off(code: ErrorCode): void {
    this.handlers.delete(code);
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }

  /**
   * Handle an error
   */
  handle(error: unknown, context: ErrorContext = {}): never {
    // Convert to AppError if not already
    const appError = this.normalizeError(error);
    
    // Log to console
    this.logError(appError, context);
    
    // Call specific handler if registered
    const specificHandler = this.handlers.get(appError.code as ErrorCode);
    if (specificHandler) {
      specificHandler(appError);
    }
    
    // Call global handlers
    for (const handler of this.globalHandlers) {
      handler(appError, context);
    }
    
    // Re-throw the error
    throw appError;
  }

  /**
   * Handle an error without re-throwing
   */
  handleSilent(error: unknown, context: ErrorContext = {}): AppError {
    const appError = this.normalizeError(error);
    this.logError(appError, context);
    
    const specificHandler = this.handlers.get(appError.code as ErrorCode);
    if (specificHandler) {
      specificHandler(appError);
    }
    
    for (const handler of this.globalHandlers) {
      handler(appError, context);
    }
    
    return appError;
  }

  /**
   * Normalize any error to AppError
   */
  private normalizeError(error: unknown): AppError {
    if (AppError.isAppError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, ErrorCodes.GENERIC_ERROR, error);
    }

    if (typeof error === 'string') {
      return new AppError(error, ErrorCodes.GENERIC_ERROR);
    }

    return new AppError('Unknown error occurred', ErrorCodes.GENERIC_ERROR, error);
  }

  /**
   * Log error to console
   */
  private logError(error: AppError, context: ErrorContext): void {
    const contextStr = Object.keys(context).length > 0 
      ? ` [${JSON.stringify(context)}]` 
      : '';
    
    console.error(
      `%c[${error.code}]%c ${error.message}${contextStr}`,
      'color: red; font-weight: bold;',
      'color: inherit;',
      error.details,
      error.stack
    );
  }
}

/**
 * Convenience function to handle errors
 */
export function handleError(error: unknown, context: ErrorContext = {}): never {
  return ErrorHandler.getInstance().handle(error, context);
}

/**
 * Convenience function to handle errors silently
 */
export function handleErrorSilent(error: unknown, context: ErrorContext = {}): AppError {
  return ErrorHandler.getInstance().handleSilent(error, context);
}

/**
 * Create an AppError with proper typing
 */
export function createError(
  message: string,
  code: ErrorCode,
  details?: unknown
): AppError {
  return new AppError(message, code, details);
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(message, ErrorCodes.VALIDATION_ERROR, details);
}

/**
 * Not found error helper
 */
export function notFoundError(resourceType: string, id: string): AppError {
  return new AppError(
    `${resourceType} with id '${id}' not found`,
    ErrorCodes.MODEL_NOT_FOUND,
    { resourceType, id }
  );
}

// Retry configuration
export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    jitter: boolean;
    retryableCodes?: ErrorCodes[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    retryableCodes: [
        ErrorCodes.NETWORK_ERROR,
        ErrorCodes.TIMEOUT,
        ErrorCodes.CONNECTION_FAILED,
        ErrorCodes.MODEL_LOAD_FAILED,
        ErrorCodes.MODEL_DOWNLOAD_FAILED,
        ErrorCodes.STORAGE_ERROR,
    ],
};

/**
 * Create an error with the given code and context
 */
export const createAppError = (
    message: string,
    code: ErrorCodes = ErrorCodes.UNKNOWN_ERROR,
    context: ErrorContext = {},
    isRetryable: boolean = false
): AppError => {
    return new AppError(message, code, undefined, context, isRetryable);
};

/**
 * Check if an error is retryable
 */
export const isRetryableError = (error: unknown, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG): boolean => {
    if (!(error instanceof AppError)) {
        // For non-AppError, assume it's retryable if it looks like a
        // transient network problem. "failed" alone is too broad - almost
        // every error message contains it.
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return message.includes('network') || 
                   message.includes('timeout') || 
                   message.includes('connection') ||
                   message.includes('fetch');
        }
        return false;
    }

    // An explicitly configured retryable code is retryable even when the
    // error object was created without the isRetryable flag (the default).
    if (retryConfig.retryableCodes?.includes(error.code)) {
        return true;
    }

    return error.isRetryable;
};

/**
 * Get user-friendly message from an error
 */
export const getUserMessage = (error: unknown): string => {
    if (error instanceof AppError) {
        return error.userMessage;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Try to match with known error patterns
        if (message.includes('network') || message.includes('fetch')) {
            return ERROR_MESSAGES[ErrorCodes.NETWORK_ERROR];
        }
        if (message.includes('timeout')) {
            return ERROR_MESSAGES[ErrorCodes.TIMEOUT];
        }
        if (message.includes('quota') || message.includes('storage')) {
            return ERROR_MESSAGES[ErrorCodes.STORAGE_QUOTA_EXCEEDED];
        }
        if (message.includes('permission') || message.includes('denied')) {
            return ERROR_MESSAGES[ErrorCodes.PERMISSION_DENIED];
        }
        if (message.includes('webgpu')) {
            return ERROR_MESSAGES[ErrorCodes.WEBGPU_NOT_SUPPORTED];
        }
        if (message.includes('wasm') || message.includes('webassembly')) {
            return ERROR_MESSAGES[ErrorCodes.WASM_NOT_SUPPORTED];
        }
        
        // Return the original message if it's not too technical
        if (message.length < 100 && !message.includes('at ') && !message.includes('http')) {
            return error.message;
        }
    }

    return ERROR_MESSAGES[ErrorCodes.UNKNOWN_ERROR];
};

/**
 * Get error code from an error
 */
export const getErrorCode = (error: unknown): ErrorCodes => {
    if (error instanceof AppError) {
        return error.code;
    }
    return ErrorCodes.UNKNOWN_ERROR;
};

/**
 * Classify an error based on its type and message
 */
export const classifyError = (error: unknown): ErrorCodes => {
    if (error instanceof AppError) {
        return error.code;
    }

    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('network') || message.includes('fetch') || message.includes('online')) {
            return ErrorCodes.NETWORK_ERROR;
        }
        if (message.includes('timeout')) {
            return ErrorCodes.TIMEOUT;
        }
        if (message.includes('connection') || message.includes('connect')) {
            return ErrorCodes.CONNECTION_FAILED;
        }
        if (message.includes('model') && (message.includes('not found') || message.includes('404'))) {
            return ErrorCodes.MODEL_NOT_FOUND;
        }
        if (message.includes('model') && (message.includes('load') || message.includes('failed'))) {
            return ErrorCodes.MODEL_LOAD_FAILED;
        }
        if (message.includes('download') && message.includes('failed')) {
            return ErrorCodes.MODEL_DOWNLOAD_FAILED;
        }
        if (message.includes('storage') || message.includes('quota')) {
            return ErrorCodes.STORAGE_QUOTA_EXCEEDED;
        }
        if (message.includes('permission') || message.includes('denied') || message.includes('access')) {
            return ErrorCodes.PERMISSION_DENIED;
        }
        if (message.includes('webgpu')) {
            return ErrorCodes.WEBGPU_NOT_SUPPORTED;
        }
        if (message.includes('wasm') || message.includes('webassembly')) {
            return ErrorCodes.WASM_NOT_SUPPORTED;
        }
        if (message.includes('validation') || message.includes('invalid')) {
            return ErrorCodes.VALIDATION_ERROR;
        }
        if (message.includes('security') || message.includes('blocked')) {
            return ErrorCodes.SECURITY_ERROR;
        }
    }

    // Check for specific error types
    if (error instanceof TypeError) {
        return ErrorCodes.CONFIGURATION_ERROR;
    }
    if (error instanceof RangeError) {
        return ErrorCodes.VALIDATION_ERROR;
    }

    return ErrorCodes.UNKNOWN_ERROR;
};

/**
 * Execute a function with retry logic
 */
export const withRetry = async <T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context: ErrorContext = {}
): Promise<T> => {
    const retryConfig: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        ...config,
    };

    let lastError: unknown;
    let attempt = 0;

    while (attempt < retryConfig.maxAttempts) {
        attempt++;
        
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            context.retryCount = attempt;
            
            // Check if we should retry
            if (attempt >= retryConfig.maxAttempts) {
                break;
            }

            if (!isRetryableError(error, retryConfig)) {
                break;
            }

            // Calculate delay with exponential backoff and jitter
            let delay = retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
            
            if (retryConfig.jitter) {
                // Add random jitter to prevent thundering herd
                delay = delay * (0.5 + Math.random() * 0.5);
            }
            
            delay = Math.min(delay, retryConfig.maxDelay);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // If we get here, all retries failed
    if (lastError instanceof AppError) {
        throw lastError;
    }

    // Convert to AppError if it's not already
    const errorCode = classifyError(lastError);
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw createAppError(message, errorCode, context, false);
};

/**
 * Create a user-friendly error object for display
 */
export const createUserError = (error: unknown): {
    code: ErrorCodes;
    message: string;
    details?: string;
    isRetryable: boolean;
    timestamp: number;
} => {
    const code = getErrorCode(error);
    const message = getUserMessage(error);
    const isRetryable = isRetryableError(error);
    const timestamp = Date.now();

    // Extract details for display
    let details: string | undefined;
    if (error instanceof AppError) {
        details = error.message;
    } else if (error instanceof Error) {
        details = error.message;
    }

    return {
        code,
        message,
        details,
        isRetryable,
        timestamp,
    };
};

/**
 * Format error for logging
 */
export const formatErrorForLogging = (error: unknown): string => {
    if (error instanceof AppError) {
        return JSON.stringify(error.toJSON(), null, 2);
    }

    if (error instanceof Error) {
        return `Error: ${error.name}\nMessage: ${error.message}\nStack: ${error.stack}`;
    }

    return String(error);
};

/**
 * Check if an error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
    const code = getErrorCode(error);
    return [
        ErrorCodes.NETWORK_ERROR,
        ErrorCodes.TIMEOUT,
        ErrorCodes.CONNECTION_FAILED,
    ].includes(code);
};

/**
 * Check if an error is a storage error
 */
export const isStorageError = (error: unknown): boolean => {
    const code = getErrorCode(error);
    return [
        ErrorCodes.STORAGE_ERROR,
        ErrorCodes.STORAGE_QUOTA_EXCEEDED,
        ErrorCodes.STORAGE_NOT_AVAILABLE,
    ].includes(code);
};

/**
 * Check if an error is a model error
 */
export const isModelError = (error: unknown): boolean => {
    const code = getErrorCode(error);
    return [
        ErrorCodes.MODEL_NOT_FOUND,
        ErrorCodes.MODEL_LOAD_FAILED,
        ErrorCodes.MODEL_INFERENCE_FAILED,
        ErrorCodes.MODEL_DOWNLOAD_FAILED,
        ErrorCodes.MODEL_VALIDATION_FAILED,
    ].includes(code);
};

/**
 * Check if an error is a security error
 */
export const isSecurityError = (error: unknown): boolean => {
    const code = getErrorCode(error);
    return [
        ErrorCodes.SECURITY_ERROR,
        ErrorCodes.PERMISSION_DENIED,
        ErrorCodes.INVALID_INPUT,
    ].includes(code);
};

/**
 * Check if an error is a compatibility error
 */
export const isCompatibilityError = (error: unknown): boolean => {
    const code = getErrorCode(error);
    return [
        ErrorCodes.WEBGPU_NOT_SUPPORTED,
        ErrorCodes.WASM_NOT_SUPPORTED,
        ErrorCodes.FEATURE_NOT_SUPPORTED,
        ErrorCodes.NOT_SUPPORTED,
    ].includes(code);
};

/**
 * Get appropriate action for an error
 */
export const getErrorAction = (error: unknown): {
    label: string;
    action: 'retry' | 'refresh' | 'settings' | 'contact' | 'none';
} => {
    const code = getErrorCode(error);
    const isRetryable = isRetryableError(error);

    switch (code) {
        case ErrorCodes.NETWORK_ERROR:
        case ErrorCodes.TIMEOUT:
        case ErrorCodes.CONNECTION_FAILED:
        case ErrorCodes.MODEL_LOAD_FAILED:
        case ErrorCodes.MODEL_DOWNLOAD_FAILED:
            return { label: 'Retry', action: 'retry' };

        case ErrorCodes.WEBGPU_NOT_SUPPORTED:
        case ErrorCodes.WASM_NOT_SUPPORTED:
            return { label: 'Check Browser', action: 'settings' };

        case ErrorCodes.STORAGE_QUOTA_EXCEEDED:
            return { label: 'Free Up Space', action: 'settings' };

        case ErrorCodes.PERMISSION_DENIED:
            return { label: 'Grant Permission', action: 'settings' };

        case ErrorCodes.MODEL_NOT_FOUND:
            return { label: 'Select Different Model', action: 'refresh' };

        case ErrorCodes.SECURITY_ERROR:
        case ErrorCodes.INVALID_INPUT:
            return { label: 'Check Input', action: 'none' };

        default:
            return isRetryable 
                ? { label: 'Retry', action: 'retry' } 
                : { label: 'Contact Support', action: 'contact' };
    }
};
