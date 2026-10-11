/**
 * WebGPU repro harness: drives the LIVE site in headless Chrome (real
 * WebGPU/Metal) through the image studio - prompt, generate, wait - and
 * captures every console message, page error and the UI error text.
 *
 * The wasm-EP path is covered by sd-pipeline-e2e.mjs; this harness covers
 * the WebGPU execution provider, which only exists in a real browser.
 *
 * Run: node scripts/sd-repro/webgpu-repro.mjs [url]
 *   url defaults to https://www.kikobold.net
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.argv[2] ?? 'https://www.kikobold.net';
const TIMEOUT_MIN = Number(process.env.REPRO_TIMEOUT_MIN ?? 12);

const browser = await puppeteer.launch({
  userDataDir: '/tmp/webgui-chrome-profile',
  executablePath: CHROME,
  headless: true,
  args: [
    '--enable-unsafe-webgpu',
    '--disable-gpu-sandbox',
    '--no-first-run',
    '--disable-features=Translate',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });

const logs = [];
page.on('console', (m) => {
  logs.push(`[console.${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => {
  logs.push(`[pageerror] ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 10).join('\n')}`);
});
page.on('requestfailed', (r) => {
  logs.push(`[requestfailed] ${r.url()} -> ${r.failure()?.errorText}`);
});

console.log(`opening ${URL} ...`);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });

// The app reloads itself when the service worker updates - retry any
// interaction that hits a detached frame until the document is stable.
const evalWithTimeout = async (fn, arg, ms = 8000) => Promise.race([
    page.evaluate(fn, arg),
    new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout')), ms)),
  ]);

const retryEvaluate = async (fn, arg, tries = 20) => {
  for (let i = 0; i < tries; i++) {
    try {
      return await page.evaluate(fn, arg);
    } catch (err) {
      if (/detached Frame|Execution context/i.test(String(err.message))) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('page never became stable');
};

const clickButton = async (pattern) => retryEvaluate((p) => {
  const re = new RegExp(p);
  const el = [...document.querySelectorAll('button')]
    .find((b) => re.test(b.textContent ?? '') && !b.disabled);
  if (el) {
    el.click();
    return el.textContent?.trim();
  }
  return null;
}, pattern);

// Wait for the app shell to be ready (sidebar rendered)
for (let i = 0; i < 30; i++) {
  const ready = await retryEvaluate(() =>
    [...document.querySelectorAll('button')]
      .some((b) => (b.textContent ?? '').includes('Bilder (Alpha)')), null);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 1000));
}
await new Promise((r) => setTimeout(r, 1000));

// Close the what's-new dialog if it opened (version bump)
const closed = await clickButton('^Alles klar');
if (closed) console.log('closed whats-new dialog');
await new Promise((r) => setTimeout(r, 800));

// Open the image studio via the sidebar
const tab = await clickButton('Bilder \\(Alpha\\)');
console.log('clicked sidebar item:', tab);
await new Promise((r) => setTimeout(r, 1500));

// Check WebGPU availability as the page sees it
const gpu = await retryEvaluate(() => ({
  hasGpu: typeof navigator !== 'undefined' && !!navigator.gpu,
  isolated: globalThis.crossOriginIsolated,
}), null);
try {
  const adapter = await retryEvaluate(async () => {
    if (!navigator.gpu) return null;
    const a = await navigator.gpu.requestAdapter();
    return a ? { vendor: a.info?.vendor, architecture: a.info?.architecture } : null;
  }, null);
  gpu.adapter = adapter;
} catch { /* ignore */ }
console.log('WebGPU:', JSON.stringify(gpu));

// Fill the prompt (React-controlled textarea: native setter + input event,
// retried across reloads until the value sticks)
for (let i = 0; i < 15; i++) {
  const typed = await retryEvaluate((text) => {
    const ta = document.querySelector('#image-prompt');
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return ta.value === text;
  }, 'a photo of a cat, cozy library, warm light');
  if (typed) break;
  await new Promise((r) => setTimeout(r, 1500));
}
await new Promise((r) => setTimeout(r, 300));

// Diagnostics: why is the generate button (not) clickable?
const diag = await retryEvaluate(() => {
  const prompt = document.querySelector('#image-prompt');
  const btns = [...document.querySelectorAll('button')].filter(b => /Bild erzeugen/.test(b.textContent ?? ''));
  const warnings = [...document.querySelectorAll('div, p, section')]
    .map(e => e.textContent ?? '')
    .filter(t => /Browser|WebAssembly|Arbeitsspeicher|unterst.utzt/i.test(t))
    .slice(0, 3);
  return {
    promptValue: prompt?.value ?? null,
    buttons: btns.map(b => ({ text: b.textContent?.trim(), disabled: b.disabled })),
    warnings,
  };
}, null);
console.log('button diagnostics:', JSON.stringify(diag, null, 1));

