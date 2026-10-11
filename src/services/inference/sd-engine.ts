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
let loadPromise: Promise<boolean> | null = null;

export const isImageGenModelLoaded = (): boolean => pipeline !== null;

const mapProgress = (payload: ProgressPayload, onProgress?: (p: ImageGenProgress) => void): void => {
  if (!onProgress) {
    return;
  }
  switch (payload.status) {
    case 'Downloading': {
      const dl = payload.downloadStatus;
      const progress = dl && dl.size > 0 ? (dl.downloaded / dl.size) * 100 : 0;
      onProgress({ phase: 'downloading', progress, label: dl?.file });
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
 * Load the image generation model (downloads on first use, ~2.2 GB).
 * Safe to call repeatedly; parallel calls share one load.
 */
export const loadImageGenModel = async (
  onProgress?: (progress: ImageGenProgress) => void
): Promise<boolean> => {
  if (pipeline) {
    return true;
  }
  if (loadPromise) {
    return loadPromise;
  }
  loadPromise = (async (): Promise<boolean> => {
    try {
      // WebGPU is required: the WASM CPU fallback would take minutes per image.
      if (!(navigator as Navigator & { gpu?: unknown }).gpu) {
        throw new Error('WebGPU is not supported in this browser');
      }

      const [{ DiffusionPipeline, setModelCacheDir }, ortModule] = await Promise.all([
        import('@aislamov/diffusers.js'),
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
      })) as DiffusionPipelineLike;

      pipeline = loaded;
      log('sd-engine: model loaded');
      return true;
    } catch (err) {
      warn(`sd-engine: failed to load image model: ${err}`);
      pipeline = null;
      return false;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
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
  const ready = await loadImageGenModel(options.onProgress);
  if (!ready || !pipeline) {
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
