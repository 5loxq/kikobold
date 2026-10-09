import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageGet, localStorageSet } from '../../services/storage/local-storage';

const DISMISSED_KEY = 'webgui_install_prompt_dismissed_v1';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Dismissible hint to install the page as a PWA. The banner only appears
 * when the browser fires `beforeinstallprompt` (Chrome/Edge; Safari on iOS
 * never does) and only once per dismissal - the browser's own mini
 * infobar is suppressed so the hint is not shown twice.
 */
export const InstallPrompt: FC = () => {
  const { t } = useTranslation();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorageGet(DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handler = (e: Event): void => {
      // Keep the browser's own install banner out of the way
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return (): void => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!installEvent || dismissed) {
    return null;
  }

  const handleInstall = (): void => {
    // The event can only be used once; hide the banner regardless of the
    // user's choice so they are not asked again on every visit.
    setDismissed(true);
    void installEvent.prompt().then(() => installEvent.userChoice).then(() => undefined);
  };

  const handleLater = (): void => {
    try {
      localStorageSet(DISMISSED_KEY, '1');
    } catch {
      // Ignore storage errors - the hint may show again then
    }
    setDismissed(true);
  };

  return (
    <div
      role="complementary"
      className="flex items-start gap-3 mx-4 mt-3 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/30 p-4"
    >
      <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">⬇️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
          {t('install.title')}
        </p>
        <p className="text-sm text-indigo-800/90 dark:text-indigo-400/90 leading-relaxed mt-1">
          {t('install.text')}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={handleInstall}
            className="px-4 py-1.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
          >
            {t('install.installButton')}
          </button>
          <button
            type="button"
            onClick={handleLater}
            className="px-4 py-1.5 text-sm rounded-xl text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
          >
            {t('install.laterButton')}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLater}
        className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex-shrink-0"
        aria-label={t('install.laterButton')}
      >
        ✕
      </button>
    </div>
  );
};
