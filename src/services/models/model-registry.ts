import { Model, ModelConfig } from '../../types';

// All available models - single source of truth
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'qwen-0.5b': {
    id: 'qwen-0.5b',
    name: 'Qwen1.5 0.5B Chat',
    modelPath: 'Xenova/Qwen1.5-0.5B-Chat',
    type: 'chat',
    description: 'Very small and fast, minimal resources needed',
    modelSize: '0.5B',
    fileSizeMB: 350,
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
  'distilgpt2': {
    id: 'distilgpt2',
    name: 'DistilGPT2',
    modelPath: 'Xenova/distilgpt2',
    type: 'base',
    description: 'Ultra-small, instant responses, basic quality',
    modelSize: '82M',
    fileSizeMB: 120,
    quantized: true,
    recommended: true,
    contextLength: 1024,
  },
  'gpt2': {
    id: 'gpt2',
    name: 'GPT-2',
    modelPath: 'Xenova/gpt2',
    type: 'base',
    description: 'Reliable text generation, good all-rounder',
    modelSize: '124M',
    fileSizeMB: 500,
    quantized: true,
    recommended: true,
    contextLength: 1024,
  },
  'qwen-1.8b': {
    id: 'qwen-1.8b',
    name: 'Qwen1.5 1.8B Chat',
    modelPath: 'Xenova/Qwen1.5-1.8B-Chat',
    type: 'chat',
    description: 'Best quality, needs more resources',
    modelSize: '1.8B',
    fileSizeMB: 1200,
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
  // Legacy models from FEATURES.md for backward compatibility
  'tinyllama-1.1b': {
    id: 'tinyllama-1.1b',
    name: 'TinyLLaMA 1.1B',
    modelPath: 'Xenova/TinyLlama-1.1B-Chat',
    type: 'chat',
    description: 'Ultra-lightweight, fastest inference',
    modelSize: '1.1B',
    fileSizeMB: 637,
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
  'phi-2': {
    id: 'phi-2',
    name: 'Phi-2 2.7B',
    modelPath: 'Xenova/phi-2',
    type: 'chat',
    description: 'High-quality, excellent reasoning',
    modelSize: '2.7B',
    fileSizeMB: 1400,
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
  'neural-chat-7b': {
    id: 'neural-chat-7b',
    name: 'Neural Chat 7B',
    modelPath: 'Xenova/NeuralChat-7B',
    type: 'chat',
    description: 'Conversational optimized',
    modelSize: '7B',
    fileSizeMB: 10000,
    quantized: true,
    recommended: false,
    contextLength: 4096,
  },
  'mistral-7b': {
    id: 'mistral-7b',
    name: 'Mistral 7B Instruct',
    modelPath: 'Xenova/Mistral-7B-Instruct',
    type: 'chat',
    description: 'Balanced performance',
    modelSize: '7B',
    fileSizeMB: 10000,
    quantized: true,
    recommended: false,
    contextLength: 4096,
  },
  'llama-2-7b': {
    id: 'llama-2-7b',
    name: 'LLaMA 2 7B Chat',
    modelPath: 'Xenova/Llama-2-7B-Chat',
    type: 'chat',
    description: 'Reliable and consistent',
    modelSize: '7B',
    fileSizeMB: 10000,
    quantized: true,
    recommended: false,
    contextLength: 4096,
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
