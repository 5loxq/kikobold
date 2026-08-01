import { InferenceOptions, InferenceResult } from '../../types';
import { pipeline, TextGenerationPipeline, env } from '@xenova/transformers';
import { log, warn } from '../logging';
import { checkWebGPUSupport, validateModelPath } from '../security';
import { MODEL_CONFIGS, getModelConfig } from '../models/model-registry';
import { createError, ErrorCodes } from '../../utils/errors';

// Workaround for read-only env properties in @xenova/transformers
const mutableEnv = env as any;

// Model cache to prevent reloading the same model multiple times
// Using LRU cache with max size to prevent memory issues
const MAX_CACHE_SIZE = 2; // Maximum number of models to cache
const modelCache: Map<string, { pipeline: TextGenerationPipeline; timestamp: number }> = new Map();

let currentModelId: string | null = null;
let currentPipeline: TextGenerationPipeline | null = null;
let isLoading = false;
let webgpuAvailable: boolean | null = null;
let cleanupFunctions: (() => void)[] = [];

// Cache cleanup interval (5 minutes)
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

// Start cache cleanup timer
setInterval(() => {
  cleanupOldCacheEntries();
}, CACHE_CLEANUP_INTERVAL);

/**
 * Clean up old cache entries based on LRU policy
 */
