/**
 * Biome Linting & Formatting Module
 *
 * Sets up Biome for JavaScript/TypeScript projects.
 * Biome is a fast, modern alternative to ESLint + Prettier.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: `{{projectDir}}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Biome - Fast linter and formatter for JavaScript/TypeScript";

export const dependencies = {};

export const devDependencies = {
  "@biomejs/biome": "^1.9.0",
};

export const scripts = {
  lint: "biome lint .",
  "lint:fix": "biome lint --write .",
  format: "biome format --write .",
  "format:check": "biome format .",
  check: "biome check .",
  "check:fix": "biome check --write .",
};

export const envVars = {};
