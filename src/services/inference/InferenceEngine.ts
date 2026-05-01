import { InferenceOptions, InferenceResult } from '../../types';
import { pipeline, TextGenerationPipeline, env } from '@xenova/transformers';
import { log, warn } from '../logging';
import { checkWebGPUSupport } from '../security';

// Allow loading ONNX models from HuggingFace (cached in browser after first load)
env.allowRemoteModels = true;

let currentModelId: string | null = null;
let currentPipeline: TextGenerationPipeline | null = null;
let isLoading = false;
let webgpuAvailable: boolean | null = null;
let cleanupFunctions: (() => void)[] = [];

// Type guard for pipeline results
function isPipelineResult(result: any): result is { generated_text: string } {
  return result && typeof result === 'object' && 'generated_text' in result;
}

// Model configurations - using Xenova ONNX models (compatible with Transformers.js)
export const MODEL_CONFIG: Record<string, { name: string; modelPath: string; type: 'chat' | 'base' }> = {
  'qwen-0.5b': {
    name: 'Qwen1.5 0.5B Chat',
    modelPath: 'Xenova/Qwen1.5-0.5B-Chat',
    type: 'chat',
  },
  'gpt2': {
    name: 'GPT-2',
    modelPath: 'Xenova/gpt2',
    type: 'base',
  },
  'qwen-1.8b': {
    name: 'Qwen1.5 1.8B Chat',
    modelPath: 'Xenova/Qwen1.5-1.8B-Chat',
    type: 'chat',
  },
  'distilgpt2': {
    name: 'DistilGPT2',
    modelPath: 'Xenova/distilgpt2',
    type: 'base',
  },
};

// Format prompt based on model type
const formatPrompt = (modelId: string, userPrompt: string, systemPrompt?: string, language: string = 'en'): string => {
  const config = MODEL_CONFIG[modelId];
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
  const promptIndex = generatedText.indexOf(fullPrompt);
  let responseText = '';

  if (promptIndex !== -1) {
    responseText = generatedText.substring(promptIndex + fullPrompt.length).trim();
  } else {
    responseText = generatedText.trim();
  }

  // Remove ChatML end tokens for Qwen models
  const config = MODEL_CONFIG[modelId];
  if (config?.type === 'chat') {
    const endIdx = responseText.indexOf('<|im_end|>');
    if (endIdx !== -1) responseText = responseText.substring(0, endIdx).trim();
  }

  // Remove any remaining special tokens
  responseText = responseText.replace(/<\|[^|]+\|>/g, '').trim();

  // For base models, stop at the next "Q:" to avoid rambling
  if (config?.type === 'base') {
    const nextQ = responseText.indexOf('\nQ:');
    if (nextQ !== -1) responseText = responseText.substring(0, nextQ).trim();
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
        env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
        env.backends.onnx.wasm.simd = true;
        env.backends.onnx.wasm.proxy = false;
      } else if (isChrome) {
        log('✓ WebGPU is available (Chrome - using aggressive optimizations)');
        // Chrome WebGPU settings
        env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 4 : 8, navigator.hardwareConcurrency || 8);
        env.backends.onnx.wasm.simd = true;
        env.backends.onnx.wasm.proxy = false;
      } else if (isSafari) {
        log('✓ WebGPU is available (Safari - using mobile-optimized settings)');
        // Safari WebGPU settings (more conservative, especially on mobile)
        env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 3, navigator.hardwareConcurrency || 3);
        env.backends.onnx.wasm.simd = true;
        env.backends.onnx.wasm.proxy = false;
      } else {
        log('✓ WebGPU is available (Generic browser)');
        // Default settings for other browsers
        env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
        env.backends.onnx.wasm.simd = true;
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

  if (isLoading) {
    throw new Error('Another model is already loading');
  }

  try {
    isLoading = true;
    const config = MODEL_CONFIG[modelId];
    
    if (!config) {
      throw new Error(`Unknown model ID: ${modelId}`);
    }
    
    // Validate model configuration
    if (!config.name || !config.modelPath || !config.type) {
      throw new Error(`Invalid model configuration for ${modelId}`);
    }
    
    if (config.type !== 'chat' && config.type !== 'base') {
      throw new Error(`Invalid model type: ${config.type} for ${modelId}`);
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
      throw new Error('Failed to create pipeline');
    }

    currentPipeline = generator as TextGenerationPipeline;
    currentModelId = modelId;

    log(`✓ Model ${modelId} loaded successfully`);
  } catch (error) {
    console.error('Failed to load model:', error instanceof Error ? error : new Error(String(error)));
    currentModelId = null;
    currentPipeline = null;
    throw error instanceof Error ? error : new Error('Unknown error occurred while loading model');
  } finally {
    isLoading = false;
  }
};

export const generate = async (
  prompt: string,
  options: InferenceOptions
): Promise<InferenceResult> => {
  if (!currentPipeline || !currentModelId) {
    throw new Error('No model loaded. Please load a model first.');
  }

  // Validate input
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt must be a non-empty string');
  }

  if (!options || typeof options !== 'object') {
    throw new Error('Options must be an object');
  }

  // Validate options
  if (options.temperature < 0 || options.temperature > 2) {
    throw new Error('Temperature must be between 0 and 2');
  }

  if (options.topP < 0 || options.topP > 1) {
    throw new Error('TopP must be between 0 and 1');
  }

  if (options.maxTokens < 1 || options.maxTokens > 1024) {
    throw new Error('MaxTokens must be between 1 and 1024');
  }

  if (options.systemPrompt && typeof options.systemPrompt !== 'string') {
    throw new Error('System prompt must be a string');
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
    throw new Error(
      `Failed to generate response: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export const unloadModel = (): void => {
  // Clean up resources
  if (currentPipeline) {
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
  
  currentModelId = null;
  currentPipeline = null;
  log('Model unloaded and resources cleaned up');
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
