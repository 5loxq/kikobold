#!/usr/bin/env node
/**
 * Injects the app version from package.json into the built service worker
 * (dist/sw.js). Every release gets its own cache name this way, so
 * browsers reliably pick up updates and the activate handler cleans up
 * the old cache. Run automatically as part of `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const swPath = path.join(root, 'dist', 'sw.js');

if (!fs.existsSync(swPath)) {
  console.error('set-sw-version: dist/sw.js not found - run the vite build first.');
  process.exit(1);
}

const sw = fs.readFileSync(swPath, 'utf8');
const versioned = sw.replace('__APP_VERSION__', pkg.version);

if (versioned === sw && !sw.includes(`llm-webgui-v${pkg.version}`)) {
  console.warn('set-sw-version: placeholder __APP_VERSION__ not found in dist/sw.js.');
}

fs.writeFileSync(swPath, versioned);
console.log(`set-sw-version: service worker cache name -> llm-webgui-v${pkg.version}`);
