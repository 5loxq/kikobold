/**
 * Inference hook for browser-based LLM generation.
 *
 * Two engines:
 * - WebLLM (WebGPU, MLC models) when the browser supports it
 * - wllama (WASM, GGUF models) as universal fallback
 *
 * Model files live on our own webspace (/models/) and are cached in the
 * browser (OPFS); the HuggingFace CDN is only a fallback source.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { type AppConfig, type ChatCompletionChunk, type MLCEngineInterface } from "@mlc-ai/web-llm";
import { handleErrorSilent } from '../utils/errors';
import { log, warn } from '../services/logging';
import { stripHiddenPartsText } from '../services/llm/text-processing';
import { getEngineType, getModelConfig, getWasmFallbackModelId } from '../services/models/model-registry';
import { getCustomAppConfig } from '../services/models/webllm-config';
import {
  cancelWllamaGeneration,
  type DownloadStats,
  generateWithWllamaStream,
  isWllamaModelLoaded,
  loadWllamaModel,
  supportsWllamaImageInput,
  unloadWllamaModel,
  wllamaIsActive,
} from '../services/inference/wllama-engine';

// ============================================================================
// Types
// ============================================================================

/** Download size/speed info shown while a model is being fetched */
export type ModelLoadStats = DownloadStats;

// WebLLM reports download progress only as text. Current versions (0.2.79+)
// use "Fetching param cache[20/38]: 250MB fetched. 18% completed, 12.5 secs
// elapsed." - the total size has to be derived from the percentage. Older
// versions used "250MB/1.4GB".
const parseWebLLMSizeText = (text: string): { loadedMB: number; totalMB: number } | null => {
  const current = text.match(/(\d+(?:\.\d+)?)\s*MB\s+(?:fetched|loaded)\.\s*(\d+(?:\.\d+)?)%\s+completed/);
  if (current) {
    const loadedMB = parseFloat(current[1]);
    const percent = parseFloat(current[2]);
    return { loadedMB, totalMB: percent > 0 ? (loadedMB * 100) / percent : 0 };
  }
  const match = text.match(/(\d+(?:\.\d+)?)(MB|GB)\/(\d+(?:\.\d+)?)(MB|GB)/);
  if (!match) {
    return null;
  }
  const toMB = (value: string, unit: string): number =>
    unit === 'GB' ? parseFloat(value) * 1024 : parseFloat(value);
  return { loadedMB: toMB(match[1], match[2]), totalMB: toMB(match[3], match[4]) };
};

export interface WebLLMGenerateOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  images?: Array<{ name: string; data: ArrayBuffer }>;
}

export interface UseEnhancedInferenceOptions {
  modelId: string;
  defaultOptions?: WebLLMGenerateOptions;
  appConfig?: AppConfig;
  /** Automatically load `modelId` on mount. Set to false when the caller
   *  wants to control model loading itself (e.g. ask the user first). */
  autoLoad?: boolean;
}

/** 'downloading' = fetching model files, 'preparing' = initializing in memory */
export type ModelLoadPhase = 'downloading' | 'preparing';

export interface EnhancedInferenceReturn {
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  streamText: string;
  progress: number;
  progressStats: ModelLoadStats | null;
  modelLoadPhase: ModelLoadPhase;
  currentModelId: string | null;
  webgpuAvailable: boolean | null;
  supportsImageInput: boolean;

  generateStream: (prompt: string, options?: WebLLMGenerateOptions, onChunk?: (text: string) => void) => Promise<string>;
  cancel: () => void;
  loadModel: (modelId: string) => Promise<boolean>;
  refreshStatus: () => void;
}

// ============================================================================
// Main Hook
// ============================================================================

