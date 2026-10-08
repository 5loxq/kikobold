import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom: some tested modules touch browser APIs at import time
    // (e.g. InputBox checks for the SpeechRecognition API).
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
