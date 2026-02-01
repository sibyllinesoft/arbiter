/**
 * Azure Cloud Module
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

export const description = "Azure cloud resources (Container Apps, SQL, Storage, etc.)";

export const envVars = {
  ARM_SUBSCRIPTION_ID: "your-subscription-id",
  AZURE_REGION: "eastus",
};

export const requires = ["infra/terraform"];
