/**
 * CLI Tool Preset - Go
 *
 * Initializes .arbiter/ directory for a Go CLI tool or library.
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
        presetId: "cli-go",
        language: "go",
      },
    },
    {
      type: "add",
      path: "{{projectDir}}/.arbiter/config.json",
      templateFile: `${templatesDir}/config.json.hbs`,
      data: {
        ...data,
        presetId: "cli-go",
        language: "go",
      },
    },
  ];
}

export const id = "cli-go";
export const name = "CLI Tool (Go)";
export const description = "Command-line tool or library using Go";
export const language = "go";
export const category = "cli";
