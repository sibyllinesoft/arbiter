import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    (monacoEditorPlugin as any).default({})
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    target: 'es2022',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.api']
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  }
})
