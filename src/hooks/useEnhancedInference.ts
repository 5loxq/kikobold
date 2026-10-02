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
import { 
  AppConfig, 
  CreateMLCEngine,
  MLCEngineInterface 
} from "@mlc-ai/web-llm";
import { handleErrorSilent } from '../utils/errors';
import { log, warn } from '../services/logging';

// ============================================================================
// Types
// ============================================================================

export interface UseEnhancedInferenceOptions {
  modelId: string;
  defaultOptions?: any;
  engineConfig?: any;
  autoRetry?: boolean;
  appConfig?: AppConfig;
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
  generate: (prompt: string, options?: any) => Promise<{ text: string; usage?: any } | null>;
  generateStream: (prompt: string, options?: any, onChunk?: (text: string) => void) => Promise<string>;
  cancel: () => void;
  
  // Model management
  loadModel: (modelId: string) => Promise<boolean>;
  unloadModel: (modelId: string) => Promise<boolean>;
  preloadModel: (modelId: string, priority?: number) => Promise<void>;
  
  // Status
  refreshStatus: () => void;
}

// ============================================================================
// Custom AppConfig for WebLLM with MLC models
// ============================================================================

// Custom configuration for MLC models
// Use ONLY local model files for offline support and better performance
// All models must be available in /public/models/{model_id}/
// WebLLM will automatically look for params_shard_*.bin files in the same directory as model.wasm
const getCustomAppConfig = (): AppConfig => {
  // Only use Qwen2-0.5B-Instruct-q4f16_1-MLC since it's the only model available locally
  // WebLLM expects: model.wasm (runtime) + params_shard_*.bin (weights) in same directory
  const customModels = [
    {
      model_id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
      model: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC',
      model_lib: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/model.wasm',
      vocab_url: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/vocab.json',
      tokenizer_url: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/tokenizer.json',
      tokenizer_config_url: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/tokenizer_config.json',
      ndarray_cache_url: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/ndarray-cache.json',
      mlc_config_url: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC/mlc-chat-config.json',
      context_length: 32768,
      max_seq_length: 32768,
      prefill_chunk_size: 2048,
      // WebLLM will automatically look for params_shard_*.bin in the model directory
      // when model_lib points to a local path
    }
  ];
  
  return {
    cacheBackend: 'opfs', // Use Origin Private File System for best caching
    model_list: customModels,
  };
};

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
    appConfig: customAppConfig 
  } = options;

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [streamText, setStreamText] = useState('');
  const [progress, setProgress] = useState(0);
  const [tokensGenerated, setTokensGenerated] = useState(0);
  const [tokensPerSecond, setTokensPerSecond] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const [webgpuAvailable, setWebgpuAvailable] = useState<boolean | null>(null);

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

      // Check if WebGPU is available
      const hasWebGPU = !!(navigator as any).gpu;
      if (!hasWebGPU) {
        throw new Error('WebGPU is not supported in your browser. Please use Chrome, Firefox 113+, Edge, or Safari 16.4+.');
      }

      // Use custom config or default
      const effectiveAppConfig = customAppConfig ?? getCustomAppConfig();

      log(`Loading model: ${modelId} with WebLLM`);
      log(`Using WebGPU: ${hasWebGPU ? 'Yes' : 'No'}`);
      log(`Using WASM: ${typeof WebAssembly !== 'undefined' ? 'Yes' : 'No'}`);

      const engine = await CreateMLCEngine(modelId, {
        appConfig: effectiveAppConfig,
        initProgressCallback: (p: { text?: string; progress: number }) => {
          setProgress(p.progress * 100); // Convert to percentage
          if (p.text) {
            log(`Loading: ${p.text} (${Math.round(p.progress * 100)}%)`);
          }
        }
      });

      engineRef.current = engine;
      setCurrentModelId(modelId);
      setWebgpuAvailable(true); // WebLLM uses WebGPU
      setIsLoading(false);
      
      log(`Model ${modelId} loaded successfully with WebLLM`);
      return true;

    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsLoading(false);
      setProgress(0);
      warn(`Failed to load model ${modelId}: ${err}`);
      
      // Enhanced error messages for common issues
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('CORS') || errorMessage.includes('cross-origin')) {
        setError('⚠️ CORS Fehler: Modelle müssen auf demselben Server gehostet werden (www.posthiel.de). Bitte lade die MLC-Modelle in den Ordner /models/ hoch. Anleitung: Siehe Dokumentation.');
      } else if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setError('⚠️ Modell-Dateien nicht gefunden. Bitte stelle sicher, dass die Modelle in https://www.posthiel.de/models/{Modell-ID}/ verfügbar sind.');
      } else if (errorMessage.includes('WebGPU')) {
        setError('⚠️ WebGPU nicht verfügbar. Bitte verwende einen modernen Browser: Chrome, Firefox 113+, Edge oder Safari 16.4+.');
      } else if (errorMessage.includes('WASM')) {
        setError('⚠️ WebAssembly-Fehler. Bitte stelle sicher, dass dein Browser WASM unterstützt und HTTPS verwendet wird.');
      } else {
        // Default error message with more context
        setError(`⚠️ Fehler beim Laden des Modells: ${errorMessage}. Bitte lade die Modell-Dateien auf deinen Webspace hoch.`);
      }
      
      return false;
    }
  }, [customAppConfig]);

  // Unload model
  const unloadModel = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      if (engineRef.current && currentModelId === modelId) {
        // WebLLM doesn't have a direct unload method in the current API
        // We can nullify the reference and reset state
        engineRef.current = null;
        setCurrentModelId(null);
        setWebgpuAvailable(null);
        return true;
      }
      return false;
    } catch (err: unknown) {
      warn('Failed to unload model:', err);
      return false;
    }
  }, [currentModelId]);

  // Generate text (non-streaming)
  const generate = useCallback(async (
    prompt: string,
    options: any = {}
  ): Promise<{ text: string; usage?: any } | null> => {
    try {
      if (!engineRef.current) {
        throw new Error('Model not loaded. Please load a model first.');
      }

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

      const reply = await engineRef.current.chat.completions.create({
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
        max_tokens: mergedOptions.max_tokens,
        ...mergedOptions
      });

      const responseText = reply.choices[0]?.message?.content || '';
      
      setResult(responseText);
      setTokensGenerated(tokenCountRef.current);
      setDuration(Date.now() - startTimeRef.current);
      setIsGenerating(false);

      return {
        text: responseText,
        usage: reply.usage
      };

    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsGenerating(false);
      throw err;
    }
  }, [defaultOptions]);

  // Generate text with streaming
  const generateStream = useCallback(async (
    prompt: string,
    options: any = {},
    onChunk?: (text: string) => void
  ): Promise<string> => {
    try {
      if (!engineRef.current) {
        throw new Error('Model not loaded. Please load a model first.');
      }

      // Cancel any existing generation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const newAbortController = new AbortController();
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

      const chunks = await engineRef.current.chat.completions.create({
        messages: [
          { role: "user", content: prompt }
        ],
        stream: true,
        temperature: mergedOptions.temperature,
        top_p: mergedOptions.top_p,
        max_tokens: mergedOptions.max_tokens,
        ...mergedOptions
      });

      let fullText = '';
      
      for await (const chunk of chunks) {
        if (newAbortController.signal.aborted) {
          break;
        }

        const delta = chunk.choices[0]?.delta?.content || '';
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

      setResult(fullText);
      setTokensGenerated(tokenCountRef.current);
      setDuration(Date.now() - startTimeRef.current);
      setIsGenerating(false);
      setIsStreaming(false);
      
      return fullText;

    } catch (err: unknown) {
      const appError = handleErrorSilent(err);
      setError(appError.userMessage);
      setIsGenerating(false);
      setIsStreaming(false);
      throw err;
    } finally {
      abortControllerRef.current = null;
    }
  }, [defaultOptions]);

  // Cancel generation
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setIsStreaming(false);
  }, []);

  // Refresh status
  const refreshStatus = useCallback(() => {
    if (engineRef.current) {
      setWebgpuAvailable(true);
      try {
        // WebLLM engine has getCurrentModelId method
        const modelId = (engineRef.current as any).getCurrentModelId?.();
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

  // Auto-load model when modelId changes
  useEffect(() => {
    if (modelId && !currentModelId) {
      loadModel(modelId);
    }
  }, [modelId, currentModelId, loadModel]);

  // Cleanup on unmount
  useEffect(() => {
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
    // Status
    isLoading,
    isStreaming,
    isGenerating,
    
    // Results
    result,
    streamText,
    
    // Progress
    progress,
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
export const useBatchInference = (options: UseEnhancedInferenceOptions) => {
  const { generate } = useEnhancedInference(options);

  const generateBatch = useCallback(async (
    prompts: string[],
    batchOptions?: any
  ): Promise<{ text: string; usage?: any }[]> => {
    const results: { text: string; usage?: any }[] = [];
    
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
) => {
  const { conversationId, ...baseOptions } = options;
  const { generate, generateStream, ...baseReturn } = useEnhancedInference(baseOptions);

  const generateWithContext = useCallback(async (
    prompt: string,
    options?: any,
    messages?: Array<{ role: string; content: string }>
  ): Promise<{ text: string; usage?: any } | null> => {
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
  }, [conversationId, generate]);

  return {
    ...baseReturn,
    generate: generateWithContext,
    generateStream,
  };
};

/**
 * Hook for monitoring inference performance
 */
export const useInferencePerformance = () => {
  const [metrics, setMetrics] = useState<any>({});
  const [memoryUsage, setMemoryUsage] = useState<{
    usedMB: number;
    totalMB: number;
    usagePercent: number;
  }>({ usedMB: 0, totalMB: 0, usagePercent: 0 });

  // WebLLM doesn't expose detailed metrics in the current API
  // This is a placeholder for future implementation
  useEffect(() => {
    // For now, just return empty metrics
    setMetrics({});
    setMemoryUsage({ usedMB: 0, totalMB: 0, usagePercent: 0 });
  }, []);

  return { metrics, memoryUsage };
};

/**
 * Hook for preloading models in the background
 */
export const useModelPreloader = (options: {
  modelIds: string[];
}) => {
  const { modelIds } = options;
  const [preloadStatus, setPreloadStatus] = useState<Record<string, {
    status: 'pending' | 'loading' | 'loaded' | 'failed';
    progress: number;
    error?: string;
  }>>({});

  useEffect(() => {
    const preload = async () => {
      // Initialize status
      const initialStatus: typeof preloadStatus = {};
      for (const modelId of modelIds) {
        initialStatus[modelId] = { status: 'pending', progress: 0 };
      }
      setPreloadStatus(initialStatus);

      // WebLLM handles preloading automatically
      // For now, mark all as loaded
      for (const modelId of modelIds) {
        setPreloadStatus(prev => ({
          ...prev,
          [modelId]: { ...prev[modelId], status: 'loaded', progress: 100 }
        }));
      }
    };

    preload();
  }, [modelIds]);

  return { preloadStatus };
};

// ============================================================================
// Exports
// ============================================================================

export default useEnhancedInference;
