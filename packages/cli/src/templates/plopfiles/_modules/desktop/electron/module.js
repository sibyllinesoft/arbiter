/**
 * Electron Desktop Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const desktopDir = data.desktopDir || "desktop";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${desktopDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Electron desktop application with TypeScript";

export const dependencies = {
  electron: "^28.0.0",
};

export const devDependencies = {
  "@electron-forge/cli": "^7.2.0",
  "@electron-forge/maker-deb": "^7.2.0",
  "@electron-forge/maker-rpm": "^7.2.0",
  "@electron-forge/maker-squirrel": "^7.2.0",
  "@electron-forge/maker-zip": "^7.2.0",
  "@electron-forge/plugin-auto-unpack-natives": "^7.2.0",
  "@electron-forge/plugin-vite": "^7.2.0",
  typescript: "^5.3.0",
};

export const scripts = {
  "dev:desktop": "cd desktop && electron-forge start",
  "build:desktop": "cd desktop && electron-forge make",
  "package:desktop": "cd desktop && electron-forge package",
};

export const envVars = {
  ELECTRON_IS_DEV: "1",
};
