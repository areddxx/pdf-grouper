import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // pdfjs-dist ships an ESM build; ensure Vite pre-bundles it cleanly
    include: ['pdfjs-dist'],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
