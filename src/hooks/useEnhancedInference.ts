/**
 * Enhanced Inference Hook
 * 
 * Provides React hooks for inference with performance optimizations including:
 * - Web Worker support for non-blocking inference
 * - Token streaming with React state updates
 * - Performance metrics tracking
 * - Model preloading
 * - Conversation context caching
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    generateText,
    streamText,
    getInferenceEngine,
    generateTextWithRetry,
    InferenceEngineConfig,
    GenerateResult,
    MemoryManager,
    PerformanceMetricsCollector,
    PERFORMANCE_CONFIG,
} from '../services/inference';
import { InferenceOptions, Model, LocalModel } from '../types';
import { createError, ErrorCodes, AppError, handleErrorSilent } from '../utils/errors';
import { log, warn } from '../services/logging';

// ============================================================================
// Types
// ============================================================================

export interface UseEnhancedInferenceOptions {
    modelId: string;
    defaultOptions?: Partial<InferenceOptions>;
    engineConfig?: InferenceEngineConfig;
    enableStreaming?: boolean;
    autoRetry?: boolean;
    retryOptions?: {
        maxRetries: number;
        delay: number;
    };
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
    webWorkersEnabled: boolean;
}

export interface EnhancedInferenceReturn extends InferenceState {
    // Actions
    generate: (prompt: string, options?: Partial<InferenceOptions>) => Promise<GenerateResult | null>;
    generateStream: (
        prompt: string,
        options?: Partial<InferenceOptions>,
        onToken?: (token: string, fullText: string) => void
    ) => Promise<void>;
    cancel: () => void;
    
    // Model management
    loadModel: (modelId: string) => Promise<boolean>;
    unloadModel: (modelId: string) => Promise<boolean>;
    preloadModel: (modelId: string, priority?: number) => Promise<void>;
    
    // Performance
    getMetrics: () => any;
    getMemoryManager: () => MemoryManager;
    getPerformanceConfig: () => typeof PERFORMANCE_CONFIG;
    
    // Status
    refreshStatus: () => void;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Enhanced inference hook with performance optimizations
 */
