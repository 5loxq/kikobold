// App settings persisted in localStorage. Managed by the settings page and
// applied by the MainLayout (theme, default profile/model, behavior).

import { localStorageGet, localStorageSetJson } from './storage/local-storage';

export type AppThemeMode = 'system' | 'light' | 'dark';

/** Base font size - scales the whole rem-based UI via the html element */
export type TextScale = 'small' | 'standard' | 'large' | 'xlarge';

export interface AppSettings {
  theme: AppThemeMode;
  /** Profile that is active on startup */
  defaultProfileId: string | null;
  /** Model that is pre-selected on startup (only applied if downloaded) */
  defaultModelId: string | null;
  /** Read responses aloud automatically (text-to-speech) */
  autoSpeak: boolean;
  /** Include the memory entries in requests */
  memoryEnabled: boolean;
  /** Base text size applied to the html element */
  textScale: TextScale;
  /** More line height on reading surfaces for easier reading */
  readableText: boolean;
  /** Disable animations regardless of the OS "reduce motion" setting */
  reduceMotion: boolean;
}

const SETTINGS_KEY = 'webgui_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultProfileId: null,
  defaultModelId: null,
  // Off by default: reading answers aloud surprised more users than it
  // helped - it can be enabled in the settings.
  autoSpeak: false,
  memoryEnabled: true,
  textScale: 'standard',
  readableText: false,
  reduceMotion: false,
};

const isTextScale = (value: unknown): value is TextScale =>
  value === 'small' || value === 'standard' || value === 'large' || value === 'xlarge';

export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorageGet(SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
        ? parsed.theme
        : DEFAULT_SETTINGS.theme,
      textScale: isTextScale(parsed.textScale) ? parsed.textScale : DEFAULT_SETTINGS.textScale,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorageSetJson(SETTINGS_KEY, settings);
  } catch {
    // Ignore storage errors - settings just don't persist
  }
};