function cleanupOldCacheEntries(): void {
  if (modelCache.size <= MAX_CACHE_SIZE) return;
  
  // Get all entries sorted by timestamp (oldest first)
  const entries = Array.from(modelCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  // Remove oldest entries to get back to max size
  while (modelCache.size > MAX_CACHE_SIZE && entries.length > 0) {
    const oldestEntry = entries.shift();
    if (oldestEntry) {
      try {
        const [modelId, cached] = oldestEntry;
        
        // Clean up the pipeline if it has a dispose method
        if (typeof (cached.pipeline as any).dispose === 'function') {
          (cached.pipeline as any).dispose();
        }
        
        // Also clean up if this is the current model
        if (currentModelId === modelId) {
          currentPipeline = null;
          currentModelId = null;
        }
        
        modelCache.delete(modelId);
        log(`Cleaned up cached model: ${modelId}`);
      } catch (error) {
        warn(`Error cleaning up cached model ${oldestEntry[0]}:`, error);
      }
    }
  }
}

// Type guard for pipeline results
function isPipelineResult(result: any): result is { generated_text: string } {
  return result && typeof result === 'object' && 'generated_text' in result;
}

// Format prompt based on model type
const formatPrompt = (modelId: string, userPrompt: string, systemPrompt?: string, language: string = 'en'): string => {
  const config = getModelConfig(modelId);
  if (!config) return userPrompt;

  // Add language instruction to system prompt
  const languageInstruction = language === 'de' 
    ? 'Antworte immer auf Deutsch.' 
    : 'Always respond in English.';
  
  const enhancedSystemPrompt = systemPrompt 
    ? `${systemPrompt} ${languageInstruction}` 
    : languageInstruction;

  if (config.type === 'chat') {
    // Qwen models use ChatML format
    let prompt = '';
    prompt += `<|im_start|>system\n${enhancedSystemPrompt}<|im_end|>\n`;
    prompt += `<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
    return prompt;
  }

  // Base models (GPT-2, DistilGPT2): simple Q&A format
  return `${enhancedSystemPrompt}\n\nQ: ${userPrompt}\nA:`;
};

// Extract response and clean up model-specific tokens
const extractResponse = (modelId: string, generatedText: string, fullPrompt: string): string => {
  const config = getModelConfig(modelId);
  let responseText = '';

  if (config?.type === 'chat') {
    // For Qwen/ChatML models: extract text after the assistant token
    // The prompt ends with "<|im_start|>assistant\n" and we want everything after that
    const assistantStart = '<|im_start|>assistant\n';
    const assistantIndex = generatedText.indexOf(assistantStart);
    
    if (assistantIndex !== -1) {
      responseText = generatedText.substring(assistantIndex + assistantStart.length);
    } else {
      // Fallback: try to find the user prompt and take everything after it
      const userPromptIndex = generatedText.indexOf(fullPrompt);
      if (userPromptIndex !== -1) {
        responseText = generatedText.substring(userPromptIndex + fullPrompt.length);
      } else {
        responseText = generatedText;
      }
    }
    
    // Remove ChatML end tokens
    const endIdx = responseText.indexOf('<|im_end|>');
    if (endIdx !== -1) responseText = responseText.substring(0, endIdx).trim();
    
    // Remove any remaining special tokens
    responseText = responseText.replace(/<\|[^|]+\|>/g, '').trim();
  } else {
    // For base models
    const promptIndex = generatedText.indexOf(fullPrompt);
    if (promptIndex !== -1) {
      responseText = generatedText.substring(promptIndex + fullPrompt.length).trim();
    } else {
      responseText = generatedText.trim();
    }

    // For base models, stop at the next "Q:" to avoid rambling
    const nextQ = responseText.indexOf('\nQ:');
    if (nextQ !== -1) responseText = responseText.substring(0, nextQ).trim();
    
    // Remove any remaining special tokens
    responseText = responseText.replace(/<\|[^|]+\|>/g, '').trim();
  }

  return responseText;
};

// Check if WebGPU is available in the browser with browser-specific optimizations
export const checkWebGPUAvailable = async (): Promise<boolean> => {
  if (webgpuAvailable !== null) {
    return webgpuAvailable;
  }

  try {
    // Use our security utility for comprehensive WebGPU detection
    const available = await checkWebGPUSupport();
    
    if (available) {
      const isFirefox = navigator.userAgent.includes('Firefox');
      const isChrome = navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Chromium');
      
      // Browser-specific WebGPU optimizations
      const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      if (isFirefox) {
        log('✓ WebGPU is available (Firefox - using conservative settings)');
        // Firefox WebGPU settings
        mutableEnv.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
        mutableEnv.backends.onnx.wasm.simd = true;
        mutableEnv.backends.onnx.wasm.proxy = false;
      } else if (isChrome) {
        log('✓ WebGPU is available (Chrome - using aggressive optimizations)');
        // Chrome WebGPU settings
        mutableEnv.backends.onnx.wasm.numThreads = Math.min(isMobile ? 4 : 8, navigator.hardwareConcurrency || 8);
        mutableEnv.backends.onnx.wasm.simd = true;
        mutableEnv.backends.onnx.wasm.proxy = false;
      } else if (isSafari) {
        log('✓ WebGPU is available (Safari - using mobile-optimized settings)');
        // Safari WebGPU settings (more conservative, especially on mobile)
        mutableEnv.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 3, navigator.hardwareConcurrency || 3);
        mutableEnv.backends.onnx.wasm.simd = true;
        mutableEnv.backends.onnx.wasm.proxy = false;
      } else {
        log('✓ WebGPU is available (Generic browser)');
        // Default settings for other browsers
        mutableEnv.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
        mutableEnv.backends.onnx.wasm.simd = true;
      }
    } else {
      warn('⚠️ WebGPU is not supported in this browser');
    }
    
    webgpuAvailable = available;
    return available;
  } catch (error) {
    warn('⚠️ WebGPU check failed:', error);
    webgpuAvailable = false;
    return false;
  }
};

export const loadModel = async (modelId: string): Promise<void> => {
  if (currentModelId === modelId && currentPipeline) {
    return; // Model already loaded
  }

  // Check if model is in cache
  if (modelCache.has(modelId)) {
    log(`Loading model ${modelId} from cache`);
    
    // Clean up current model if different
    if (currentModelId && currentModelId !== modelId) {
      await unloadModel();
    }
    
    // Update timestamp for LRU cache
    const cached = modelCache.get(modelId)!;
    cached.timestamp = Date.now();
    modelCache.set(modelId, cached);
    
    currentPipeline = cached.pipeline;
    currentModelId = modelId;
    return;
  }

  if (isLoading) {
    throw createError(
      'Another model is already loading',
      ErrorCodes.MODEL_LOAD_FAILED,
      { currentModelId }
    );
  }

  try {
    isLoading = true;
    const config = getModelConfig(modelId);
    
    if (!config) {
      throw createError(`Unknown model ID: ${modelId}`, ErrorCodes.MODEL_NOT_FOUND, { modelId });
    }
    
    // Validate model configuration
    if (!config.name || !config.modelPath || !config.type) {
      throw createError(
        `Invalid model configuration for ${modelId}`,
        ErrorCodes.VALIDATION_ERROR,
        { modelId, config }
      );
    }

    if (config.type !== 'chat' && config.type !== 'base') {
      throw createError(
        `Invalid model type: ${config.type} for ${modelId}`,
        ErrorCodes.VALIDATION_ERROR,
        { modelId, type: config.type }
      );
    }

    // Validate model path for security
    if (!validateModelPath(config.modelPath)) {
      throw createError(
        `Model path is not from a trusted source: ${config.modelPath}`,
        ErrorCodes.SECURITY_ERROR,
        { modelId, modelPath: config.modelPath }
      );
    }

    log(`Loading model: ${modelId} (${config.name}) from ${config.modelPath}...`);

    // Create pipeline for text generation with ONNX model
    const generator = await pipeline('text-generation', config.modelPath, {
      quantized: true,
      progress_callback: (progress: number) => {
        // Skip progress updates for better performance
        if (progress % 10 === 0) {
          log(`Loading progress: ${progress}%`);
        }
      },
      // Browser-specific optimizations
      ...(navigator.userAgent.includes('Firefox') ? {
        // Firefox-specific optimizations
        dtype: 'float32', // Better compatibility with Firefox's WebGPU
      } : {
        // Chrome/Chromium optimizations
        dtype: 'float16', // Chrome handles float16 better
      }),
    });

    if (!generator) {
      throw createError(
        'Failed to create pipeline',
        ErrorCodes.MODEL_LOAD_FAILED,
        { modelId, modelPath: config.modelPath }
      );
    }

    // Cache the model with timestamp for LRU management
    modelCache.set(modelId, { 
      pipeline: generator as TextGenerationPipeline, 
      timestamp: Date.now() 
    });
    
    // Clean up previous pipeline if it exists and is different
    if (currentPipeline && currentModelId && currentModelId !== modelId) {
      try {
        if (typeof (currentPipeline as any).dispose === 'function') {
          (currentPipeline as any).dispose();
        }
      } catch (cleanupError) {
        warn('Error cleaning up previous pipeline:', cleanupError);
      }
    }
    
    currentPipeline = generator as TextGenerationPipeline;
    currentModelId = modelId;

    log(`✓ Model ${modelId} loaded successfully and cached`);
  } catch (error) {
    console.error('Failed to load model:', error instanceof Error ? error : new Error(String(error)));
    currentModelId = null;
    currentPipeline = null;
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw createError(
      `Failed to load model: ${errorMessage}`,
      ErrorCodes.MODEL_LOAD_FAILED,
      { modelId, error: error }
    );
  } finally {
    isLoading = false;
  }
};

export const generate = async (
  prompt: string,
  options: InferenceOptions
): Promise<InferenceResult> => {
  if (!currentPipeline || !currentModelId) {
    throw createError(
      'No model loaded. Please load a model first.',
      ErrorCodes.MODEL_NOT_FOUND,
      { currentModelId }
    );
  }

  // Validate input
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw createError(
      'Prompt must be a non-empty string',
      ErrorCodes.VALIDATION_ERROR,
      { prompt }
    );
  }

  if (!options || typeof options !== 'object') {
    throw createError(
      'Options must be an object',
      ErrorCodes.VALIDATION_ERROR,
      { options }
    );
  }

  // Validate options
  if (options.temperature < 0 || options.temperature > 2) {
    throw createError(
      'Temperature must be between 0 and 2',
      ErrorCodes.VALIDATION_ERROR,
      { temperature: options.temperature }
    );
  }

  if (options.topP < 0 || options.topP > 1) {
    throw createError(
      'TopP must be between 0 and 1',
      ErrorCodes.VALIDATION_ERROR,
      { topP: options.topP }
    );
  }

  if (options.maxTokens < 1 || options.maxTokens > 1024) {
    throw createError(
      'MaxTokens must be between 1 and 1024',
      ErrorCodes.VALIDATION_ERROR,
      { maxTokens: options.maxTokens }
    );
  }

  if (options.systemPrompt && typeof options.systemPrompt !== 'string') {
    throw createError(
      'System prompt must be a string',
      ErrorCodes.VALIDATION_ERROR,
      { systemPrompt: options.systemPrompt }
    );
  }

  const startTime = performance.now();

  try {
    // Format prompt using model-specific template with language
    const fullPrompt = formatPrompt(currentModelId, prompt, options.systemPrompt, options.language || 'en');

    if (typeof fullPrompt !== 'string' || fullPrompt.length === 0) {
      throw new Error('Formatted prompt is invalid');
    }

    log(`Generating response using ${currentModelId}...`);

    // Generate text using the loaded model with browser-specific optimizations
    const isFirefox = navigator.userAgent.includes('Firefox');
    const isChrome = navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Chromium');
    const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Mobile-specific adjustments
    const maxTokensLimit = isMobile ? 96 : (isFirefox ? 128 : 192);
    const tempLimit = isMobile ? 1.3 : (isFirefox ? 1.5 : 1.8);
    const topPLimit = isMobile ? 0.85 : (isFirefox ? 0.9 : 0.95);
    const repPenalty = isMobile ? 1.2 : (isFirefox ? 1.1 : 1.05);
    
    const result = await currentPipeline(fullPrompt, {
      max_new_tokens: Math.min(options.maxTokens, maxTokensLimit),
      temperature: Math.max(0.1, Math.min(tempLimit, options.temperature)),
      top_p: Math.max(0.1, Math.min(topPLimit, options.topP)),
      do_sample: true,
      repetition_penalty: repPenalty,
      num_beams: 1, // Disable beam search for faster generation
      ...(isChrome && !isMobile ? { early_stopping: true } : {}), // Chrome desktop only
      ...(isSafari ? { use_cache: false } : {}), // Safari works better without cache
    });

    // Extract generated text using model-specific extraction
    let responseText = '';

    if (Array.isArray(result)) {
      const output = result[0];
      if (output && typeof output === 'object') {
        const generatedText = (output as any).generated_text || (output as any).text || '';
        if (typeof generatedText === 'string') {
          responseText = extractResponse(currentModelId, generatedText, fullPrompt);
        }
      }
    } else if (isPipelineResult(result)) {
      responseText = extractResponse(currentModelId, (result as any).generated_text, fullPrompt);
    } else if (typeof result === 'string') {
      responseText = extractResponse(currentModelId, result, fullPrompt);
    }

    const duration = performance.now() - startTime;

    // Estimate token count
    const tokenCount = Math.ceil(responseText.split(/\s+/).length * 1.3);

    log(`✓ Generated ${responseText.length} characters in ${duration.toFixed(2)}ms`);

    return {
      text: responseText,
      tokens: tokenCount,
      duration,
    };
  } catch (error) {
    console.error('Inference error:', error instanceof Error ? error : new Error(String(error)));
    throw createError(
      `Failed to generate response: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCodes.MODEL_INFERENCE_FAILED,
      { error, modelId: currentModelId }
    );
  }
};

