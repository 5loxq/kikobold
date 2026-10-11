import type {
  ChatCompletionMessage,
  ChatCompletionMessageContent,
  Wllama,
} from '@wllama/wllama';
import { log, warn } from '../logging';
import { isMobileLike } from '../../utils/device';

export interface WllamaLoadCallbacks {
  /** fraction: 0..1; stats: download size/speed while available */
  onProgress?: (fraction: number, labelText?: string, stats?: DownloadStats) => void;
}

/** Download size and speed info shown in the UI while a model loads */
export interface DownloadStats {
  loadedMB: number;
  totalMB: number;
  speedMBps: number;
}

export interface WllamaImageAttachment {
  name: string;
  data: ArrayBuffer;
}

export interface WllamaGenerateOptions {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  systemPrompt?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  images?: WllamaImageAttachment[];
}

// Only a single wllama.wasm build is deployed. It is multi-thread capable and
// also runs on the single-thread path, so both wllama keys map to that file.
const WASM_PATHS = {
  default: '/wllama/wllama.wasm',
  'single-thread/wllama.wasm': '/wllama/wllama.wasm',
  'multi-thread/wllama.wasm': '/wllama/wllama.wasm',
};

let wllamaInstance: Wllama | null = null;
let loadedModelId: string | null = null;
let activeAbortController: AbortController | null = null;
// Guard against parallel loads: a second call while a load is running would
// unload the instance the first call is still initializing.
let loadPromise: Promise<boolean> | null = null;
// Which model the in-flight load belongs to (see loadWllamaModel).
let loadingModelId: string | null = null;

export const isWllamaModelLoaded = (modelId: string): boolean => {
  return wllamaInstance !== null && loadedModelId === modelId;
};

export const wllamaIsActive = (): boolean => {
  return wllamaInstance !== null;
};

/**
 * JSPI (JavaScript Promise Integration) makes WASM inference dramatically
 * faster. Chrome/Edge support it; Firefox does not and falls back to the
 * much slower Asyncify, which is why generation feels sluggish there.
 */
export const supportsWllamaJspi = (): boolean => {
  return !!(WebAssembly as unknown as { Suspending?: unknown }).Suspending;
};

const isAbortError = (err: unknown): boolean => {
  return err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
};

export const supportsWllamaImageInput = (): boolean => {
  if (!wllamaInstance) {
    return false;
  }
  try {
    return wllamaInstance.supportInputModality('image');
  } catch (err) {
    warn(`wllama: supportInputModality check failed: ${err}`);
    return false;
  }
};

const buildMessages = (
  prompt: string,
  options: WllamaGenerateOptions
): ChatCompletionMessage[] => {
  const messages: ChatCompletionMessage[] = [];
  if (options.systemPrompt && options.systemPrompt.trim().length > 0) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  for (const m of options.history ?? []) {
    messages.push({ role: m.role, content: m.content });
  }
  if (options.images && options.images.length > 0) {
    const content: ChatCompletionMessageContent[] = options.images.map((img) => ({
      type: 'image' as const,
      data: img.data,
    }));
    content.push({ type: 'text' as const, text: prompt });
    messages.push({ role: 'user', content });
  } else {
    messages.push({ role: 'user', content: prompt });
  }
  return messages;
};

