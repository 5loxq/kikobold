import React from 'react';
import { useTranslation } from 'react-i18next';

export const HelpPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">{t('help.title')}</h1>

        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">{t('help.welcome')}</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            {t('help.introText')}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">{t('help.gettingStarted')}</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            {t('help.gettingStartedText')}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">{t('help.interfaceGuide')}</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">1</span>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 dark:text-zinc-200">{t('help.profilesTitle')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  {t('help.profilesDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">2</span>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 dark:text-zinc-200">{t('help.modelsTitle')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  {t('help.modelsDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">3</span>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 dark:text-zinc-200">{t('help.chatTitle')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  {t('help.chatDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">4</span>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 dark:text-zinc-200">{t('help.voiceInputTitle')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  {t('help.voiceInputDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">5</span>
              </div>
              <div>
                <h3 className="font-medium text-zinc-700 dark:text-zinc-200">{t('help.languageTitle')}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-1">
                  {t('help.languageDescription')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">{t('help.tipsTitle')}</h2>
          <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 mt-1">•</span>
              <span>{t('help.tip1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 mt-1">•</span>
              <span>{t('help.tip2')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 mt-1">•</span>
              <span>{t('help.tip3')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-600 dark:text-indigo-400 mt-1">•</span>
              <span>{t('help.tip4')}</span>
            </li>
          </ul>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">{t('help.needMoreHelp')}</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            {t('help.contactSupport')}
          </p>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => window.close()} // Or navigate back
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('help.closeHelp')}
          </button>
        </div>
      </div>
    </div>
  );
};
