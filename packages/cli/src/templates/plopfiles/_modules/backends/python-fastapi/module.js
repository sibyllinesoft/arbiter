/**
 * Python + FastAPI Backend Module
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

export const description = "Python backend with FastAPI and async support";

export const dependencies = {};

export const devDependencies = {};

export const scripts = {
  "dev:backend": "cd backend && uvicorn app.main:app --reload --port 3000",
  "start:backend": "cd backend && uvicorn app.main:app --host 0.0.0.0 --port 3000",
  "test:backend": "cd backend && pytest",
  "lint:backend": "cd backend && ruff check .",
  "lint:backend:fix": "cd backend && ruff check --fix .",
  "format:backend": "cd backend && ruff format .",
  "typecheck:backend": "cd backend && mypy app",
  "docs:backend": "cd backend && pdoc --html --output-dir ../docs/api/backend app",
};

export const envVars = {
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/{{snakeCase name}}",
  SECRET_KEY: "change-me-in-production",
};

export const pythonDependencies = {
  fastapi: "^0.109.0",
  uvicorn: "^0.27.0",
  pydantic: "^2.5.0",
  "pydantic-settings": "^2.1.0",
  "python-dotenv": "^1.0.0",
  httpx: "^0.26.0",
};

export const pythonDevDependencies = {
  pytest: "^8.3.0",
  "pytest-asyncio": "^0.24.0",
  "pytest-cov": "^6.0.0",
  ruff: "^0.8.0",
  mypy: "^1.13.0",
  pdoc: "^15.0.0",
};
