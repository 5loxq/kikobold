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
    getSystemCapabilities,
    applyAdaptiveConfiguration,
    PERFORMANCE_CONFIG,
    
    // Types
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

// Re-export from old inference-engine.ts (deprecated, use unified engine)
export * from './inference-engine';

// Re-export from old llm-inference-engine.ts (deprecated, use unified engine)
export * from './llm-inference-engine';
export * from './llm-types';

// Re-export ModelConfig from types
export type { ModelConfig } from '../../types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate text with automatic retry on failure
 */
export const generateTextWithRetry = async (
    modelId: string,
    prompt: string,
    options: Partial<import('./unified-inference-engine').InferenceOptions> = {},
    retryOptions?: {
        maxRetries?: number;
        delay?: number;
    }
): Promise<import('./unified-inference-engine').GenerateResult> => {
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
