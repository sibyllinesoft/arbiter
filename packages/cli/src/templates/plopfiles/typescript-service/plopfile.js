/**
 * Plop Generator for TypeScript Services
 *
 * Generates a TypeScript service with Express/Hono structure.
 */

export default function (plop) {
  // Case helpers
  plop.setHelper("camelCase", (str) => {
    if (!str) return "";
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^(.)/, (c) => c.toLowerCase());
  });

  plop.setHelper("pascalCase", (str) => {
    if (!str) return "";
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^(.)/, (c) => c.toUpperCase());
  });

  plop.setHelper("kebabCase", (str) => {
    if (!str) return "";
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[_\s]+/g, "-")
      .toLowerCase();
  });

  plop.setHelper("snakeCase", (str) => {
    if (!str) return "";
    return str
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[-\s]+/g, "_")
      .toLowerCase();
  });

  // Default generator
  plop.setGenerator("default", {
    description: "Generate a TypeScript service",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Service name:",
        when: (answers) => !answers.name,
      },
      {
        type: "list",
        name: "framework",
        message: "Framework:",
        choices: ["hono", "express", "fastify"],
        default: "hono",
        when: (answers) => !answers.framework,
      },
      {
        type: "confirm",
        name: "includeDb",
        message: "Include database setup?",
        default: true,
        when: (answers) => answers.includeDb === undefined,
      },
    ],
    actions: (data) => {
      const actions = [];
      const basePath = "{{kebabCase name}}";

      // Package.json
      actions.push({
        type: "add",
        path: `${basePath}/package.json`,
        templateFile: "templates/package.json.hbs",
      });

      // Main entry
      actions.push({
        type: "add",
        path: `${basePath}/src/index.ts`,
        templateFile: "templates/index.ts.hbs",
      });

      // Routes
      actions.push({
        type: "add",
        path: `${basePath}/src/routes/index.ts`,
        templateFile: "templates/routes/index.ts.hbs",
      });

      // Health route
      actions.push({
        type: "add",
        path: `${basePath}/src/routes/health.ts`,
        templateFile: "templates/routes/health.ts.hbs",
      });

      // Config
      actions.push({
        type: "add",
        path: `${basePath}/src/config.ts`,
        templateFile: "templates/config.ts.hbs",
      });

      // Types
      actions.push({
        type: "add",
        path: `${basePath}/src/types.ts`,
        templateFile: "templates/types.ts.hbs",
      });

      // Database setup if requested
      if (data.includeDb) {
        actions.push({
          type: "add",
          path: `${basePath}/src/db/index.ts`,
          templateFile: "templates/db/index.ts.hbs",
        });
        actions.push({
          type: "add",
          path: `${basePath}/src/db/schema.ts`,
          templateFile: "templates/db/schema.ts.hbs",
        });
      }

      // Dockerfile
      actions.push({
        type: "add",
        path: `${basePath}/Dockerfile`,
        templateFile: "templates/Dockerfile.hbs",
      });

      // TypeScript config
      actions.push({
        type: "add",
        path: `${basePath}/tsconfig.json`,
        templateFile: "templates/tsconfig.json.hbs",
      });

      // README
      actions.push({
        type: "add",
        path: `${basePath}/README.md`,
        templateFile: "templates/README.md.hbs",
      });

      return actions;
    },
  });

  // Component generator
  plop.setGenerator("component", {
    description: "Generate a service component (route, middleware, etc.)",
    prompts: [
      {
        type: "list",
        name: "type",
        message: "Component type:",
        choices: ["route", "middleware", "service", "model"],
      },
      {
        type: "input",
        name: "name",
        message: "Component name:",
      },
    ],
    actions: (data) => {
      const actions = [];
      const folder =
        data.type === "route"
          ? "routes"
          : data.type === "middleware"
            ? "middleware"
            : data.type === "model"
              ? "db"
              : "services";

      actions.push({
        type: "add",
        path: `src/${folder}/{{kebabCase name}}.ts`,
        templateFile: `templates/component/${data.type}.ts.hbs`,
      });

      return actions;
    },
  });
}
