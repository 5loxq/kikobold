/**
 * Inference Services Index
 * 
 * Exports inference-related services and types
 * 
 * Note: There are two inference engine implementations:
 * - inference-engine.ts: Basic inference engine
 * - llm-inference-engine.ts: Enhanced LLM inference engine with createInferenceBackend
 * To avoid export conflicts, we re-export with specific names
 */

// Export from inference engine with specific names
export {
    checkWebGPUAvailable as checkWebGPUAvailableBasic,
    loadModel as loadModelBasic,
    unloadModel as unloadModelBasic,
    isModelLoaded as isModelLoadedBasic,
    getCurrentModelId as getCurrentModelIdBasic,
    getWebGPUAvailable as getWebGPUAvailableBasic,
    clearModelCache as clearModelCacheBasic,
    getCachedModelIds as getCachedModelIdsBasic,
    getCacheStats as getCacheStatsBasic,
    generate as generateBasic,
    MODEL_CONFIGS,
    getModelConfig,
    registerCleanup
} from './inference-engine';

// Export from llm inference engine (has createInferenceBackend)
export * from './llm-inference-engine';

// Export from unified inference engine
export * from './unified-inference-engine';

// Export from performance optimizer
export * from './performance-optimizer';

// Re-export types with proper syntax for isolatedModules
export type { LlmMessage, GenerateChatRequest, GenerateEvent } from './llm-types';

// Backward compatibility: re-export the basic functions with original names for existing code
// Import the basic functions and re-export them
import {
    checkWebGPUAvailable as checkWebGPUAvailableBasic,
    loadModel as loadModelBasic,
    unloadModel as unloadModelBasic,
    isModelLoaded as isModelLoadedBasic,
    getCurrentModelId as getCurrentModelIdBasic,
    getWebGPUAvailable as getWebGPUAvailableBasic,
    clearModelCache as clearModelCacheBasic,
    getCachedModelIds as getCachedModelIdsBasic,
    getCacheStats as getCacheStatsBasic,
    generate as generateBasic,
} from './inference-engine';

// Re-export with original names
export { checkWebGPUAvailableBasic as checkWebGPUAvailable };
export { loadModelBasic as loadModel };
export { unloadModelBasic as unloadModel };
export { isModelLoadedBasic as isModelLoaded };
export { getCurrentModelIdBasic as getCurrentModelId };
export { getWebGPUAvailableBasic as getWebGPUAvailable };
export { clearModelCacheBasic as clearModelCache };
export { getCachedModelIdsBasic as getCachedModelIds };
export { getCacheStatsBasic as getCacheStats };
export { generateBasic as generate };
