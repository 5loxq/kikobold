import { Model, ModelConfig } from '../../types';

// Engine type: 'webllm' uses WebGPU MLC models, 'wllama' runs GGUF models on WASM/CPU
export type EngineType = 'webllm' | 'wllama';

export interface EngineModelConfig extends ModelConfig {
  engine: EngineType;
  gguf?: { repo: string; file: string; mmprojFile?: string; selfHostedPath?: string };
  multimodal?: boolean;
  badge?: 'recommended' | 'fast';
  /** Path prefix on our own webspace; falls back to HuggingFace if missing/unavailable */
  selfHostedPath?: string;
}

// Curated selection of 3 models - kept small on purpose so the choice stays
// clear. Every WebGPU model automatically falls back to the WASM model (LFM)
// when the browser has no WebGPU support.
export const MODEL_CONFIGS: Record<string, EngineModelConfig> = {
  'LFM2.5-VL-1.6B-GGUF': {
    id: 'LFM2.5-VL-1.6B-GGUF',
    name: 'LFM 2.5 1.6B',
    modelPath: 'lfm2.5-1.6b',
    engine: 'wllama',
    type: 'chat',
    description: 'Allzweckmodell für Alltag, Wissen und Texte - gute Antworten bei Fragen, Zusammenfassungen und Übersetzungen. Läuft in jedem Browser, auch ohne WebGPU.',
    modelSize: '1.6B',
    fileSizeMB: 664,
    quantized: true,
    recommended: true,
    contextLength: 8192,
    provider: 'gguf-hf',
    badge: 'recommended',
    gguf: {
      repo: 'LiquidAI/LFM2.5-VL-1.6B-GGUF',
      selfHostedPath: '/models/LFM2.5-VL-1.6B-Q4_0.gguf',
      file: 'LFM2.5-VL-1.6B-Q4_0.gguf',
    },
  },
  'gemma-2-2b-it-q4f16_1-MLC': {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    name: 'Gemma 2 2B',
    modelPath: 'gemma-2-2b-it-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Für anspruchsvollere Aufgaben: längere Texte, bessere Erklärungen und solidere Qualität beim Schreiben. Braucht Chrome/Edge mit WebGPU.',
    modelSize: '2B',
    fileSizeMB: 1403,
    quantized: true,
    recommended: false,
    contextLength: 4096,
    provider: 'webllm-hf-cdn',
    selfHostedPath: '/models/gemma-2-2b-it-q4f16_1-MLC',
    badge: 'recommended',
  },
  'Qwen2-0.5B-Instruct-q4f16_1-MLC': {
    id: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2 0.5B',
    modelPath: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Für kurze Fragen und schnelle Antworten - ideal zum Ausprobieren, für kleine Aufgaben und ältere Geräte. Braucht Chrome/Edge mit WebGPU.',
    modelSize: '0.5B',
    fileSizeMB: 400,
    quantized: true,
    recommended: false,
    contextLength: 4096,
    provider: 'webllm-hf-cdn',
    selfHostedPath: '/models/Qwen2-0.5B-Instruct-q4f16_1-MLC',
    badge: 'fast',
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

// Find a WASM (GGUF/wllama) model to use when a WebGPU model cannot run.
// With only one WASM model in the registry, every WebGPU model falls back
// to it (LFM 2.5, the recommended model).
export const getWasmFallbackModelId = (webllmModelId: string): string | undefined => {
  const source = MODEL_CONFIGS[webllmModelId];
  if (!source || source.engine !== 'webllm') {
    return undefined;
  }
  const ggufModels = Object.values(MODEL_CONFIGS).filter(
    (c) => c.engine === 'wllama' && !c.multimodal
  );
  const sameFamily = ggufModels.find(
    (c) => c.modelSize === source.modelSize &&
      c.name.toLowerCase().split(' ')[0] === source.name.toLowerCase().split(' ')[0]
  );
  if (sameFamily) {
    return sameFamily.id;
  }
  const recommended = ggufModels.find((c) => c.recommended);
  return recommended?.id;
};