export const useEnhancedInference = (
    options: UseEnhancedInferenceOptions
): EnhancedInferenceReturn => {
    const {
        modelId,
        defaultOptions = {},
        engineConfig = {},
        enableStreaming = true,
        autoRetry = true,
        retryOptions = { maxRetries: 3, delay: 1000 },
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
    const [webWorkersEnabled, setWebWorkersEnabled] = useState(false);

    // Refs
    const abortControllerRef = useRef<AbortController | null>(null);
    const engineRef = useRef<any>(null);
    const startTimeRef = useRef<number>(0);
    const tokenCountRef = useRef<number>(0);
    const fullTextRef = useRef<string>('');

    // Memoized default options
    const defaultInferenceOptions = useMemo<InferenceOptions>(() => ({
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 512,
        topK: 50,
        repeatPenalty: 1.0,
        ...defaultOptions,
    }), [defaultOptions]);

    // Initialize engine
    useEffect(() => {
        const initEngine = async () => {
            try {
                const engine = getInferenceEngine(engineConfig);
                await engine.init();
                engineRef.current = engine;
                
                const status = engine.getStatus();
                setCurrentModelId(status.currentModelId);
                setWebgpuAvailable(status.webgpuAvailable);
                setWebWorkersEnabled(status.webWorkersEnabled);
            } catch (err) {
                warn('Failed to initialize inference engine:', err);
            }
        };

        initEngine();

        return () => {
            // Cleanup on unmount
            if (engineRef.current) {
                engineRef.current.cleanup().catch(() => {});
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [engineConfig]);

    // Refresh status when modelId changes
    useEffect(() => {
        refreshStatus();
    }, [modelId]);

    // Actions
    const generate = useCallback(async (
        prompt: string,
        options?: Partial<InferenceOptions>
    ): Promise<GenerateResult | null> => {
        try {
            setIsGenerating(true);
            setError(null);
            setResult('');
            startTimeRef.current = Date.now();
            tokenCountRef.current = 0;

            const mergedOptions: InferenceOptions = {
                ...defaultInferenceOptions,
                ...options,
            };

            // Use retry wrapper if enabled
            const generateFn = autoRetry ? generateTextWithRetry : generateText;
            
            const result = await generateFn(modelId, prompt, mergedOptions, retryOptions);
            
            setResult(result.text);
            setTokensGenerated(result.tokens);
            setTokensPerSecond(result.averageTokensPerSecond);
            setDuration(result.duration);
            setProgress(100);
            
            return result;
        } catch (err) {
            const appError = handleErrorSilent(err);
            setError(appError.userMessage);
            return null;
        } finally {
            setIsGenerating(false);
            setProgress(0);
        }
    }, [modelId, defaultInferenceOptions, autoRetry, retryOptions]);

    const generateStream = useCallback(async (
        prompt: string,
        options?: Partial<InferenceOptions>,
        onToken?: (token: string, fullText: string) => void
    ): Promise<void> => {
        try {
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
            fullTextRef.current = '';
            startTimeRef.current = Date.now();
            tokenCountRef.current = 0;

            const mergedOptions: InferenceOptions = {
                ...defaultInferenceOptions,
                ...options,
            };

            const stream = streamText(modelId, prompt, mergedOptions);
            
            for await (const token of stream) {
                if (newAbortController.signal.aborted) {
                    break;
                }

                fullTextRef.current += token;
                tokenCountRef.current++;
                
                setStreamText(fullTextRef.current);
                setTokensGenerated(tokenCountRef.current);
                
                // Calculate tokens per second
                const elapsed = (Date.now() - startTimeRef.current) / 1000;
                if (elapsed > 0) {
                    setTokensPerSecond(tokenCountRef.current / elapsed);
                }

                // Call user callback
                if (onToken) {
                    onToken(token, fullTextRef.current);
                }
            }

            setDuration(Date.now() - startTimeRef.current);
            setProgress(100);
        } catch (err) {
            const appError = handleErrorSilent(err);
            setError(appError.userMessage);
        } finally {
            setIsGenerating(false);
            setIsStreaming(false);
            setProgress(0);
            abortControllerRef.current = null;
        }
    }, [modelId, defaultInferenceOptions]);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        setIsStreaming(false);
    }, []);

    const loadModel = useCallback(async (modelId: string): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);
            
            const engine = getInferenceEngine(engineConfig);
            const result = await engine.loadModel(modelId);
            
            if (result.success) {
                setCurrentModelId(modelId);
                setWebgpuAvailable(engine.getStatus().webgpuAvailable);
                return true;
            } else {
                setError(result.error || 'Failed to load model');
                return false;
            }
        } catch (err) {
            const appError = handleErrorSilent(err);
            setError(appError.userMessage);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [engineConfig]);

    const unloadModel = useCallback(async (modelId: string): Promise<boolean> => {
        try {
            const engine = getInferenceEngine(engineConfig);
            const result = engine.unloadModel(modelId);
            
            if (currentModelId === modelId) {
                setCurrentModelId(null);
            }
            
            return result;
        } catch (err) {
            warn('Failed to unload model:', err);
            return false;
        }
    }, [currentModelId, engineConfig]);

    const preloadModel = useCallback(async (modelId: string, priority: number = 5): Promise<void> => {
        try {
            const engine = getInferenceEngine(engineConfig);
            await engine.preloadModel(modelId, priority);
            log(`Preloading model: ${modelId} (priority: ${priority})`);
        } catch (err) {
            warn('Failed to preload model:', err);
        }
    }, [engineConfig]);

    const refreshStatus = useCallback(() => {
        try {
            const engine = getInferenceEngine(engineConfig);
            const status = engine.getStatus();
            setCurrentModelId(status.currentModelId);
            setWebgpuAvailable(status.webgpuAvailable);
            setWebWorkersEnabled(status.webWorkersEnabled);
        } catch (err) {
            warn('Failed to refresh inference status:', err);
        }
    }, [engineConfig]);

    const getMetrics = useCallback(() => {
        try {
            const engine = getInferenceEngine(engineConfig);
            return engine.getMetrics();
        } catch {
            return {};
        }
    }, [engineConfig]);

    const getMemoryManager = useCallback(() => {
        try {
            const engine = getInferenceEngine(engineConfig);
            return engine.getMemoryManager();
        } catch {
            return memoryManager;
        }
    }, [engineConfig]);

    const getPerformanceConfig = useCallback(() => {
        return PERFORMANCE_CONFIG;
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
        webWorkersEnabled,
        
        // Actions
        generate,
        generateStream,
        cancel,
        
        // Model management
        loadModel,
        unloadModel,
        preloadModel,
        
        // Performance
        getMetrics,
        getMemoryManager,
        getPerformanceConfig,
        
        // Status
        refreshStatus,
    };
};

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook for batch inference operations
 */
export const useBatchInference = (options: UseEnhancedInferenceOptions) => {
    const { generate } = useEnhancedInference(options);

    const generateBatch = useCallback(async (
        prompts: string[],
        batchOptions?: Partial<InferenceOptions>
    ): Promise<GenerateResult[]> => {
        const results: GenerateResult[] = [];
        
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
        options?: Partial<InferenceOptions>,
        messages?: Array<{ role: string; content: string }>
    ): Promise<GenerateResult | null> => {
        try {
            const engine = getInferenceEngine(baseOptions.engineConfig);
            
            // Cache conversation context
            if (messages && messages.length > 0) {
                engine.cacheConversation(conversationId, messages);
            }

            // Generate with context
            return generate(prompt, options);
        } catch (err) {
            warn('Failed to generate with context:', err);
            return null;
        }
    }, [conversationId, generate, baseOptions.engineConfig]);

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

    useEffect(() => {
        const engine = getInferenceEngine();
        
        const updateMetrics = () => {
            try {
                setMetrics(engine.getMetrics());
                
                engine.getMemoryManager().getCurrentUsage().then(usage => {
                    setMemoryUsage({
                        usedMB: usage.usedMB,
                        totalMB: usage.totalMB,
                        usagePercent: usage.usagePercent,
                    });
                });
            } catch {
                // Ignore errors
            }
        };

        // Update every second
        const interval = setInterval(updateMetrics, 1000);
        
        // Initial update
        updateMetrics();

        return () => clearInterval(interval);
    }, []);

    return { metrics, memoryUsage };
};

// ============================================================================
// Preloading Hook
// ============================================================================

/**
 * Hook for preloading models in the background
 */
export const useModelPreloader = (options: {
    modelIds: string[];
    engineConfig?: InferenceEngineConfig;
}) => {
    const { modelIds, engineConfig } = options;
    const [preloadStatus, setPreloadStatus] = useState<Record<string, {
        status: 'pending' | 'loading' | 'loaded' | 'failed';
        progress: number;
        error?: string;
    }>>({});

    useEffect(() => {
        const preload = async () => {
            const engine = getInferenceEngine(engineConfig);
            
            // Initialize status
            const initialStatus: typeof preloadStatus = {};
            for (const modelId of modelIds) {
                initialStatus[modelId] = { status: 'pending', progress: 0 };
            }
            setPreloadStatus(initialStatus);

            // Preload models with priority
            for (let i = 0; i < modelIds.length; i++) {
                const modelId = modelIds[i];
                const priority = 10 - i; // Higher priority for earlier models
                
                setPreloadStatus(prev => ({
                    ...prev,
                    [modelId]: { ...prev[modelId], status: 'loading', progress: 0 },
                }));

                try {
                    await engine.preloadModel(modelId, priority);
                    
                    setPreloadStatus(prev => ({
                        ...prev,
                        [modelId]: { ...prev[modelId], status: 'loaded', progress: 100 },
                    }));
                } catch (err) {
                    setPreloadStatus(prev => ({
                        ...prev,
                        [modelId]: { 
                            ...prev[modelId], 
                            status: 'failed', 
                            error: err instanceof Error ? err.message : String(err)
                        },
                    }));
                }
            }
        };

        preload();
    }, [modelIds, engineConfig]);

    return { preloadStatus };
};

// ============================================================================
// Exports
// ============================================================================

export type {
    UseEnhancedInferenceOptions,
    InferenceState,
    EnhancedInferenceReturn,
};

export default useEnhancedInference;
