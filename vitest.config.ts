import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/pact/**', 'tests/api-integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
