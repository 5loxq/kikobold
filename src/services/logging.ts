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

// Current log level - can be changed at runtime
let currentLogLevel: LogLevel = LogLevel.INFO;

// Set the log level
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

// Get the current log level
export const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

// Log a debug message
export const debug = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.DEBUG)) {
    console.debug(`[DEBUG] ${message}`, ...optionalParams); // eslint-disable-line no-console
  }
};

// Log an info message
export const info = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.INFO)) {
    console.info(`[INFO] ${message}`, ...optionalParams);
  }
};

// Log a warning message
export const warn = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.WARN)) {
    console.warn(`[WARN] ${message}`, ...optionalParams);
  }
};

// Log an error message
export const error = (message: string, ...optionalParams: unknown[]): void => {
  if (shouldLog(LogLevel.ERROR)) {
    console.error(`[ERROR] ${message}`, ...optionalParams);
  }
};

// Check if a message should be logged based on the current log level
function shouldLog(level: LogLevel): boolean {
  const levels: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.NONE]: 4
  };
  
  return levels[level] >= levels[currentLogLevel];
}

// Log important events (similar to console.log but with our logging system)
export const log = (message: string, ...optionalParams: unknown[]): void => {
  info(message, ...optionalParams);
};
