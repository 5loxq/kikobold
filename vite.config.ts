import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
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
    // Increase timeout for model loading
    watch: {
      usePolling: true,
      interval: 1000,
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
      external: ['@xenova/transformers'],
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