export const useEnhancedInference = (
  options: UseEnhancedInferenceOptions
): EnhancedInferenceReturn => {
  const {
    modelId,
    defaultOptions = {},
    appConfig: customAppConfig,
    autoLoad = true,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStats, setProgressStats] = useState<ModelLoadStats | null>(null);
  const [modelLoadPhase, setModelLoadPhase] = useState<ModelLoadPhase>('downloading');
  const [error, setError] = useState<string | null>(null);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);
  const [supportsImageInput, setSupportsImageInput] = useState(false);

  const activeEngineRef = useRef<'webllm' | 'wllama' | null>(null);
  const engineRef = useRef<MLCEngineInterface | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load model using WebLLM or wllama
  const loadModel = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      if (!modelId) {
        throw new Error('No model ID provided');
      }
      setIsLoading(true);
      setError(null);
      setProgress(0);
      setProgressStats(null);
      setModelLoadPhase('downloading');
      const engineType = getEngineType(modelId);
      if (engineType === 'wllama') {
        const config = getModelConfig(modelId);
        if (!config?.gguf) {
          throw new Error('No GGUF source configured for this model');
        }
        // Free the WebLLM engine if another engine is active
        engineRef.current = null;
        setWebgpuAvailable(null);
        const ok = await loadWllamaModel(modelId, config.gguf, {
          onProgress: (fraction, label, stats) => {
            setProgress(fraction * 100);
            setProgressStats(stats ?? null);
            // Once the file is fully fetched, wllama initializes the model in
            // memory (allocate context, load tensors) - that phase has no
            // progress events, so switch the label to "preparing".
            setModelLoadPhase(fraction >= 0.999 ? 'preparing' : 'downloading');
            log(`Loading: ${label ?? ''}`);
          },
        });
        if (!ok) {
          setError('Failed to load GGUF model. Check your connection and try again.');
          setIsLoading(false);
          return false;
        }
        setCurrentModelId(modelId);
        activeEngineRef.current = 'wllama';
        setSupportsImageInput(supportsWllamaImageInput());
        setIsLoading(false);
        return true;
      }

      // Free the wllama instance if another engine is active
      if (wllamaIsActive()) {
        await unloadWllamaModel();
      }

      // Check if WebGPU is available
      const hasWebGPU = !!(navigator as Navigator & { gpu?: unknown }).gpu;
      if (!hasWebGPU) {
        // Automatic fallback: load the WASM/GGUF variant of the model instead
        const fallbackModelId = getWasmFallbackModelId(modelId);
        if (fallbackModelId) {
          log(`WebGPU not available - falling back to WASM model ${fallbackModelId}`);
          setIsLoading(false);
          return loadModel(fallbackModelId);
        }
        throw new Error('WebGPU is not supported in your browser. Please use Chrome, Firefox 113+, Edge, or Safari 16.4+.');
      }

      // Proactive check: WebLLM requires maxStorageBuffersPerShaderStage >= 10.
      // Some GPUs/drivers only report 9, which makes engine init fail AFTER
      // downloading the model. Detect this early and use the WASM variant.
      try {
        const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ limits?: Record<string, number> } | null> | undefined } }).gpu;
        const adapter = await gpu?.requestAdapter();
        const maxStorageBuffers = adapter?.limits?.['maxStorageBuffersPerShaderStage'] ?? 10;
        if (maxStorageBuffers < 10) {
          const fallbackModelId = getWasmFallbackModelId(modelId);
          if (fallbackModelId) {
            log(`WebGPU limit too low (maxStorageBuffersPerShaderStage=${maxStorageBuffers}) - falling back to WASM model ${fallbackModelId}`);
            setIsLoading(false);
            return loadModel(fallbackModelId);
          }
        }
      } catch {
        // Adapter check is best-effort; let WebLLM surface real errors
      }

      // Use custom config or default
      const effectiveAppConfig = customAppConfig ?? getCustomAppConfig();
      log(`Loading model: ${modelId} with WebLLM`);
      log(`Using WebGPU: ${hasWebGPU ? 'Yes' : 'No'}`);
      log(`Using WASM: ${typeof WebAssembly !== 'undefined' ? 'Yes' : 'No'}`);

      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const initProgressCallback = (p: unknown): void => {
        // The runtime report also carries timeElapsed (seconds since init
        // start), which the engine config type does not declare.
        const report = p as { text?: string; progress: number; timeElapsed?: number };
        setProgress(report.progress * 100); // Convert to percentage
        // After the files are fetched, WebLLM compiles GPU shaders and copies
        // the weights into graphics memory - no download progress anymore.
        const isPreparing =
          report.progress >= 0.999 || /shader|Loading GPU/i.test(report.text ?? '');
        setModelLoadPhase(isPreparing ? 'preparing' : 'downloading');
        const size = report.text ? parseWebLLMSizeText(report.text) : null;
        const elapsed = report.timeElapsed ?? 0;
        if (size && elapsed > 0 && !isPreparing) {
          setProgressStats({
            ...size,
            speedMBps: size.loadedMB / elapsed,
          });
        } else {
          setProgressStats(null);
        }
        if (report.text) {
          log(`Loading: ${report.text} (${Math.round(report.progress * 100)}%)`);
        }
      };

      let engine: MLCEngineInterface;
      try {
        engine = await CreateMLCEngine(modelId, {
          appConfig: effectiveAppConfig,
          initProgressCallback,
        });
      } catch (selfHostedError) {
        // If our self-hosted copy cannot be fetched, retry with the
        // original HuggingFace CDN sources before surfacing the error.
        if (!customAppConfig && getModelConfig(modelId)?.selfHostedPath) {
          warn(`Self-hosted model fetch failed (${selfHostedError}), retrying with HuggingFace CDN`);
          setProgress(0);
          setProgressStats(null);
          engine = await CreateMLCEngine(modelId, {
            appConfig: getCustomAppConfig(false),
            initProgressCallback,
          });
        } else {
          throw selfHostedError;
        }
      }

      engineRef.current = engine;
      setCurrentModelId(modelId);
      activeEngineRef.current = 'webllm';
      setSupportsImageInput(false);
      setWebgpuAvailable(true); // WebLLM uses WebGPU
      setIsLoading(false);

      log(`Model ${modelId} loaded successfully with WebLLM`);
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Runtime limit errors (e.g. maxStorageBuffersPerShaderStage) surface
      // only at engine init - automatically fall back to the WASM variant.
      if (/maxStorageBuffersPerShaderStage|exceeds limit/i.test(errorMessage) && getEngineType(modelId) === 'webllm') {
        const fallbackModelId = getWasmFallbackModelId(modelId);
        if (fallbackModelId) {
          warn(`WebGPU runtime limit exceeded for ${modelId} - falling back to WASM model ${fallbackModelId}`);
          setError(null);
          return loadModel(fallbackModelId);
        }
      }
      handleErrorSilent(err);
      setIsLoading(false);
      setProgress(0);
      setProgressStats(null);
      warn(`Failed to load model ${modelId}: ${err}`);
      // Enhanced error messages for common issues
      if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
        setError('⚠️ CORS-Fehler beim Laden vom HuggingFace-CDN. Bitte prüfe deine Internetverbindung und versuche es erneut.');
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('⚠️ Modell nicht auf dem HuggingFace-CDN gefunden. Bitte prüfe die Modell-ID in der Registry.');
      } else if (errorMessage.includes('WebGPU')) {
        setError('⚠️ WebGPU nicht verfügbar. Bitte verwende einen modernen Browser: Chrome, Firefox 113+, Edge oder Safari 16.4+.');
      } else if (errorMessage.includes('WASM')) {
        setError('⚠️ WebAssembly-Fehler. Bitte stelle sicher, dass dein Browser WASM unterstützt und HTTPS verwendet wird.');
      } else {
        setError(`⚠️ Fehler beim Laden des Modells: ${errorMessage}`);
      }

      return false;
    }
  }, [customAppConfig]);

  // Generate text with streaming
  const generateStream = useCallback(async (
    prompt: string,
    options: WebLLMGenerateOptions = {},
    onChunk?: (text: string) => void
  ): Promise<string> => {
    try {
      // Cancel any existing generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;
      setIsGenerating(true);
      setError(null);
      setStreamText('');
      startTimeRef.current = Date.now();
      const mergedOptions = {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 512,
        ...defaultOptions,
        ...options
      };
      let fullText = '';
      if (activeEngineRef.current === 'wllama') {
        if (!currentModelId || !isWllamaModelLoaded(currentModelId)) {
          throw new Error('Model not loaded. Please load a model first.');
        }
        fullText = await generateWithWllamaStream(
          prompt,
          {
            temperature: mergedOptions.temperature,
            top_p: mergedOptions.top_p,
            max_tokens: mergedOptions.max_tokens,
            systemPrompt: mergedOptions.systemPrompt,
            history: mergedOptions.history,
            images: mergedOptions.images,
          },
          (delta) => {
            fullText += delta;
            setStreamText(fullText);
            if (onChunk) {
              onChunk(delta);
            }
          }
        );
      } else {
        if (!engineRef.current) {
          throw new Error('Model not loaded. Please load a model first.');
        }
        const historyMessages = (mergedOptions.history ?? []).map((m) => ({ role: m.role, content: m.content }));
        const response = await engineRef.current.chat.completions.create({
          messages: [
            ...(mergedOptions.systemPrompt
              ? [{ role: 'system' as const, content: mergedOptions.systemPrompt }]
              : []),
            ...historyMessages,
            { role: "user", content: prompt }
          ],
          stream: true,
          ...mergedOptions
        });
        if (typeof (response as AsyncIterable<unknown>)[Symbol.asyncIterator] !== 'function') {
          throw new Error('Expected streaming response but received a single completion');
        }
        const chunks = response as AsyncIterable<ChatCompletionChunk>;
        for await (const chunk of chunks) {
          if (newAbortController.signal.aborted) {
            break;
          }
          const delta = chunk.choices?.[0]?.delta?.content ?? '';
          fullText += delta;
          setStreamText(fullText);
          if (onChunk) {
            onChunk(delta);
          }
        }
      }
      const visibleText = stripHiddenPartsText(fullText);
      setIsGenerating(false);

      return visibleText;
    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsGenerating(false);
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, [defaultOptions, currentModelId]);

  // Cancel generation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cancelWllamaGeneration();
    engineRef.current?.interruptGenerate?.();
    setIsGenerating(false);
  }, []);

  // Refresh status
  const refreshStatus = useCallback(() => {
    if (engineRef.current) {
      setWebgpuAvailable(true);
      try {
        // WebLLM engine has getCurrentModelId method
        const modelId = (engineRef.current as { getCurrentModelId?: () => string | undefined }).getCurrentModelId?.();
        if (modelId) {
          setCurrentModelId(modelId);
        }
      } catch {
        // Ignore errors
      }
    }
  }, []);

  // Auto-load model when modelId changes (unless the caller opts out)
  useEffect(() => {
    if (autoLoad && modelId && !currentModelId) {
      loadModel(modelId);
    }
  }, [modelId, currentModelId, loadModel, autoLoad]);

  // Cleanup on unmount
  useEffect((): (() => void) => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // WebLLM engine cleanup
      if (engineRef.current) {
        // Current WebLLM doesn't have explicit cleanup, but we nullify the reference
        engineRef.current = null;
      }
    };
  }, []);

  return {
    isLoading,
    isGenerating,
    error,
    streamText,
    progress,
    progressStats,
    modelLoadPhase,
    currentModelId,
    webgpuAvailable,
    supportsImageInput,
    generateStream,
    cancel,
    loadModel,
    refreshStatus,
  };
};
