import { Model } from '../../types';

export const MODELS: Model[] = [
  {
    id: 'qwen-0.5b',
    name: 'Qwen1.5 0.5B Chat',
    description: 'Very small and fast, minimal resources needed',
    modelSize: '0.5B',
    fileSizeMB: 350,
    downloadUrl: 'Xenova/Qwen1.5-0.5B-Chat',
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
  {
    id: 'distilgpt2',
    name: 'DistilGPT2',
    description: 'Ultra-small, instant responses, basic quality',
    modelSize: '82M',
    fileSizeMB: 120,
    downloadUrl: 'Xenova/distilgpt2',
    quantized: true,
    recommended: true,
    contextLength: 1024,
  },
  {
    id: 'gpt2',
    name: 'GPT-2',
    description: 'Reliable text generation, good all-rounder',
    modelSize: '124M',
    fileSizeMB: 500,
    downloadUrl: 'Xenova/gpt2',
    quantized: true,
    recommended: true,
    contextLength: 1024,
  },
  {
    id: 'qwen-1.8b',
    name: 'Qwen1.5 1.8B Chat',
    description: 'Best quality, needs more resources',
    modelSize: '1.8B',
    fileSizeMB: 1200,
    downloadUrl: 'Xenova/Qwen1.5-1.8B-Chat',
    quantized: true,
    recommended: true,
    contextLength: 2048,
  },
];

export const getModelById = (id: string): Model | undefined => {
  return MODELS.find(m => m.id === id);
};

export const getRecommendedModels = (): Model[] => {
  return MODELS.filter(m => m.recommended);
};
