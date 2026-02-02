/**
 * CLI Tool Preset - Python
 *
 * Initializes .arbiter/ directory for a Python CLI tool or library.
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
        presetId: "cli-python",
        language: "python",
      },
    },
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/config.json",
      templateFile: `${templatesDir}/config.json.hbs`,
      data: {
        ...data,
        presetId: "cli-python",
        language: "python",
      },
    },
  ];
}

export const id = "cli-python";
export const name = "CLI Tool (Python)";
export const description = "Command-line tool or library using Python";
export const language = "python";
export const category = "cli";
