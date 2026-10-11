import React from 'react';
import { useTranslation } from 'react-i18next';

interface RoadmapPageProps {
  /** Return to the previous view (e.g. the chat). window.close() only works
   *  for script-opened windows, so without this the button does nothing. */
  onNavigateBack?: () => void;
}

export const RoadmapPage: React.FC<RoadmapPageProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();

  const categories: Array<{ icon: string; titleKey: string; itemKeys: string[] }> = [
    {
      icon: '🎨',
      titleKey: 'roadmap.imagesTitle',
      itemKeys: [
        'roadmap.images1', 'roadmap.images2', 'roadmap.images3', 'roadmap.images4',
        'roadmap.images5', 'roadmap.images6', 'roadmap.images7', 'roadmap.images8',
      ],
    },
    {
      icon: '💬',
      titleKey: 'roadmap.chatTitle',
      itemKeys: [
        'roadmap.chat1', 'roadmap.chat2', 'roadmap.chat3', 'roadmap.chat4',
        'roadmap.chat5', 'roadmap.chat6', 'roadmap.chat7', 'roadmap.chat8',
        'roadmap.chat9',
      ],
    },
    {
      icon: '📄',
      titleKey: 'roadmap.docsTitle',
      itemKeys: ['roadmap.docs1', 'roadmap.docs2', 'roadmap.docs3', 'roadmap.docs4'],
    },
    {
      icon: '🛡️',
      titleKey: 'roadmap.stabilityTitle',
      itemKeys: ['roadmap.stability2', 'roadmap.stability5', 'roadmap.stability6'],
    },
    {
      icon: '📦',
      titleKey: 'roadmap.downloadsTitle',
      itemKeys: ['roadmap.downloads2', 'roadmap.downloads3', 'roadmap.downloads4', 'roadmap.downloads5', 'roadmap.downloads6'],
    },
    {
      icon: '💾',
      titleKey: 'roadmap.storageTitle',
      itemKeys: ['roadmap.storage1', 'roadmap.storage3', 'roadmap.storage4'],
    },
    {
      icon: '🔒',
      titleKey: 'roadmap.privacyTitle',
      itemKeys: ['roadmap.privacy1', 'roadmap.privacy2', 'roadmap.privacy3', 'roadmap.privacy4'],
    },
    {
      icon: '🧩',
      titleKey: 'roadmap.extTitle',
      itemKeys: ['roadmap.ext1', 'roadmap.ext2', 'roadmap.ext3'],
    },
    {
      icon: '⌨️',
      titleKey: 'roadmap.comfortTitle',
      itemKeys: ['roadmap.comfort1', 'roadmap.comfort2', 'roadmap.comfort3', 'roadmap.comfort4', 'roadmap.comfort5'],
    },
    {
      icon: '🌍',
      titleKey: 'roadmap.a11yTitle',
      itemKeys: ['roadmap.a11y1', 'roadmap.a11y2'],
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">
          🗺️ {t('roadmap.title')}
        </h1>

        {/* Intro */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('roadmap.intro')}
          </p>
        </section>

        {/* No timeline / no promises note */}
        <section className="rounded-2xl p-4 mb-4 border-l-4 border-amber-400 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60">
          <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
            ⏳ {t('roadmap.noTimeline')}
          </p>
        </section>

        {/* Categories */}
        {categories.map((category) => (
          <section
            key={category.titleKey}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4"
          >
            <h2 className="text-xl font-semibold mb-3 text-zinc-700 dark:text-zinc-200">
              {category.icon} {t(category.titleKey)}
            </h2>
            <ul className="space-y-1.5">
              {category.itemKeys.map((itemKey) => (
                <li
                  key={itemKey}
                  className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2"
                >
                  <span className="text-indigo-500 dark:text-indigo-400 mt-0.5">•</span>
                  <span>{t(itemKey)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Footer */}
        <section className="text-center mt-8">
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('roadmap.closeRoadmap')}
          </button>
        </section>
      </div>
    </div>
  );
};
