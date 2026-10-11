/**
 * Theme Service
 * 
 * Provides theme management including:
 * - Dark/Light mode switching
 * - Custom theme colors
 * - Theme persistence
 * - System preference detection
 */

import { CustomizationSettings, ThemeMode, ThemeSettings } from '../types/kikobold-types';
import { warn as logWarn } from './logging';
import { localStorageGet, localStorageSetJson } from './storage/local-storage';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'webgui.theme.settings';
const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  primaryColor: '#3b82f6',
  secondaryColor: '#10b981',
  backgroundColor: '',
  textColor: '',
  accentColor: '#8b5cf6',
  borderRadius: 8,
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontSize: 16,
};

const DEFAULT_CUSTOMIZATION: CustomizationSettings = {
  theme: DEFAULT_THEME,
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MMM d, yyyy',
  timeFormat: 'h:mm a',
  animationEnabled: true,
  soundEnabled: true,
  notificationsEnabled: true,
};

// ============================================================================
// Theme State
// ============================================================================

let currentTheme: ThemeSettings = { ...DEFAULT_THEME };
let currentCustomization: CustomizationSettings = { ...DEFAULT_CUSTOMIZATION };
let initialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize theme service
 */
export const initThemeService = async (): Promise<void> => {
  if (initialized) {return;}

  // Load saved settings
  const savedSettings = loadThemeSettings();
  if (savedSettings) {
    currentTheme = { ...DEFAULT_THEME, ...savedSettings.theme };
    currentCustomization = { ...DEFAULT_CUSTOMIZATION, ...savedSettings };
  } else {
    // Detect system preference
    const systemPrefersDark = getSystemPrefersDark();
    currentTheme.mode = systemPrefersDark ? 'dark' : 'light';
  }

  // Apply theme
  applyTheme(currentTheme);
  
  // Listen for system preference changes
  if ('matchMedia' in window) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (currentTheme.mode === 'system') {
        applyTheme({ ...currentTheme, mode: e.matches ? 'dark' : 'light' });
      }
    });
  }

  initialized = true;
};

// ============================================================================
// Theme Settings Management
// ============================================================================

/**
 * Load theme settings from localStorage
 */
const loadThemeSettings = (): CustomizationSettings | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const saved = localStorageGet(STORAGE_KEY);
    if (!saved) {return null;}

    const parsed = JSON.parse(saved) as CustomizationSettings;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Save theme settings to localStorage
 */
const saveThemeSettings = (settings: CustomizationSettings): void => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    localStorageSetJson(STORAGE_KEY, settings);
  } catch {
    logWarn('Failed to save theme settings');
  }
};

// ============================================================================
// Theme Getters
// ============================================================================

/**
 * Get current theme mode
 */
export const getThemeMode = (): ThemeMode => {
  return currentTheme.mode;
};

/**
 * Get current theme settings
 */
export const getThemeSettings = (): ThemeSettings => {
  return { ...currentTheme };
};

/**
 * Get current customization settings
 */
export const getCustomizationSettings = (): CustomizationSettings => {
  return { ...currentCustomization };
};

/**
 * Check if dark mode is active
 */
export const isDarkMode = (): boolean => {
  if (currentTheme.mode === 'system') {
    return getSystemPrefersDark();
  }
  return currentTheme.mode === 'dark';
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
// Theme Setters
// ============================================================================

/**
 * Set theme mode
 */
export const setThemeMode = (mode: ThemeMode): void => {
  currentTheme.mode = mode;
  currentCustomization.theme.mode = mode;
  
  applyTheme(currentTheme);
  saveThemeSettings(currentCustomization);
};

/**
 * Set theme settings
 */
export const setThemeSettings = (settings: Partial<ThemeSettings>): void => {
  currentTheme = { ...currentTheme, ...settings };
  currentCustomization.theme = { ...currentCustomization.theme, ...settings };
  
  applyTheme(currentTheme);
  saveThemeSettings(currentCustomization);
};

/**
 * Set customization settings
 */
export const setCustomizationSettings = (settings: Partial<CustomizationSettings>): void => {
  currentCustomization = { ...currentCustomization, ...settings };
  currentTheme = { ...currentTheme, ...settings.theme };
  
  applyTheme(currentTheme);
  saveThemeSettings(currentCustomization);
};

/**
 * Toggle between dark and light mode
 */
export const toggleTheme = (): void => {
  // From 'system', switch to the opposite of what is currently effective
  const newMode = isDarkMode() ? 'light' : 'dark';
  setThemeMode(newMode);
};

/**
 * Reset theme to defaults
 */
export const resetTheme = (): void => {
  currentTheme = { ...DEFAULT_THEME };
  currentCustomization = { ...DEFAULT_CUSTOMIZATION };
  
  applyTheme(currentTheme);
  saveThemeSettings(currentCustomization);
};

// ============================================================================
// Theme Application
// ============================================================================

/**
 * Apply theme to document
 */
const applyTheme = (theme: ThemeSettings): void => {
  if (typeof document === 'undefined') {return;}

  const html = document.documentElement;
  
  // Remove existing theme classes
  html.classList.remove('light', 'dark');
  
  // Determine actual mode
  const actualMode = theme.mode === 'system' ? 
    (getSystemPrefersDark() ? 'dark' : 'light') : theme.mode;
  
  // Add theme class
  html.classList.add(actualMode);
  
  // Set CSS variables for custom colors. Empty values remove a previously
  // set variable - otherwise a reset would leave the old color active.
  const colorVars: Array<[string, string | undefined]> = [
    ['--color-primary', theme.primaryColor],
    ['--color-secondary', theme.secondaryColor],
    ['--color-accent', theme.accentColor],
    ['--color-background', theme.backgroundColor],
    ['--color-text', theme.textColor],
    ['--radius', theme.borderRadius !== undefined ? `${theme.borderRadius}px` : undefined],
    ['--font-family', theme.fontFamily],
    ['--font-size', theme.fontSize !== undefined ? `${theme.fontSize}px` : undefined],
  ];
  for (const [cssVar, value] of colorVars) {
    if (value) {
      html.style.setProperty(cssVar, value);
    } else {
      html.style.removeProperty(cssVar);
    }
  }
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', actualMode === 'dark' ? '#1a1a1a' : '#ffffff');
  }
};

