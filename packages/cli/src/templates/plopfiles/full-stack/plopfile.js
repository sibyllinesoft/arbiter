/**
 * Full-Stack Project Composer
 *
 * Interactive plopfile that composes multiple modules (backend, frontend, database, infra)
 * into a complete project scaffold.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { composeModules, getModuleChoices } from "../_modules/composer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (plop) {
  plop.setGenerator("full-stack", {
    description: "Create a full-stack project with customizable tech stack",
    prompts: async (inquirer) => {
      const choices = await getModuleChoices();

      return inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Project name:",
          validate: (input) => (input ? true : "Project name is required"),
        },
        {
          type: "list",
          name: "backend",
          message: "Backend framework:",
          choices: choices.backends.length > 0 ? choices.backends : ["none"],
          default: choices.backends[0] || "none",
        },
        {
          type: "list",
          name: "frontend",
          message: "Frontend framework:",
          choices: choices.frontends,
          default: "none",
        },
        {
          type: "list",
          name: "database",
          message: "Database:",
          choices: choices.databases,
          default: "none",
        },
        {
          type: "checkbox",
          name: "infra",
          message: "Infrastructure (select multiple):",
          choices: choices.infra.length > 0 ? choices.infra : [],
        },
        {
          type: "input",
          name: "backendDir",
          message: "Backend directory name:",
          default: "backend",
          when: (answers) => answers.backend !== "none",
        },
        {
          type: "input",
          name: "frontendDir",
          message: "Frontend directory name:",
          default: "frontend",
          when: (answers) => answers.frontend !== "none",
        },
      ]);
    },
    actions: async (data) => {
      const context = {
        ...data,
        projectDir: process.cwd(),
      };

      const { actions, manifest } = await composeModules(
        {
          backend: data.backend,
          frontend: data.frontend,
          database: data.database,
          infra: data.infra || [],
        },
        context,
      );

      // Add root package.json
      actions.push({
        type: "add",
        path: "{{projectDir}}/package.json",
        templateFile: `${templatesDir}/package.json.hbs`,
        data: { ...context, manifest },
        skipIfExists: true,
      });

      // Add root .env.example
      if (Object.keys(manifest.envVars).length > 0) {
        actions.push({
          type: "add",
          path: "{{projectDir}}/.env.example",
          template:
            Object.entries(manifest.envVars)
              .map(([k, v]) => `${k}=${v}`)
              .join("\n") + "\n",
          skipIfExists: true,
        });
      }

      // Add .gitignore
      actions.push({
        type: "add",
        path: "{{projectDir}}/.gitignore",
        templateFile: `${templatesDir}/gitignore.hbs`,
        skipIfExists: true,
      });

      // Log the composed modules
      actions.push({
        type: "log",
        message: `\n✓ Created project "${data.name}" with modules:\n  ${manifest.modules.join("\n  ")}\n`,
      });

      return actions;
    },
  });

  // Custom log action type
  plop.setActionType("log", (answers, config) => {
    console.log(config.message);
    return config.message;
  });
}
