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

import { version as appVersion } from '../../../package.json';
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
  // Include the top stack frames: the studio shows only err.message, and
  // for errors deep inside the engine/wasm glue the message alone ("offset
  // is out of bounds") does not name the failing code path.
  const frames = err instanceof Error && err.stack
    ? err.stack.split('\n').slice(1, 5).map((line) => line.trim().replace(/^at /, '')).filter(Boolean)
    : [];
  const wrapped = new Error(
    `${context}: ${detail}${frames.length > 0 ? ` @ ${frames.join(' <- ')}` : ''}`
  );
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
 * The ORT fork the engine uses ("web64") is compiled for the WebAssembly
 * memory64 proposal and allocates a shared 16 GiB memory. Its emscripten
 * glue however predates the final JS API: it passes the draft property
 * `index: "i64"` with plain number limits. The final API (Wasm 3.0, shipped
 * in Chrome 133+) uses `address: "i64"` with BigInt limits - Chrome ignores
 * the unknown `index` property and rejects the descriptor with
 * "value 262144 is above the upper bound 65536". The shim below translates
 * draft descriptors into the final API and patches `grow` to accept plain
 * numbers (the final API requires BigInt there as well).
 */
interface MemoryDescriptorLike {
  initial?: number | bigint;
  maximum?: number | bigint;
  shared?: boolean;
  address?: 'i64';
  index?: 'i64';
}

/**
 * Diagnostics for the translated memories: records creations and grow
 * operations (with the resulting buffer sizes). Appended to load errors so
 * a failure like "offset is out of bounds" in createSessionAllocate shows
 * whether the wasm heap actually grew.
 */
const memoryLog: string[] = [];
const recordMemory = (entry: string): void => {
  memoryLog.push(entry);
  if (memoryLog.length > 12) {
    memoryLog.shift();
  }
};

const ensureOrtMemory64Shim = (): void => {
  const nativeMemory = WebAssembly.Memory as unknown as
    ((new (descriptor?: MemoryDescriptorLike) => WebAssembly.Memory
      & { grow: (delta: number | bigint) => number })
      & { prototype: WebAssembly.Memory }
      & Record<string, unknown>);
  if (nativeMemory['__webguiMemory64Shim']) {
    return;
  }

  const patched = function (descriptor?: MemoryDescriptorLike): WebAssembly.Memory {
    const desc = descriptor ?? {};
    if (desc.index !== 'i64') {
      return Reflect.construct(nativeMemory as unknown as typeof WebAssembly.Memory, [desc]);
    }
    const translated: MemoryDescriptorLike = { address: 'i64' };
    translated.initial = typeof desc.initial === 'bigint' ? desc.initial : BigInt(desc.initial ?? 0);
    if (desc.maximum !== undefined) {
      translated.maximum = typeof desc.maximum === 'bigint' ? desc.maximum : BigInt(desc.maximum);
    }
    if (desc.shared !== undefined) {
      translated.shared = desc.shared;
    }
    const memory = Reflect.construct(nativeMemory as unknown as typeof WebAssembly.Memory, [translated]);
    recordMemory(
      `created memory64: initial ${translated.initial} pages `
      + `(${memory.buffer.byteLength} bytes), max ${translated.maximum ?? 'unbounded'}, `
      + `shared=${translated.shared === true}`
    );
    try {
      const nativeGrow = memory.grow.bind(memory);
      memory.grow = (delta: number | bigint): number => {
        const pages = typeof delta === 'bigint' ? delta : BigInt(Math.trunc(delta));
        try {
          const result = nativeGrow(pages);
          recordMemory(`grow(${pages} pages) ok -> buffer ${memory.buffer.byteLength} bytes`);
          return Number(result);
        } catch (err) {
          recordMemory(
            `grow(${pages} pages) FAILED: ${err instanceof Error ? err.message : String(err)}`
          );
          throw err;
        }
      };
    } catch {
      // Best effort: the glue only grows on the main thread; if assigning
      // the own property fails, growth with plain numbers may throw later.
      recordMemory('could not patch grow() on the created memory');
    }
    return memory;
  } as unknown as typeof WebAssembly.Memory;
  Object.setPrototypeOf(patched, nativeMemory);
  patched.prototype = nativeMemory.prototype;
  (patched as unknown as Record<string, unknown>)['__webguiMemory64Shim'] = true;
  WebAssembly.Memory = patched;
  log('sd-engine: installed WebAssembly.Memory memory64 translation shim');
};

