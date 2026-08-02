import { Model, ModelConfig } from '../../types';

// All available models - single source of truth (MLC-Format for WebLLM)
// Model IDs must match exactly with prebuiltAppConfig from @mlc-ai/web-llm
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'Qwen2-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 0.5B (MLC)',
    modelPath: 'mlc-ai/Qwen2-0.5B-Instruct-q4f16_1-MLC',
    type: 'chat',
    description: 'Very small and fast, minimal resources needed',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: true,
    contextLength: 4096, // From prebuiltAppConfig overrides
    provider: 'mlc-ai',
  },
  'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC': {
    id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
    name: 'TinyLlama 1.1B v1.0 (MLC)',
    modelPath: 'mlc-ai/TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',
    type: 'chat',
    description: 'Ultra-lightweight, fastest inference',
    modelSize: '1.1B',
    fileSizeMB: 300,
    quantized: true,
    recommended: true,
    contextLength: 4096,
    provider: 'mlc-ai',
  },
  'Mistral-7B-Instruct-v0.3-q4f16_1-MLC': {
    id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    name: 'Mistral 7B v0.3 (MLC)',
    modelPath: 'mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    type: 'chat',
    description: 'Balanced performance, good quality',
    modelSize: '7B',
    fileSizeMB: 1800,
    quantized: true,
    recommended: false, // Too large for most devices
    contextLength: 4096,
    provider: 'mlc-ai',
  },
};

// Convert to Model[] for UI components
export const MODELS: Model[] = Object.values(MODEL_CONFIGS).map(config => ({
  id: config.id,
  name: config.name,
  description: config.description,
  modelSize: config.modelSize,
  fileSizeMB: config.fileSizeMB,
  downloadUrl: config.modelPath,
  quantized: config.quantized,
  recommended: config.recommended,
  contextLength: config.contextLength,
  provider: config.provider,
}));

// Helper functions
export const getModelConfig = (modelId: string): ModelConfig | undefined => {
  return MODEL_CONFIGS[modelId];
};

export const getModelById = (id: string): Model | undefined => {
  return MODELS.find(m => m.id === id);
};

export const getRecommendedModels = (): Model[] => {
  return MODELS.filter(m => m.recommended);
};
