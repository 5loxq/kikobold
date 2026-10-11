/**
 * Image generation engine (ALPHA)
 *
 * Wraps @aislamov/diffusers.js, which runs Stable-Diffusion-class models as
 * ONNX via onnxruntime-web with the WebGPU execution provider - everything
 * happens locally in the browser, consistent with the chat engines.
 *
 * The model (see IMAGE_GEN_MODEL in the model registry) is downloaded from
 * HuggingFace on first use and cached in IndexedDB by the engine.
 *
 * The ORT WASM runtime files are served from our own origin (/ort/, copied
 * into public/ by scripts/copy-ort-wasm.mjs) - no CDN dependency.
 */

import { IMAGE_GEN_MODEL } from '../models/model-registry';
import { log, warn } from '../logging';

// Minimal structural types for the engine (the package ships its own types,
// but we import it lazily and keep the surface small here).
interface ProgressPayload {
  status: string;
  downloadStatus?: { file: string; size: number; downloaded: number };
  unetTotalSteps?: number;
  unetTimestep?: number;
}

interface DiffusionPipelineLike {
  run: (input: {
    prompt: string;
    negativePrompt?: string;
    guidanceScale?: number;
    seed?: string;
    width?: number;
    height?: number;
    numInferenceSteps: number;
    progressCallback?: (cb: ProgressPayload) => Promise<void>;
  }) => Promise<Array<{ dims: number[]; data: Float32Array }>>;
  release: () => Promise<void>;
}

export interface ImageGenProgress {
  /** 'downloading' = fetching model files, 'encoding' = text encoder,
   *  'unet' = diffusion steps, 'vae' = decoder, 'done' = finished */
  phase: 'downloading' | 'encoding' | 'unet' | 'vae' | 'done';
  /** 0..100 for downloading, 0..100 across steps for unet */
  progress: number;
  label?: string;
  /** Bytes of the file currently downloading (phase 'downloading') */
  downloadedBytes?: number;
  /** Total size in bytes of the file currently downloading */
  totalBytes?: number;
}

export interface ImageGenOptions {
  negativePrompt?: string;
  steps?: number;
  seed?: number;
  width?: number;
  height?: number;
  onProgress?: (progress: ImageGenProgress) => void;
}

let pipeline: DiffusionPipelineLike | null = null;
let loadPromise: Promise<void> | null = null;

export const isImageGenModelLoaded = (): boolean => pipeline !== null;

const mapProgress = (payload: ProgressPayload, onProgress?: (p: ImageGenProgress) => void): void => {
  if (!onProgress) {
    return;
  }
  switch (payload.status) {
    case 'Downloading': {
      const dl = payload.downloadStatus;
      const progress = dl && dl.size > 0 ? (dl.downloaded / dl.size) * 100 : 0;
      onProgress({
        phase: 'downloading',
        progress,
        label: dl?.file,
        downloadedBytes: dl?.downloaded,
        totalBytes: dl?.size,
      });
      break;
    }
    case 'EncodingPrompt':
      onProgress({ phase: 'encoding', progress: 0 });
      break;
    case 'RunningUnet': {
      const total = payload.unetTotalSteps ?? 1;
      const step = payload.unetTimestep ?? 0;
      onProgress({ phase: 'unet', progress: (step / total) * 100 });
      break;
    }
    case 'RunningVae':
      onProgress({ phase: 'vae', progress: 0 });
      break;
    case 'Done':
      onProgress({ phase: 'done', progress: 100 });
      break;
    default:
      // Ready / Error and anything else: no UI update needed
      break;
  }
};

/**
 * Fail with a descriptive error: the studio shows `err.message` to the
 * user, so a bare "could not be loaded" hides the actual cause (missing
 * engine files, WebGPU limits, interrupted download, ...).
 */
const engineError = (context: string, err: unknown): Error => {
  const detail = err instanceof Error ? err.message : String(err);
  const wrapped = new Error(`${context}: ${detail}`);
  warn(`sd-engine: ${wrapped.message}`);
  return wrapped;
};

