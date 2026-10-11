/**
 * ESM wrapper around the fork's BROWSER ORT bundle (UMD). Node's package
 * resolution would otherwise load ort-web.node.js (onnxruntime-node),
 * which is a completely different runtime - this wrapper keeps the test
 * on the exact code path the browser runs (ort.webgpu.min.js +
 * ort-wasm-simd.jsep.wasm).
 *
 * InferenceSession.create is wrapped to rewrite execution providers to
 * 'wasm' (Node has no WebGPU; the browser uses 'webgpu' - the pipeline
 * logic under test is provider independent).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);

const ort = require(path.join(REPO, 'node_modules/@aislamov/onnxruntime-web64/dist/ort.webgpu.min.js'));

const originalCreate = ort.InferenceSession.create;
ort.InferenceSession.create = function patchedCreate(model, options) {
  if (options && Array.isArray(options.executionProviders)) {
    options.executionProviders = options.executionProviders.map((ep) =>
      typeof ep === 'string' ? 'wasm' : { ...ep, name: 'wasm' });
  }
  return originalCreate.call(ort.InferenceSession, model, options);
};

export default ort;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor;
export const env = ort.env;
export const registerBackend = ort.registerBackend;
