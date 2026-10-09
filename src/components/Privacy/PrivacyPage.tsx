import React from 'react';
import { useTranslation } from 'react-i18next';

const CONTACT_EMAIL = 'kikobold.kepmu@8alias.com';

interface PrivacyPageProps {
  /** Optional: called by a "back" button to return to the chat */
  onNavigateBack?: () => void;
}

/**
 * Privacy policy. The texts live in the locale files (privacy.*) so the
 * page is bilingual like the rest of the app. Every statement matches the
 * actual data flows of the app: local inference, IndexedDB chats, server
 * logs on the webspace, HuggingFace as the download fallback.
 */
export const PrivacyPage: React.FC<PrivacyPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  const sections: Array<{ titleKey: string; textKeys: string[] }> = [
    {
      titleKey: 'privacy.controllerTitle',
      textKeys: ['privacy.controllerText'],
    },
    {
      titleKey: 'privacy.localTitle',
      textKeys: ['privacy.localText1', 'privacy.localText2'],
    },
    {
      titleKey: 'privacy.logsTitle',
      textKeys: ['privacy.logsText1', 'privacy.logsText2'],
    },
    {
      titleKey: 'privacy.modelsTitle',
      textKeys: ['privacy.modelsText1', 'privacy.modelsText2'],
    },
    {
      titleKey: 'privacy.trackingTitle',
      textKeys: ['privacy.trackingText1', 'privacy.trackingText2'],
    },
    {
      titleKey: 'privacy.rightsTitle',
      textKeys: ['privacy.rightsText1', 'privacy.rightsText2'],
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8" data-tour="privacy-page">
        <h1 className="text-3xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          🔒 {t('privacy.title')}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {t('privacy.subtitle')}
        </p>

        {sections.map((section) => (
          <section
            key={section.titleKey}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4"
          >
            <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
              {t(section.titleKey)}
            </h2>
            {section.textKeys.map((key) => (
              <p key={key} className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3 last:mb-0">
                {t(key)}
              </p>
            ))}
          </section>
        ))}

        {/* Controller address block */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('privacy.addressTitle')}
          </h2>
          <address className="not-italic text-zinc-600 dark:text-zinc-400 leading-relaxed">
            kikobold.net
            <br />
            c/o COCENTER
            <br />
            Koppoldstr. 1
            <br />
            86551 Aichach
          </address>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mt-3">
            {t('privacy.contactEmailLabel')}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="px-6 py-2 bg-indigo-700 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('privacy.backToChat')}
          </button>
        )}
      </div>
    </div>
  );
};
