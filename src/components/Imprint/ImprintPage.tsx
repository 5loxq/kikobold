import React from 'react';
import { useTranslation } from 'react-i18next';

const CONTACT_EMAIL = 'kikobold.kepmu@8alias.com';

interface ImprintPageProps {
  /** Optional: called by a "back" button to return to the chat */
  onNavigateBack?: () => void;
}

/**
 * Imprint (§ 5 DDG - the German Telemedia/Digital Services Act).
 * Name and address mirror the privacy policy: the operator is named,
 * the private home address stays protected via the c/o address.
 */
export const ImprintPage: React.FC<ImprintPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8" data-tour="imprint-page">
        <h1 className="text-3xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          📋 {t('imprint.title')}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          {t('imprint.subtitle')}
        </p>

        {/* Provider identification - the legally required block (§ 5 DDG) */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('imprint.providerTitle')}
          </h2>
          <address className="not-italic text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Roman Thiel
            <br />
            kikobold.net
            <br />
            c/o COCENTER
            <br />
            Koppoldstr. 1
            <br />
            86551 Aichach
          </address>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mt-3">
            {t('imprint.contactLabel')}:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-indigo-600 dark:text-indigo-400 hover:underline break-all"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('imprint.vatTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('imprint.vatText')}
          </p>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('imprint.contentTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('imprint.contentText')}
          </p>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('imprint.linksTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('imprint.linksText')}
          </p>
        </section>

        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-lg font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('imprint.copyrightTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('imprint.copyrightText')}
          </p>
        </section>

        {onNavigateBack && (
          <button
            onClick={onNavigateBack}
            className="px-6 py-2 bg-indigo-700 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('imprint.backToChat')}
          </button>
        )}
      </div>
    </div>
  );
};