export const loadWllamaModel = async (
  modelId: string,
  gguf: { repo: string; file: string; mmprojFile?: string; selfHostedPath?: string },
  callbacks?: WllamaLoadCallbacks
): Promise<boolean> => {
  if (isWllamaModelLoaded(modelId)) {
    log(`wllama: model ${modelId} already loaded`);
    return true;
  }
  if (loadPromise) {
    // Another load is already in flight - do not start a second one (it
    // would unload the instance the first load is initializing into).
    // If it is a DIFFERENT model, its result must not be reported as the
    // requested one: wait for it, then load the requested model after it.
    if (loadingModelId === modelId) {
      log('wllama: same load already in progress, waiting for it');
      return loadPromise;
    }
    log(`wllama: other model ${String(loadingModelId)} is loading - waiting, then loading ${modelId}`);
    await loadPromise.catch((): boolean => false);
    if (isWllamaModelLoaded(modelId)) {
      return true;
    }
  }
  loadingModelId = modelId;
  loadPromise = (async (): Promise<boolean> => {    // Declared outside the try so the catch block can free the WASM workers
    // and partially downloaded chunks of a failed load.
    let wllama: Wllama | null = null;
    try {
      if (wllamaInstance) {
        await unloadWllamaModel();
      }

      const { Wllama: WllamaClass } = await import('@wllama/wllama');
      wllama = new WllamaClass(WASM_PATHS, { allowOffline: true });

    // If the model file is already in the browser cache, there is no download
    // phase: wllama goes straight to initializing the model in memory. Report
    // full progress upfront so the UI shows "loading" instead of a misleading
    // "downloading 100%".
    try {
      const { CacheManager } = await import('@wllama/wllama');
      const cacheManager = new CacheManager();
      const entries = await cacheManager.list();
      const isCached = entries.some((entry) => entry.name.endsWith(`_${gguf.file}`));
      if (isCached) {
        callbacks?.onProgress?.(1, 'Loading model from browser cache...');
      } else {
        callbacks?.onProgress?.(0, 'Downloading model...');
      }
    } catch {
      callbacks?.onProgress?.(0, 'Downloading model...');
    }

    const downloadStartedAt = Date.now();
    // Mobile devices have a hard per-tab memory limit (iOS Safari kills the
    // tab around 1-1.5 GB). The KV cache for the context is a big chunk of
    // the WASM heap on top of the model weights, so phones get a smaller
    // context than desktops.
    const loadParams = {
      progressCallback: ({ loaded, total }: { loaded: number; total: number }): void => {
        const fraction = total > 0 ? loaded / total : 0;
        const elapsedSec = (Date.now() - downloadStartedAt) / 1000;
        const stats = total > 0
          ? {
              loadedMB: loaded / (1024 * 1024),
              totalMB: total / (1024 * 1024),
              speedMBps: elapsedSec > 0 ? loaded / (1024 * 1024) / elapsedSec : 0,
            }
          : undefined;
        callbacks?.onProgress?.(
          fraction,
          `Downloading model... ${Math.round(fraction * 100)}%`,
          stats
        );
      },
      n_threads: Math.min(navigator.hardwareConcurrency || 2, 4),
      // wllama defaults to a tiny 1024-token context, which regular prompts
      // (system prompt + memory + history + attachments) quickly exceed.
      n_ctx: isMobileLike() ? 2048 : 4096,
    };

    // Prefer the copy on our own webspace (same origin, no CDN dependency).
    // Fall back to HuggingFace if the self-hosted file is unavailable. A
    // failed download can also surface as a resolved promise with no model
    // loaded (e.g. when a server answers with an HTML error page), so the
    // load result is verified explicitly.
    if (gguf.selfHostedPath) {
      const selfHostedUrl = new URL(gguf.selfHostedPath, window.location.origin).href;
      try {
        await wllama.loadModelFromUrl(selfHostedUrl, loadParams);
        if (!wllama.isModelLoaded()) {
          throw new Error('self-hosted file did not contain a loadable model');
        }
      } catch (selfHostedError) {
        warn(`wllama: self-hosted model failed (${selfHostedError}), falling back to HuggingFace`);
        callbacks?.onProgress?.(0, 'Downloading model (HuggingFace)...');
        await wllama.loadModelFromHF(
          { repo: gguf.repo, file: gguf.file, mmprojFile: gguf.mmprojFile },
          loadParams
        );
      }
    } else {
      await wllama.loadModelFromHF(
        { repo: gguf.repo, file: gguf.file, mmprojFile: gguf.mmprojFile },
        loadParams
      );
    }
    if (!wllama.isModelLoaded()) {
      throw new Error('Model file could not be loaded');
    }

    wllamaInstance = wllama;
    loadedModelId = modelId;
    if (gguf.mmprojFile && supportsWllamaImageInput()) {
      log(`wllama: model ${modelId} loaded with image input support`);
    } else {
      log(`wllama: model ${modelId} loaded successfully`);
    }
    callbacks?.onProgress?.(1);
    return true;
  } catch (err) {
    warn(`wllama: failed to load model ${modelId}: ${err}`);
    // Free the WASM workers and cached chunks of the failed load, otherwise
    // every failed attempt (e.g. self-hosted -> HuggingFace fallback) leaks.
    try {
      await wllama?.exit();
    } catch {
      // Ignore secondary errors during cleanup
    }
    wllamaInstance = null;
    loadedModelId = null;
    return false;
  } finally {
    loadPromise = null;
    loadingModelId = null;
  }
  })();
  return loadPromise;
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
  if (options.images && options.images.length > 0 && !supportsWllamaImageInput()) {
    throw new Error('The loaded model does not support image input');
  }

  const messages = buildMessages(prompt, options);

  activeAbortController = new AbortController();
  try {
    const response = await wllamaInstance.createChatCompletion({
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
      max_tokens: options.max_tokens ?? 512,
      abortSignal: activeAbortController.signal,
    });
    const text = response.choices[0]?.message?.content ?? '';
    return text.trim();
  } catch (err) {
    if (isAbortError(err)) {
      return '';
    }
    throw err;
  } finally {
    activeAbortController = null;
  }
};

export const generateWithWllamaStream = async (
  prompt: string,
  options: WllamaGenerateOptions = {},
  onChunk?: (delta: string) => void
): Promise<string> => {
  if (!wllamaInstance) {
    throw new Error('No wllama model loaded');
  }
  if (options.images && options.images.length > 0 && !supportsWllamaImageInput()) {
    throw new Error('The loaded model does not support image input');
  }

  const messages = buildMessages(prompt, options);

  activeAbortController = new AbortController();
  let fullText = '';
  try {
    await wllamaInstance.createChatCompletion({
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      ...(options.top_p !== undefined ? { top_p: options.top_p } : {}),
      max_tokens: options.max_tokens ?? 512,
      abortSignal: activeAbortController.signal,
      onData: (chunk) => {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        if (delta) {
          fullText += delta;
          onChunk?.(delta);
        }
      },
    });
    return fullText;
  } catch (err) {
    if (isAbortError(err)) {
      return fullText;
    }
    throw err;
  } finally {
    activeAbortController = null;
  }
};

export const cancelWllamaGeneration = (): void => {
  activeAbortController?.abort();
  activeAbortController = null;
};
