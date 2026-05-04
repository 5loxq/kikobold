// Inference service exports
// Export the new enhanced inference engine
export * from './llm-inference-engine';
export * from './llm-types';

// Export the old inference engine for backward compatibility
export {
  checkWebGPUAvailable,
  loadModel,
  generate,
  unloadModel,
  registerCleanup,
  isModelLoaded,
  getCurrentModelId,
  getWebGPUAvailable,
  MODEL_CONFIGS,
  getModelConfig,
  clearModelCache,
  getCachedModelIds,
  getCacheStats,
} from './inference-engine';

// Re-export ModelConfig from types
export type { ModelConfig } from '../../types';
