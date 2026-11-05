/**
 * Centralized logging system for the application
 * Provides different log levels and can be configured to show/hide logs
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  NONE = 'none'
}

// Current log level - can be changed at runtime. In production builds only
// warnings and errors are printed; in development info messages as well.
// Debug messages are always suppressed unless explicitly enabled.
let currentLogLevel: LogLevel = import.meta.env.PROD ? LogLevel.WARN : LogLevel.INFO;

// Set the log level
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

// Get the current log level
export const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

// ---------------------------------------------------------------------------
// Ring buffer for the diagnostic report (help page): keeps the most recent
// log entries in memory so a support request can name what actually
// happened. Deliberately small, never persisted, never transmitted - and
// it contains no chat content (only the log messages the app itself writes).
// ---------------------------------------------------------------------------

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
}

const RING_BUFFER_SIZE = 50;
const logBuffer: LogEntry[] = [];

const formatParam = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Circular structure or BigInt - the plain string form is enough
    return String(value);
  }
};

const recordEntry = (level: LogLevel, message: string, params: unknown[]): void => {
  const suffix = params.length > 0 ? ` ${params.map(formatParam).join(' ')}` : '';
  logBuffer.push({ level, message: `${message}${suffix}`.slice(0, 300), timestamp: Date.now() });
  if (logBuffer.length > RING_BUFFER_SIZE) {
    logBuffer.shift();
  }
};

/** Most recent log entries, oldest first (for the diagnostic report). */
export const getRecentLogEntries = (): LogEntry[] => [...logBuffer];

// Log a debug message
export const debug = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.DEBUG)) {
    recordEntry(LogLevel.DEBUG, message, optionalParams);
    console.debug(`[DEBUG] ${message}`, ...optionalParams); // eslint-disable-line no-console
  }
};

// Log an info message
export const info = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.INFO)) {
    recordEntry(LogLevel.INFO, message, optionalParams);
    console.info(`[INFO] ${message}`, ...optionalParams);
  }
};

// Log a warning message
export const warn = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.WARN)) {
    recordEntry(LogLevel.WARN, message, optionalParams);
    console.warn(`[WARN] ${message}`, ...optionalParams);
  }
};

// Log an error message
export const error = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.ERROR)) {
    recordEntry(LogLevel.ERROR, message, optionalParams);
    console.error(`[ERROR] ${message}`, ...optionalParams);
  }
};

// Log level weights - hoisted so shouldLog does not rebuild the object on
// every single log call.
const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.NONE]: 4
};

// Check if a message should be logged based on the current log level
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[currentLogLevel];
}

// Log important events (similar to console.log but with our logging system)
export const log = (message: string, ...optionalParams: unknown[]): void => {
  info(message, ...optionalParams);
};
