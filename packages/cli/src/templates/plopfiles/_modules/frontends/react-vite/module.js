/**
 * React + Vite Frontend Module
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

export const description = "React frontend with Vite, TypeScript, and Tailwind CSS";

export const dependencies = {
  react: "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "@tanstack/react-query": "^5.0.0",
};

export const devDependencies = {
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "@vitejs/plugin-react": "^4.2.0",
  autoprefixer: "^10.4.0",
  postcss: "^8.4.0",
  tailwindcss: "^3.4.0",
  typescript: "^5.3.0",
  vite: "^5.0.0",
  "@biomejs/biome": "^1.9.0",
  typedoc: "^0.27.0",
};

export const scripts = {
  "dev:frontend": "vite --config frontend/vite.config.ts",
  "build:frontend": "vite build --config frontend/vite.config.ts",
  "preview:frontend": "vite preview --config frontend/vite.config.ts",
  "lint:frontend": "biome check frontend",
  "lint:frontend:fix": "biome check --write frontend",
  "test:frontend": "vitest run --config frontend/vite.config.ts",
  "docs:frontend": "typedoc --out docs/api/frontend frontend/src",
};

export const envVars = {
  VITE_API_URL: "http://localhost:3000",
};
