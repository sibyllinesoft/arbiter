import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Monaco editor plugin temporarily disabled for landing page development
    // monacoEditorPlugin.default({
    //   languageWorkers: ['editorWorkerService', 'json', 'css', 'html', 'typescript'],
    // }),
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        ws: true,
      },
      '/events': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        ws: true,
      },
      '/webhooks': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  worker: {
    format: 'es',
  },
});
