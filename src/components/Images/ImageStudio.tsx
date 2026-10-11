import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMAGE_GEN_MODEL } from '../../services/models/model-registry';
import {
  generateImage,
  getImageGenRuntimeIssue,
  type ImageGenProgress,
  isImageGenModelLoaded,
  unloadImageGenModel,
} from '../../services/inference/sd-engine';

interface ImageStudioProps {
  /** Return to the previous view (e.g. the chat) */
  onNavigateBack?: () => void;
}

const AlphaBadge: React.FC = () => {
  const { t } = useTranslation();
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 align-middle">
      {t('imagesPage.alphaBadge')}
    </span>
  );
};

interface DownloadStats {
  loadedMB: number;
  totalMB: number;
  speedMBps: number;
}

// Remaining time for the current download, derived from size/speed stats
// (same formatting as the chat model downloads in MainLayout).
const downloadEta = (stats: DownloadStats | null): string | null => {
  if (!stats || stats.speedMBps <= 0 || stats.totalMB <= stats.loadedMB) {
    return null;
  }
  const remainingSec = Math.max(0, (stats.totalMB - stats.loadedMB) / stats.speedMBps);
  const min = Math.floor(remainingSec / 60);
  const sec = Math.round(remainingSec % 60);
  return min > 0 ? `${min} min ${sec} s` : `${sec} s`;
};

