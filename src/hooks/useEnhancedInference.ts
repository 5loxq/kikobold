/**
 * Enhanced Inference Hook with WebLLM
 * 
 * Provides React hooks for browser-based LLM inference using WebLLM:
 * - WebGPU acceleration
 * - WASM-optimized models (MLC format)
 * - Streaming responses
 * - Model preloading and caching
 * - OPFS (Origin Private File System) support
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type AppConfig, type ChatCompletionChunk, type MLCEngineInterface } from "@mlc-ai/web-llm";
import i18n from '../config/i18n';
import { handleErrorSilent } from '../utils/errors';
import { log, warn } from '../services/logging';
import { stripHiddenPartsText } from '../services/llm/text-processing';
import { getEngineType, getModelConfig, getWasmFallbackModelId } from '../services/models/model-registry';
import { getCustomAppConfig } from '../services/models/webllm-config';
import {
  cancelWllamaGeneration,
  type DownloadStats,
  generateWithWllama,
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
export const parseWebLLMSizeText = (text: string): { loadedMB: number; totalMB: number } | null => {
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

/**
 * web-llm's create() resolves to a single completion or to an async chunk
 * stream depending on the `stream` flag. This guard narrows that union
 * without `as unknown as` casts.
 */
const isChunkStream = (value: unknown): value is AsyncIterable<ChatCompletionChunk> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<symbol, unknown>)[Symbol.asyncIterator] === 'function';

export interface WebLLMGenerateOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  images?: Array<{ name: string; data: ArrayBuffer }>;
}

export interface WebLLMGenerateResult {
  text: string;
  usage?: unknown;
}

export interface UseEnhancedInferenceOptions {
  modelId: string;
  defaultOptions?: WebLLMGenerateOptions;
  engineConfig?: Record<string, unknown>;
  autoRetry?: boolean;
  appConfig?: AppConfig;
  /** Automatically load `modelId` on mount. Set to false when the caller
   *  wants to control model loading itself (e.g. ask the user first). */
  autoLoad?: boolean;
}

export interface InferenceState {
  // Status
  isLoading: boolean;
  isStreaming: boolean;
  isGenerating: boolean;
  
  // Results
  result: string;
  streamText: string;
  
  // Progress
  progress: number;
  progressStats: ModelLoadStats | null;
  /** 'downloading' = fetching model files, 'preparing' = initializing in memory */
  modelLoadPhase: 'downloading' | 'preparing';
  tokensGenerated: number;
  tokensPerSecond: number;
  
  // Error
  error: string | null;
  
  // Timing
  duration: number;
  
  // Model info
  currentModelId: string | null;
  webgpuAvailable: boolean | null;
}

export interface EnhancedInferenceReturn extends InferenceState {
  // Actions
  generate: (prompt: string, options?: WebLLMGenerateOptions) => Promise<WebLLMGenerateResult | null>;
  generateStream: (prompt: string, options?: WebLLMGenerateOptions, onChunk?: (text: string) => void) => Promise<string>;
  cancel: () => void;
  activeEngine: 'webllm' | 'wllama' | null;
  supportsImageInput: boolean;
  
  // Model management
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: (modelId: string) => Promise<boolean>;
  preloadModel: (modelId: string, priority?: number) => Promise<void>;
  