// ============================================================================
// Theme Hook (for React components)
// ============================================================================

/**
 * Hook to use theme in React components
 */
export const useTheme = (): {
  themeMode: ThemeMode;
  themeSettings: ThemeSettings;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setThemeSettings: (settings: Partial<ThemeSettings>) => void;
  toggleTheme: () => void;
} => {
  // In a real implementation, this would use React context
  // For now, we'll use the direct functions
  
  return {
    themeMode: getThemeMode(),
    themeSettings: getThemeSettings(),
    isDarkMode: isDarkMode(),
    setThemeMode,
    setThemeSettings,
    toggleTheme,
  };
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get CSS variable value
 */
export const getCSSVar = (name: string, defaultValue: string = ''): string => {
  if (typeof document === 'undefined') {return defaultValue;}
  
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  
  return value || defaultValue;
};

/**
 * Check if a specific theme color is set
 */
export const hasCustomColor = (colorType: keyof ThemeSettings): boolean => {
  return !!currentTheme[colorType];
};

/**
 * Get theme color with fallback
 */
export const getThemeColor = (colorType: keyof ThemeSettings, fallback: string): string => {
  const value = currentTheme[colorType];
  return (typeof value === 'string' ? value : fallback) || fallback;
};

// ============================================================================
// Animation Settings
// ============================================================================

/**
 * Check if animations are enabled
 */
export const areAnimationsEnabled = (): boolean => {
  return currentCustomization.animationEnabled;
};

/**
 * Set animation enabled state
 */
export const setAnimationsEnabled = (enabled: boolean): void => {
  currentCustomization.animationEnabled = enabled;
  saveThemeSettings(currentCustomization);
};

// ============================================================================
// Sound Settings
// ============================================================================

/**
 * Check if sound is enabled
 */
export const isSoundEnabled = (): boolean => {
  return currentCustomization.soundEnabled;
};

/**
 * Set sound enabled state
 */
export const setSoundEnabled = (enabled: boolean): void => {
  currentCustomization.soundEnabled = enabled;
  saveThemeSettings(currentCustomization);
};

// ============================================================================
// Notification Settings
// ============================================================================

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = (): boolean => {
  return currentCustomization.notificationsEnabled;
};

/**
 * Set notifications enabled state
 */
export const setNotificationsEnabled = (enabled: boolean): void => {
  currentCustomization.notificationsEnabled = enabled;
  saveThemeSettings(currentCustomization);
};

// ============================================================================
// Language Settings
// ============================================================================

/**
 * Get current language
 */
export const getLanguage = (): string => {
  return currentCustomization.language;
};

/**
 * Set language
 */
export const setLanguage = (language: string): void => {
  currentCustomization.language = language;
  saveThemeSettings(currentCustomization);
};

// ============================================================================
// Export all functions
// ============================================================================

export default {
  // Initialization
  initThemeService,
  
  // Getters
  getThemeMode,
  getThemeSettings,
  getCustomizationSettings,
  isDarkMode,
  getSystemPrefersDark,
  
  // Setters
  setThemeMode,
  setThemeSettings,
  setCustomizationSettings,
  toggleTheme,
  resetTheme,
  
  // Hook
  useTheme,
  
  // Utilities
  getCSSVar,
  hasCustomColor,
  getThemeColor,
  
  // Animation
  areAnimationsEnabled,
  setAnimationsEnabled,
  
  // Sound
  isSoundEnabled,
  setSoundEnabled,
  
  // Notifications
  areNotificationsEnabled,
  setNotificationsEnabled,
  
  // Language
  getLanguage,
  setLanguage,
};