export const ImageStudio: React.FC<ImageStudioProps> = ({ onNavigateBack }) => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [steps, setSteps] = useState(IMAGE_GEN_MODEL.steps.default);
  const [seed, setSeed] = useState<string>('');
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState<ImageGenProgress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Seed of the last generated image: shown next to the result and written
  // back into the seed input, so the image can be reproduced with one click.
  const [usedSeed, setUsedSeed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(isImageGenModelLoaded());
  const [dlStats, setDlStats] = useState<DownloadStats | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Aggregation across the model's files: the engine reports per-file
  // download progress, the UI shows the total like for the chat models.
  const dlBytesByFile = useRef<Map<string, number>>(new Map());
  const dlStartTs = useRef<number | null>(null);
  // Progress throttle bookkeeping (see onProgress below)
  const lastProgressTs = useRef(0);
  const lastProgressPhase = useRef<ImageGenProgress['phase'] | null>(null);

  const hasWebGPU = typeof navigator !== 'undefined' && !!(navigator as Navigator & { gpu?: unknown }).gpu;
  const runtimeIssue = getImageGenRuntimeIssue();
  // Chromium major version from the UA (Chrome and Edge both report it) -
  // shown in the memory64 warning so users can see how old their browser is.
  const chromiumMajor = ((): number | null => {
    const match = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent);
    return match ? Number(match[1]) : null;
  })();

  // Release the model (and its GPU memory) when leaving the studio: image
  // generation and the chat models compete for the same resources.
  useEffect((): (() => void) => {
    return () => {
      if (isImageGenModelLoaded()) {
        void unloadImageGenModel();
      }
    };
  }, []);

  const handleGenerate = useCallback((): void => {
    if (isWorking || !prompt.trim()) {
      return;
    }
    setIsWorking(true);
    setError(null);
    setProgress(null);
    setResult(null);
    setUsedSeed(null);
    setDlStats(null);
    dlBytesByFile.current.clear();
    dlStartTs.current = null;
    lastProgressTs.current = 0;
    lastProgressPhase.current = null;
    const parsedSeed = seed.trim().length > 0 ? Number(seed) : undefined;

    generateImage(prompt, {
      negativePrompt: negativePrompt.trim().length > 0 ? negativePrompt : undefined,
      steps,
      seed: Number.isFinite(parsedSeed) ? parsedSeed : undefined,
      onProgress: (p) => {
        // Throttle React updates: at ~27 MB/s the engine fires well over a
        // thousand progress events per second - rendering each one
        // saturates the main thread. Update the UI at most every 100 ms
        // (phase changes always go through).
        const now = Date.now();
        const isPhaseChange = p.phase !== lastProgressPhase.current;
        if (!isPhaseChange && now - lastProgressTs.current < 100) {
          return;
        }
        lastProgressTs.current = now;
        lastProgressPhase.current = p.phase;
        setProgress(p);
        if (p.phase === 'downloading' && p.totalBytes && p.totalBytes > 0) {
          dlBytesByFile.current.set(p.label ?? '_current', p.downloadedBytes ?? 0);
          let downloaded = 0;
          for (const bytes of dlBytesByFile.current.values()) {
            downloaded += bytes;
          }
          dlStartTs.current ??= Date.now();
          const elapsedSec = (Date.now() - dlStartTs.current) / 1000;
          const loadedMB = downloaded / (1024 * 1024);
          setDlStats({
            loadedMB,
            totalMB: IMAGE_GEN_MODEL.fileSizeMB,
            speedMBps: elapsedSec > 0 ? loadedMB / elapsedSec : 0,
          });
        }
      },
    })
      .then(({ dataUrl, seed }) => {
        setResult(dataUrl);
        setUsedSeed(seed);
        // Show the seed that produced this image (also in the input field,
        // so regenerating with the exact same seed is one click away).
        setSeed(String(seed));
        setModelLoaded(true);
      })
      .catch((err: unknown) => {
        const detail = err instanceof Error ? err.message : String(err);
        setError(`${t('imagesPage.errorLoadModel')}: ${detail}`);
      })
      .finally(() => {
        setIsWorking(false);
        setProgress(null);
      });
  }, [isWorking, prompt, negativePrompt, steps, seed, t]);

  const handleDownload = useCallback((): void => {
    if (!result) {
      return;
    }
    const link = document.createElement('a');
    link.href = result;
    link.download = `kikobold-bild-${Date.now()}.png`;
    link.click();
  }, [result]);

  const progressPercent = (): number | null => {
    if (!progress) {
      return null;
    }
    if (progress.phase === 'downloading') {
      return Math.round(progress.progress);
    }
    if (progress.phase === 'unet') {
      return Math.round(progress.progress);
    }
    return null;
  };
  const percent = progressPercent();

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-2 text-zinc-800 dark:text-zinc-100 flex items-center gap-3">
          🎨 {t('imagesPage.title')}
          <AlphaBadge />
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {t('imagesPage.intro', { name: IMAGE_GEN_MODEL.name, size: Math.round(IMAGE_GEN_MODEL.fileSizeMB / 1024 * 10) / 10 })}
        </p>

        {!hasWebGPU && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">
              {t('imagesPage.errorWebgpu')}
            </p>
            <p className="text-amber-700/80 dark:text-amber-500 text-sm mt-1">
              {t('imagesPage.errorWebgpuHint')}
            </p>
          </div>
        )}

        {hasWebGPU && runtimeIssue === 'memory64' && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">
              {t('imagesPage.errorMemory64')}
            </p>
            <p className="text-amber-700/80 dark:text-amber-500 text-sm mt-1">
              {t('imagesPage.errorMemory64Hint')}
            </p>
            {chromiumMajor !== null && (
              <p className="text-amber-700/80 dark:text-amber-500 text-sm mt-1 font-medium">
                {t('imagesPage.detectedBrowser', { version: `Chrome/Edge ${chromiumMajor}` })}
              </p>
            )}
          </div>
        )}

        {hasWebGPU && runtimeIssue === 'isolation' && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">
              {t('imagesPage.errorIsolation')}
            </p>
            <p className="text-amber-700/80 dark:text-amber-500 text-sm mt-1">
              {t('imagesPage.errorIsolationHint')}
            </p>
          </div>
        )}

        {hasWebGPU && runtimeIssue === 'memory-limit' && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl">
            <p className="text-amber-700 dark:text-amber-400 font-semibold">
              {t('imagesPage.errorMemoryLimit')}
            </p>
            <p className="text-amber-700/80 dark:text-amber-500 text-sm mt-1">
              {t('imagesPage.errorMemoryLimitHint')}
            </p>
          </div>
        )}

        {/* Prompt form */}
        <section className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <label htmlFor="image-prompt" className="block font-semibold mb-2 text-zinc-800 dark:text-zinc-100">
            {t('imagesPage.prompt')}
          </label>
          <textarea
            id="image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('imagesPage.promptPlaceholder')}
            rows={3}
            disabled={isWorking || !hasWebGPU || runtimeIssue !== null}
            className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />

          <label htmlFor="image-negative-prompt" className="block font-semibold mt-4 mb-2 text-zinc-800 dark:text-zinc-100">
            {t('imagesPage.negativePrompt')} <span className="font-normal text-zinc-400">({t('common.optional')})</span>
          </label>
          <input
            id="image-negative-prompt"
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder={t('imagesPage.negativePromptPlaceholder')}
            disabled={isWorking || !hasWebGPU || runtimeIssue !== null}
            className="w-full px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="image-steps" className="block font-semibold mb-2 text-zinc-800 dark:text-zinc-100">
                {t('imagesPage.steps')}: <span className="tabular-nums">{steps}</span>
              </label>
              <input
                id="image-steps"
                type="range"
                min={IMAGE_GEN_MODEL.steps.min}
                max={IMAGE_GEN_MODEL.steps.max}
                step={1}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                disabled={isWorking}
                className="w-full accent-indigo-600"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t('imagesPage.stepsHint')}
              </p>
            </div>
            <div>
              <label htmlFor="image-seed" className="block font-semibold mb-2 text-zinc-800 dark:text-zinc-100">
                {t('imagesPage.seed')} <span className="font-normal text-zinc-400">({t('common.optional')})</span>
              </label>
              <input
                id="image-seed"
                type="text"
                inputMode="numeric"
                value={seed}
                onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('imagesPage.seedPlaceholder')}
                disabled={isWorking}
                className="w-full px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {t('imagesPage.seedHint')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isWorking || !hasWebGPU || runtimeIssue !== null || !prompt.trim()}
            className="mt-6 w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {isWorking
              ? t('imagesPage.generating')
              : modelLoaded
                ? t('imagesPage.generate')
                : t('imagesPage.generateFirst')}
          </button>

          {/* Progress */}
          {isWorking && progress && (
            <div className="mt-4" role="status">
              {progress.phase === 'downloading' && (
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t('imagesPage.downloadingModel')}
                    {progress.label ? ` · ${progress.label}` : ''}
                  </p>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-700 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          2,
                          dlStats
                            ? (dlStats.loadedMB / Math.max(1, dlStats.totalMB)) * 100
                            : percent ?? 0
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 tabular-nums">
                    {dlStats
                      ? `${Math.round((dlStats.loadedMB / Math.max(1, dlStats.totalMB)) * 100)}% · ${t('chat.downloadStats', {
                          loaded: Math.round(dlStats.loadedMB),
                          total: Math.round(dlStats.totalMB),
                          speed: dlStats.speedMBps.toFixed(1),
                        })}`
                      : `${Math.round(percent ?? 0)}%`}
                  </p>
                  {((): JSX.Element | null => {
                    const eta = downloadEta(dlStats);
                    return eta ? (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                        {t('chat.downloadEta', { time: eta })}
                      </p>
                    ) : null;
                  })()}
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                    {t('chat.downloadLocalNote')}
                  </p>
                </>
              )}
              {progress.phase === 'encoding' && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('imagesPage.encodingPrompt')}</p>
              )}
              {progress.phase === 'unet' && (
                <>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-1.5">
                    {t('imagesPage.diffusing', { current: Math.max(1, Math.round((percent ?? 0) / 100 * steps)), total: steps })}
                  </p>
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-700 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(2, percent ?? 0)}%` }}
                    />
                  </div>
                </>
              )}
              {progress.phase === 'vae' && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('imagesPage.decoding')}</p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </section>

        {/* Result */}
        {result && (
          <section
            ref={resultRef}
            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">
                {t('imagesPage.result')}
              </h2>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                ⬇️ {t('imagesPage.download')}
              </button>
            </div>
            <img
              src={result}
              alt={prompt}
              className="w-full max-w-md mx-auto rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm"
            />
            {usedSeed !== null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 text-center tabular-nums">
                {t('imagesPage.seed')}: {usedSeed}
              </p>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 text-center">
              {t('imagesPage.localOnly')}
            </p>
          </section>
        )}

        {/* Footer */}
        <section className="text-center mt-8">
          <button
            onClick={() => (onNavigateBack ? onNavigateBack() : window.close())}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
          >
            {t('imagesPage.back')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default ImageStudio;
