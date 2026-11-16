import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Component specs opt into jsdom with `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.spec.{ts,tsx}', 'shared/**/*.spec.ts', 'backend/**/*.spec.ts'],
    coverage: {
      include: ['src/**', 'shared/**', 'backend/**'],
      exclude: ['**/*.spec.*', 'src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
});
