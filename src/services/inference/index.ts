/**
 * Inference Service Index
 * 
 * Exports all inference-related functionality with a unified API
 * 
 * Usage:
 * - For simple inference: use generateText() or streamText()
 * - For advanced control: use getInferenceEngine()
 * - For performance monitoring: use metricsCollector
 */

// ============================================================================
// Main Exports - Use these for most use cases
// ============================================================================

export {
    // Simple API - Recommended for most use cases
    generateText,
    streamText,
    
    // Engine access - For advanced use cases
    getInferenceEngine,
    resetInferenceEngine,
    createInferenceEngine,
    
    // Performance utilities
    detectSystemCapabilities,
    applyAdaptiveConfiguration,
    PERFORMANCE_CONFIG,
} from './unified-inference-engine';

// Export types separately
export type {
    GenerateRequest,
    GenerateResult,
    ModelLoadResult,
    InferenceEngineConfig,
} from './unified-inference-engine';

// Re-export types from unified-inference-engine
export type {
    MemoryManager,
    TokenStreamOptimizer,
    ModelPreloader,
    PerformanceMetricsCollector,
} from './unified-inference-engine';

// Re-export instances from performance-optimizer
export { memoryManager, metricsCollector, modelPreloader } from './performance-optimizer';

// Re-export from performance optimizer for convenience
export type { PerformanceMetrics } from './performance-optimizer';

// ============================================================================
// Legacy Exports - For backward compatibility
// ============================================================================

// Re-export specific types and functions from old inference-engine.ts (deprecated, use unified engine)
export {
    checkWebGPUAvailable,
    clearModelCache,
    generate,
    getCacheStats,
    getCachedModelIds,
    getCurrentModelId,
    getWebGPUAvailable,
    isModelLoaded,
    loadModel,
    unloadModel,
} from './inference-engine';

// Re-export types from llm-types
export type * from './llm-types';

// Re-export types from types
export type { ModelConfig, InferenceOptions, InferenceResult, Model, LocalModel } from '../../types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate text with automatic retry on failure
 */
export const generateTextWithRetry = async (
    modelId: string,
    prompt: string,
    options: Partial<import('../../types').InferenceOptions> = {},
    retryOptions?: {
        maxRetries?: number;
        delay?: number;
    }
): Promise<import('../../types').InferenceResult> => {
    const { generateText } = await import('./unified-inference-engine');
    
    const maxRetries = retryOptions?.maxRetries || 3;
    const delay = retryOptions?.delay || 1000;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await generateText(modelId, prompt, options);
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            
            if (attempt < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('All retries failed');
};

/**
 * Check if Web Workers are supported and available
 */
export const isWebWorkerSupported = (): boolean => {
    try {
        return typeof Worker !== 'undefined' && 
               typeof URL !== 'undefined' && 
               typeof URL.createObjectURL !== 'undefined';
    } catch {
        return false;
    }
};

/**
 * Get optimal inference configuration based on system capabilities
 */
export const getOptimalConfig = async (): Promise<import('./unified-inference-engine').InferenceEngineConfig> => {
    const { detectSystemCapabilities } = await import('./unified-inference-engine');
    
    const caps = await detectSystemCapabilities();
    
    return {
        maxCacheSize: caps.isMobile ? 1 : 2,
        enableWebWorkers: caps.webgpuAvailable && isWebWorkerSupported(),
        enablePreloading: !caps.isMobile,
        memoryWarningThreshold: caps.deviceMemoryGB < 4 ? 0.7 : 0.8,
        memoryCriticalThreshold: 0.95,
    };
};
