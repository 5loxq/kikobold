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
 * memory64 proposal. Its emscripten glue however predates the final JS
 * API: it passes the draft property `index: "i64"` with plain number
 * limits. The final API (Wasm 3.0, shipped in Chrome 133+) uses
 * `address: "i64"` with BigInt limits - Chrome ignores the unknown
 * `index` property and rejects the descriptor with "value 262144 is above
 * the upper bound 65536". The shim below translates draft descriptors
 * into the final API.
 *
 * Note: on the single-threaded path the wasm defines its 16 GiB heap
 * INTERNALLY (no JS constructor call - see ensureOrtMemoryGrowShim); the
 * constructor translation matters for the memories the glue DOES create
 * in JS, e.g. the dedicated weights memory in fetchModelAndWeights
 * (initial = maximum = Content-Length pages, shared) that the 1.6 GB
 * unet weights are streamed into.
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
// The patched WebAssembly.Memory constructor (set by the shim below); used
// for the "still patched?" check right before the model load.
let patchedMemoryCtor: unknown = null;
const recordMemory = (entry: string): void => {
  memoryLog.push(entry);
  if (memoryLog.length > 20) {
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
    // Record at entry, before any branch: if the construct below throws,
    // the call itself must still be visible in the diagnostics.
    recordMemory(
      `Memory ctor called: index=${String(desc.index)}, initial=${String(desc.initial)}, `
      + `maximum=${String(desc.maximum)}, shared=${String(desc.shared)}`
    );
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
    let memory: WebAssembly.Memory;
    try {
      memory = Reflect.construct(nativeMemory as unknown as typeof WebAssembly.Memory, [translated]);
    } catch (err) {
      recordMemory(
        `translated memory creation FAILED: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
    recordMemory(
      `created memory64: initial ${translated.initial} pages `
      + `(${memory.buffer.byteLength} bytes), max ${translated.maximum ?? 'unbounded'}, `
      + `shared=${translated.shared === true}`
    );
    // Growth is handled globally by the WebAssembly.Memory.prototype.grow
    // shim (see ensureOrtMemoryGrowShim) - which also covers memories the
    // glue does not create through this constructor (e.g. the wasm-internal
    // heap of the non-threaded build).
    return memory;
  } as unknown as typeof WebAssembly.Memory;
  Object.setPrototypeOf(patched, nativeMemory);
  patched.prototype = nativeMemory.prototype;
  (patched as unknown as Record<string, unknown>)['__webguiMemory64Shim'] = true;
  patchedMemoryCtor = patched;
  // Accessor instead of a plain assignment: records every read of the
  // property (so we see whether the glue even looks at the global) and
  // every attempt to overwrite it. The getter returns our patched
  // constructor, so behavior is unchanged - only observable.
  let slot: unknown = patched;
  Object.defineProperty(WebAssembly, 'Memory', {
    get(): unknown {
      recordMemory('WebAssembly.Memory read');
      return slot;
    },
    set(value: unknown): void {
      recordMemory(`WebAssembly.Memory REASSIGNED (type ${typeof value})`);
      slot = value;
    },
    configurable: true,
    enumerable: false,
  });
  recordMemory('memory64 translation shim installed (accessor)');
  log('sd-engine: installed WebAssembly.Memory memory64 translation shim');
};

/**
 * THE fix for "offset is out of bounds" in createSessionAllocate.
 *
 * Deep analysis of the fork's bundle + wasm (verified with a direct Node
 * repro against the real ort-wasm-simd.jsep.wasm, see scripts/sd-repro):
 * the non-threaded wasm defines its memory INTERNALLY (memory64, 16 MiB
 * initial, 16 GiB max - no JS constructor involved, which is why the
 * constructor shim above never fired). The emscripten glue grows that
 * heap with a plain Number page count:
 *
 *   const pages = (target - memory.buffer.byteLength + 65535) / 65536;
 *   try { memory.grow(pages) } catch {}            // Number!
 *
 * The final memory64 JS API (Chrome 133+) requires a BigInt delta, so
 * every grow throws "TypeError: Cannot convert ... to a BigInt". The glue
 * swallows the exception, emscripten_resize_heap reports failure, _malloc
 * returns 0 - and createSessionAllocate does HEAPU8.set(model, 0), which
 * surfaces as "RangeError: offset is out of bounds @ Uint8Array.set".
 * The fork was written against the draft API; on current Chrome the heap
 * can never grow, so every session with a model larger than the 16 MiB
 * initial heap dies (already the 246 MB text encoder).
 *
 * The patch translates Number <-> BigInt when the native grow rejects the
 * argument type. i32 memories (the chat models' standard ORT) keep their
 * native behavior: the first, untranslated call succeeds, so the
 * translation never kicks in. Every translated grow is recorded in the
 * memory log, so future error reports show the heap actually growing.
 */
const ensureOrtMemoryGrowShim = (): void => {
  const proto = WebAssembly.Memory.prototype as unknown as {
    grow: ((delta: number) => number) & { __webguiGrowShim?: boolean };
  };
  if (proto.grow.__webguiGrowShim) {
    return;
  }
  const nativeGrow = proto.grow;
  const patched = function (this: WebAssembly.Memory, delta: number): number {
    try {
      return nativeGrow.call(this, delta);
    } catch (err) {
      if (!(err instanceof TypeError)) {
        throw err;
      }
      // memory64 memories take BigInt deltas, i32 memories take Numbers -
      // retry with the other type (the failed call changed no state).
      const translated = typeof delta === 'number' ? BigInt(Math.trunc(delta)) : Number(delta);
      const before = this.buffer.byteLength;
      const result = nativeGrow.call(this, translated as unknown as number);
      recordMemory(
        `grow(${String(delta)} -> ${String(translated)} pages) ok: `
        + `heap ${before} -> ${this.buffer.byteLength} bytes`
      );
      return result;
    }
  } as unknown as typeof proto.grow;
  (patched as unknown as Record<string, unknown>)['__webguiGrowShim'] = true;
  proto.grow = patched;
  recordMemory('memory.grow prototype shim installed');
  log('sd-engine: installed WebAssembly.Memory.grow Number/BigInt translation shim');
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
 *
 * Suspending translation detail (verified in a headless-Chrome repro with
 * real WebGPU): the draft wrapper calls fn with only the import's
 * parameters, while the final Suspending() wrapper passes the promise
 * (the import's leading externref) as an EXTRA FIRST argument - the
 * translation drops it, otherwise every parameter shifts by one and the
 * fork's GPU readback computes with NaN.
 *
 * Promising translation detail (verified against the fork's wasm binary):
 * the draft-built async exports carry a LEADING externref parameter - the
 * draft promise handle; OrtRun is (externref, i64 x 8) -> i32. The draft
 * wrapper for {promising:"first"} strips that leading parameter from its
 * signature (the glue's makeAsyncFunction does `parameters.shift()`), so
 * JS callers pass only the 8 real arguments. The final promising() wrapper
 * keeps the export's full signature, so the translation re-injects a
 * placeholder for the leading externref - without it, the wrapper converts
 * the (absent) 9th argument and fails with "Cannot convert undefined to a
 * BigInt" on the first OrtRun call.
 */
const ensureOrtJspiShim = (): void => {
  const wa = WebAssembly as unknown as {
    Function?: ((...args: unknown[]) => unknown) & { type?: unknown };
    Suspending?: new (fn: unknown) => unknown;
    promising?: (fn: unknown) => unknown;
  };
  // Skip only if a compatible API is already present: the shim must also
  // replace a NATIVE WebAssembly.Function (JS type reflection) - the native
  // constructor has no third {suspending} argument and no static .type(),
  // both of which the fork's glue requires.
  if (typeof wa.Function === 'function' && typeof wa.Function.type === 'function') {
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
      const wrapped = wa.promising?.(fn) as unknown as
        ((...args: unknown[]) => Promise<unknown>) | undefined;
      if (!wrapped) {
        throw new Error('WebAssembly.promising unavailable (JSPI shim)');
      }
      return function (this: unknown, ...args: unknown[]): unknown {
        return wrapped.call(this, undefined, ...args);
      };
    }
    if (options?.suspending === 'first') {
      const suspending = wa.Suspending;
      if (suspending) {
        // The draft wrapper called fn with ONLY the import's parameters; the
        // final Suspending() wrapper passes the promise (the import's
        // leading externref) as an EXTRA FIRST argument. Verified in a
        // headless-Chrome repro: without dropping it, the fork's
        // __asyncjs__jsepDownload handler receives the promise in its first
        // parameter slot, converts it with Number() to NaN and every GPU
        // buffer readback fails with "data does not exist" (which aborts
        // the wasm with an "unreachable" trap).
        const dropPromise = (...args: unknown[]): unknown =>
          (fn as (...a: unknown[]) => unknown)(...args.slice(1));
        return new suspending(dropPromise);
      }
    }
    throw new Error('unsupported WebAssembly.Function options (JSPI shim)');
  } as unknown as NonNullable<typeof wa.Function>;
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

// Cached: the browser's capabilities do not change during a session, and the
// probe allocates real memories (including a shared 16 GiB reservation) -
// calling it on every component render would flood the memory diagnostics
// log and allocate hundreds of memories.
let cachedRuntimeIssue: ImageGenRuntimeIssue | null | undefined;

export const getImageGenRuntimeIssue = (): ImageGenRuntimeIssue | null => {
  if (cachedRuntimeIssue === undefined) {
    if (!canCreateMemory({ initial: 1n, maximum: 2n, address: 'i64' })) {
      cachedRuntimeIssue = 'memory64';
    } else if (!canCreateMemory({ initial: 1n, maximum: 262144n, address: 'i64' })) {
      cachedRuntimeIssue = 'memory-limit';
    } else if (!canCreateMemory({ initial: 1n, maximum: 262144n, shared: true, address: 'i64' })) {
      cachedRuntimeIssue = 'isolation';
    } else {
      cachedRuntimeIssue = null;
    }
  }
  return cachedRuntimeIssue;
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
      ensureOrtMemoryGrowShim();
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
        env?: { wasm?: { wasmPaths?: string; numThreads?: number; proxy?: boolean } };
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
        recordMemory(
          `env.wasm: numThreads=${String(env.wasm.numThreads)}, `
          + `proxy=${String(env.wasm.proxy)}, wasmPaths=${String(env.wasm.wasmPaths)}`
        );
      }
      // Prefer the copy on our own webspace (same origin, no CDN dependency).
      // The engine falls back to HuggingFace when a file is missing there.
      setModelCacheDir('/models/sd');

      log(`sd-engine: loading ${IMAGE_GEN_MODEL.repo}`);
      recordMemory(
        `before fromPretrained: Memory still patched=${String(WebAssembly.Memory === patchedMemoryCtor)}`
      );
      const loaded = (await DiffusionPipeline.fromPretrained(IMAGE_GEN_MODEL.repo, {
        progressCallback: async (cb: ProgressPayload) => {
          mapProgress(cb, onProgress);
        },
      }).catch((err: unknown) => {
        throw engineError('Model could not be loaded', err);
      })) as DiffusionPipelineLike;

      pipeline = loaded;
      log('sd-engine: model loaded');

      // Post-load compatibility patches (each verified with a direct Node
      // repro against the real pipeline, see scripts/sd-repro/): the fork's
      // pipeline expects methods its own dependency tree no longer provides.
      // Without them the first run() dies long after the model loads.
      //
      // 1. CLIPTokenizer calls this.prepare_model_inputs(...) - a hook from
      //    transformers.js v1 that @xenova/transformers 2.x (its base class)
      //    no longer defines. It was a pass-through there; restore exactly
      //    that on the tokenizer's prototype.
      const tokenizer = (loaded as { tokenizer?: object }).tokenizer;
      const tokenizerProto = tokenizer !== null && tokenizer !== undefined ? Object.getPrototypeOf(tokenizer) : null;
      if (
        tokenizerProto !== null &&
        typeof (tokenizerProto as unknown as Record<string, unknown>)['prepare_model_inputs'] !== 'function'
      ) {
        (tokenizerProto as unknown as Record<string, unknown>)['prepare_model_inputs'] =
          (inputs: unknown): unknown => inputs;
        log('sd-engine: restored missing prepare_model_inputs hook on the tokenizer');
      }

      // 2. The LCM pipeline reshapes the guidance embedding via
      //    Tensor.reshape. @xenova/transformers resolves onnxruntime-common
      //    to the nested 1.14.0, whose Tensor predates reshape (added in
      //    later onnxruntime-common). Restore it exactly as
      //    onnxruntime-common 1.16 implements it.
      const tensorModule = (await import('@xenova/transformers')) as unknown as {
        Tensor?: new (type: unknown, data: unknown, dims: number[]) => unknown;
      };
      const TensorCtor = tensorModule.Tensor;
      const tensorProto = TensorCtor !== null && TensorCtor !== undefined
        ? (TensorCtor.prototype as unknown as Record<string, unknown>)
        : null;
      if (tensorProto !== null && typeof tensorProto['reshape'] !== 'function') {
        tensorProto['reshape'] = function (
          this: { type: unknown; data: unknown },
          dims: number[]
        ): unknown {
          return new (TensorCtor as new (
            type: unknown, data: unknown, dims: number[]
          ) => unknown)(this.type, this.data, dims);
        };
        log('sd-engine: restored missing Tensor.reshape method');
      }
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
