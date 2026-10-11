import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The ORT package has two entry points: `exports` -> dist/ort.webgpu.min.js
      // (JSEP build, WebGPU-capable) and `browser` -> dist/ort-web.min.js
      // (no JSEP). Depending on the import site, the bundler picked either
      // one, silently creating TWO ORT instances with separate `env` objects:
      // the wasmPaths we set in sd-engine.ts only reached one of them, the
      // image engine fetched its WASM runtime from a relative URL and got the
      // SPA fallback (HTML) instead. Force every import to the same JSEP build.
      '@aislamov/onnxruntime-web64': fileURLToPath(
        new URL('./node_modules/@aislamov/onnxruntime-web64/dist/ort.webgpu.min.js', import.meta.url)
      ),
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
    // Optimize for development
    hmr: {
      overlay: true,
    },
  },
  // Preview must send the same isolation headers as production (.htaccess):
  // only a cross-origin isolated page enables the multi-thread (pthread)
  // WASM path, which behaves differently from the single-thread fallback.
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  worker: {
    // Configure Vite to build workers with proper format
    format: 'es',
    rollupOptions: {
      output: {
        // Ensure worker files are properly chunked
        inlineDynamicImports: false,
      },
    },
  },
  build: {
    // Optimize bundle size
    minify: 'esbuild',
    sourcemap: false, // Disable for production to reduce size
    rollupOptions: {
      output: {
        // manualChunks is now a function in Vite 8 / Rolldown
        // Temporarily disabled for compatibility
        // manualChunks: (id) => {
        //   if (id.includes('react')) return 'react';
        //   if (id.includes('transformers')) return 'transformers';
        //   if (id.includes('i18n')) return 'i18n';
        // },
      },
      // No `external` entries: broad regexes like /legacy/ would silently
      // leave matching imports unbundled and crash at runtime. Nothing in
      // the source imports these packages.
    },
    // Increase chunk size warning limit for large models
    chunkSizeWarningLimit: 2000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@mlc-ai/web-llm'],
    exclude: ['@xenova/transformers'],
  },
  // Cache directory for faster rebuilds
  cacheDir: 'node_modules/.vite-cache',
})
