/**
 * Full-pipeline end-to-end test for the image engine, on the exact browser
 * code path (browser diffusers.js build + browser ORT bundle + real wasm
 * + real model files from public/models/sd).
 *
 * Phase 1: run WITHOUT the tokenizer patch -> expect the browser error
 *          "this.prepare_model_inputs is not a function" (the fork calls
 *          a transformers.js v1 hook that @xenova/transformers 2.x no
 *          longer defines).
 * Phase 2: patch CLIPTokenizer.prototype.prepare_model_inputs (the
 *          pass-through it was in v1) -> expect a generated image tensor.
 *
 * Run: node --import ./scripts/sd-repro/register-loader.mjs \
 *           scripts/sd-repro/sd-pipeline-e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
globalThis.self = globalThis;

// --- same shims as sd-engine.ts -----------------------------------------
{
  const wa = globalThis.WebAssembly;
  if (typeof wa.Function !== 'function' && typeof wa.Suspending === 'function' && typeof wa.promising === 'function') {
    // Diagnostics: log the arguments when a promising/suspending wrapper
    // fails to convert them - identifies which pointer is undefined.
    const origPromising = wa.promising.bind(wa);
    wa.promising = (fn) => {
      const wrapped = origPromising(fn);
      return function (...args) {
        try {
          return wrapped(...args);
        } catch (err) {
          console.log(`[promising] FAILED: ${err.message}`);
          console.log(`[promising] args: ${args.map((a, i) => `${i}:${typeof a}=${String(a).slice(0, 24)}`).join(' | ')}`);
          throw err;
        }
      };
    };
    wa.Function = function (_type, fn, options) {
      if (options?.promising === 'first') {
        // The draft wrapper's signature omits the export's leading externref
        // (the draft promise handle, verified in the wasm: OrtRun is
        // (externref, i64 x8) -> i32). The final promising() wrapper keeps
        // the full signature, so re-inject a placeholder for the glue's
        // 8-arg call.
        const wrapped = origPromising(fn);
        return function (...args) {
          return wrapped(undefined, ...args);
        };
      }
      if (options?.suspending === 'first') return new wa.Suspending(fn);
      throw new Error('unsupported WebAssembly.Function options');
    };
    wa.Function.type = () => ({ parameters: ['externref'], results: [] });
    console.log('[shim] JSPI installed');
  }
  if (typeof globalThis.assert !== 'function') {
    globalThis.assert = (expr, msg) => {
      if (!expr) throw new Error(typeof msg === 'string' ? msg : msg?.() ?? 'assertion failed');
    };
  }
  // memory64 grow fix (v4.3.21): translate Number <-> BigInt on TypeError
  {
    const proto = WebAssembly.Memory.prototype;
    if (!proto.grow.__webguiGrowShim) {
      const nativeGrow = proto.grow;
      proto.grow = function patchedGrow(delta) {
        try {
          return nativeGrow.call(this, delta);
        } catch (err) {
          if (!(err instanceof TypeError)) throw err;
          const translated = typeof delta === 'number' ? BigInt(Math.trunc(delta)) : Number(delta);
          return nativeGrow.call(this, translated);
        }
      };
      proto.grow.__webguiGrowShim = true;
      console.log('[shim] memory.grow Number/BigInt translation installed');
    }
  }
  // Serve the ORT wasm from disk (no HTTP server needed)
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = String(typeof input === 'string' ? input : (input?.url ?? input));
    if (url.includes('ort-wasm')) {
      const file = url.includes('threaded')
        ? 'ort-wasm-simd-threaded.jsep.wasm'
        : 'ort-wasm-simd.jsep.wasm';
      const bytes = fs.readFileSync(path.join(REPO, 'public/ort', file));
      return Promise.resolve(new Response(bytes, { headers: { 'content-type': 'application/wasm' } }));
    }
    return realFetch(input, init);
  };
}

// The emscripten glue takes a broken Node branch when it sees a full
// `process` object - hide it (the browser build never sees one).
const nodeProcess = globalThis.process;
Object.defineProperty(globalThis, 'process', { get: () => undefined, configurable: true });

const { DiffusionPipeline, setCacheImpl } = await import('@aislamov/diffusers.js');
// Mirror sd-engine.ts: single-threaded wasm (the app runs numThreads=1,
// which selects the non-threaded glue + internal memory64 heap).
{
  const ort = (await import('@aislamov/onnxruntime-web64')).default;
  ort.env.wasm.numThreads = 1;
  console.log('[env] numThreads=1');
}

// Serve model files from public/models/sd (same bytes the webspace serves)
setCacheImpl({
  async getModelFile(repo, file, fatal, options) {
    const p = path.join(REPO, 'public/models/sd', repo, file);
    try {
      const data = fs.readFileSync(p);
      if (options?.returnText) return data.toString('utf8');
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } catch (err) {
      if (!fatal) return null;
      throw err;
    }
  },
});

const MODEL_REPO = 'aislamov/lcm-dreamshaper-v7-onnx';

const patchTokenizer = (pipeline) => {
  const tokenizer = pipeline?.tokenizer;
  const proto = tokenizer != null ? Object.getPrototypeOf(tokenizer) : null;
  if (proto != null && typeof proto.prepare_model_inputs !== 'function') {
    proto.prepare_model_inputs = (inputs) => inputs;
    console.log('[patch] CLIPTokenizer.prototype.prepare_model_inputs restored (pass-through)');
  }
};

const patchTensor = async () => {
  const { Tensor } = await import('@xenova/transformers');
  if (Tensor && typeof Tensor.prototype.reshape !== 'function') {
    // ort-common 1.14.0 (nested under @xenova/transformers) predates
    // Tensor.reshape - restore it exactly as ort-common 1.16 implements it.
    Tensor.prototype.reshape = function (dims) {
      return new Tensor(this.type, this.data, dims);
    };
    console.log('[patch] Tensor.prototype.reshape restored');
  }
};

const runGeneration = async (pipeline, label) => {
  console.log(`\n=== ${label} ===`);
  const t0 = Date.now();
  try {
    const images = await pipeline.run({
      prompt: 'a photo of a cat',
      guidanceScale: 1,
      seed: '42',
      width: 256,
      height: 256,
      numInferenceSteps: 1,
      progressCallback: async (cb) => {
        if (cb.status === 'RunningUnet' || cb.status === 'RunningVae' || cb.status === 'EncodingPrompt') {
          console.log(`  [progress] ${cb.status}`);
        }
      },
    });
    const img = images?.[0];
    console.log(`GENERATED in ${((Date.now() - t0) / 1000).toFixed(1)}s: dims=${JSON.stringify(img?.dims)}, `
      + `data=${img?.data?.constructor?.name}(${img?.data?.length} values)`);
    return true;
  } catch (err) {
    console.log(`FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
    console.log(`  ${err.message}`);
    (err.stack ?? '').split('\n').slice(1, 6).forEach((f) => console.log(`  ${f.trim()}`));
    return false;
  }
};

console.log('loading pipeline (sessions via wasm, files from public/models/sd)...');
const tLoad = Date.now();
const pipeline = await DiffusionPipeline.fromPretrained(MODEL_REPO, {
  progressCallback: async () => {},
});
console.log(`pipeline loaded in ${((Date.now() - tLoad) / 1000).toFixed(1)}s`);
console.log(`pipeline class: ${pipeline?.constructor?.name}, tokenizer: ${pipeline?.tokenizer?.constructor?.name}`);

const phase1 = await runGeneration(pipeline, 'Phase 1: WITHOUT tokenizer patch (expect browser error)');
patchTokenizer(pipeline);
await patchTensor();
const phase2 = await runGeneration(pipeline, 'Phase 2: WITH tokenizer patch (expect image)');

console.log('\n=== RESULT ===');
console.log(`phase 1 (no patch):    ${phase1 ? 'unexpected success' : 'failed as in the browser (reproduced)'}`);
console.log(`phase 2 (with patch):  ${phase2 ? 'image generated - FIX VERIFIED' : 'STILL BROKEN'}`);
nodeProcess.exit(phase2 ? 0 : 1);
