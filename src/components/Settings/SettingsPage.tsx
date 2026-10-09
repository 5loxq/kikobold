import React from 'react';
import { useTranslation } from 'react-i18next';
import { LocalModel, Profile } from '../../types';
import { MODELS } from '../../services/models/model-registry';
import type { AppSettings, AppThemeMode, TextScale } from '../../services/settings';
import { version as appVersion } from '../../../package.json';

interface SettingsPageProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  profiles: Profile[];
  downloadedModels: LocalModel[];
  onDeleteModel: (modelId: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onChange,
  profiles,
  downloadedModels,
  onDeleteModel,
}) => {
  const { t } = useTranslation();

  const themeOptions: Array<{ value: AppThemeMode; label: string; icon: string }> = [
    { value: 'system', label: t('settings.themeSystem'), icon: '💻' },
    { value: 'light', label: t('settings.themeLight'), icon: '☀️' },
    { value: 'dark', label: t('settings.themeDark'), icon: '🌙' },
  ];

  const textScaleOptions: Array<{ value: TextScale; label: string; icon: string }> = [
    { value: 'small', label: t('settings.textSmall'), icon: 'A⁻' },
    { value: 'standard', label: t('settings.textStandard'), icon: 'A' },
    { value: 'large', label: t('settings.textLarge'), icon: 'A⁺' },
    { value: 'xlarge', label: t('settings.textXLarge'), icon: 'A⁺⁺' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">{t('settings.title')}</h2>

        <div className="space-y-4">
          {/* Appearance */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-4 text-zinc-800 dark:text-zinc-100">
              {t('settings.appearance')}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onChange({ ...settings, theme: option.value })}
                  className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    settings.theme === option.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="block text-lg mb-1" aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* Defaults */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">
              {t('settings.defaultsTitle')}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t('settings.defaultsText')}
            </p>

            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5" htmlFor="settings-default-profile">
              {t('settings.defaultProfile')}
            </label>
            <select
              id="settings-default-profile"
              value={settings.defaultProfileId ?? ''}
              onChange={(e) => onChange({ ...settings, defaultProfileId: e.target.value || null })}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            >
              <option value="">{t('settings.noDefault')}</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5" htmlFor="settings-default-model">
              {t('settings.defaultModel')}
            </label>
            <select
              id="settings-default-model"
              value={settings.defaultModelId ?? ''}
              onChange={(e) => onChange({ ...settings, defaultModelId: e.target.value || null })}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('settings.noDefault')}</option>
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
              {t('settings.defaultModelHint')}
            </p>
          </section>

          {/* Accessibility */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">
              {t('settings.a11y')}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              {t('settings.a11yText')}
            </p>

            <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-1.5" htmlFor="settings-text-scale">
              {t('settings.textSize')}
            </label>
            <div id="settings-text-scale" className="grid grid-cols-4 gap-2 mb-1.5" role="group" aria-label={t('settings.textSize')}>
              {textScaleOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onChange({ ...settings, textScale: option.value })}
                  aria-pressed={settings.textScale === option.value}
                  className={`px-3 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    settings.textScale === option.value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="block text-lg mb-1" aria-hidden="true">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              {t('settings.textSizeHint')}
            </p>

            <label className="flex items-start justify-between gap-3 cursor-pointer mb-4">
              <span>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {t('settings.readableText')}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('settings.readableTextHint')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.readableText}
                onChange={(e) => onChange({ ...settings, readableText: e.target.checked })}
                className="mt-1 w-5 h-5 rounded accent-indigo-600 flex-shrink-0"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {t('settings.reduceMotion')}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('settings.reduceMotionHint')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(e) => onChange({ ...settings, reduceMotion: e.target.checked })}
                className="mt-1 w-5 h-5 rounded accent-indigo-600 flex-shrink-0"
              />
            </label>
          </section>

          {/* Behavior */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-4 text-zinc-800 dark:text-zinc-100">
              {t('settings.behavior')}
            </h3>

            <label className="flex items-start justify-between gap-3 cursor-pointer mb-4">
              <span>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {t('settings.autoSpeak')}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('settings.autoSpeakHint')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.autoSpeak}
                onChange={(e) => onChange({ ...settings, autoSpeak: e.target.checked })}
                className="mt-1 w-5 h-5 rounded accent-indigo-600 flex-shrink-0"
              />
            </label>

            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {t('settings.memoryEnabled')}
                </span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {t('settings.memoryEnabledHint')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.memoryEnabled}
                onChange={(e) => onChange({ ...settings, memoryEnabled: e.target.checked })}
                className="mt-1 w-5 h-5 rounded accent-indigo-600 flex-shrink-0"
              />
            </label>
          </section>

          {/* Storage */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">
              {t('settings.storage')}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('settings.downloadedModels')}: {downloadedModels.length}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('settings.totalSize')}: {(downloadedModels.reduce((sum, m) => sum + m.size, 0) / (1024 * 1024 * 1024)).toFixed(2)} GB
            </p>
            {downloadedModels.length > 0 && (
              <ul className="mt-3 space-y-2">
                {downloadedModels.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-200 truncate">
                      {m.name} · {(m.size / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </span>
                    <button
                      onClick={() => onDeleteModel(m.id)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors whitespace-nowrap"
                    >
                      {t('models.delete')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* About */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-lg mb-2 text-zinc-800 dark:text-zinc-100">
              {t('settings.about')}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              KI Kobold v{appVersion}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t('settings.description')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
