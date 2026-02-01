/**
 * PostgreSQL + Drizzle ORM Module
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
      destination: `{{projectDir}}/${backendDir}/src/db`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
    // Add drizzle config to backend root
    {
      type: "add",
      path: `{{projectDir}}/${backendDir}/drizzle.config.ts`,
      templateFile: `${templatesDir}/../drizzle.config.ts.hbs`,
    },
  ];
}

export const description = "PostgreSQL database with Drizzle ORM";

export const dependencies = {
  "drizzle-orm": "^0.29.0",
  postgres: "^3.4.0",
};

export const devDependencies = {
  "drizzle-kit": "^0.20.0",
};

export const scripts = {
  "db:generate": "drizzle-kit generate:pg --config backend/drizzle.config.ts",
  "db:push": "drizzle-kit push:pg --config backend/drizzle.config.ts",
  "db:studio": "drizzle-kit studio --config backend/drizzle.config.ts",
};

export const envVars = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/{{snakeCase name}}",
};

export const requires = ["backends/*"];
