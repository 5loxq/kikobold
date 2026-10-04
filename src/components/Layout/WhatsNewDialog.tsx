import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { WHATS_NEW, type WhatsNewEntry } from '../../services/whats-new';

interface WhatsNewDialogProps {
  /** Entries to display (already filtered by the caller) */
  entries: WhatsNewEntry[];
  /** Called when the user closes the dialog */
  onClose: () => void;
}

/**
 * "What's new" dialog. Shown to returning users when the app version
 * changed since their last visit. Can also be opened from the help page
 * (with all entries) to review past changes at any time.
 */
export const WhatsNewDialog: FC<WhatsNewDialogProps> = ({ entries, onClose }) => {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-label={t('whatsNew.title')}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 p-8 my-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/25 flex-shrink-0">
            🆕
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {t('whatsNew.title')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
              {t('whatsNew.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.version}
              className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4"
            >
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
                v{entry.version}
              </h3>
              <ul className="space-y-1.5">
                {entry.itemKeys.map((key) => (
                  <li
                    key={key}
                    className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2 leading-relaxed"
                  >
                    <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
        >
          {t('whatsNew.closeButton')}
        </button>
      </div>
    </div>
  );
};

/** All entries - used by the help page to review past changes */
export const ALL_WHATS_NEW_ENTRIES: WhatsNewEntry[] = WHATS_NEW;
