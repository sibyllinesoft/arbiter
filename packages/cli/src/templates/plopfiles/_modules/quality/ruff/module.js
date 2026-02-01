/**
 * Ruff Linting & Formatting Module
 *
 * Sets up Ruff for Python projects.
 * Ruff is an extremely fast Python linter and formatter.
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

export const description = "Ruff - Extremely fast Python linter and formatter";

export const dependencies = {};

export const devDependencies = {};

export const scripts = {
  "lint:python": "ruff check .",
  "lint:python:fix": "ruff check --fix .",
  "format:python": "ruff format .",
  "format:python:check": "ruff format --check .",
};

export const envVars = {};

// Python dev dependencies
export const pythonDevDependencies = ["ruff>=0.8.0", "mypy>=1.13.0"];
