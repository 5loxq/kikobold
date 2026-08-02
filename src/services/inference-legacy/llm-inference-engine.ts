/**
 * Enhanced LLM Inference Engine inspired by ente-io/ensu
 * This provides a more robust and feature-rich inference system
 */

import { pipeline, TextGenerationPipeline, env } from '@xenova-transformers-stub';
import { log, warn, error } from '../logging';
import { checkWebGPUSupport, validateModelPath } from '../security';
import { getModelConfig } from '../models/model-registry';
import { createError, ErrorCodes } from '../../utils/errors';
import type {
    LlmMessage,
    GenerateChatRequest,
    GenerateEvent,
    GenerateSummary,
    BackendType,
    InferenceBackend,
    LoadModelParams,
    ContextParams,
} from './llm-types';

// Constants
const MAX_CACHE_SIZE = 2; // Maximum number of models to cache
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CONTEXT_SIZE = 2048;
const DEFAULT_MAX_TOKENS = 512;

// Model cache to prevent reloading the same model multiple times
const modelCache: Map<string, { 
    pipeline: TextGenerationPipeline; 
    timestamp: number; 
    contextSize: number;
}> = new Map();

// State management
let currentModelId: string | null = null;
let currentPipeline: TextGenerationPipeline | null = null;
let currentContextSize: number = DEFAULT_CONTEXT_SIZE;
let isLoading = false;
let webgpuAvailable: boolean | null = null;
let jobCounter = 0;
let abortControllers = new Map<number, AbortController>();

// Initialize WebGPU support
const initializeWebGPU = async (): Promise<boolean> => {
    if (webgpuAvailable !== null) {
        return webgpuAvailable;
    }

    try {
        const available = await checkWebGPUSupport();
        
        if (available) {
            const isFirefox = navigator.userAgent.includes('Firefox');
            const isChrome = navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Chromium');
            const isSafari = navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome');
            const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

            // Browser-specific optimizations
            if (isFirefox) {
                log('✓ WebGPU available (Firefox - conservative settings)');
                env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
                env.backends.onnx.wasm.simd = true;
                env.backends.onnx.wasm.proxy = false;
            } else if (isChrome) {
                log('✓ WebGPU available (Chrome - aggressive optimizations)');
                env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 4 : 8, navigator.hardwareConcurrency || 8);
                env.backends.onnx.wasm.simd = true;
                env.backends.onnx.wasm.proxy = false;
            } else if (isSafari) {
                log('✓ WebGPU available (Safari - mobile-optimized)');
                env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 3, navigator.hardwareConcurrency || 3);
                env.backends.onnx.wasm.simd = true;
                env.backends.onnx.wasm.proxy = false;
            } else {
                log('✓ WebGPU available (Generic browser)');
                env.backends.onnx.wasm.numThreads = Math.min(isMobile ? 2 : 4, navigator.hardwareConcurrency || 4);
                env.backends.onnx.wasm.simd = true;
            }
        } else {
            warn('⚠️ WebGPU not supported, falling back to CPU');
        }
        
        webgpuAvailable = available;
        return available;
    } catch (err) {
        warn('⚠️ WebGPU check failed:', err);
        webgpuAvailable = false;
        return false;
    }
};

// Clean up old cache entries based on LRU policy
const cleanupOldCacheEntries = (): void => {
    if (modelCache.size <= MAX_CACHE_SIZE) return;
    
    const entries = Array.from(modelCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    while (modelCache.size > MAX_CACHE_SIZE) {
        const oldestEntry = entries.shift();
        if (oldestEntry) {
            try {
                if (typeof (oldestEntry[1].pipeline as any).dispose === 'function') {
                    (oldestEntry[1].pipeline as any).dispose();
                }
                modelCache.delete(oldestEntry[0]);
            } catch (err) {
                warn(`Error cleaning up cached model ${oldestEntry[0]}:`, err);
            }
        }
    }
};

// Start cache cleanup timer
setInterval(() => {
    cleanupOldCacheEntries();
}, CACHE_CLEANUP_INTERVAL);

// Format chat messages using model-specific templates
const formatChatMessages = (modelId: string, messages: LlmMessage[], addAssistant: boolean = true): string => {
    const config = getModelConfig(modelId);
    if (!config) {
        // Fallback to simple format
        return messages.map(msg => `${msg.role}: ${msg.content}`).join('\n') + (addAssistant ? '\nassistant: ' : '');
    }

    if (config.type === 'chat') {
        // Qwen/ChatML format
        let prompt = '';
        for (const msg of messages) {
            if (msg.role === 'system') {
                prompt += `<|im_start|>system\n${msg.content}<|im_end|>\n`;
            } else if (msg.role === 'user') {
                prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
            } else if (msg.role === 'assistant') {
                prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
            }
        }
        if (addAssistant) {
            prompt += `<|im_start|>assistant\n`;
        }
        return prompt;
    } else {
        // Base model format (simple Q&A)
        let prompt = '';
        for (const msg of messages) {
            if (msg.role === 'system') {
                prompt += `System: ${msg.content}\n`;
            } else if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                prompt += `Assistant: ${msg.content}\n`;
            }
        }
        if (addAssistant) {
            prompt += 'Assistant: ';
        }
        return prompt;
    }
};

