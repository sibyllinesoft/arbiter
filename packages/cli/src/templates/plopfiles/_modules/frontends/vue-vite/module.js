/**
 * Vue + Vite Frontend Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const frontendDir = data.frontendDir || "frontend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${frontendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Vue 3 frontend with Vite, TypeScript, and Tailwind CSS";

export const dependencies = {
  vue: "^3.4.0",
  "vue-router": "^4.2.0",
  pinia: "^2.1.0",
  "@tanstack/vue-query": "^5.0.0",
};

export const devDependencies = {
  "@vitejs/plugin-vue": "^5.0.0",
  "@vue/tsconfig": "^0.5.0",
  "vue-tsc": "^1.8.0",
  autoprefixer: "^10.4.0",
  postcss: "^8.4.0",
  tailwindcss: "^3.4.0",
  typescript: "^5.3.0",
  vite: "^5.0.0",
};

export const scripts = {
  "dev:frontend": "vite --config frontend/vite.config.ts",
  "build:frontend": "vue-tsc && vite build --config frontend/vite.config.ts",
  "preview:frontend": "vite preview --config frontend/vite.config.ts",
};

export const envVars = {
  VITE_API_URL: "http://localhost:3000",
};
