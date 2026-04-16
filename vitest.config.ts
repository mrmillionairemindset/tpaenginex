import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/__tests__/**/*.ts'],
    exclude: ['node_modules', '.next', 'dist', 'src/**/__tests__/integration/**'],
    // Test environment variables — real crypto key for testing at-rest encryption
    env: {
      APP_ENCRYPTION_KEY: 'test-encryption-key-with-32-plus-characters-of-entropy-xxxx',
      TOTP_ISSUER: 'TestIssuer',
      BASE_DOMAIN: 'tpaplatform.com',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
