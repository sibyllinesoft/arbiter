/**
 * Go + Chi Backend Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const backendDir = data.backendDir || "backend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${backendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Go backend with Chi router";

export const scripts = {
  "dev:backend": "cd backend && air",
  "build:backend": "cd backend && go build -o bin/server ./cmd/server",
  "start:backend": "cd backend && ./bin/server",
  "test:backend": "cd backend && go test ./...",
  "lint:backend": "cd backend && golangci-lint run",
  "lint:backend:fix": "cd backend && golangci-lint run --fix",
  "format:backend": "cd backend && gofmt -s -w .",
  "docs:backend": "cd backend && godoc -http=:6060",
};

export const envVars = {
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/{{snakeCase name}}",
  GO_ENV: "development",
};
