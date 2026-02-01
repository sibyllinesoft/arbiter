/**
 * AWS Cloud Module
 *
 * Provides AWS-specific configuration and Terraform resources.
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

export const description = "AWS cloud resources (ECS, RDS, S3, etc.)";

export const envVars = {
  AWS_REGION: "us-east-1",
  AWS_PROFILE: "default",
};

export const requires = ["infra/terraform"];
