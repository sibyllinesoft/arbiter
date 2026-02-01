/**
 * Pulumi Infrastructure Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: "{{projectDir}}/infra/pulumi",
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Pulumi infrastructure as code (TypeScript)";

export const scripts = {
  "pulumi:preview": "cd infra/pulumi && pulumi preview",
  "pulumi:up": "cd infra/pulumi && pulumi up",
  "pulumi:destroy": "cd infra/pulumi && pulumi destroy",
};