export const unloadModel = (): void => {
  // Clean up resources
  if (currentPipeline && currentModelId) {
    try {
      // Check if pipeline has a dispose method
      if (typeof (currentPipeline as any).dispose === 'function') {
        (currentPipeline as any).dispose();
      }
      
      // Clean up any registered cleanup functions
      cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          warn('Cleanup function error:', error);
        }
      });
      cleanupFunctions = [];
    } catch (error) {
      warn('Error during model cleanup:', error);
    }
  }
  
  // Remove from cache if current model is cached
  if (currentModelId && modelCache.has(currentModelId)) {
    modelCache.delete(currentModelId);
  }
  
  currentModelId = null;
  currentPipeline = null;
  log('Model unloaded and resources cleaned up');
};

/**
 * Clear all cached models to free up memory
 */
export const clearModelCache = (): void => {
  // Clean up all cached models
  for (const [modelId, cached] of modelCache) {
    try {
      if (typeof (cached.pipeline as any).dispose === 'function') {
        (cached.pipeline as any).dispose();
      }
    } catch (error) {
      warn(`Error cleaning up cached model ${modelId}:`, error);
    }
  }
  
  modelCache.clear();
  cleanupFunctions = [];
  
  // Also unload current model if any
  if (currentModelId) {
    currentModelId = null;
    currentPipeline = null;
  }
  
  log('All model caches cleared');
};

/**
 * Get list of cached model IDs
 */
export const getCachedModelIds = (): string[] => {
  return Array.from(modelCache.keys());
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): { size: number; maxSize: number; entries: string[] } => {
  return {
    size: modelCache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(modelCache.keys()),
  };
};

/**
 * Register a cleanup function to be called when model is unloaded
 * Useful for cleaning up WebGPU resources, event listeners, etc.
 */
export const registerCleanup = (cleanupFn: () => void): void => {
  cleanupFunctions.push(cleanupFn);
};

export const isModelLoaded = (): boolean => {
  return currentModelId !== null && currentPipeline !== null;
};

export const getCurrentModelId = (): string | null => {
  return currentModelId;
};

export const getWebGPUAvailable = (): boolean | null => {
  return webgpuAvailable;
};

// Export MODEL_CONFIGS and getModelConfig for backward compatibility
export { MODEL_CONFIGS, getModelConfig };
// Export ModelConfig type
export type { ModelConfig } from '../../types';


