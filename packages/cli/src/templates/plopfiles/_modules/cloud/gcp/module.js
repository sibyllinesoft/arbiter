/**
 * Google Cloud Platform Module
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

export const description = "GCP cloud resources (Cloud Run, Cloud SQL, GCS, etc.)";

export const envVars = {
  GCP_PROJECT: "your-project-id",
  GCP_REGION: "us-central1",
};

export const requires = ["infra/terraform"];
