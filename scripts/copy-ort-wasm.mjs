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

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
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
  copyFileSync(join(source, file), join(target, file));
  console.log(`copy-ort-wasm: ${file}`);
}
console.log('copy-ort-wasm: done');