// Pause on every exception and dump the stack when the wasm trap fires
const cdp = await page.createCDPSession();
await cdp.send('Debugger.enable');
await cdp.send('Debugger.setPauseOnExceptions', { state: 'all' });
cdp.on('Debugger.paused', async (params) => {
  try {
    const text = params.data?.exception?.description
      ?? params.data?.description
      ?? params.data?.text ?? '';
    console.log('[pause] ' + JSON.stringify(params.data ?? {}).replace(/\\n/g, ' | ').slice(0, 2500));
    if (/data does not exist/i.test(text)) {
      try {
        const frame = params.callFrames?.[0];
        if (frame) {
          const expr = 'JSON.stringify({id: String(u), type: typeof u, cacheSize: this.storageCache.size, lastKeys: [...this.storageCache.keys()].slice(-8).map(String)})';
          const id = await cdp.send('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression: expr, objectGroup: 'repro' });
          console.log('[DOWNLOAD-ID] ' + id.result.value);
        }
      } catch (e2) { console.log('[DOWNLOAD-ID] failed: ' + e2.message); }
    }
    if (/unreachable|Aborted/i.test(text)) {
      const frames = (params.callFrames ?? []).map((f, i) =>
        `    #${i} ${f.functionName || '(anonymous)'} @ ${f.url}:${f.location.lineNumber}:${f.location.columnNumber}`);
      console.log('[TRAP] ' + text.slice(0, 200));
      console.log('[TRAP stack]\n' + frames.slice(0, 20).join('\n'));
    }
  } catch { /* ignore */ }
  try { await cdp.send('Debugger.resume'); } catch { /* already resumed */ }
});

// Enable ORT verbose logging via the app's own ORT chunk (same module
// instance): prints GpuDataManager create/release/download with ids.
try {
  await retryEvaluate(async () => {
    const ort = (await import('/assets/ort.webgpu.min-BJqL9tZt.js')).default;
    ort.env.logLevel = 'verbose';
    ort.env.wasm.debug = true;
    if (ort.env.wasm) ort.env.wasm.logLevel = 'verbose';
    return ort.env.logLevel;
  }, null);
  console.log('ORT verbose logging enabled');
} catch (err) {
  console.log('could not enable verbose logging: ' + err.message);
}

const started = Date.now();
const gen = await clickButton('Modell laden & Bild erzeugen|Bild erzeugen');
console.log(`clicked generate: "${gen}" at +0s`);

// Poll for result (img) or error text
let outcome = null;
const deadline = Date.now() + TIMEOUT_MIN * 60_000;
let shot = 0;
while (Date.now() < deadline && !outcome) {
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const buf = await Promise.race([
      page.screenshot({ type: 'png' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('shot timeout')), 5000)),
    ]);
    fs.writeFileSync('/tmp/webgpu-shot-' + (shot++) + '.png', buf);
  } catch { /* renderer busy */ }
  // Do NOT retry on evaluate timeouts here: a busy main thread (wasm
  // session build / GPU busy-wait) must not wedge the poll loop.
  try {
    outcome = await evalWithTimeout(() => {
      const errEl = [...document.querySelectorAll('p, div, span')]
        .filter((e) => e.children.length === 0 && (e.textContent ?? '').includes('Das Bildmodell konnte nicht geladen werden'))
        .sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (errEl) return { type: 'error', text: (errEl.textContent ?? '').trim().slice(0, 800) };
      const img = document.querySelector('img[src^="data:image/png"]');
      if (img) return { type: 'image', len: img.src.length };
      const status = (document.body.innerText.match(/Modell wird geladen[^\n]*|Bild wird generiert[^\n]*|Schritt \d+[^\n]*/) ?? [null])[0];
      return status ? { type: 'status', text: status } : null;
    }, null);
    if (outcome?.type === 'status') {
      console.log(`  [status] ${outcome.text.slice(0, 120)}`);
      outcome = null;
    }
  } catch (err) {
    console.log(`  [poll] ${err.message}`);
  }
  if (!outcome && Date.now() - started < deadline) {
    const secs = Math.round((Date.now() - started) / 1000);
    if (secs % 30 < 5) console.log(`  ...waiting (+${secs}s)`);
  }
}

console.log(`\n=== OUTCOME after ${Math.round((Date.now() - started) / 1000)}s ===`);
console.log(outcome ? JSON.stringify(outcome, null, 1).slice(0, 800) : 'TIMEOUT');

console.log('\n=== console/error log (relevant) ===');
for (const l of logs) {
  if (/sd-engine|error|Error|warn|unreachable|webgpu|wasm|ORT|fail/i.test(l)) {
    console.log(l.slice(0, 500));
  }
}

await browser.close();
process.exit(outcome?.type === 'image' ? 0 : 1);