/**
 * Workaround for a bug in the minified ort.webgpu.min.js bundle that the
 * package exports for browsers: its inlined emscripten glue calls a bare
 * assert(...) that the minifier never defined (the unminified bundle has
 * it), so backend init dies with "ReferenceError: assert is not defined"
 * right after the model download. The bare identifier resolves through the
 * scope chain to globalThis, so a global fallback fixes it. The emscripten
 * glue in the pthread worker file defines assert itself and is unaffected.
 */
const ensureOrtAssertShim = (): void => {
  const g = globalThis as {
    assert?: (expr: unknown, msg?: string | (() => string)) => void;
  };
  if (typeof g.assert !== 'function') {
    g.assert = (expr, msg): void => {
      if (!expr) {
        throw new Error(typeof msg === 'string' ? msg : msg?.() ?? 'assertion failed');
      }
    };
    log('sd-engine: installed globalThis.assert shim for ORT backend init');
  }
};

/**
 * The ORT fork the engine uses ("web64") is compiled entirely for the
 * WebAssembly memory64 proposal: its glue allocates a shared 16 GiB memory
 * (`index: "i64"`, maximum 262144 pages). Browsers without memory64 reject
 * that with "value 262144 is above the upper bound 65536" - after the whole
 * model download. Probe with the exact same allocation so it fails fast.
 * memory64 is available since Chrome/Edge 133 and Firefox 134; the shared
 * variant additionally requires cross-origin isolation (COOP/COEP).
 */
export type ImageGenRuntimeIssue = 'memory64' | 'isolation';

export const getImageGenRuntimeIssue = (): ImageGenRuntimeIssue | null => {
  try {
    new WebAssembly.Memory({
      initial: 1,
      maximum: 262144,
      index: 'i64',
    } as WebAssembly.MemoryDescriptor & { index: 'i64' });
  } catch {
    return 'memory64';
  }
  try {
    new WebAssembly.Memory({
      initial: 1,
      maximum: 262144,
      shared: true,
      index: 'i64',
    } as WebAssembly.MemoryDescriptor & { index: 'i64' });
  } catch {
    return 'isolation';
  }
  return null;
};

/**
 * Quick checks before the big download, so the most common setup problems
 * fail fast with a clear message instead of deep inside the engine.
 */
const preflight = async (): Promise<void> => {
  const runtimeIssue = getImageGenRuntimeIssue();
  if (runtimeIssue === 'memory64') {
    throw new Error(
      'This browser does not support WebAssembly memory64 (required for the image engine). '
      + 'Please use Chrome or Edge 133 or newer.'
    );
  }
  if (runtimeIssue === 'isolation') {
    throw new Error(
      'This page is not cross-origin isolated, but the image engine requires shared '
      + 'WebAssembly memory (COOP/COEP headers missing).'
    );
  }
  if (!(navigator as Navigator & { gpu?: unknown }).gpu) {
    throw new Error('WebGPU is not available (Chrome or Edge required)');
  }
  // The ORT WASM runtime must be served by our own origin; if the files
  // are missing, every session creation would fail with a fetch error.
  const probe = await fetch('/ort/ort-wasm-simd.jsep.wasm', { method: 'HEAD' });
  if (!probe.ok) {
    throw new Error(`ORT runtime not found on the server (HTTP ${probe.status})`);
  }
};

/**
 * Load the image generation model (downloads on first use, ~2.2 GB).
 * Safe to call repeatedly; parallel calls share one load. Throws with a
 * descriptive message on failure.
 */
