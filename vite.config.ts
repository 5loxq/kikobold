import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  build: {
    // Optimize bundle size
    minify: 'esbuild',
    sourcemap: false, // Disable for production to reduce size
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          react: ['react', 'react-dom'],
          transformers: ['@xenova/transformers'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
    // Increase chunk size warning limit for large models
    chunkSizeWarningLimit: 2000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@xenova/transformers'],
    exclude: [],
  },
  // Cache directory for faster rebuilds
  cacheDir: 'node_modules/.vite-cache',
})
