/**
 * Clippy & Rustfmt Module
 *
 * Sets up Clippy linting and Rustfmt formatting for Rust projects.
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

export const description = "Clippy & Rustfmt - Rust linting and formatting";

export const dependencies = {};

export const devDependencies = {};

export const scripts = {
  "lint:rust": "cargo clippy --all-targets --all-features -- -D warnings",
  "lint:rust:fix": "cargo clippy --fix --allow-dirty --allow-staged",
  "format:rust": "cargo fmt",
  "format:rust:check": "cargo fmt -- --check",
  "check:rust": "cargo check --all-targets --all-features",
};

export const envVars = {};
