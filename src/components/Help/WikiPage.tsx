import React from 'react';
import { useTranslation } from 'react-i18next';

interface WikiPageProps {
  /** Return to the previous view (e.g. the chat) */
  onNavigateBack?: () => void;
}

/**
 * Small static AI lexicon: explains what AI, machine learning, language
 * models and "thinking" are, presents well-known models and what AI can
 * and cannot do. All content is fixed text from the locale files - it
 * needs no downloaded model and works offline.
 */
export const WikiPage: React.FC<WikiPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  const basics = [
    { icon: '🤖', titleKey: 'wiki.aiTitle', textKey: 'wiki.aiText', points: ['wiki.aiPoint1', 'wiki.aiPoint2', 'wiki.aiPoint3'] },
    { icon: '📈', titleKey: 'wiki.mlTitle', textKey: 'wiki.mlText', points: ['wiki.mlPoint1', 'wiki.mlPoint2'] },
    { icon: '💬', titleKey: 'wiki.llmTitle', textKey: 'wiki.llmText', points: ['wiki.llmPoint1', 'wiki.llmPoint2', 'wiki.llmPoint3'] },
  ];

  const models = [
    { nameKey: 'wiki.modelGptName', textKey: 'wiki.modelGptText', local: false },
    { nameKey: 'wiki.modelGeminiName', textKey: 'wiki.modelGeminiText', local: false },
    { nameKey: 'wiki.modelClaudeName', textKey: 'wiki.modelClaudeText', local: false },
    { nameKey: 'wiki.modelLlamaName', textKey: 'wiki.modelLlamaText', local: false },
    { nameKey: 'wiki.modelMistralName', textKey: 'wiki.modelMistralText', local: false },
    { nameKey: 'wiki.modelQwenName', textKey: 'wiki.modelQwenText', local: true },
    { nameKey: 'wiki.modelLfmName', textKey: 'wiki.modelLfmText', local: true },
  ];

  const canItems = ['wiki.can1', 'wiki.can2', 'wiki.can3', 'wiki.can4', 'wiki.can5'];
  const cannotItems = ['wiki.cannot1', 'wiki.cannot2', 'wiki.cannot3', 'wiki.cannot4', 'wiki.cannot5'];
  const thinkingUseful = ['wiki.thinkingUseful1', 'wiki.thinkingUseful2', 'wiki.thinkingUseful3'];
  const thinkingNot = ['wiki.thinkingNot1', 'wiki.thinkingNot2'];

  const glossary = [
    { termKey: 'wiki.termToken', defKey: 'wiki.termTokenDef' },
    { termKey: 'wiki.termContext', defKey: 'wiki.termContextDef' },
    { termKey: 'wiki.termParameters', defKey: 'wiki.termParametersDef' },
    { termKey: 'wiki.termQuantization', defKey: 'wiki.termQuantizationDef' },
    { termKey: 'wiki.termTemperature', defKey: 'wiki.termTemperatureDef' },
    { termKey: 'wiki.termHallucination', defKey: 'wiki.termHallucinationDef' },
    { termKey: 'wiki.termWebgpu', defKey: 'wiki.termWebgpuDef' },
    { termKey: 'wiki.termWasm', defKey: 'wiki.termWasmDef' },
    { termKey: 'wiki.termLocal', defKey: 'wiki.termLocalDef' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8" data-tour="wiki-page">
        <h1 className="text-3xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          📖 {t('wiki.title')}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {t('wiki.subtitle')}
        </p>

        {/* Basics: AI, Machine Learning, Language Models */}
        {basics.map((basic) => (
          <section
            key={basic.titleKey}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4"
          >
            <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
              {basic.icon} {t(basic.titleKey)}
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
              {t(basic.textKey)}
            </p>
            <ul className="space-y-1.5">
              {basic.points.map((pointKey) => (
                <li key={pointKey} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                  <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                  <span>{t(pointKey)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Thinking */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
            💭 {t('wiki.thinkingTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('wiki.thinkingText')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                ✅ {t('wiki.thinkingUsefulTitle')}
              </h3>
              <ul className="space-y-1.5">
                {thinkingUseful.map((itemKey) => (
                  <li key={itemKey} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                    <span>{t(itemKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-4">
              <h3 className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
                ⏳ {t('wiki.thinkingNotTitle')}
              </h3>
              <ul className="space-y-1.5">
                {thinkingNot.map((itemKey) => (
                  <li key={itemKey} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-500 mt-0.5">•</span>
                    <span>{t(itemKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            💡 {t('wiki.thinkingHint')}
          </p>
        </section>

        {/* Known models */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-2 text-zinc-700 dark:text-zinc-200">
            🗺️ {t('wiki.modelsTitle')}
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
            {t('wiki.modelsIntro')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {models.map((model) => (
              <div
                key={model.nameKey}
                className={`rounded-xl border p-4 ${
                  model.local
                    ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/20'
                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60'
                }`}
              >
                <p className={`text-sm font-semibold mb-1 ${model.local ? 'text-indigo-700 dark:text-indigo-300' : 'text-zinc-700 dark:text-zinc-200'}`}>
                  {model.local && '🏠 '}{t(model.nameKey)}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t(model.textKey)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3">
            🔒 {t('wiki.modelsLocalNote')}
          </p>
        </section>

        {/* Can / cannot */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-4 text-zinc-700 dark:text-zinc-200">
            ⚖️ {t('wiki.canTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
              <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
                ✅ {t('wiki.canListTitle')}
              </h3>
              <ul className="space-y-1.5">
                {canItems.map((itemKey) => (
                  <li key={itemKey} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                    <span>{t(itemKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
                ⛔ {t('wiki.cannotListTitle')}
              </h3>
              <ul className="space-y-1.5">
                {cannotItems.map((itemKey) => (
                  <li key={itemKey} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                    <span>{t(itemKey)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
            🪄 {t('wiki.hallucinationTitle')}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('wiki.hallucinationText')}
          </p>
        </section>

        {/* Glossary (collapsible) */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <h2 className="text-xl font-semibold mb-2 text-zinc-700 dark:text-zinc-200">
            📗 {t('wiki.glossaryTitle')}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {t('wiki.glossaryIntro')}
          </p>
          <div className="space-y-2">
            {glossary.map((entry) => (
              <details
                key={entry.termKey}
                className="group rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60"
              >
                <summary className="px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer list-none flex items-center justify-between gap-2">
                  <span>{t(entry.termKey)}</span>
                  <span className="text-zinc-400 transition-transform group-open:rotate-90">›</span>
                </summary>
                <p className="px-4 pb-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {t(entry.defKey)}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer */}
        <section className="text-center mt-8">
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('wiki.closeWiki')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default WikiPage;
