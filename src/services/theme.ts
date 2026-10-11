/**
 * Theme Service
 *
 * Applies the persisted theme mode (dark/light/system) to the document.
 * This module is intentionally persistence-free: the mode is stored ONLY
 * in the app settings (services/settings.ts, key `webgui_settings_v1`) -
 * there used to be a second, competing copy under `webgui.theme.settings`
 * which could drift out of sync and is gone.
 *
 * Consumers:
 * - main.tsx calls initThemeService() once before the first render
 * - MainLayout calls setThemeMode() whenever the settings change
 */

import { type AppThemeMode, hasStoredSettings, loadSettings } from './settings';
import { localStorageGet } from './storage/local-storage';

type ThemeMode = AppThemeMode;

// Legacy key from the time when this service kept its own theme copy.
// Only read as a fallback for users who never saved app settings.
const LEGACY_STORAGE_KEY = 'webgui.theme.settings';

// ============================================================================
// Theme State
// ============================================================================

let currentMode: ThemeMode = 'system';
let initialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Apply the persisted theme mode once, before the first render, and keep
 * following the OS preference while the mode is set to 'system'.
 */
export const initThemeService = async (): Promise<void> => {
  if (initialized) {return;}

  // The single source of truth for the persisted mode is the app settings.
  // Users from before the settings existed may only have the legacy key -
  // read it once as a fallback, but never let it override saved settings.
  let mode = loadSettings().theme;
  if (!hasStoredSettings()) {
    try {
      const legacy = localStorageGet(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as { theme?: { mode?: unknown } };
        const legacyMode = parsed?.theme?.mode;
        if (legacyMode === 'dark' || legacyMode === 'light' || legacyMode === 'system') {
          mode = legacyMode;
        }
      }
    } catch {
      // Malformed legacy entry - fall back to the settings mode
    }
  }
  currentMode = mode;
  applyTheme(currentMode);

  // Listen for system preference changes
  if ('matchMedia' in window) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (currentMode === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  initialized = true;
};

// ============================================================================
// Getters
// ============================================================================

/**
 * Check if dark mode is active
 */
export const isDarkMode = (): boolean => {
  if (currentMode === 'system') {
    return getSystemPrefersDark();
  }
  return currentMode === 'dark';
};

/**
 * Check if system prefers dark mode
 */
export const getSystemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// ============================================================================
// Setters
// ============================================================================

/**
 * Apply a theme mode. Persisting the choice is the caller's job
 * (MainLayout does it via saveSettings) - this only touches the document.
 */
export const setThemeMode = (mode: ThemeMode): void => {
  currentMode = mode;
  applyTheme(mode);
};

// ============================================================================
// Theme Application
// ============================================================================

/**
 * Apply theme to document: the `dark` class on <html> drives all Tailwind
 * dark: variants, and the meta theme-color follows the effective mode.
 */
const applyTheme = (mode: ThemeMode): void => {
  if (typeof document === 'undefined') {return;}

  const html = document.documentElement;

  // Remove existing theme classes
  html.classList.remove('light', 'dark');

  // Determine actual mode
  const actualMode = mode === 'system'
    ? (getSystemPrefersDark() ? 'dark' : 'light')
    : mode;

  // Add theme class
  html.classList.add(actualMode);

  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', actualMode === 'dark' ? '#1a1a1a' : '#ffffff');
  }
};
