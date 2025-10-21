/// <reference types="vitest" />

import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import monacoEditorPlugin from "vite-plugin-monaco-editor";
import { configDefaults } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Conditionally load Monaco Editor plugin only for non-test environments
    ...(process.env.VITEST ? [] : [(monacoEditorPlugin as any).default({})]),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: [
      ...configDefaults.exclude,
      "tests/**",
      "**/tests/**",
      "**/*.e2e.{ts,tsx}",
      "**/*.pw.{ts,tsx}",
    ],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
        "**/*.stories.{ts,tsx}",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "storybook-static/",
        ".storybook/",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./src/assets"),
      "monaco-editor": path.resolve(__dirname, "./src/test/mocks/monaco-editor.ts"),
    },
  },
});
