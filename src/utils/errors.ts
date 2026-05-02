/**
 * Centralized error handling for the application
 */

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: number;
  public cause?: unknown;

  constructor(
    message: string,
    code: string = 'GENERIC_ERROR',
    details?: unknown,
    cause?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
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
 * Error codes for different types of errors
 */
export const ErrorCodes = {
  // General errors
  GENERIC_ERROR: 'GENERIC_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  
  // Model errors
  MODEL_LOAD_FAILED: 'MODEL_LOAD_FAILED',
  MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
  MODEL_ALREADY_LOADED: 'MODEL_ALREADY_LOADED',
  MODEL_INFERENCE_FAILED: 'MODEL_INFERENCE_FAILED',
  
  // Storage errors
  STORAGE_ERROR: 'STORAGE_ERROR',
  STORAGE_NOT_INITIALIZED: 'STORAGE_NOT_INITIALIZED',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  
  // WebGPU errors
  WEBGPU_NOT_SUPPORTED: 'WEBGPU_NOT_SUPPORTED',
  WEBGPU_INIT_FAILED: 'WEBGPU_INIT_FAILED',
  
  // Voice errors
  VOICE_RECOGNITION_FAILED: 'VOICE_RECOGNITION_FAILED',
  VOICE_SYNTHESIS_FAILED: 'VOICE_SYNTHESIS_FAILED',
  MICROPHONE_PERMISSION_DENIED: 'MICROPHONE_PERMISSION_DENIED',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  
  // Security errors
  SECURITY_ERROR: 'SECURITY_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  XSS_DETECTED: 'XSS_DETECTED',
  SSRF_DETECTED: 'SSRF_DETECTED',
  INVALID_MODEL_PATH: 'INVALID_MODEL_PATH',
  UNTRUSTED_SOURCE: 'UNTRUSTED_SOURCE',
  FILE_VALIDATION_FAILED: 'FILE_VALIDATION_FAILED',
} as const;

/**
 * Type for error codes
 */
export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Context for error logging
 */
export interface ErrorContext {
  component?: string;
  function?: string;
  modelId?: string;
  profileId?: string;
  chatId?: string;
  [key: string]: unknown;
}

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
      return new AppError(error.message, 'GENERIC_ERROR', error);
    }

    if (typeof error === 'string') {
      return new AppError(error, 'GENERIC_ERROR');
    }

    return new AppError('Unknown error occurred', 'GENERIC_ERROR', error);
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
    ErrorCodes.NOT_FOUND,
    { resourceType, id }
  );
}
