#!/usr/bin/env node
/**
 * i18n consistency check (idea #34 from VERBESSERUNGS-IDEEN.md).
 *
 * Fails when:
 *  1. a key exists in only one of the two locale files (de/en drift), or
 *  2. the code calls t('...') with a key that is missing from a locale.
 *
 * Run via `npm run check:i18n` - also part of the CI pipeline.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(root, 'src');

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );

const loadKeys = (file) => flatten(JSON.parse(fs.readFileSync(file, 'utf8')));

const deKeys = new Set(loadKeys(path.join(SRC_DIR, 'locales', 'de.json')));
const enKeys = new Set(loadKeys(path.join(SRC_DIR, 'locales', 'en.json')));

const problems = [];

const onlyDe = [...deKeys].filter((key) => !enKeys.has(key));
const onlyEn = [...enKeys].filter((key) => !deKeys.has(key));
for (const key of onlyDe) problems.push(`nur in de.json: ${key}`);
for (const key of onlyEn) problems.push(`nur in en.json: ${key}`);

// Collect every t('key') / t(`key`) call used in the source code
const usedKeys = new Set();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*(['"`])([a-zA-Z0-9_.]+)\1/g)) {
        usedKeys.add(match[2]);
      }
    }
  }
};
walk(SRC_DIR);

for (const key of usedKeys) {
  if (!deKeys.has(key)) problems.push(`im Code benutzt, fehlt in de.json: ${key}`);
  if (!enKeys.has(key)) problems.push(`im Code benutzt, fehlt in en.json: ${key}`);
}

if (problems.length > 0) {
  console.error(`i18n-Check fehlgeschlagen (${problems.length} Probleme):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`i18n-Check OK: ${deKeys.size} Keys in de.json und en.json, ${usedKeys.size} im Code benutzte Keys vorhanden.`);
