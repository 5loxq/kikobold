import React from 'react';
import { useTranslation } from 'react-i18next';

interface FaqPageProps {
  /** Optional: called by a "back" button to return to the chat */
  onNavigateBack?: () => void;
}

/**
 * Frequently asked questions. The texts live in the locale files (faq.*)
 * so the page is bilingual like the rest of the app. Every answer matches
 * the actual behaviour of the app: local inference, local IndexedDB chats,
 * offline use after model download, no accounts.
 */
export const FaqPage: React.FC<FaqPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  const items: Array<{ key: string }> = [
    { key: 'free' },
    { key: 'data' },
    { key: 'models' },
    { key: 'browsers' },
    { key: 'offline' },
    { key: 'images' },
    { key: 'export' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8" data-tour="faq-page">
        <h1 className="text-3xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          🤔 {t('faq.title')}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {t('faq.subtitle')}
        </p>

        {items.map(({ key }) => (
          <details
            key={key}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 mb-3"
          >
            <summary className="px-6 py-4 cursor-pointer font-semibold text-zinc-700 dark:text-zinc-200 select-none">
              {t(`faq.${key}.q`)}
            </summary>
            <p className="px-6 pb-5 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {t(`faq.${key}.a`)}
            </p>
          </details>
        ))}

        {onNavigateBack && (
          <div className="text-center mt-8">
            <button
              onClick={onNavigateBack}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              {t('faq.backToChat')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaqPage;
