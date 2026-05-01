// Inference service exports
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
} from './inference-engine';

// Re-export ModelConfig from types
export type { ModelConfig } from '../../types';
