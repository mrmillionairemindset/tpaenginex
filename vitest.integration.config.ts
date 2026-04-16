import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/integration/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    env: {
      APP_ENCRYPTION_KEY: 'test-encryption-key-with-32-plus-characters-of-entropy-xxxx',
      TOTP_ISSUER: 'TestIssuer',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
