import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    // Synthesizing a stack takes a few seconds.
    testTimeout: 30_000,
  },
});