// Extract response from generated text
const extractResponse = (modelId: string, generatedText: string, fullPrompt: string): string => {
    const config = getModelConfig(modelId);
    let responseText = '';

    if (config?.type === 'chat') {
        // For Qwen/ChatML models
        const assistantStart = '<|im_start|>assistant\n';
        const assistantIndex = generatedText.indexOf(assistantStart);
        
        if (assistantIndex !== -1) {
            responseText = generatedText.substring(assistantIndex + assistantStart.length);
        } else {
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

        // For base models, stop at the next prompt to avoid rambling
        const nextPrompt = responseText.indexOf('\nUser:') || responseText.indexOf('\nSystem:');
        if (nextPrompt !== -1) responseText = responseText.substring(0, nextPrompt).trim();
        
        responseText = responseText.replace(/<\|[^|]+\|>/g, '').trim();
    }

    return responseText;
};



// Main inference backend implementation
class WebGPUInferenceBackend implements InferenceBackend {
    public readonly kind: BackendType = "webgpu";

    async initBackend(): Promise<void> {
        await initializeWebGPU();
        log('✓ WebGPU inference backend initialized');
    }

    async loadModel(params: LoadModelParams): Promise<void> {
        const modelId = params.modelPath; // In our case, modelPath is the modelId
        
        if (currentModelId === modelId && currentPipeline) {
            return; // Model already loaded
        }

        // Check if model is in cache
        if (modelCache.has(modelId)) {
            log(`Loading model ${modelId} from cache`);
            
            if (currentModelId && currentModelId !== modelId) {
                await this.freeContext();
                await this.freeModel();
            }
            
            const cached = modelCache.get(modelId)!;
            cached.timestamp = Date.now();
            modelCache.set(modelId, cached);
            
            currentPipeline = cached.pipeline;
            currentModelId = modelId;
            currentContextSize = cached.contextSize;
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

            if (!validateModelPath(config.modelPath)) {
                throw createError(
                    `Model path is not from a trusted source: ${config.modelPath}`,
                    ErrorCodes.SECURITY_ERROR,
                    { modelId, modelPath: config.modelPath }
                );
            }

            log(`Loading model: ${modelId} (${config.name}) from ${config.modelPath}...`);

            // Create pipeline for text generation
            const generator = await pipeline('text-generation', config.modelPath, {
                quantized: true,
                progress_callback: (progress: number) => {
                    if (progress % 10 === 0) {
                        log(`Loading progress: ${progress}%`);
                    }
                },
            });

            if (!generator) {
                throw createError(
                    'Failed to create pipeline',
                    ErrorCodes.MODEL_LOAD_FAILED,
                    { modelId, modelPath: config.modelPath }
                );
            }

            // Cache the model
            modelCache.set(modelId, { 
                pipeline: generator as TextGenerationPipeline, 
                timestamp: Date.now(),
                contextSize: config.contextLength || DEFAULT_CONTEXT_SIZE
            });
            
            currentPipeline = generator as TextGenerationPipeline;
            currentModelId = modelId;
            currentContextSize = config.contextLength || DEFAULT_CONTEXT_SIZE;

            log(`✓ Model ${modelId} loaded successfully and cached`);
        } catch (err) {
            error('Failed to load model:', err);
            currentModelId = null;
            currentPipeline = null;
            throw createError(
                `Failed to load model: ${err instanceof Error ? err.message : String(err)}`,
                ErrorCodes.MODEL_LOAD_FAILED,
                { modelId, error: err }
            );
        } finally {
            isLoading = false;
        }
    }

    async createContext(
        model: { modelPath: string },
        params: ContextParams = {},
    ): Promise<void> {
        const modelId = model.modelPath;
        const contextSize = params.contextSize ?? DEFAULT_CONTEXT_SIZE;
        
        // If model is already loaded with the same context size, we're good
        if (currentModelId === modelId && currentContextSize === contextSize) {
            return;
        }

        // If model is loaded but with different context size, we need to reload
        if (currentModelId === modelId && currentContextSize !== contextSize) {
            await this.freeContext();
            await this.loadModel({ modelPath: modelId });
            currentContextSize = contextSize;
            return;
        }

        // Load the model if not already loaded
        if (currentModelId !== modelId) {
            await this.loadModel({ modelPath: modelId });
            currentContextSize = contextSize;
        }
    }

    async generateChatStream(
        request: GenerateChatRequest,
        onEvent?: (event: GenerateEvent) => void,
    ): Promise<GenerateSummary> {
        if (!currentPipeline || !currentModelId) {
            throw createError(
                'No model loaded. Please load a model first.',
                ErrorCodes.MODEL_NOT_FOUND,
                { currentModelId }
            );
        }

        const jobId = this.nextJobId();
        const start = Date.now();
        const controller = new AbortController();
        abortControllers.set(jobId, controller);

        let generatedTokens = 0;
        let errorMessage: string | null = null;
        let promptTokens: number | null = null;

        try {
            // Format the chat messages
            const fullPrompt = formatChatMessages(currentModelId, request.messages, request.addAssistant ?? true);

            // Token counting (approximate)
            try {
                const tokenList = await currentPipeline.tokenizer?.encode(fullPrompt);
                promptTokens = tokenList?.length ?? null;
            } catch {
                promptTokens = null;
            }

            // Build sampling configuration
            const sampling = this.buildSamplingConfig(request);
            const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;

            // Generate text
            const result = await currentPipeline(fullPrompt, {
                max_new_tokens: Math.min(maxTokens, currentContextSize - 256), // Leave room for context
                temperature: request.temperature ?? 0.7,
                top_p: request.topP ?? 0.9,
                top_k: request.topK ?? 50,
                do_sample: true,
                repetition_penalty: request.repeatPenalty ?? 1.1,
                num_beams: 1,
                ...sampling,
            });

            // Handle the result
            let responseText = '';
            
            if (Array.isArray(result)) {
                const output = result[0];
                if (output && typeof output === 'object') {
                    const generatedText = (output as any).generated_text || (output as any).text || '';
                    if (typeof generatedText === 'string') {
                        responseText = extractResponse(currentModelId, generatedText, fullPrompt);
                    }
                }
            } else if (typeof result === 'object' && result && 'generated_text' in result) {
                responseText = extractResponse(currentModelId, (result as any).generated_text, fullPrompt);
            } else if (typeof result === 'string') {
                responseText = extractResponse(currentModelId, result, fullPrompt);
            }

            // For streaming, we'll emit the full text at once (simulated streaming)
            if (responseText && onEvent) {
                onEvent({
                    type: "text",
                    job_id: jobId,
                    text: responseText,
                    token_id: null,
                });
                generatedTokens = Math.ceil(responseText.split(/\s+/).length * 1.3);
            }

        } catch (err) {
            if (!(err instanceof Error && err.name === 'AbortError')) {
                errorMessage = err instanceof Error ? err.message : String(err);
            } else {
                errorMessage = "Generation aborted";
            }
        } finally {
            abortControllers.delete(jobId);
        }

        if (errorMessage && onEvent) {
            onEvent({ type: "error", job_id: jobId, message: errorMessage });
        }

        const summary: GenerateSummary = {
            job_id: jobId,
            prompt_tokens: promptTokens,
            generated_tokens: generatedTokens,
            total_time_ms: Date.now() - start,
        };

        if (onEvent) {
            onEvent({ type: "done", summary });
        }

        return summary;
    }

    cancel(jobId: number): void {
        if (jobId <= 0) {
            for (const controller of abortControllers.values()) {
                controller.abort();
            }
            abortControllers.clear();
            return;
        }
        const controller = abortControllers.get(jobId);
        if (controller) {
            controller.abort();
            abortControllers.delete(jobId);
        }
    }

    async freeContext(): Promise<void> {
        // In our current implementation, context is tied to the model
        // So freeing context means we need to unload the model
        await this.freeModel();
    }

    async freeModel(): Promise<void> {
        if (currentPipeline && currentModelId) {
            try {
                if (typeof (currentPipeline as any).dispose === 'function') {
                    (currentPipeline as any).dispose();
                }
            } catch (err) {
                warn('Error during model cleanup:', err);
            }
        }

        if (currentModelId && modelCache.has(currentModelId)) {
            modelCache.delete(currentModelId);
        }

        currentModelId = null;
        currentPipeline = null;
        currentContextSize = DEFAULT_CONTEXT_SIZE;
        log('Model unloaded and resources cleaned up');
    }

    async isModelAvailable(modelPath: string): Promise<boolean> {
        // For now, we assume all models in our registry are available
        // In a more advanced implementation, we could check if the model is cached
        const config = getModelConfig(modelPath);
        return config !== undefined;
    }

    async applyChatTemplate(
        messages: LlmMessage[],
        _templateOverride?: string,
    ): Promise<string> {
        if (!currentModelId) {
            throw new Error("Model must be loaded first.");
        }
        return formatChatMessages(currentModelId, messages, true);
    }

    private nextJobId(): number {
        jobCounter += 1;
        return jobCounter;
    }

    private buildSamplingConfig(request: GenerateChatRequest): Record<string, unknown> {
        const sampling: Record<string, unknown> = {};

        if (request.temperature !== undefined && request.temperature !== null) {
            sampling["temp"] = request.temperature;
        }
        if (request.topP !== undefined && request.topP !== null) {
            sampling["top_p"] = request.topP;
        }
        if (request.topK !== undefined && request.topK !== null) {
            sampling["top_k"] = request.topK;
        }
        if (request.repeatPenalty !== undefined && request.repeatPenalty !== null) {
            sampling["repetition_penalty"] = request.repeatPenalty;
        }
        if (request.frequencyPenalty !== undefined && request.frequencyPenalty !== null) {
            sampling["penalty_freq"] = request.frequencyPenalty;
        }
        if (request.presencePenalty !== undefined && request.presencePenalty !== null) {
            sampling["penalty_present"] = request.presencePenalty;
        }

        return sampling;
    }
}

// Factory function to create inference backend
export const createInferenceBackend = (): InferenceBackend => {
    return new WebGPUInferenceBackend();
};

// Export types for use in other modules
export type {
    LlmMessage,
    GenerateChatRequest,
    GenerateEvent,
    GenerateSummary,
    BackendType,
    InferenceBackend,
    LoadModelParams,
    ContextParams,
};

// Backward compatibility exports
export const checkWebGPUAvailable = initializeWebGPU;
export const loadModel = async (modelId: string): Promise<void> => {
    const backend = createInferenceBackend();
    await backend.initBackend();
    await backend.loadModel({ modelPath: modelId });
};

export const unloadModel = async (): Promise<void> => {
    const backend = createInferenceBackend();
    await backend.freeModel();
};

export const generate = async (
    prompt: string,
    options: any
): Promise<any> => {
    const backend = createInferenceBackend();
    await backend.initBackend();
    
    const messages: LlmMessage[] = [
        { role: 'user', content: prompt }
    ];
    
    if (options.systemPrompt) {
        messages.unshift({ role: 'system', content: options.systemPrompt });
    }

    const request: GenerateChatRequest = {
        messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        repeatPenalty: options.repeatPenalty,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        addAssistant: true,
    };

    return backend.generateChatStream(request, undefined);
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

export const clearModelCache = (): void => {
    for (const [modelId, cached] of modelCache) {
        try {
            if (typeof (cached.pipeline as any).dispose === 'function') {
                (cached.pipeline as any).dispose();
            }
        } catch (err) {
            warn(`Error cleaning up cached model ${modelId}:`, err);
        }
    }
    
    modelCache.clear();
    abortControllers.clear();
    
    if (currentModelId) {
        currentModelId = null;
        currentPipeline = null;
        currentContextSize = DEFAULT_CONTEXT_SIZE;
    }
    
    log('All model caches cleared');
};

export const getCachedModelIds = (): string[] => {
    return Array.from(modelCache.keys());
};

export const getCacheStats = (): { size: number; maxSize: number; entries: string[] } => {
    return {
        size: modelCache.size,
        maxSize: MAX_CACHE_SIZE,
        entries: Array.from(modelCache.keys()),
    };
};
