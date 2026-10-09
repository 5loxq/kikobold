// Accessibility audit: runs axe-core against the built app (dist/) in a
// headless Chrome - the same engine the online audit tools use.
//
//   npm run build && npm run audit:a11y
//
// Reports violations (real failures) and incomplete checks (manual review).
// Exits with code 1 when violations are found.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const PORT = 4178;
const BROWSER = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  stdio: 'ignore',
  detached: false,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(2500);

let exitCode = 0;
let browser;
try {
  const { default: puppeteer } = await import('puppeteer-core');
  browser = await puppeteer.launch({ executablePath: BROWSER, headless: 'new' });
  const axeSource = await readFile('node_modules/axe-core/axe.min.js', 'utf-8');

  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const report = await page.evaluate(async (src) => {
      // eslint-disable-next-line no-eval
      eval(src);
      // eslint-disable-next-line no-undef
      return await axe.run(document, { resultTypes: ['violations', 'incomplete'] });
    }, axeSource);
    await page.close();

    console.log(`\n=== ${scheme === 'light' ? 'HELL' : 'DUNKEL'}-Modus: ${report.violations.length} Verstoesse, ${report.incomplete.length} manuelle Prüfungen`);
    for (const v of report.violations) {
      exitCode = 1;
      console.log(`  VERSTOSS ${v.id} (${v.impact}) - ${v.help}`);
      for (const node of v.nodes) {
        console.log(`    Ziel: ${JSON.stringify(node.target)}`);
        for (const chk of node.any) {
          const d = chk.data || {};
          console.log(`    ${chk.message.slice(0, 140)}`);
          if (d.contrastRatio) {
            console.log(`    Ist ${d.contrastRatio}:1, erwartet ${d.expectedContrastRatio}`);
          }
        }
      }
    }
    for (const v of report.incomplete) {
      console.log(`  MANUELL ${v.id} - ${v.help}`);
      for (const node of v.nodes) {
        console.log(`    Ziel: ${JSON.stringify(node.target)}`);
      }
    }
  }
  await browser.close();
} catch (err) {
  console.error('Audit fehlgeschlagen:', err.message);
  exitCode = 2;
} finally {
  preview.kill('SIGTERM');
}

process.exit(exitCode);
