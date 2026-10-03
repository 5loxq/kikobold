import type { Wllama } from '@wllama/wllama';
import { log, warn } from '../logging';

export interface WllamaLoadCallbacks {
  onProgress?: (fraction: number, labelText?: string) => void;
}

export interface WllamaGenerateOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const WASM_PATHS = {
  default: '/wllama/wllama.wasm',
  'single-thread/wllama.wasm': '/wllama/wllama.wasm',
  'multi-thread/wllama.wasm': '/wllama/wllama.wasm',
};

let wllamaInstance: Wllama | null = null;
let loadedModelId: string | null = null;
let activeAbortController: AbortController | null = null;

export const isWllamaModelLoaded = (modelId: string): boolean => {
  return wllamaInstance !== null && loadedModelId === modelId;
};

export const loadWllamaModel = async (
  modelId: string,
  gguf: { repo: string; file: string },
  callbacks?: WllamaLoadCallbacks
): Promise<boolean> => {
  try {
    if (isWllamaModelLoaded(modelId)) {
      log(`wllama: model ${modelId} already loaded`);
      return true;
    }
    if (wllamaInstance) {
      await unloadWllamaModel();
    }

    const { Wllama: WllamaClass } = await import('@wllama/wllama');
    const wllama = new WllamaClass(WASM_PATHS, { allowOffline: true });

    callbacks?.onProgress?.(0, 'Downloading model...');
    await wllama.loadModelFromHF(
      { repo: gguf.repo, file: gguf.file },
      {
        progressCallback: ({ loaded, total }) => {
          const fraction = total > 0 ? loaded / total : 0;
          callbacks?.onProgress?.(fraction, `Downloading model... ${Math.round(fraction * 100)}%`);
        },
        n_threads: Math.min(navigator.hardwareConcurrency || 2, 4),
      }
    );

    wllamaInstance = wllama;
    loadedModelId = modelId;
    callbacks?.onProgress?.(1);
    log(`wllama: model ${modelId} loaded successfully`);
    return true;
  } catch (err) {
    warn(`wllama: failed to load model ${modelId}: ${err}`);
    wllamaInstance = null;
    loadedModelId = null;
    return false;
  }
};

export const unloadWllamaModel = async (): Promise<void> => {
  try {
    await wllamaInstance?.exit();
  } catch (err) {
    warn(`wllama: error during unload: ${err}`);
  }
  wllamaInstance = null;
  loadedModelId = null;
};

export const generateWithWllama = async (
  prompt: string,
  options: WllamaGenerateOptions = {}
): Promise<string> => {
  if (!wllamaInstance) {
    throw new Error('No wllama model loaded');
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  for (const m of options.history ?? []) {
    messages.push({ role: m.role, content: m.content });
  }
  messages.push({ role: 'user', content: prompt });

  activeAbortController = new AbortController();
  try {
    const response = await wllamaInstance.createChatCompletion({
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 512,
      abortSignal: activeAbortController.signal,
    });
    const text = response.choices[0]?.message?.content ?? '';
    return text.trim();
  } finally {
    activeAbortController = null;
  }
};

export const cancelWllamaGeneration = (): void => {
  activeAbortController?.abort();
  activeAbortController = null;
};
