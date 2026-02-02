/**
 * CLI Tool Preset - Node.js/TypeScript
 *
 * Initializes .arbiter/ directory for a Node.js CLI tool or library.
 * Creates minimal structure - use `arbiter sync` to detect packages.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    // Create .arbiter/README.md
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/README.md",
      templateFile: `${templatesDir}/README.md.hbs`,
      data: {
        ...data,
        presetId: "cli-node",
        language: "typescript",
      },
    },
    // Create .arbiter/config.json
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/config.json",
      templateFile: `${templatesDir}/config.json.hbs`,
      data: {
        ...data,
        presetId: "cli-node",
        language: "typescript",
      },
    },
  ];
}

export const id = "cli-node";
export const name = "CLI Tool (Node.js/TypeScript)";
export const description = "Command-line tool or library using Node.js/TypeScript/Bun";
export const language = "typescript";
export const category = "cli";
