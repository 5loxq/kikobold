import { Model, ModelConfig } from '../../types';

// Engine type: 'webllm' uses WebGPU MLC models, 'wllama' runs GGUF models on WASM/CPU
export type EngineType = 'webllm' | 'wllama';

export interface EngineModelConfig extends ModelConfig {
  engine: EngineType;
  gguf?: { repo: string; file: string; mmprojFile?: string };
  multimodal?: boolean;
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
  'Llama-3.2-1B-Instruct-GGUF': {
    id: 'Llama-3.2-1B-Instruct-GGUF',
    name: 'Llama 3.2 1B Instruct (GGUF)',
    modelPath: 'llama-3.2-1b-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Modern Meta model with good multilingual skills, runs via WASM',
    modelSize: '1B',
    fileSizeMB: 808,
    quantized: true,
    recommended: true,
    contextLength: 8192,
    provider: 'gguf-hf',
    gguf: {
      repo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
      file: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    },
  },
  'Llama-3.2-3B-Instruct-GGUF': {
    id: 'Llama-3.2-3B-Instruct-GGUF',
    name: 'Llama 3.2 3B Instruct (GGUF)',
    modelPath: 'llama-3.2-3b-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Larger and stronger, but slower on CPU - more RAM required',
    modelSize: '3B',
    fileSizeMB: 2016,
    quantized: true,
    recommended: false,
    contextLength: 8192,
    provider: 'gguf-hf',
    gguf: {
      repo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
      file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    },
  },
  'Phi-3.5-mini-instruct-GGUF': {
    id: 'Phi-3.5-mini-instruct-GGUF',
    name: 'Phi 3.5 Mini Instruct (GGUF)',
    modelPath: 'phi-3.5-mini-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Microsoft model, strong at code and reasoning for its size',
    modelSize: '3.8B',
    fileSizeMB: 2388,
    quantized: true,
    recommended: false,
    contextLength: 4096,
    provider: 'gguf-hf',
    gguf: {
      repo: 'bartowski/Phi-3.5-mini-instruct-GGUF',
      file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    },
  },
  'Qwen2.5-1.5B-Instruct-GGUF': {
    id: 'Qwen2.5-1.5B-Instruct-GGUF',
    name: 'Qwen 2.5 1.5B Instruct (GGUF)',
    modelPath: 'qwen2.5-1.5b-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Balanced quality and speed, good multilingual support',
    modelSize: '1.5B',
    fileSizeMB: 1110,
    quantized: true,
    recommended: true,
    contextLength: 8192,
    provider: 'gguf-hf',
    gguf: {
      repo: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
      file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    },
  },
  'SmolVLM-500M-Instruct-GGUF': {
    id: 'SmolVLM-500M-Instruct-GGUF',
    name: 'SmolVLM 500M Instruct (GGUF, Vision)',
    modelPath: 'smolvlm-500m-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Smallest multimodal model - understands images, very low RAM usage',
    modelSize: '0.5B',
    fileSizeMB: 410,
    quantized: true,
    recommended: true,
    contextLength: 8192,
    provider: 'gguf-hf',
    multimodal: true,
    gguf: {
      repo: 'ggml-org/SmolVLM-500M-Instruct-GGUF',
      file: 'SmolVLM-500M-Instruct-Q8_0.gguf',
      mmprojFile: 'mmproj-SmolVLM-500M-Instruct-Q8_0.gguf',
    },
  },
  'Qwen2-VL-2B-Instruct-GGUF': {
    id: 'Qwen2-VL-2B-Instruct-GGUF',
    name: 'Qwen2 VL 2B Instruct (GGUF, Vision)',
    modelPath: 'qwen2-vl-2b-instruct',
    engine: 'wllama',
    type: 'chat',
    description: 'Multimodal: understands images (with mmproj projector) and text',
    modelSize: '2B',
    fileSizeMB: 1650,
    quantized: true,
    recommended: false,
    contextLength: 8192,
    provider: 'gguf-hf',
    multimodal: true,
    gguf: {
      repo: 'ggml-org/Qwen2-VL-2B-Instruct-GGUF',
      file: 'Qwen2-VL-2B-Instruct-Q4_K_M.gguf',
      mmprojFile: 'mmproj-Qwen2-VL-2B-Instruct-Q8_0.gguf',
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

export const isMultimodalModel = (modelId: string): boolean => {
  return MODEL_CONFIGS[modelId]?.multimodal === true;
};

export const getModelById = (id: string): Model | undefined => {
  return MODELS.find(m => m.id === id);
};

export const getRecommendedModels = (): Model[] => {
  return MODELS.filter(m => m.recommended);
};
