/**
 * Just Command Runner Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "add",
      path: "{{projectDir}}/justfile",
      templateFile: `${templatesDir}/justfile.hbs`,
      data,
    },
  ];
}

export const description = "Just command runner recipes";

export const scripts = {
  just: "just",
};
