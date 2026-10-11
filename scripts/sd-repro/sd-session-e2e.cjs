/**
 * End-to-end test: create a real ORT session (the fork's own JS bundle +
 * real wasm + real model file) in Node, reproducing the browser's
 * "Model could not be loaded: offset is out of bounds" and proving the
 * WebAssembly.Memory.prototype.grow patch fixes it.
 *
 * Phase 1: no patch      -> expect RangeError: offset is out of bounds
 * Phase 2: with patch    -> expect session created
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
global.self = globalThis;

// The emscripten glue modules evaluate lazily (on first session creation)
// and take a Node branch (require('fs')/require('path')) that the browser
// bundle does not contain. Hide `process` for the whole run so every glue
// evaluates in browser mode, exactly like on kikobold.net.
const nodeProcess = globalThis.process;
Object.defineProperty(globalThis, 'process', { get: () => undefined, configurable: true });

// Same JSPI shim as sd-engine.ts (in case Node lacks WebAssembly.Function)
{
  const wa = globalThis.WebAssembly;
  if (typeof wa.Function !== 'function' && typeof wa.Suspending === 'function' && typeof wa.promising === 'function') {
    wa.Function = function (_type, fn, options) {
      if (options?.promising === 'first') return wa.promising(fn);
      if (options?.suspending === 'first') return new wa.Suspending(fn);
      throw new Error('unsupported WebAssembly.Function options');
    };
    wa.Function.type = () => ({ parameters: ['externref'], results: [] });
    console.log('JSPI shim installed');
  }
}
// Same assert shim as sd-engine.ts
if (typeof globalThis.assert !== 'function') {
  globalThis.assert = (expr, msg) => {
    if (!expr) throw new Error(typeof msg === 'string' ? msg : msg?.() ?? 'assertion failed');
  };
}

// Serve the ORT wasm files from disk (no HTTP server needed)
const realFetch = global.fetch;
global.fetch = (input, init) => {
  const url = String(typeof input === 'string' ? input : (input?.url ?? input));
  if (url.includes('ort-wasm')) {
    const file = url.includes('threaded')
      ? 'ort-wasm-simd-threaded.jsep.wasm'
      : 'ort-wasm-simd.jsep.wasm';
    const bytes = fs.readFileSync(path.join(REPO, 'public/ort', file));
    console.log(`  [fetch-served] ${url} -> ${file} (${bytes.length} bytes)`);
    return Promise.resolve(new Response(bytes, { headers: { 'content-type': 'application/wasm' } }));
  }
  return realFetch(input, init);
};

const ort = require(path.join(REPO, 'node_modules/@aislamov/onnxruntime-web64/dist/ort.webgpu.min.js'));
ort.env.wasm.numThreads = 1;

const installGrowPatch = () => {
  const nativeGrow = WebAssembly.Memory.prototype.grow;
  WebAssembly.Memory.prototype.grow = function patchedGrow(delta) {
    try {
      return nativeGrow.call(this, delta);
    } catch (err) {
      if (err instanceof TypeError) {
        const conv = typeof delta === 'number' ? BigInt(Math.trunc(delta)) : Number(delta);
        return nativeGrow.call(this, conv);
      }
      throw err;
    }
  };
};

const createSession = async (label) => {
  const modelPath = path.join(REPO, 'public/models/sd/aislamov/lcm-dreamshaper-v7-onnx/text_encoder/model.onnx');
  const model = new Uint8Array(fs.readFileSync(modelPath));
  console.log(`\n=== ${label} ===`);
  console.log(`model: text_encoder/model.onnx (${model.byteLength} bytes)`);
  const t0 = Date.now();
  try {
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    console.log(`SESSION CREATED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`  input names:  ${session.inputNames.join(', ')}`);
    console.log(`  output names: ${session.outputNames.join(', ')}`);
    return true;
  } catch (err) {
    console.log(`FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s:`);
    console.log(`  ${err.constructor.name}: ${err.message}`);
    const frames = (err.stack ?? '').split('\n').slice(1, 4).map(l => l.trim());
    frames.forEach(f => console.log(`  ${f}`));
    return false;
  }
};

(async () => {
  const phase1 = await createSession('Phase 1: WITHOUT grow patch (expect the browser error)');
  installGrowPatch();
  const phase2 = await createSession('Phase 2: WITH grow patch (expect success)');

  // Phase 3: the heaviest session - unet with 1.6 GB external weights,
  // exactly like diffusers.js passes them (externalWeights EP option).
  console.log('\n=== Phase 3: unet + external weights (1.6 GB) with patch ===');
  const base = path.join(REPO, 'public/models/sd/aislamov/lcm-dreamshaper-v7-onnx/unet');
  const unet = new Uint8Array(fs.readFileSync(path.join(base, 'model.onnx')));
  const weights = new Uint8Array(fs.readFileSync(path.join(base, 'model.onnx_data')));
  console.log(`unet model.onnx: ${unet.byteLength} bytes, model.onnx_data: ${weights.byteLength} bytes`);
  const t0 = Date.now();
  let phase3 = false;
  try {
    const session = await ort.InferenceSession.create(unet, {
      executionProviders: [{ name: 'wasm', externalWeights: weights, externalWeightsFilename: 'model.onnx_data' }],
    });
    console.log(`UNET SESSION CREATED in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`  input names:  ${session.inputNames.join(', ')}`);
    phase3 = true;
  } catch (err) {
    console.log(`FAILED after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${err.message}`);
  }

  console.log('\n=== RESULT ===');
  console.log(`phase 1 (no patch):       ${phase1 ? 'unexpected success' : 'failed as in the browser (reproduced)'}`);
  console.log(`phase 2 (with patch):     ${phase2 ? 'session created - FIX VERIFIED' : 'STILL BROKEN'}`);
  console.log(`phase 3 (unet+weights):   ${phase3 ? 'session created - HEAVY PATH VERIFIED' : 'STILL BROKEN'}`);
  nodeProcess.exit(phase2 && phase3 ? 0 : 1);
})();
