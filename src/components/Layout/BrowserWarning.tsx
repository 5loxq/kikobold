import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageGet, localStorageSet } from '../../services/storage/local-storage';

const WARNING_SEEN_KEY = 'webgui_firefox_warning_done_v1';

const isFirefox = (): boolean => {
  try {
    const ua = navigator.userAgent;
    // Firefox and Firefox-based browsers (Waterfox etc.). Seamonkey also
    // contains "Firefox/" in its UA but is a different suite - exclude it.
    return /Firefox\/\d+/i.test(ua) && !/Seamonkey/i.test(ua);
  } catch {
    return false;
  }
};

const hasSeenWarning = (): boolean => {
  try {
    return localStorageGet(WARNING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const markWarningSeen = (): void => {
  try {
    localStorageSet(WARNING_SEEN_KEY, '1');
  } catch {
    // Ignore storage errors - the banner just shows again
  }
};

/**
 * Dismissible performance warning for Firefox users. Firefox does not support
 * JSPI (JavaScript Promise Integration), so WASM models (LFM 2.5) have to use
 * the slow "asyncify" fallback - text then appears word by word. The WebGPU
 * models (Qwen 3.x) need Chrome/Edge anyway. This cannot be fixed on
 * our side; the recommendation is Chrome or Edge.
 */
export const BrowserWarning: React.FC = () => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(hasSeenWarning() || !isFirefox());

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 mx-4 mt-3 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4"
    >
      <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {t('browserWarning.firefoxTitle')}
        </p>
        <p className="text-sm text-amber-800/90 dark:text-amber-400/90 leading-relaxed mt-1">
          {t('browserWarning.firefoxText')}
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed mt-1.5">
          {t('browserWarning.firefoxReason')}
        </p>
      </div>
      <button
        onClick={() => {
          markWarningSeen();
          setDismissed(true);
        }}
        className="p-1.5 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex-shrink-0"
        aria-label={t('common.close')}
      >
        ✕
      </button>
    </div>
  );
};
