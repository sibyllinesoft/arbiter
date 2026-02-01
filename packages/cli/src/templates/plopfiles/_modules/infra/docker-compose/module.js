/**
 * Docker Compose Infrastructure Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const actions = [
    {
      type: "add",
      path: "{{projectDir}}/docker-compose.yml",
      templateFile: `${templatesDir}/docker-compose.yml.hbs`,
      data,
    },
  ];

  // Add Dockerfiles based on selected stack
  if (data.backend && data.backend !== "none") {
    actions.push({
      type: "add",
      path: `{{projectDir}}/{{backendDir}}/Dockerfile`,
      templateFile: `${templatesDir}/Dockerfile.backend.hbs`,
      data,
      skipIfExists: true,
    });
  }

  if (data.frontend && data.frontend !== "none") {
    actions.push({
      type: "add",
      path: `{{projectDir}}/{{frontendDir}}/Dockerfile`,
      templateFile: `${templatesDir}/Dockerfile.frontend.hbs`,
      data,
      skipIfExists: true,
    });
  }

  return actions;
}

export const description = "Docker Compose configuration for local development";

export const scripts = {
  "docker:up": "docker-compose up -d",
  "docker:down": "docker-compose down",
  "docker:logs": "docker-compose logs -f",
  "docker:build": "docker-compose build",
};