export const loadImageGenModel = async (
  onProgress?: (progress: ImageGenProgress) => void
): Promise<void> => {
  if (pipeline) {
    return;
  }
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loadPromise = (async (): Promise<void> => {
    // Bypass the browser HTTP cache for the model files: responses from
    // before the no-gzip server fix may still be cached with a compressed
    // Content-Length, which breaks the engine's buffer allocation (and the
    // engine keeps its own IndexedDB cache anyway, so nothing is lost).
    // Surgical: only /models/sd/ requests, restored right after the load.
    const originalFetch = window.fetch;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input?.url;
      if (url.includes('/models/sd/') && init?.cache === undefined) {
        return originalFetch(input, { ...init, cache: 'no-store' });
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    try {
      ensureOrtAssertShim();
      await preflight();

      const [{ DiffusionPipeline, setModelCacheDir }, ortModule] = await Promise.all([
        import('@aislamov/diffusers.js').catch((err: unknown) => {
          throw engineError('Engine code could not be loaded', err);
        }),
        import('@aislamov/onnxruntime-web64'),
      ]);
      // Serve the ORT WASM runtime from our own origin (see public/ort).
      const ort = (ortModule as unknown as { default?: Record<string, unknown> }).default
        ?? (ortModule as unknown as Record<string, unknown>);
      const env = (ort as { env?: { wasm?: { wasmPaths?: string } } }).env;
      if (env?.wasm) {
        env.wasm.wasmPaths = '/ort/';
      }
      // Prefer the copy on our own webspace (same origin, no CDN dependency).
      // The engine falls back to HuggingFace when a file is missing there.
      setModelCacheDir('/models/sd');

      log(`sd-engine: loading ${IMAGE_GEN_MODEL.repo}`);
      const loaded = (await DiffusionPipeline.fromPretrained(IMAGE_GEN_MODEL.repo, {
        progressCallback: async (cb: ProgressPayload) => {
          mapProgress(cb, onProgress);
        },
      }).catch((err: unknown) => {
        throw engineError('Model could not be loaded', err);
      })) as DiffusionPipelineLike;

      pipeline = loaded;
      log('sd-engine: model loaded');
    } catch (err) {
      pipeline = null;
      throw err;
    } finally {
      window.fetch = originalFetch;
      loadPromise = null;
    }
  })();
  await loadPromise;
};

/** Convert the VAE decoder output tensor (float 0..1) to a PNG data URL. */
const tensorToDataUrl = (image: { dims: number[]; data: Float32Array }): string => {
  // The ONNX VAE decoder output is either NCHW [1, 3, H, W] or NHWC
  // [1, H, W, 3] depending on the export - detect the layout from dims.
  const dims = image.dims;
  const isNchw = dims.length === 4 && dims[1] === 3;
  const height = isNchw ? dims[2] : dims[1];
  const width = isNchw ? dims[3] : dims[2];
  const channels = 3;
  const pixelCount = width * height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }
  const imageData = ctx.createImageData(width, height);
  const out = imageData.data;

  for (let i = 0; i < pixelCount; i++) {
    const r = Math.round(Math.min(1, Math.max(0, image.data[i * channels])) * 255);
    const g = Math.round(Math.min(1, Math.max(0, image.data[i * channels + 1])) * 255);
    const b = Math.round(Math.min(1, Math.max(0, image.data[i * channels + 2])) * 255);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
};

/**
 * Generate an image from a prompt. Returns a PNG data URL.
 * Loads the model first if necessary (with download progress).
 */
export const generateImage = async (prompt: string, options: ImageGenOptions = {}): Promise<string> => {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt must be a non-empty string');
  }
  await loadImageGenModel(options.onProgress);
  if (!pipeline) {
    throw new Error('The image model could not be loaded');
  }

  const steps = Math.max(
    IMAGE_GEN_MODEL.steps.min,
    Math.min(IMAGE_GEN_MODEL.steps.max, options.steps ?? IMAGE_GEN_MODEL.steps.default)
  );
  const seed = options.seed !== undefined ? String(options.seed) : String(Math.floor(Math.random() * 1e9));

  const images = await pipeline.run({
    prompt: prompt.trim(),
    negativePrompt: options.negativePrompt?.trim().length ? options.negativePrompt.trim() : undefined,
    // LCM models are trained without classifier-free guidance at inference
    // time; guidance 1 skips the second (negative) UNet pass and halves work.
    guidanceScale: 1,
    seed,
    width: options.width ?? IMAGE_GEN_MODEL.width,
    height: options.height ?? IMAGE_GEN_MODEL.height,
    numInferenceSteps: steps,
    progressCallback: async (cb: ProgressPayload) => {
      mapProgress(cb, options.onProgress);
    },
  });

  const image = images[0];
  if (!image) {
    throw new Error('The model did not return an image');
  }
  return tensorToDataUrl(image);
};

/** Release the model and its GPU/WASM memory. */
export const unloadImageGenModel = async (): Promise<void> => {
  try {
    await pipeline?.release();
  } catch (err) {
    warn('sd-engine: error during unload:', err);
  }
  pipeline = null;
};
