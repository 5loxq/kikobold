// App settings persisted in localStorage. Managed by the settings page and
// applied by the MainLayout (theme, default profile/model, behavior).

export type AppThemeMode = 'system' | 'light' | 'dark';

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
}

const SETTINGS_KEY = 'webgui_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  defaultProfileId: null,
  defaultModelId: null,
  autoSpeak: true,
  memoryEnabled: true,
};

export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
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
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors - settings just don't persist
  }
};
