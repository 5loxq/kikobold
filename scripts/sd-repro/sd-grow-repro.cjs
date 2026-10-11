/**
 * Direct repro of "offset is out of bounds" (createSessionAllocate):
 *
 * Root cause hypothesis: the fork's emscripten glue grows the wasm heap with
 * memory.grow(NUMBER), but the wasm's internal memory is memory64 (i64) -
 * the final JS API requires a BigInt delta. The TypeError is swallowed by
 * the glue's try/catch, emscripten_resize_heap returns false, malloc
 * returns 0, and HEAPU8.set(model, 0) throws RangeError "offset is out of
 * bounds" - the exact error the browser shows.
 *
 * This test instantiates the REAL ort-wasm-simd.jsep.wasm with a faithful
 * copy of the glue's resize logic and proves:
 *   1. grow(Number) on the i64 memory throws TypeError (API mismatch)
 *   2. malloc(246MB) fails -> HEAPU8.set reproduces the exact error
 *   3. with the prototype grow patch (Number<->BigInt translation) the
 *      same malloc + set succeeds.
 */
const fs = require('fs');
const path = require('path');

const WASM = path.resolve(__dirname, '../../public/ort/ort-wasm-simd.jsep.wasm');
const wasmBytes = fs.readFileSync(WASM);
console.log(`wasm: ${WASM} (${wasmBytes.length} bytes)`);

const mod = new WebAssembly.Module(wasmBytes);
const specs = WebAssembly.Module.imports(mod);
console.log(`imports: ${specs.length}, kinds: ${[...new Set(specs.map(s => s.kind))].join(',')}`);

let mem = null;
let HEAPU8 = null;
const updateViews = () => { HEAPU8 = new Uint8Array(mem.buffer); };

// Faithful copy of the fork's glue (module "9377" style, non-threaded):
//   vr: pages = (target - byteLength + 65535) / 65536; try { mem.grow(pages) } catch {}
//   Yt: retry loop with 1.25/1.5/2x growth, cap 16 GiB
const glueGrowTo = (target) => {
  const pages = (target - mem.buffer.byteLength + 65535) / 65536;
  try {
    mem.grow(pages); // <-- NUMBER, like the glue
    updateViews();
    return true;
  } catch {
    return false; // <-- swallowed, like the glue
  }
};
const glueResizeHeap = (requestedSize) => {
  const MAX = 17179869184; // 16 GiB, like the glue's emscripten_get_heap_max
  if (requestedSize > MAX) return false;
  const oldLen = HEAPU8.length;
  for (let mult = 1; mult <= 4; mult *= 2) {
    let geometric = oldLen * (1 + 0.2 / mult);
    geometric = Math.min(geometric, requestedSize + 100663296);
    const want = Math.max(requestedSize, geometric);
    const target = Math.min(MAX, want + (65536 - (want % 65536)) % 65536);
    if (glueGrowTo(target)) return true;
  }
  return false;
};

const imports = {};
for (const spec of specs) {
  const ns = (imports[spec.module] ??= {});
  if (spec.kind !== 'function') continue;
  if (spec.name === 'emscripten_resize_heap') {
    ns[spec.name] = (sz) => glueResizeHeap(Number(sz));
  } else if (spec.name === 'emscripten_memcpy_js') {
    ns[spec.name] = (d, s, l) => {
      d = Number(d); s = Number(s); l = Number(l);
      HEAPU8.copyWithin(d, s, s + l);
    };
  } else if (spec.name === 'abort') {
    ns[spec.name] = (msg) => { throw new Error(`wasm abort: ${msg}`); };
  } else {
    ns[spec.name] = () => {};
  }
}

const inst = new WebAssembly.Instance(mod, imports);
mem = inst.exports.memory;
updateViews();
inst.exports.__wasm_call_ctors();
console.log(`memory after ctors: ${mem.buffer.byteLength} bytes (expect 16 MiB)`);

console.log('\n--- 1. API mismatch proof ---');
try {
  mem.grow(1);
  console.log('grow(Number): OK  <-- UNEXPECTED, hypothesis wrong');
} catch (err) {
  console.log(`grow(Number) -> ${err.constructor.name}: ${err.message}`);
}
try {
  mem.grow(1n);
  console.log(`grow(BigInt): OK, memory now ${mem.buffer.byteLength} bytes`);
} catch (err) {
  console.log(`grow(BigInt) -> ${err.constructor.name}: ${err.message}`);
}
updateViews();

console.log('\n--- 2. Repro WITHOUT fix (faithful glue logic) ---');
const SIZE = 246 * 1024 * 1024; // text_encoder/model.onnx
const model = new Uint8Array(SIZE);
let ptr = inst.exports.malloc(BigInt(SIZE));
console.log(`malloc(246MB) -> ${ptr} (0 = allocation failed)`);
try {
  HEAPU8.set(model, Number(ptr)); // createSessionAllocate
  console.log('HEAPU8.set OK  <-- UNEXPECTED');
} catch (err) {
  console.log(`REPRODUCED: ${err.constructor.name}: ${err.message}`);
}

console.log('\n--- 3. Same flow WITH prototype grow patch (the fix) ---');
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
ptr = inst.exports.malloc(BigInt(SIZE));
console.log(`malloc(246MB) -> ${ptr}, heap now ${mem.buffer.byteLength} bytes`);
try {
  HEAPU8.set(model, Number(ptr));
  console.log('HEAPU8.set OK - model buffer copied into the grown heap');
} catch (err) {
  console.log(`STILL FAILING: ${err.constructor.name}: ${err.message}`);
  process.exitCode = 1;
}
