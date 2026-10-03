import { Model, ModelConfig } from '../../types';

// Engine type: 'webllm' uses WebGPU MLC models, 'wllama' runs GGUF models on WASM/CPU
export type EngineType = 'webllm' | 'wllama';

export interface EngineModelConfig extends ModelConfig {
  engine: EngineType;
  gguf?: { repo: string; file: string };
}

// WebLLM models are loaded via the official prebuilt config (HF CDN + browser cache).
// GGUF models are downloaded from Hugging Face via wllama's ModelManager (cached in Cache Storage).
export const MODEL_CONFIGS: Record<string, EngineModelConfig> = {
  'Qwen2-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 0.5B (WebGPU)',
    modelPath: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Very small and fast WebGPU model, needs a modern browser',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: true,
    contextLength: 4096,
    provider: 'webllm-hf-cdn',
  },
  'TinyLlama-1.1B-Chat-v1.0-GGUF': {
    id: 'TinyLlama-1.1B-Chat-v1.0-GGUF',
    name: 'TinyLlama 1.1B Chat (GGUF)',
    modelPath: 'tinyllama',
    engine: 'wllama',
    type: 'chat',
    description: 'Runs on any device via WebAssembly, no WebGPU required',
    modelSize: '1.1B',
    fileSizeMB: 670,
    quantized: true,
    recommended: true,
    contextLength: 2048,
    provider: 'gguf-hf',
    gguf: {
      repo: 'TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF',
      file: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    },
  },
  'Qwen2-0.5B-Instruct-GGUF': {
    id: 'Qwen2-0.5B-Instruct-GGUF',
    name: 'Qwen 2 0.5B Instruct (GGUF)',
    modelPath: 'qwen2-05b-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Same model as the WebGPU variant, but runs everywhere via WASM',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: false,
    contextLength: 2048,
    provider: 'gguf-hf',
    gguf: {
      repo: 'Qwen/Qwen2-0.5B-Instruct-GGUF',
      file: 'qwen2-0_5b-instruct-q4_k_m.gguf',
    },
  },
};

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

export const getEngineType = (modelId: string): EngineType | undefined => {
  return MODEL_CONFIGS[modelId]?.engine;
};

export const getModelConfig = (modelId: string): EngineModelConfig | undefined => {
  return MODEL_CONFIGS[modelId];
};

export const getModelById = (id: string): Model | undefined => {
  return MODELS.find(m => m.id === id);
};

export const getRecommendedModels = (): Model[] => {
  return MODELS.filter(m => m.recommended);
};