  // Status
  refreshStatus: () => void;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Enhanced inference hook using WebLLM for browser-based LLM inference
 */
export const useEnhancedInference = (
  options: UseEnhancedInferenceOptions
): EnhancedInferenceReturn => {
  const {
    modelId,
    defaultOptions = {},
    appConfig: customAppConfig,
    autoLoad = true,
  } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [streamText, setStreamText] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressStats, setProgressStats] = useState<ModelLoadStats | null>(null);
  const [modelLoadPhase, setModelLoadPhase] = useState<'downloading' | 'preparing'>('downloading');
  const [tokensGenerated, setTokensGenerated] = useState(0);
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'webllm' | 'wllama' | null>(null);
  const activeEngineRef = useRef<'webllm' | 'wllama' | null>(null);
  const setEngine = useCallback((engine: 'webllm' | 'wllama' | null): void => {
    activeEngineRef.current = engine;
    setActiveEngine(engine);
  }, []);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);
  const [supportsImageInput, setSupportsImageInput] = useState(false);

  // Refs
  const engineRef = useRef<MLCEngineInterface | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const tokenCountRef = useRef<number>(0);

  // Load model using WebLLM
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
          setError(i18n.t('chat.errorLoadGguf'));
          setIsLoading(false);
          return false;
        }
        setCurrentModelId(modelId);
        setEngine('wllama');
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
      const effectiveAppConfig = customAppConfig ?? await getCustomAppConfig();

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
            appConfig: await getCustomAppConfig(false),
            initProgressCallback,
          });
        } else {
          throw selfHostedError;
        }
      }

      engineRef.current = engine;
      setCurrentModelId(modelId);
      setEngine('webllm');
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

      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsLoading(false);
      setProgress(0);
      setProgressStats(null);
      warn(`Failed to load model ${modelId}: ${err}`);

      // Enhanced error messages for common issues (translated via i18next)
      if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
        setError(i18n.t('chat.errorCors'));
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError(i18n.t('chat.errorNotFound'));
      } else if (errorMessage.includes('WebGPU')) {
        setError(i18n.t('chat.errorWebgpu'));
      } else if (errorMessage.includes('WASM')) {
        setError(i18n.t('chat.errorWasm'));
      } else {
        setError(i18n.t('chat.errorGeneric', { message: errorMessage }));
      }
      
      return false;
    }
  }, [customAppConfig, setEngine]);

  // Unload model
  const unloadModel = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      if (activeEngineRef.current === 'wllama') {
        await unloadWllamaModel();
        setCurrentModelId(null);
        setEngine(null);
        setSupportsImageInput(false);
        return true;
      }
      if (engineRef.current && currentModelId === modelId) {
        // web-llm offers unload(): it waits for the GPU device to finish all
        // submitted work and destroys itself - graphics memory is actually
        // released, not just the JS reference dropped.
        await engineRef.current.unload();
        engineRef.current = null;
        setCurrentModelId(null);
        setEngine(null);
        setWebgpuAvailable(null);
        return true;
      }
      return false;
    } catch (err: unknown) {
      warn('Failed to unload model:', err);
      return false;
    }
  }, [currentModelId, setEngine]);

  // Generate text (non-streaming)
  const generate = useCallback(async (
    prompt: string,
    options: WebLLMGenerateOptions = {}
  ): Promise<WebLLMGenerateResult | null> => {
    try {
      setIsGenerating(true);
      setError(null);
      setResult('');
      startTimeRef.current = Date.now();
      tokenCountRef.current = 0;

      const mergedOptions = {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 512,
        ...defaultOptions,
        ...options
      };

      if (activeEngineRef.current === 'wllama') {
        if (!currentModelId || !isWllamaModelLoaded(currentModelId)) {
          throw new Error('Model not loaded. Please load a model first.');
        }
        const rawText = await generateWithWllama(prompt, {
          temperature: mergedOptions.temperature,
          top_p: mergedOptions.top_p,
          max_tokens: mergedOptions.max_tokens,
          systemPrompt: mergedOptions.systemPrompt,
          history: mergedOptions.history,
          images: mergedOptions.images,
        });
        const responseText = stripHiddenPartsText(rawText);
        setResult(responseText);
        setTokensGenerated(tokenCountRef.current);
        setIsGenerating(false);
        setDuration(Date.now() - startTimeRef.current);
        return { text: responseText, usage: undefined };
      }

      if (!engineRef.current) {
        throw new Error('Model not loaded. Please load a model first.');
      }

      // Only pass the parameters the WebLLM chat API understands; the
      // prompt-building fields (systemPrompt, history, images) are already
      // part of `messages`.
      const apiOptions = {
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
        max_tokens: mergedOptions.max_tokens,
      };

      const messages = [
        ...(mergedOptions.systemPrompt
          ? [{ role: 'system' as const, content: mergedOptions.systemPrompt }]
          : []),
        ...(mergedOptions.history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: prompt },
      ];

      const reply = await engineRef.current.chat.completions.create({
        messages,
        ...apiOptions
      });

      if (isChunkStream(reply)) {
        throw new Error('Unexpected streaming response for non-streaming request');
      }
      const completion = reply;
      const responseText = completion.choices[0]?.message?.content ?? '';
      
      setResult(responseText);
      setTokensGenerated(tokenCountRef.current);
      setDuration(Date.now() - startTimeRef.current);
      setIsGenerating(false);

      return {
        text: responseText,
        usage: completion.usage
      };

    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsGenerating(false);
      throw err;
    }
  }, [defaultOptions, currentModelId]);

  // Generate text with streaming
  const generateStream = useCallback(async (
    prompt: string,
    options: WebLLMGenerateOptions = {},
    onChunk?: (text: string) => void
  ): Promise<string> => {
    // Declared outside the try so the finally block can compare against it
    let newAbortController: AbortController | null = null;
    try {
      // Cancel any existing generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      newAbortController = new AbortController();
      abortControllerRef.current = newAbortController;

      setIsGenerating(true);
      setIsStreaming(true);
      setError(null);
      setStreamText('');
      startTimeRef.current = Date.now();
      tokenCountRef.current = 0;

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
            tokenCountRef.current++;
            setStreamText(fullText);
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            if (elapsed > 0) {
              setTokensPerSecond(tokenCountRef.current / elapsed);
            }
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

        // Only pass the parameters the WebLLM chat API understands; the
        // prompt-building fields are already part of `messages`.
        const apiOptions = {
          temperature: mergedOptions.temperature,
          top_p: mergedOptions.top_p,
          max_tokens: mergedOptions.max_tokens,
        };

        const response = await engineRef.current.chat.completions.create({
          messages: [
            ...(mergedOptions.systemPrompt
              ? [{ role: 'system' as const, content: mergedOptions.systemPrompt }]
              : []),
            ...historyMessages,
            { role: "user", content: prompt }
          ],
          stream: true,
          ...apiOptions
        });
        if (!isChunkStream(response)) {
          throw new Error('Expected streaming response but received a single completion');
        }
        const chunks = response;

        for await (const chunk of chunks) {
          if (newAbortController.signal.aborted) {
            break;
          }

          const delta = chunk.choices?.[0]?.delta?.content ?? '';
          fullText += delta;
          tokenCountRef.current++;

          setStreamText(fullText);

          // Calculate tokens per second
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          if (elapsed > 0) {
            setTokensPerSecond(tokenCountRef.current / elapsed);
          }

          if (onChunk) {
            onChunk(delta);
          }
        }
      }

      const visibleText = stripHiddenPartsText(fullText);
      // Only finalize if this call is still the active generation: an older
      // call that was aborted by a newer one must not clear the new stream's
      // state (and must not null the newer AbortController in `finally`).
      if (abortControllerRef.current !== newAbortController) {
        return visibleText;
      }
      setResult(visibleText);
      setTokensGenerated(tokenCountRef.current);
      setDuration(Date.now() - startTimeRef.current);
      setIsGenerating(false);
      setIsStreaming(false);
      
      return visibleText;

    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsGenerating(false);
      setIsStreaming(false);
      throw err;
    } finally {
      if (newAbortController !== null && abortControllerRef.current === newAbortController) {
        abortControllerRef.current = null;
      }
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
    setIsStreaming(false);
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

  // Preload model (placeholder - WebLLM handles preloading automatically)
  const preloadModel = useCallback(async (modelId: string, priority?: number): Promise<void> => {
    // WebLLM doesn't expose a direct preload API in the current version
    // Preloading is handled automatically when models are used
    log(`Preload requested for model: ${modelId} (priority: ${priority})`);
    // For now, we can trigger a background load if needed
    if (modelId && modelId !== currentModelId) {
      // Don't actually load yet, just log
      log(`Model ${modelId} marked for preloading`);
    }
  }, [currentModelId]);

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
      // Release GPU/WASM memory: web-llm's unload() waits for pending GPU
      // work and destroys the device; wllama frees its worker threads.
      if (engineRef.current) {
        void engineRef.current.unload().catch(() => undefined);
        engineRef.current = null;
      }
      if (wllamaIsActive()) {
        void unloadWllamaModel();
      }
    };
  }, []);

  return {
    // Status
    isLoading,
    isStreaming,
    isGenerating,
    
    // Results
    result,
    streamText,
    
    // Progress
    progress,
    progressStats,
    modelLoadPhase,
    tokensGenerated,
    tokensPerSecond,
    
    // Error
    error,
    
    // Timing
    duration,
    
    // Model info
    currentModelId,
    webgpuAvailable,
    
    // Actions
    generate,
    generateStream,
    cancel,
    
    // Model management
    loadModel,
    unloadModel,
    preloadModel,
    activeEngine,
    supportsImageInput,
    
    // Status
    refreshStatus,
  };
};

