import { Model, ModelConfig } from '../../types';

// All available models - single source of truth (MLC-Format for WebLLM)
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'Qwen2-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 0.5B (MLC)',
    modelPath: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    type: 'chat',
    description: 'Very small and fast, minimal resources needed',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: true,
    contextLength: 2048,
    provider: 'mlc-ai',
  },
  'TinyLlama-1.1B-q4f16_1-MLC': {
    id: 'TinyLlama-1.1B-q4f16_1-MLC',
    name: 'TinyLlama 1.1B (MLC)',
    modelPath: 'TinyLlama-1.1B-q4f16_1-MLC',
    type: 'chat',
    description: 'Ultra-lightweight, fastest inference',
    modelSize: '1.1B',
    fileSizeMB: 300,
    quantized: true,
    recommended: true,
    contextLength: 2048,
    provider: 'mlc-ai',
  },
  'Phi-2-q4f16_1-MLC': {
    id: 'Phi-2-q4f16_1-MLC',
    name: 'Phi 2 (MLC)',
    modelPath: 'Phi-2-q4f16_1-MLC',
    type: 'chat',
    description: 'High-quality, excellent reasoning',
    modelSize: '2.7B',
    fileSizeMB: 700,
    quantized: true,
    recommended: true,
    contextLength: 2048,
    provider: 'mlc-ai',
  },
  'Llama-3.1-8B-Instruct-q4f32_1-MLC': {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B (MLC)',
    modelPath: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    type: 'chat',
    description: 'Large model, needs more resources',
    modelSize: '8B',
    fileSizeMB: 1500,
    quantized: true,
    recommended: false,
    contextLength: 4096,
    provider: 'mlc-ai',
  },
  'Mistral-7B-Instruct-v0.3-q4f32_1-MLC': {
    id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    name: 'Mistral 7B (MLC)',
    modelPath: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    type: 'chat',
    description: 'Balanced performance, good quality',
    modelSize: '7B',
    fileSizeMB: 1800,
    quantized: true,
    recommended: false,
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