/**
 * The glue also uses the OLD JSPI draft API: `new WebAssembly.Function(type,
 * fn, {suspending:"first"})` for async imports and `{promising:"first"}` for
 * async exports. Chrome never shipped `WebAssembly.Function` (JS type
 * reflection); it ships the final JSPI API instead (Chrome 137+):
 * `new WebAssembly.Suspending(fn)` and `WebAssembly.promising(fn)`. The shim
 * translates the draft constructor to the final API. `WebAssembly.Function
 * .type()` (used to re-type an export) is faked - the translated constructor
 * ignores the type descriptor anyway.
 */
const ensureOrtJspiShim = (): void => {
  const wa = WebAssembly as unknown as {
    Function?: unknown;
    Suspending?: new (fn: unknown) => unknown;
    promising?: (fn: unknown) => unknown;
  };
  if (typeof wa.Function === 'function') {
    return;
  }
  if (typeof wa.Suspending !== 'function' || typeof wa.promising !== 'function') {
    return;
  }
  const shimmed = function (
    _type: unknown,
    fn: unknown,
    options?: { suspending?: string; promising?: string }
  ): unknown {
    if (options?.promising === 'first') {
      return wa.promising?.(fn);
    }
    if (options?.suspending === 'first') {
      const suspending = wa.Suspending;
      if (suspending) {
        return new suspending(fn);
      }
    }
    throw new Error('unsupported WebAssembly.Function options (JSPI shim)');
  } as unknown as Record<string, unknown>;
  shimmed['type'] = (): { parameters: string[]; results: string[] } =>
    ({ parameters: ['externref'], results: [] });
  wa.Function = shimmed;
  log('sd-engine: installed WebAssembly.Function JSPI translation shim');
};

/**
 * Probe the browser with the final memory64 JS API (the same allocation the
 * shim performs for the engine): memory64 at all, the 16 GiB maximum the
 * engine's glue requests, and the shared variant (needs cross-origin
 * isolation). Returns the missing capability or null if the engine can run.
 */
export type ImageGenRuntimeIssue = 'memory64' | 'memory-limit' | 'isolation';

const canCreateMemory = (descriptor: MemoryDescriptorLike): boolean => {
  try {
    new WebAssembly.Memory(descriptor as unknown as WebAssembly.MemoryDescriptor);
    return true;
  } catch {
    return false;
  }
};

