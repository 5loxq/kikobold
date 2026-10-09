import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { WHATS_NEW, type WhatsNewEntry } from '../../services/whats-new';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  const trapRef = useFocusTrap(entries.length > 0, onClose);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[60] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('whatsNew.title')}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 max-h-[85vh] flex flex-col my-4">
        <div className="flex items-center gap-4 mb-5 flex-shrink-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/25 flex-shrink-0">
            🆕
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {t('whatsNew.title')}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-0.5">
              {t('whatsNew.subtitle')}
            </p>
          </div>
        </div>

        {/* Scrollable entry list - the close button stays visible below */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.version}
              className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4"
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
          className="mt-5 w-full px-6 py-3 rounded-xl bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity flex-shrink-0"
        >
          {t('whatsNew.closeButton')}
        </button>
      </div>
    </div>
  );
};

/** All entries - used by the help page to review past changes */
export const ALL_WHATS_NEW_ENTRIES: WhatsNewEntry[] = WHATS_NEW;
