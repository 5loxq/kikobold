import { Model, ModelConfig } from '../../types';

// Engine type: 'webllm' uses WebGPU MLC models, 'wllama' runs GGUF models on WASM/CPU
export type EngineType = 'webllm' | 'wllama';

export interface EngineModelConfig extends ModelConfig {
  engine: EngineType;
  gguf?: { repo: string; file: string; mmprojFile?: string; selfHostedPath?: string };
  multimodal?: boolean;
  badge?: 'recommended' | 'fast' | 'alpha';
  /** Model can produce a visible thinking process (`` blocks) */
  thinking?: boolean;
  /** Path prefix on our own webspace; falls back to HuggingFace if missing/unavailable */
  selfHostedPath?: string;
}

/** Metadata for the image generation model (Alpha feature, own engine). */
export interface ImageGenModelInfo {
  id: string;
  name: string;
  /** HuggingFace repo with the ONNX pipeline (diffusers.js layout) */
  repo: string;
  description: string;
  /** Total download size of all pipeline files (unet, text encoder, VAE) */
  fileSizeMB: number;
  /** Native resolution of the model */
  width: number;
  height: number;
  /** Sensible step range for the LCM scheduler */
  steps: { min: number; max: number; default: number };
  license: string;
}

// Image generation (Alpha): LCM DreamShaper v7 as ONNX, converted by the
// diffusers.js author for his WebGPU demo - the pipeline class
// (LatentConsistencyModelPipeline) and scheduler (LCM) are natively supported
// by the engine. LCM needs only 4-8 steps, which makes generation viable
// in the browser.
export const IMAGE_GEN_MODEL: ImageGenModelInfo = {
  id: 'lcm-dreamshaper-v7-onnx',
  name: 'LCM DreamShaper v7',
  repo: 'aislamov/lcm-dreamshaper-v7-onnx',
  description:
    'Kompaktes Bildmodell (Stable-Diffusion-1.5-Basis mit LCM-Verfahren): erzeugt in 4-8 Schritten ein Bild aus einer Textbeschreibung. Läuft über WebGPU direkt im Browser.',
  fileSizeMB: 2200,
  width: 512,
  height: 512,
  steps: { min: 2, max: 12, default: 4 },
  license: 'CreativeML Open RAIL-M',
};

// Curated selection of 5 models - kept small on purpose so the choice stays
// clear. Every WebGPU model automatically falls back to a WASM model (LFM)
// when the browser has no WebGPU support; the big Gemma is deliberately not
// the fallback (too large for weak devices).
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
  'Qwen3.5-2B-q4f16_1-MLC': {
    id: 'Qwen3.5-2B-q4f16_1-MLC',
    name: 'Qwen 3.5 2B',
    modelPath: 'Qwen3.5-2B-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Das stärkste Modell: längere Texte, bessere Erklärungen und die beste Qualität beim Schreiben. Denkt bei schwierigen Aufgaben sichtbar nach. Braucht Chrome/Edge mit WebGPU.',
    modelSize: '2B',
    fileSizeMB: 1032,
    quantized: true,
    recommended: true,
    contextLength: 262144,
    provider: 'webllm-hf-cdn',
    selfHostedPath: '/models/Qwen3.5-2B-q4f16_1-MLC',
    badge: 'recommended',
    thinking: true,
  },
  'Qwen3-1.7B-q4f16_1-MLC': {
    id: 'Qwen3-1.7B-q4f16_1-MLC',
    name: 'Qwen 3 1.7B',
    modelPath: 'Qwen3-1.7B-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Der Denker: löst Mathe- und Logikaufgaben Schritt für Schritt - der Gedankengang ist aufklappbar. Braucht Chrome/Edge mit WebGPU.',
    modelSize: '1.7B',
    fileSizeMB: 939,
    quantized: true,
    recommended: false,
    contextLength: 40960,
    provider: 'webllm-hf-cdn',
    selfHostedPath: '/models/Qwen3-1.7B-q4f16_1-MLC',
    thinking: true,
  },
  'Qwen3-0.6B-q4f16_1-MLC': {
    id: 'Qwen3-0.6B-q4f16_1-MLC',
    name: 'Qwen 3 0.6B',
    modelPath: 'Qwen3-0.6B-q4f16_1-MLC',
    engine: 'webllm',
    type: 'chat',
    description: 'Für kurze Fragen und schnelle Antworten - ideal zum Ausprobieren, für kleine Aufgaben und ältere Geräte. Braucht Chrome/Edge mit WebGPU.',
    modelSize: '0.6B',
    fileSizeMB: 335,
    quantized: true,
    recommended: false,
    contextLength: 40960,
    provider: 'webllm-hf-cdn',
    selfHostedPath: '/models/Qwen3-0.6B-q4f16_1-MLC',
    badge: 'fast',
    thinking: true,
  },
  'Gemma4-E2B-it-GGUF': {
    id: 'Gemma4-E2B-it-GGUF',
    name: 'Gemma 4 E2B',
    modelPath: 'gemma-4-e2b-it',
    engine: 'wllama',
    type: 'chat',
    description: 'Ensus Mobil-Modell von Google: multimodal (versteht auch Bilder), sehr gute Qualität für seine Größe. Achtung: großer Download (3,3 GB plus ~1 GB Vision-Datei bei Bildnutzung) und läuft auf dem Prozessor - Desktop mit viel RAM empfohlen.',
    modelSize: '2B',
    fileSizeMB: 3190,
    quantized: true,
    recommended: false,
    contextLength: 4096,
    provider: 'gguf-hf',
    multimodal: true,
    gguf: {
      repo: 'google/gemma-4-E2B-it-qat-q4_0-gguf',
      file: 'gemma-4-E2B_q4_0-it.gguf',
      mmprojFile: 'gemma-4-E2B-it-mmproj.gguf',
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

// Find a WASM (GGUF/wllama) model to use when a WebGPU model cannot run.
// With only one WASM model in the registry, every WebGPU model falls back
// to it (LFM 2.5, the recommended model).
export const getWasmFallbackModelId = (webllmModelId: string): string | undefined => {
  const source = MODEL_CONFIGS[webllmModelId];
  if (source?.engine !== 'webllm') {
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

export const getModelById = (id: string): Model | undefined => {
  return MODELS.find(m => m.id === id);
};

export const getRecommendedModels = (): Model[] => {
  return MODELS.filter(m => m.recommended);
};
