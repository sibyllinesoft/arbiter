/**
 * Kotlin + Ktor Backend Module
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

export const description = "Kotlin backend with Ktor framework";

export const scripts = {
  "dev:backend": "cd backend && ./gradlew run --continuous",
  "build:backend": "cd backend && ./gradlew build",
  "start:backend": "cd backend && ./gradlew run",
  "test:backend": "cd backend && ./gradlew test",
};

export const envVars = {
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/{{snakeCase name}}",
};
