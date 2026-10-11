/**
 * Loader hook: forces the BROWSER builds in Node.
 * - '@aislamov/diffusers.js'       -> dist/index.esm.js (browser build)
 * - '@aislamov/onnxruntime-web64'  -> ort-wrapper.mjs (the browser UMD
 *   ort.webgpu.min.js, required via createRequire, with the webgpu
 *   execution provider rewritten to wasm - Node has no WebGPU, but the
 *   failing code paths (tokenizer, session allocate, scheduler, tensor
 *   plumbing) are execution-provider independent).
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');

export async function resolve(specifier, context, next) {
  if (specifier === '@aislamov/diffusers.js') {
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(REPO, 'node_modules/@aislamov/diffusers.js/dist/index.esm.js')).href,
    };
  }
  if (specifier === '@aislamov/onnxruntime-web64') {
    return { shortCircuit: true, url: pathToFileURL(path.join(HERE, 'ort-wrapper.mjs')).href };
  }
  if (specifier === '@xenova/transformers') {
    // Node would load src/transformers.js (requires onnxruntime-node);
    // the app bundles the browser build - use that one.
    return {
      shortCircuit: true,
      url: pathToFileURL(path.join(REPO, 'node_modules/@xenova/transformers/dist/transformers.js')).href,
    };
  }
  return next(specifier, context);
}
