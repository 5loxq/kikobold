import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageGet, localStorageSet } from '../../services/storage/local-storage';
import { isIOSDevice } from '../../utils/device';

const WARNING_SEEN_KEY = 'webgui_ios_warning_done_v1';

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
 * Dismissible warning for iOS devices. Every browser on iOS must use
 * Apple's WebKit engine, and WebKit lacks the WebAssembly features the
 * inference engines need (wllama requires MEMORY64/JSPI; the asyncify
 * compat build does not finish the model initialization either). LLM
 * inference in the browser is therefore currently not usable on iOS -
 * this is a platform limitation, not a bug in the app. Recommendation:
 * desktop, or Chrome on Android. A native app (Tauri) is the long-term
 * path for mobile.
 */
export const IOSWarning: React.FC = () => {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<boolean>(hasSeenWarning() || !isIOSDevice());

  if (dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 mx-4 mt-3 rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4"
    >
      <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">📱</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {t('browserWarning.iosTitle')}
        </p>
        <p className="text-sm text-amber-800/90 dark:text-amber-400/90 leading-relaxed mt-1">
          {t('browserWarning.iosText')}
        </p>
        <p className="text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed mt-1.5">
          {t('browserWarning.iosReason')}
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