export const getImageGenRuntimeIssue = (): ImageGenRuntimeIssue | null => {
  if (!canCreateMemory({ initial: 1n, maximum: 2n, address: 'i64' })) {
    return 'memory64';
  }
  if (!canCreateMemory({ initial: 1n, maximum: 262144n, address: 'i64' })) {
    return 'memory-limit';
  }
  if (!canCreateMemory({ initial: 1n, maximum: 262144n, shared: true, address: 'i64' })) {
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
  if (runtimeIssue === 'memory-limit') {
    throw new Error(
      'This browser supports memory64 but rejects the 16 GiB memory reservation '
      + 'the image engine needs.'
    );
  }
  if (runtimeIssue === 'isolation') {
    throw new Error(
      'This page is not cross-origin isolated, but the image engine requires shared '
      + 'WebAssembly memory (COOP/COEP headers missing).'
    );
  }
  // The engine's glue needs JSPI for its async kernels: either the old draft
  // constructor (WebAssembly.Function, never shipped in Chrome) or the final
  // API our shim translates it into (WebAssembly.Suspending/promising).
  const waJspi = WebAssembly as unknown as {
    Function?: unknown;
    Suspending?: unknown;
    promising?: unknown;
  };
  const hasJspi = typeof waJspi.Suspending === 'function'
    && typeof waJspi.promising === 'function';
  if (typeof waJspi.Function !== 'function' && !hasJspi) {
    throw new Error(
      'This browser does not support the JSPI API the image engine needs '
      + '(WebAssembly.Suspending/promising). Please use Chrome or Edge 137 or newer.'
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
 * Safety net for the ORT runtime files: the emscripten glue inlined in the
 * bundle has its own hardcoded `locateFile` (scriptDirectory + plain file
 * name) and ignores the ORT factory's path mapping - so it fetches e.g.
 * "ort-wasm-simd.wasm" RELATIVE to the page. The server's SPA fallback
 * answers that with the index page (HTML, status 200) and WebAssembly
 * dies with "expected magic word". Worse, the plain name is the NON-JSEP
 * build while the WebGPU glue needs the JSEP variant (driving the wrong
 * binary ends in "offset is out of bounds"). Rewrite same-origin
 * ort-wasm-* requests to the matching JSEP file in /ort/, mirroring the
 * mapping the ORT factory intended.
 */
const ORT_JSEP_REWRITE: Record<string, string> = {
  'ort-wasm-simd.wasm': 'ort-wasm-simd.jsep.wasm',
  'ort-wasm-simd-threaded.wasm': 'ort-wasm-simd-threaded.jsep.wasm',
};

const ensureOrtFetchRewrite = (): void => {
  const patched = window.fetch as typeof window.fetch & { __webguiOrtRewrite?: boolean };
  if (patched.__webguiOrtRewrite) {
    return;
  }
  const originalFetch = window.fetch;
  const rewritten = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input?.url ?? '';
    const match = /^((?:https?:\/\/[^/]+)?\/?)(ort-wasm-[a-z0-9.-]+\.(?:wasm|js))$/
      .exec(url.split('?')[0]);
    const sameOrigin = !/^https?:\/\//.test(url) || url.startsWith(self.location.origin);
    if (match && sameOrigin && !url.includes('/ort/')) {
      const file = match[2];
      const target = ORT_JSEP_REWRITE[file] ?? file;
      log(`sd-engine: rewrote relative ORT fetch ${file} to /ort/${target}`);
      return originalFetch(`/ort/${target}`, init);
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
  (rewritten as typeof window.fetch & { __webguiOrtRewrite?: boolean }).__webguiOrtRewrite = true;
  window.fetch = rewritten;
  log('sd-engine: installed ort-wasm fetch rewrite');
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
    // Diagnostics: record the requests made during the load so load errors
    // can name the exact URL that failed (status + content type) instead
    // of a downstream symptom like a WASM magic-word mismatch.
    const requestLog: string[] = [];
    const record = (entry: string): void => {
      requestLog.push(entry);
      if (requestLog.length > 8) {
        requestLog.shift();
      }
    };

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
      // Single fetch per call: bypass the browser HTTP cache for the model
      // files (stale gzip-era responses break the engine's buffer
      // allocation; the engine keeps its own IndexedDB cache anyway).
      const effectiveInit = url.includes('/models/sd/') && init?.cache === undefined
        ? { ...init, cache: 'no-store' as RequestCache }
        : init;
      return originalFetch(input, effectiveInit).then(
        (response) => {
          record(`${url} -> ${response.status} ${response.headers.get('content-type') ?? '?'}`);
          return response;
        },
        (err: unknown) => {
          record(`${url} -> FAILED ${err instanceof Error ? err.message : String(err)}`);
          throw err;
        }
      );
    }) as typeof window.fetch;

    try {
      ensureOrtAssertShim();
      ensureOrtMemory64Shim();
      ensureOrtJspiShim();
      ensureOrtFetchRewrite();
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
      const env = (ort as {
        env?: { wasm?: { wasmPaths?: string; numThreads?: number } };
      }).env;
      if (env?.wasm) {
        env.wasm.wasmPaths = '/ort/';
        // Run the WASM side single-threaded: the pthread worker is spawned
        // from a blob built inside the ORT bundle and executes the glue in
        // its own scope - without our assert/JSPI shims, which cannot be
        // injected there. With numThreads=1 the glue runs entirely on the
        // main thread where the shims are installed; WebGPU does the heavy
        // math anyway, so the CPU parallelism loss is negligible.
        env.wasm.numThreads = 1;
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
      const detail = err instanceof Error ? err.message : String(err);
      // Include the recorded requests and memory operations so the visible
      // error names the failing URL and the heap state instead of a
      // downstream symptom.
      const parts: string[] = [`v${appVersion}`];
      if (requestLog.length > 0) {
        parts.push(`requests: ${requestLog.join(' | ')}`);
      }
      if (memoryLog.length > 0) {
        parts.push(`memory: ${memoryLog.join(' | ')}`);
      }
      const withDiagnostics = parts.length > 0
        ? new Error(`${detail} [${parts.join('] [')}]`)
        : err;
      warn(`sd-engine: load failed: ${detail}`);
      throw withDiagnostics;
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
