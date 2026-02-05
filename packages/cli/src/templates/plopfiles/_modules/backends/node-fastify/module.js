/**
 * Node.js + Fastify Backend Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const backendDir = data.backendDir || "backend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${backendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Node.js backend with Fastify framework";

export const dependencies = {
  fastify: "^4.25.0",
  "@fastify/cors": "^9.0.0",
  "@fastify/helmet": "^11.1.0",
  "@fastify/rate-limit": "^9.0.0",
};

export const devDependencies = {
  "@types/node": "^20.0.0",
  typescript: "^5.0.0",
  tsx: "^4.15.6",
  vitest: "^1.2.0",
  eslint: "^8.57.1",
  "@typescript-eslint/parser": "^7.18.0",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
};

export const scripts = {
  "dev:backend": "tsx watch backend/src/index.ts",
  "build:backend": "tsc -p backend/tsconfig.json",
  "start:backend": "node backend/dist/index.js",
  "test:backend": "vitest run backend",
  "lint:backend": 'eslint "backend/src/**/*.ts"',
};

export const envVars = {
  PORT: "3000",
  NODE_ENV: "development",
};
