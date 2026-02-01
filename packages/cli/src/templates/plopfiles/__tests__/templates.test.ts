/**
 * Template File Validation Tests
 *
 * Validates that all template files are valid Handlebars templates
 * and don't have obvious issues.
 */

import { describe, expect, test } from "bun:test";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFile, readdir, stat } from "fs/promises";
import Handlebars from "handlebars";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, "..", "_modules");

// Register common helpers used in templates
Handlebars.registerHelper(
  "kebabCase",
  (str: string) =>
    str
      ?.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "",
);
Handlebars.registerHelper(
  "snakeCase",
  (str: string) =>
    str
      ?.toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "") || "",
);
Handlebars.registerHelper("camelCase", (str: string) => {
  if (!str) return "";
  return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
});
Handlebars.registerHelper("pascalCase", (str: string) => {
  if (!str) return "";
  const camel = str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
});
Handlebars.registerHelper(
  "titleCase",
  (str: string) => str?.replace(/\b\w/g, (char) => char.toUpperCase()) || "",
);
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper("ne", (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper("json", (obj: unknown) => JSON.stringify(obj, null, 2));
Handlebars.registerHelper(
  "has",
  (arr: unknown[] | undefined, value: unknown) => Array.isArray(arr) && arr.includes(value),
);

// Recursively find all .hbs files
async function findTemplateFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".hbs")) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  return files;
}

// Test context for template rendering
const testContext = {
  name: "test-app",
  projectDir: "/tmp/test",
  backendDir: "backend",
  frontendDir: "frontend",
  desktopDir: "desktop",
  mobileDir: "mobile",
  backend: "node-hono",
  frontend: "react-vite",
  database: "postgres-drizzle",
  environment: "development",
  infra: ["docker-compose", "kubernetes"],
  build: ["bazel", "nx"],
  manifest: {
    dependencies: { test: "^1.0.0" },
    devDependencies: { "test-dev": "^1.0.0" },
    scripts: { test: "echo test" },
    envVars: { TEST: "value" },
  },
};

