import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { devBackend } from './backend/dev/vite-dev-backend';

export default defineConfig({
  plugins: [react(), devBackend()],
});
