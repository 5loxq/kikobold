import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';

// LocalStorage flag: once the user has seen the welcome guide, it stays closed
const WELCOME_SEEN_KEY = 'webgui_welcome_seen_v1';

const hasSeenWelcome = (): boolean => {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const markWelcomeSeen = (): void => {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // Ignore storage errors (e.g. private mode) - the screen just shows again
  }
};

/**
 * Full-screen welcome page shown on the very first visit.
 * Explains in three short steps how the app works: everything runs
 * locally, one model must be downloaded once, then you can chat.
 */
export const WelcomeScreen: FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState<boolean>(!hasSeenWelcome());

  if (!visible) {
    return null;
  }

  const handleStart = (): void => {
    markWelcomeSeen();
    setVisible(false);
  };

  const steps = [
    {
      icon: '🔒',
      title: t('welcome.localTitle'),
      text: t('welcome.localText'),
    },
    {
      icon: '⬇️',
      title: t('welcome.modelTitle'),
      text: t('welcome.modelText'),
    },
    {
      icon: '💬',
      title: t('welcome.chatTitle'),
      text: t('welcome.chatText'),
    },
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-zinc-200 dark:border-zinc-800 p-8 my-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/25 flex-shrink-0">
            🧌
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
              {t('welcome.title')}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
              {t('welcome.subtitle')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.title}
              className="flex gap-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4"
            >
              <div className="text-2xl flex-shrink-0" aria-hidden="true">
                {step.icon}
              </div>
              <div>
                <h3 className="font-semibold text-zinc-800 dark:text-zinc-100">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {step.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-5 leading-relaxed">
          {t('welcome.downloadHint')}
        </p>

        <button
          onClick={handleStart}
          className="mt-6 w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-90 transition-opacity"
        >
          {t('welcome.startButton')}
        </button>
      </div>
    </div>
  );
};
