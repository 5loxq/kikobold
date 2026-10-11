// Copies the onnxruntime-web WASM runtime files into public/ort/ so the
// image generation engine (diffusers.js) can load them from our own origin
// instead of a CDN. Runs as part of the build; public/ort/ is gitignored
// (like public/models/) because of its size.
//
// Only the variants modern browsers actually request are copied:
// - *simd* (SSE4/NEON, every browser since 2021)
// - *jsep (WebGPU) and non-jsep (WASM CPU fallback)
// - threaded + non-threaded (threads need cross-origin isolation, which
//   the dev server provides via COOP/COEP headers)
// Ancient no-SIMD variants are not shipped.

import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@aislamov', 'onnxruntime-web64', 'dist');
const target = join(root, 'public', 'ort');

if (!existsSync(source)) {
  console.error('copy-ort-wasm: @aislamov/onnxruntime-web64 is not installed. Run npm install first.');
  process.exit(1);
}

mkdirSync(target, { recursive: true });

// Prepended to the pthread worker file: the ORT glue (which the worker loads
// via importScripts) instantiates the wasm module with imports wrapped in the
// OLD JSPI draft API (WebAssembly.Function with {suspending:"first"} /
// {promising:"first"}). Chrome ships the final JSPI API instead
// (WebAssembly.Suspending / WebAssembly.promising) and no WebAssembly.Function.
// The main-thread shim lives in sd-engine.ts; the worker needs its own.
const JSPI_SHIM = `\
// webgui: JSPI translation shim (prepended by copy-ort-wasm.mjs)
(function () {
  if (typeof WebAssembly.Function === 'function') return;
  if (typeof WebAssembly.Suspending !== 'function' || typeof WebAssembly.promising !== 'function') return;
  var shim = function (_type, fn, options) {
    if (options && options.promising === 'first') return WebAssembly.promising(fn);
    if (options && options.suspending === 'first') return new WebAssembly.Suspending(fn);
    throw new Error('unsupported WebAssembly.Function options (JSPI shim)');
  };
  shim.type = function () { return { parameters: ['externref'], results: [] }; };
  WebAssembly.Function = shim;
})();
`;

const FILES = [
  // Non-threaded (production site has no cross-origin isolation)
  'ort-wasm-simd.jsep.wasm',
  'ort-wasm-simd.wasm',
  // Threaded (dev server sends COOP/COEP)
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.js',
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.js',
  'ort-wasm-simd-threaded.worker.js',
];

for (const file of FILES) {
  if (file === 'ort-wasm-simd-threaded.worker.js') {
    // The worker re-instantiates the wasm module with the glue's instrumented
    // imports, so it needs the JSPI translation before the glue runs.
    writeFileSync(
      join(target, file),
      JSPI_SHIM + readFileSync(join(source, file), 'utf8'),
    );
  } else {
    copyFileSync(join(source, file), join(target, file));
  }
  console.log(`copy-ort-wasm: ${file}`);
}
console.log('copy-ort-wasm: done');