// ============================================================================
// Specialized Hooks (simplified versions for compatibility)
// ============================================================================

/**
 * Hook for batch inference operations
 */
export const useBatchInference = (options: UseEnhancedInferenceOptions): {
  generateBatch: (prompts: string[], batchOptions?: WebLLMGenerateOptions) => Promise<WebLLMGenerateResult[]>;
} => {
  const { generate } = useEnhancedInference(options);

  const generateBatch = useCallback(async (
    prompts: string[],
    batchOptions?: WebLLMGenerateOptions
  ): Promise<WebLLMGenerateResult[]> => {
    const results: WebLLMGenerateResult[] = [];
    
    for (const prompt of prompts) {
      const result = await generate(prompt, batchOptions);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }, [generate]);

  return { generateBatch };
};

/**
 * Hook for conversation-based inference with context caching
 */
export const useConversationInference = (
  options: UseEnhancedInferenceOptions & {
    conversationId: string;
  }
): EnhancedInferenceReturn => {
  const baseOptions = options;
  const { generate, generateStream, ...baseReturn } = useEnhancedInference(baseOptions);

  const generateWithContext = useCallback(async (
    prompt: string,
    options?: WebLLMGenerateOptions,
    messages?: Array<{ role: string; content: string }>
  ): Promise<WebLLMGenerateResult | null> => {
    try {
      // For WebLLM, context is handled via the messages array
      if (messages && messages.length > 0) {
        // Prepend context messages to the prompt
        const contextPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const fullPrompt = `${contextPrompt}\n\nUser: ${prompt}`;
        return generate(fullPrompt, options);
      }
      return generate(prompt, options);
    } catch (err: unknown) {
      warn('Failed to generate with context:', err);
      return null;
    }
  }, [generate]);

  return {
    ...baseReturn,
    generate: generateWithContext,
    generateStream,
  };
};

// ============================================================================
// Exports
// ============================================================================

export default useEnhancedInference;
