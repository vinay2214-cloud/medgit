import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    passWithNoTests: true,
    exclude: ['**/node_modules/**', '**/._*', '**/.DS_Store', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@core': new URL('./src/core', import.meta.url).pathname,
      '@ui': new URL('./src/ui', import.meta.url).pathname,
    },
  },
});
