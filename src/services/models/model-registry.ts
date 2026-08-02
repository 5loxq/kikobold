import { Model, ModelConfig } from '../../types';

// All available models - single source of truth (MLC-Format for WebLLM)
// Only models that are available locally in /public/models/ are listed here
// Model IDs must match exactly with the local model directory names
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'Qwen2-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 0.5B (MLC)',
    modelPath: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC',
    type: 'chat',
    description: 'Very small and fast, minimal resources needed',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: true,
    contextLength: 4096,
    provider: 'local',
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
