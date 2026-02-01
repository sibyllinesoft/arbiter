/**
 * golangci-lint Module
 *
 * Sets up golangci-lint for Go projects.
 * The most comprehensive linter aggregator for Go.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: `{{projectDir}}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "golangci-lint - Fast Go linter aggregator";

export const dependencies = {};

export const devDependencies = {};

export const scripts = {
  "lint:go": "golangci-lint run",
  "lint:go:fix": "golangci-lint run --fix",
  "format:go": "gofmt -s -w .",
  "format:go:check": "test -z $(gofmt -l .)",
};

export const envVars = {};
