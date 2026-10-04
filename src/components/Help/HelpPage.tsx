import React from 'react';
import { useTranslation } from 'react-i18next';

interface HelpPageProps {
  /** Return to the previous view (e.g. the chat). window.close() only works
   *  for script-opened windows, so without this the button does nothing. */
  onNavigateBack?: () => void;
}

export const HelpPage: React.FC<HelpPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  const canItems = [t('help.modelsCan1'), t('help.modelsCan2'), t('help.modelsCan3')];
  const cannotItems = [
    t('help.modelsCannot1'),
    t('help.modelsCannot2'),
    t('help.modelsCannot3'),
    t('help.modelsCannot4'),
  ];
  const importExportItems = [
    t('help.importExportList1'),
    t('help.importExportList2'),
    t('help.importExportList3'),
    t('help.importExportList4'),
  ];
  const tips = [t('help.tip1'), t('help.tip2'), t('help.tip3'), t('help.tip4')];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">{t('help.title')}</h1>

        {/* Welcome / What is this */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🧌 {t('help.welcome')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.introText')}
          </p>
        </section>

        {/* Getting started */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.gettingStarted')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.gettingStartedText')}
          </p>
        </section>

        {/* Models: can / cannot */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">
            {t('help.modelsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                ✅ {t('help.modelsCanTitle')}
              </h3>
              <ul className="space-y-1.5">
                {canItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                ⛔ {t('help.modelsCannotTitle')}
              </h3>
              <ul className="space-y-1.5">
                {cannotItems.map((item) => (
                  <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-4 leading-relaxed">
            💡 {t('help.modelsHint')}
          </p>
        </section>

        {/* Context: how the AI sees the chat */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.contextTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.contextText')}
          </p>
        </section>

        {/* Profiles */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.profilesTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.profilesDescription')}
          </p>
        </section>

        {/* Memory */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🧠 {t('help.memoryTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
            {t('help.memoryText')}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            💡 {t('help.memoryHowTo')}
          </p>
        </section>

        {/* Import / Export */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.importExportTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
            {t('help.importExportIntro')}
          </p>
          <ul className="space-y-1.5 mb-4">
            {importExportItems.map((item) => (
              <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            {t('help.importExportHint')}
          </p>
        </section>

        {/* Privacy */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            🔒 {t('help.privacyTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('help.privacyText')}
          </p>
        </section>

        {/* Tips */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            {t('help.tipsTitle')}
          </h2>
          <ul className="space-y-1.5">
            {tips.map((tip) => (
              <li key={tip} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Footer */}
        <section className="text-center mt-8">
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 mb-1">
            {t('help.needMoreHelp')}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            {t('help.contactSupport')}
          </p>
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('help.closeHelp')}
          </button>
        </section>
      </div>
    </div>
  );
};
