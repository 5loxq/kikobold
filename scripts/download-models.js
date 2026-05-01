#!/usr/bin/env node

/**
 * Model Download Script
 * Downloads pre-quantized GGUF models from HuggingFace for local use
 * Usage: npm run download-models
 *
 * Note: Downloads are ~3.3GB total (3 ultra-small efficient models)
 * - TinyLLaMA 1.1B: 637 MB (ultra-lightweight, fastest)
 * - Phi-2 2.7B: 1.4 GB (high-quality, excellent reasoning)
 * - Qwen 1.8B: 1.3 GB (multilingual, efficient)
 * Requires nodejs >= 14
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODELS = [
  {
    name: 'TinyLLaMA 1.1B Chat',
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    filename: 'tinyllama-1.1b-chat-v1.0.gguf',
    size: '637 MB'
  },
  {
    name: 'Phi-2 2.7B',
    url: 'https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf',
    filename: 'phi-2.gguf',
    size: '1.4 GB'
  },
  {
    name: 'Qwen 1.8B Chat',
    url: 'https://huggingface.co/TheBloke/Qwen1.5-1.8B-Chat-GGUF/resolve/main/qwen1.5-1.8b-chat.Q4_K_M.gguf',
    filename: 'qwen1.5-1.8b-chat.gguf',
    size: '1.3 GB'
  }
];

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(MODELS_DIR, filename);
    const file = fs.createWriteStream(filepath);
    let downloadedBytes = 0;

    console.log(`\n📥 Downloading ${filename}...`);
    console.log(`   URL: ${url}`);

    function handleRequest(requestUrl) {
      https.get(requestUrl, (response) => {
        // Follow redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`   ↻ Following redirect...`);
          handleRequest(response.headers.location);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'], 10);

        response.pipe(file);

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
          process.stdout.write(`\r   Progress: ${mb}MB / ${(totalBytes / (1024 * 1024)).toFixed(1)}MB (${percent}%)`);
        });

        file.on('finish', () => {
          file.close();
          console.log(`\n   ✅ Downloaded successfully!\n`);
          resolve();
        });

        file.on('error', (err) => {
          fs.unlink(filepath, () => {});
          reject(err);
        });
      }).on('error', reject);
    }

    handleRequest(url);
  });
}

async function main() {
  console.log('\n🚀 Local LLM Model Downloader');
  console.log('================================\n');

  // Create models directory
  if (!fs.existsSync(MODELS_DIR)) {
    console.log(`📁 Creating directory: ${MODELS_DIR}`);
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  } else {
    console.log(`📁 Models directory exists: ${MODELS_DIR}`);
  }

  console.log('\n📋 Models to download:');
  MODELS.forEach((model, i) => {
    console.log(`   ${i + 1}. ${model.name} (${model.size})`);
  });

  console.log('\n⚠️  Total size: ~3.3GB');
  console.log('⚠️  This may take 15-45 minutes depending on internet speed\n');

  // Check for existing files
  const existingFiles = MODELS.filter(m =>
    fs.existsSync(path.join(MODELS_DIR, m.filename))
  );

  if (existingFiles.length > 0) {
    console.log('⏭️  Already downloaded:');
    existingFiles.forEach(m => {
      const filepath = path.join(MODELS_DIR, m.filename);
      const stats = fs.statSync(filepath);
      console.log(`   ✓ ${m.filename} (${(stats.size / (1024 * 1024 * 1024)).toFixed(2)}GB)`);
    });
  }

  // Download missing models
  const modelsToDownload = MODELS.filter(m =>
    !fs.existsSync(path.join(MODELS_DIR, m.filename))
  );

  if (modelsToDownload.length === 0) {
    console.log('\n✅ All models already downloaded!\n');
    process.exit(0);
  }

  console.log(`\n⬇️  Downloading ${modelsToDownload.length} model(s)...\n`);

  try {
    for (const model of modelsToDownload) {
      await downloadFile(model.url, model.filename);
    }

    console.log('✅ All models downloaded successfully!\n');
    console.log('📍 Models location: ./public/models/');
    console.log('🚀 Models will be automatically loaded from local storage when app is built.\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Download failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  1. Check your internet connection');
    console.error('  2. Make sure you have enough disk space (~8.2GB)');
    console.error('  3. Try running the script again\n');
    process.exit(1);
  }
}

main();
