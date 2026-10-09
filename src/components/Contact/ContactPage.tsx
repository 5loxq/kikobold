import React from 'react';
import { useTranslation } from 'react-i18next';

const CONTACT_EMAIL = 'kikobold.kepmu@8alias.com';

interface ContactPageProps {
  /** Optional: called by a "back" button to return to the chat */
  onNavigateBack?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8" data-tour="contact-page">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">
          ✉️ {t('contact.title')}
        </h1>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('contact.introText')}
          </p>
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
              {t('contact.emailLabel')}
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-lg font-semibold text-indigo-600 dark:text-indigo-400 hover:underline break-all"
            >
              {CONTACT_EMAIL}
            </a>
            <div className="mt-3">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-block px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
              >
                {t('contact.writeEmail')}
              </a>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-2 text-zinc-700 dark:text-zinc-200">
            {t('contact.beforeWritingTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('contact.beforeWritingText')}
          </p>
        </section>

        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('contact.backToChat')}
          </button>
        )}
      </div>
    </div>
  );
};
