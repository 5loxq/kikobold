import React from 'react';
import { useTranslation } from 'react-i18next';
import { type EngineModelConfig, getModelConfig, getRecommendedModelId, IMAGE_GEN_MODEL } from '../../services/models/model-registry';
import { isMobileLike } from '../../utils/device';

interface ModelsPageProps {
  /** Return to the previous view (e.g. the chat) */
  onNavigateBack?: () => void;
  /** Select (and if needed download) a model, then return to the chat */
  onSelectModel?: (modelId: string) => void;
}

interface ModelInfo {
  configId: string;
  /** i18n key prefix below `modelsPage` */
  key: string;
  strengths: number;
  weaknesses: number;
}

// Order = presentation order on the page
const MODELS_INFO: ModelInfo[] = [
  { configId: 'Qwen3.5-2B-q4f16_1-MLC', key: 'qwen35', strengths: 4, weaknesses: 3 },
  { configId: 'Qwen3-1.7B-q4f16_1-MLC', key: 'qwen17', strengths: 3, weaknesses: 3 },
  { configId: 'Qwen3-0.6B-q4f16_1-MLC', key: 'qwen06', strengths: 3, weaknesses: 3 },
  { configId: 'LFM2.5-VL-1.6B-GGUF', key: 'lfm', strengths: 4, weaknesses: 4 },
  { configId: 'LFM2.5-350M-GGUF', key: 'lfm350', strengths: 3, weaknesses: 3 },
  { configId: 'Gemma4-E2B-it-GGUF', key: 'gemma4', strengths: 4, weaknesses: 4 },
];

const formatSize = (fileSizeMB?: number): string => {
  if (!fileSizeMB) { return '-'; }
  return fileSizeMB >= 1024 ? `${(fileSizeMB / 1024).toFixed(1)} GB` : `${fileSizeMB} MB`;
};

const ModelCard: React.FC<{ info: ModelInfo }> = ({ info }) => {
  const { t } = useTranslation();
  const config: EngineModelConfig | undefined = getModelConfig(info.configId);

  if (!config) { return null; }

  const strengths = Array.from({ length: info.strengths }, (_, i) => t(`modelsPage.${info.key}.s${i + 1}`));
  const weaknesses = Array.from({ length: info.weaknesses }, (_, i) => t(`modelsPage.${info.key}.w${i + 1}`));

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          {t(`modelsPage.${info.key}.name`)}
        </h2>
        {config.thinking && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
            💭 {t('modelsPage.thinkingBadge')}
          </span>
        )}
        {config.badge === 'recommended' && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300">
            {t('modelsPage.recommendedBadge')}
          </span>
        )}
        {config.badge === 'fast' && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            ⚡ {t('modelsPage.fastBadge')}
          </span>
        )}
        {config.badge === 'alpha' && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
            {t('modelsPage.alphaBadge')}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">
            {t('modelsPage.released')}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">
            {t(`modelsPage.${info.key}.released`)}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">
            {t('modelsPage.downloadSize')}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">
            {formatSize(config.fileSizeMB)}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">
            {t('modelsPage.engine')}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">
            {config.engine === 'webllm' ? t('modelsPage.engineWebgpu') : t('modelsPage.engineWasm')}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 p-3">
          <p className="text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold mb-0.5">
            {t('modelsPage.context')}
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 font-medium">
            {config.contextLength.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Strengths / weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-200 dark:border-green-900/60 bg-green-50/60 dark:bg-green-950/20 p-4">
          <h3 className="font-semibold text-green-700 dark:text-green-400 mb-2">
            ✅ {t('modelsPage.strengths')}
          </h3>
          <ul className="space-y-1.5">
            {strengths.map((item) => (
              <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-green-600 dark:text-green-500 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-4">
          <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">
            ⛔ {t('modelsPage.weaknesses')}
          </h3>
          <ul className="space-y-1.5">
            {weaknesses.map((item) => (
              <li key={item} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-4">
        {t(`modelsPage.${info.key}.summary`)}
      </p>
    </section>
  );
};


export const ModelsPage: React.FC<ModelsPageProps> = ({ onNavigateBack, onSelectModel }) => {
  const { t } = useTranslation();
  // Phones/tablets: WASM inference is slow and the per-tab memory limit is
  // small, so the model choice matters more there than on desktops.
  const isMobile = isMobileLike();

  const handleRecommendation = (): void => {
    const modelId = getRecommendedModelId();
    onSelectModel?.(modelId);
    onNavigateBack?.();
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-zinc-800 dark:text-zinc-100">
          🤖 {t('modelsPage.title')}
        </h1>

        {/* Intro */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('modelsPage.intro')}
          </p>
          {onSelectModel && (
            <button
              onClick={handleRecommendation}
              className="mt-4 w-full sm:w-auto px-6 py-3 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-500 transition-colors shadow-sm"
            >
              ✨ {t('modelsPage.recommendButton')}
            </button>
          )}
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed border-l-4 border-indigo-300 dark:border-indigo-800 pl-3 mt-3">
            💡 {t('modelsPage.thinkingHint')}
          </p>
        </section>

        {/* Mobile hint: which model to pick on a phone and how to download */}
        {isMobile && (
          <section className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-6 shadow-sm border border-amber-200 dark:border-amber-900 mb-4">
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              📱 {t('modelsPage.mobileNote')}
            </p>
          </section>
        )}

        {/* Model cards */}
        {MODELS_INFO.map((info) => (
          <ModelCard key={info.configId} info={info} />
        ))}

        {/* Image generation (Alpha) */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
              🎨 {t('modelsPage.imageGen.title')}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
              {t('modelsPage.alphaBadge')}
            </span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('modelsPage.imageGen.text', {
              name: IMAGE_GEN_MODEL.name,
              size: Math.round(IMAGE_GEN_MODEL.fileSizeMB / 1024 * 10) / 10,
            })}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            {IMAGE_GEN_MODEL.license}
          </p>
        </section>

        {/* Footer */}
        <section className="text-center mt-8">
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('modelsPage.closeModels')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default ModelsPage;
