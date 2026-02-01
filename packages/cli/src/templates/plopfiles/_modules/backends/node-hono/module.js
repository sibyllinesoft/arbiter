/**
 * Node.js + Hono Backend Module
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

export const description = "Node.js backend with Hono framework and Bun runtime";

export const dependencies = {
  hono: "^4.0.0",
  "@hono/node-server": "^1.8.0",
  "@hono/zod-validator": "^0.2.0",
  zod: "^3.22.0",
};

export const devDependencies = {
  "@types/bun": "latest",
  typescript: "^5.3.0",
  "@biomejs/biome": "^1.9.0",
  typedoc: "^0.27.0",
  "typedoc-plugin-markdown": "^4.2.0",
};

export const scripts = {
  "dev:backend": "bun run --watch backend/src/index.ts",
  "build:backend": "bun build backend/src/index.ts --outdir dist/backend --target node",
  "start:backend": "bun run dist/backend/index.js",
  "test:backend": "bun test backend",
  "lint:backend": "biome check backend",
  "lint:backend:fix": "biome check --write backend",
  "docs:backend": "typedoc --out docs/api/backend backend/src",
};

export const envVars = {
  PORT: "3000",
  NODE_ENV: "development",
};
