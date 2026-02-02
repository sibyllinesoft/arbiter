/**
 * CLI Tool Preset - Rust
 *
 * Initializes .arbiter/ directory for a Rust CLI tool or library.
 * Creates minimal structure - use `arbiter sync` to detect packages.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/README.md",
      templateFile: `${templatesDir}/README.md.hbs`,
      data: {
        ...data,
        presetId: "cli-rust",
        language: "rust",
      },
    },
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/config.json",
      templateFile: `${templatesDir}/config.json.hbs`,
      data: {
        ...data,
        presetId: "cli-rust",
        language: "rust",
      },
    },
  ];
}

export const id = "cli-rust";
export const name = "CLI Tool (Rust)";
export const description = "Command-line tool or library using Rust";
export const language = "rust";
export const category = "cli";
