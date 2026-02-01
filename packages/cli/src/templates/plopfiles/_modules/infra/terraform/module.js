/**
 * Terraform Infrastructure Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: "{{projectDir}}/infra/terraform",
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Terraform infrastructure as code";

export const scripts = {
  "tf:init": "cd infra/terraform && terraform init",
  "tf:plan": "cd infra/terraform && terraform plan",
  "tf:apply": "cd infra/terraform && terraform apply",
  "tf:destroy": "cd infra/terraform && terraform destroy",
};