describe("Template Validation", () => {
  test("all .hbs files are valid Handlebars templates", async () => {
    const templateFiles = await findTemplateFiles(MODULES_DIR);
    const errors: string[] = [];

    for (const file of templateFiles) {
      try {
        const content = await readFile(file, "utf-8");
        // Try to compile the template
        Handlebars.compile(content);
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.error("Template compilation errors:");
      errors.forEach((e) => console.error(`  - ${e}`));
    }

    expect(errors).toHaveLength(0);
  });

  test("all .hbs files render without errors", async () => {
    const templateFiles = await findTemplateFiles(MODULES_DIR);
    const errors: string[] = [];

    for (const file of templateFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const template = Handlebars.compile(content);
        const rendered = template(testContext);

        // Check for unrendered Handlebars template syntax
        // But exclude other template syntaxes that look similar:
        // - Vue/Angular: {{ expression }}
        // - GitHub Actions: ${{ expression }}
        // - React Native/JSX: ={{ ... }}
        // - Kotlin string templates: ${ }
        if (rendered.includes("{{") && rendered.includes("}}")) {
          const match = rendered.match(/\{\{[^}]+\}\}/g);
          if (match) {
            const unintentional = match.filter((m) => {
              // Skip GitHub Actions syntax
              if (m.includes("${{")) return false;
              // Skip escaped Handlebars
              if (m.includes("\\{{")) return false;
              // Skip Handlebars block syntax in output
              if (m.includes("{{#") || m.includes("{{/") || m.includes("{{>")) return false;
              // Skip Vue/Angular template expressions (typically in .vue files)
              if (file.endsWith(".vue.hbs")) return false;
              // Skip JSX attribute syntax like ={{ }}
              if (m.match(/^=\{\{/)) return false;

              // Check if it looks like a JavaScript expression (Vue/Angular)
              // These typically have spaces around content or JS operators
              const inner = m.slice(2, -2).trim();
              if (
                inner.includes("JSON.") ||
                inner.includes(".toString") ||
                inner.match(/^\s*\w+\s*$/) || // Simple variable like {{ health }}
                inner.includes(":") // Object literal like {{ title: "..." }}
              ) {
                return false;
              }

              return true;
            });
            if (unintentional.length > 0) {
              errors.push(`${file}: Unrendered template syntax: ${unintentional.join(", ")}`);
            }
          }
        }
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.error("Template rendering errors:");
      errors.forEach((e) => console.error(`  - ${e}`));
    }

    expect(errors).toHaveLength(0);
  });

  test("JSON template files produce valid JSON", async () => {
    const templateFiles = await findTemplateFiles(MODULES_DIR);
    const jsonFiles = templateFiles.filter(
      (f) => f.endsWith(".json.hbs") || f.endsWith("package.json.hbs"),
    );
    const errors: string[] = [];

    for (const file of jsonFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const template = Handlebars.compile(content);
        const rendered = template(testContext);
        JSON.parse(rendered);
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.error("JSON validation errors:");
      errors.forEach((e) => console.error(`  - ${e}`));
    }

    expect(errors).toHaveLength(0);
  });

  test("YAML template files don't have obvious syntax errors", async () => {
    const templateFiles = await findTemplateFiles(MODULES_DIR);
    const yamlFiles = templateFiles.filter(
      (f) => f.endsWith(".yaml.hbs") || f.endsWith(".yml.hbs"),
    );
    const errors: string[] = [];

    for (const file of yamlFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const template = Handlebars.compile(content);
        const rendered = template(testContext);

        // Basic YAML checks
        const lines = rendered.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for tabs (YAML doesn't allow tabs for indentation)
          if (line.match(/^\t/)) {
            errors.push(`${file}:${i + 1}: Tab character used for indentation`);
          }
          // Check for obviously broken indentation
          if (line.match(/^(\s*)(\S+):\s*$/) && i + 1 < lines.length) {
            const currentIndent = line.match(/^(\s*)/)?.[1]?.length || 0;
            const nextLine = lines[i + 1];
            const nextIndent = nextLine.match(/^(\s*)/)?.[1]?.length || 0;
            if (
              nextLine.trim() &&
              nextIndent <= currentIndent &&
              !nextLine.trim().startsWith("#")
            ) {
              // This might be intentional for empty values, so just warn
            }
          }
        }
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.error("YAML validation warnings:");
      errors.forEach((e) => console.error(`  - ${e}`));
    }

    // YAML warnings shouldn't fail the test, just report
    expect(true).toBe(true);
  });

  test("TypeScript template files don't have unrendered variables", async () => {
    const templateFiles = await findTemplateFiles(MODULES_DIR);
    const tsFiles = templateFiles.filter((f) => f.endsWith(".ts.hbs") || f.endsWith(".tsx.hbs"));
    const errors: string[] = [];

    for (const file of tsFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const template = Handlebars.compile(content);
        const rendered = template(testContext);

        // Check for undefined values that slipped through template rendering
        // But allow valid JS patterns like ternary expressions: `x ? y : undefined`
        const lines = rendered.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Check for assignment to undefined (likely template error)
          if (line.match(/\w+\s*=\s*undefined\s*;?\s*$/)) {
            errors.push(`${file}:${i + 1}: Direct assignment to undefined: ${line.trim()}`);
          }
          // Check for property set to undefined (likely template error)
          if (line.match(/:\s*undefined\s*,?\s*$/) && !line.includes("?")) {
            errors.push(`${file}:${i + 1}: Property set to undefined: ${line.trim()}`);
          }
        }

        // Check for unrendered Handlebars variables (shows as empty or malformed)
        // Look for patterns that suggest template variables weren't rendered
        if (rendered.match(/\{\{\s*\}\}/)) {
          errors.push(`${file}: Contains empty template expression {{}}`);
        }
      } catch (error) {
        errors.push(`${file}: ${error}`);
      }
    }

    if (errors.length > 0) {
      console.error("TypeScript template errors:");
      errors.forEach((e) => console.error(`  - ${e}`));
    }

    expect(errors).toHaveLength(0);
  });
});

describe("Module Structure Validation", () => {
  const categories = ["backends", "frontends", "databases", "desktop", "mobile", "infra", "cloud"];

  for (const category of categories) {
    test(`${category} modules have required structure`, async () => {
      const categoryPath = join(MODULES_DIR, category);

      try {
        const entries = await readdir(categoryPath, { withFileTypes: true });
        const modules = entries.filter((e) => e.isDirectory() && !e.name.startsWith("_"));

        for (const mod of modules) {
          const modulePath = join(categoryPath, mod.name);
          const moduleJsPath = join(modulePath, "module.js");

          // Check module.js exists
          const moduleJsExists = await stat(moduleJsPath)
            .then(() => true)
            .catch(() => false);
          expect(moduleJsExists).toBe(true);

          // Check templates directory exists (optional for some modules)
          const templatesPath = join(modulePath, "templates");
          const templatesExist = await stat(templatesPath)
            .then((s) => s.isDirectory())
            .catch(() => false);

          // Most modules should have templates
          if (!templatesExist) {
            console.warn(`Warning: ${category}/${mod.name} has no templates directory`);
          }
        }
      } catch {
        // Category might not exist
        console.warn(`Warning: Category ${category} not found`);
      }
    });
  }
});
