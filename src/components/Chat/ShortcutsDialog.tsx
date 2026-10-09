import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ShortcutsDialogProps {
  onClose: () => void;
}

/**
 * Keyboard shortcut overview, opened with "?" (Shift+/) from the chat.
 * Lists every shortcut in one compact dialog - the same list lives in the
 * help page, this one is reachable without leaving the chat.
 */
export const ShortcutsDialog: FC<ShortcutsDialogProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const trapRef = useFocusTrap(true, onClose);

  const shortcuts = [
    t('help.shortcutSearch'),
    t('help.shortcutCancel'),
    t('help.shortcutSend'),
    t('help.shortcutNewline'),
    t('a11y.shortcutOlderMessage'),
    t('a11y.shortcutNewerMessage'),
    t('a11y.shortcutCopy'),
    t('a11y.shortcutDialog'),
    t('a11y.shortcutClearFocus'),
  ];

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[60] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('help.shortcutsTitle')}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
          ⌨️ {t('help.shortcutsTitle')}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
          {t('help.shortcutsIntro')}
        </p>
        <ul className="space-y-2 mb-5">
          {shortcuts.map((shortcut) => (
            <li
              key={shortcut}
              className="text-sm text-zinc-600 dark:text-zinc-300 flex items-start gap-2 leading-relaxed"
            >
              <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
              <span>{shortcut}</span>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="w-full px-6 py-3 rounded-xl bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
        >
          {t('common.close')}
        </button>
      </div>
    </div>
  );
};
