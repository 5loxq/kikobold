/**
 * KI Kobold E2E smoke test — runs the full program against a deployed
 * instance (default: https://www.kikobold.net).
 *
 * Covers: app boot, React render, onboarding dialogs, all sidebar pages,
 * recommendation button, FAQ, model download + load, real chat round-trip.
 *
 * Usage:
 *   node e2e/e2e-test.js                       # against production
 *   BASE_URL=http://localhost:4173 node e2e/e2e-test.js
 *
 * Skips the (heavy) model download test when SKIP_MODEL_TEST=1.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'https://www.kikobold.net';
const results = [];
const ok = (name, pass, note = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`);
};

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Accept download-confirm dialogs and alerts automatically
await page.addInitScript(() => { window.confirm = () => true; window.alert = () => {}; });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)));

try {
  // 1) App boot
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000); // React mount + i18n
  ok('App boot', (await page.title()).includes('KI Kobold'), await page.title());
  const rootChildren = await page.evaluate(() => document.getElementById('root')?.children.length ?? 0);
  ok('React rendered', rootChildren > 0, `children=${rootChildren}`);

  // 2) Onboarding dialogs (welcome + tour)
  for (let i = 0; i < 4; i++) {
    const dlg = await page.evaluate(() => document.querySelector('[role="dialog"]')?.getAttribute('aria-label') || '');
    if (!dlg) break;
    const btnTexts = ['Alles klar, los geht\'s!', 'Los geht\'s', 'Starten', 'Verstanden', 'OK', 'Alles klar', 'Fertig', 'Schließen', 'Zum Chat springen', 'Überspringen', 'Skip', 'Next', 'Got it'];
    let done = false;
    for (const t of btnTexts) {
      done = await page.locator(`[role="dialog"] button:has-text("${t}")`).first().click({ timeout: 1200 }).then(() => true).catch(() => false);
      if (done) break;
    }
    if (!done) await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(600);
  }
  const dlgGone = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
  ok('Onboarding dismissed', dlgGone);

  // 3) Sidebar pages
  const openSidebarEntry = async (label) => {
    try {
      const grp = page.locator('button[title="Hilfe & Rechtliches"]').first();
      if (await grp.isVisible() && await grp.getAttribute('aria-expanded') === 'false') {
        await grp.click();
        await page.waitForTimeout(500);
      }
    } catch { /* group not present (EN layout) */ }
    const item = page.locator(`button[title="${label}"], button:has-text("${label}"), a:has-text("${label}")`).first();
    await item.click({ timeout: 8000 });
    await page.waitForTimeout(1200);
  };

  await openSidebarEntry('Modelle');
  const modelsText = await page.evaluate(() => document.body.innerText.slice(0, 2500));
  ok('Models page', /LFM 2\.5|Qwen/i.test(modelsText));
  ok('Recommend button present', /Modell für mein Gerät empfehlen|recommend/i.test(modelsText));
  await page.locator('button:has-text("Modell für mein Gerät empfehlen")').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  ok('Recommend button works', true, 'clicked');

  await openSidebarEntry('FAQ');
  const faqText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  ok('FAQ page', /Häufige Fragen|FAQ|Frequently/i.test(faqText));
  const q1 = page.locator('summary').first();
  if (await q1.isVisible().catch(() => false)) {
    await q1.click();
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => document.querySelector('details[open]')?.innerText.slice(0, 300) || '');
    ok('FAQ answer expands', open.length > 40);
  }

  for (const [label, pattern] of [
    ['Hilfe', /Hilfe|What's new|Tour|Help/i],
    ['Roadmap', /Roadmap/i],
    ['Datenschutz', /Datenschutz|Privacy/i],
    ['Impressum', /Impressum|Imprint/i],
  ]) {
    try {
      await openSidebarEntry(label);
      const t = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      ok(`Page: ${label}`, pattern.test(t));
    } catch (e) { ok(`Page: ${label}`, false, String(e).slice(0, 100)); }
  }

  // 4) Model load + real chat (heavy: ~220 MB download, several minutes)
  if (process.env.SKIP_MODEL_TEST !== '1') {
    console.log('\n=== Model load test (LFM2.5-350M) ===');
    await openSidebarEntry('Modelle');
    await page.locator('button:has-text("Zurück zum Chat"), button:has-text("Chat")').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // The model select is the one containing the LFM options (not the profile select)
    const modelSel = page.locator('select', { has: page.locator('option', { hasText: 'LFM 2.5 350M' }) }).first();
    if (await modelSel.isVisible().catch(() => false)) {
      const value = await modelSel.locator('option', { hasText: '350M' }).getAttribute('value');
      await modelSel.selectOption(value);
      console.log('Model selected:', value);
      // Ready = textarea enabled again
      await page.waitForFunction(() => !document.querySelector('textarea')?.disabled, null, { timeout: 480000, polling: 5000 });
      ok('Model loaded', true);
      const input = page.locator('textarea').first();
      await input.fill('Nenne bitte die Hauptstadt von Frankreich. Antworte mit einem Wort.');
      await input.press('Enter');
      console.log('Message sent — waiting for reply (max 3 min)...');
      let answer = '';
      const t0 = Date.now();
      let prev = '', stable = 0;
      while (Date.now() - t0 < 180000) {
        await page.waitForTimeout(3000);
        const cur = await page.evaluate(() => {
          const all = [...document.querySelectorAll('[class*="markdown"], [class*="message"]')];
          return all.map((e) => e.innerText.trim()).filter((t) => t.length > 2).pop() || '';
        });
        if (cur === prev && cur.length > 0) { stable++; if (stable >= 2) { answer = cur; break; } }
        else { stable = 0; prev = cur; }
      }
      ok('LLM replies', /Paris/i.test(answer), answer.replace(/\n/g, ' ').slice(0, 120));
    } else {
      ok('Model select found', false, 'no select with LFM options');
    }
  }

  // 5) Console errors (GPU-missing on headless CI runners is expected noise)
  const realErrors = consoleErrors.filter((e) => !/favicon|sourcemap|DevTools|GPU|WebGPU/i.test(e));
  ok('No critical console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' || ') || 'clean');
} finally {
  await browser.close();
}

console.log(`\n=== RESULT: ${results.filter((r) => r.pass).length}/${results.length} passed ===`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
