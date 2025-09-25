import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@services': path.resolve(__dirname, './src/services'),
      '@design-system': path.resolve(__dirname, './src/design-system'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@types': path.resolve(__dirname, './src/types'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
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
