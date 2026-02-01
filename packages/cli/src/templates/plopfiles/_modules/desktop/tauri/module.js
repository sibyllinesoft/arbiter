/**
 * Tauri Desktop Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: "{{projectDir}}",
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Tauri desktop application (Rust + Web frontend)";

export const devDependencies = {
  "@tauri-apps/cli": "^1.5.0",
  "@tauri-apps/api": "^1.5.0",
};

export const scripts = {
  "dev:desktop": "tauri dev",
  "build:desktop": "tauri build",
};

export const envVars = {
  TAURI_DEBUG: "1",
};
