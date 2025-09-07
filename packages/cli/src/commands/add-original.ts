/**
 * Add command - Compositional interface for building specifications
 *
 * This command allows users to incrementally build up their arbiter.assembly.cue
 * specification through discrete, validated operations rather than editing files directly.
 */

import fs from "fs-extra";
import * as path from "node:path";
import chalk from "chalk";
import type { CLIConfig } from "../types.js";
import { templateManager, extractVariablesFromCue } from "../templates/index.js";

export interface AddOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  template?: string;
}

/**
 * Main add command dispatcher
 */
export async function addCommand(
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  _config: CLIConfig,
): Promise<number> {
  try {
    console.log(chalk.blue(`🔧 Adding ${subcommand}: ${name}`));

    // Ensure we have an assembly file to work with
    const assemblyPath = path.resolve("arbiter.assembly.cue");
    let assemblyContent = "";

    if (fs.existsSync(assemblyPath)) {
      assemblyContent = fs.readFileSync(assemblyPath, "utf-8");
    } else {
      // Initialize with basic structure
      console.log(chalk.yellow("⚠️  No arbiter.assembly.cue found. Creating new specification..."));
      assemblyContent = await initializeAssembly();
    }

    let updatedContent = assemblyContent;

    // Route to appropriate handler
    switch (subcommand) {
      case "service":
        updatedContent = await addService(assemblyContent, name, options);
        break;
      case "endpoint":
        updatedContent = await addEndpoint(assemblyContent, name, options);
        break;
      case "route":
        updatedContent = await addRoute(assemblyContent, name, options);
        break;
      case "flow":
        updatedContent = await addFlow(assemblyContent, name, options);
        break;
      case "load-balancer":
        updatedContent = await addLoadBalancer(assemblyContent, options);
        break;
      case "database":
        updatedContent = await addDatabase(assemblyContent, name, options);
        break;
      case "cache":
        updatedContent = await addCache(assemblyContent, name, options);
        break;
      case "locator":
        updatedContent = await addLocator(assemblyContent, name, options);
        break;
      case "schema":
        updatedContent = await addSchema(assemblyContent, name, options);
        break;
      default:
        console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
        console.log(
          chalk.dim(
            "Available subcommands: service, endpoint, route, flow, load-balancer, database, cache, locator, schema",
          ),
        );
        return 1;
    }

    // Validate the updated content
    const validationResult = await validateAssembly(updatedContent);
    if (!validationResult.valid) {
      console.error(chalk.red("❌ Validation failed:"));
      validationResult.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      return 1;
    }

    // Write or preview the changes
    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - changes that would be made:"));
      console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
    } else {
      fs.writeFileSync(assemblyPath, updatedContent);
      console.log(chalk.green(`✅ Updated ${path.basename(assemblyPath)}`));

      if (options.verbose) {
        console.log(chalk.dim("Added configuration:"));
        console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
      }
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("❌ Failed to add component:"));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Initialize a new assembly file with basic structure
 */
async function initializeAssembly(): Promise<string> {
  const projectName = path.basename(process.cwd());

  return `package ${projectName.replace(/[^a-zA-Z0-9]/g, "")}

// Auto-generated arbiter.assembly.cue
// Build your specification incrementally with: arbiter add <component>

product: {
  name: "${toTitleCase(projectName)}"
  goals: ["Application goals will be defined here"]
}

ui: routes: []

locators: {}

flows: []

// V1 compatibility structure
config: {
  language: "typescript"
  kind: "service"
}

metadata: {
  name: "${projectName}"
  version: "1.0.0"
}

deployment: {
  target: "kubernetes"
}

services: {}
`;
}

/**
 * Add a service using a template
 */
async function addServiceWithTemplate(
  content: string,
  serviceName: string,
  options: {
    language?: string;
    port?: number;
    image?: string;
    directory?: string;
    template?: string;
    [key: string]: any;
  },
): Promise<string> {
  const { template, directory = `./src/${serviceName}` } = options;

  if (!template) {
    throw new Error("Template name is required for template-based generation");
  }

  try {
    // Load template manager configuration
    await templateManager.loadConfig();

    // Check if template alias exists
    const alias = templateManager.getAlias(template);
    if (!alias) {
      const availableTemplates = Object.keys(templateManager.getAliases());
      throw new Error(
        `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
      );
    }

    console.log(chalk.blue(`🔧 Generating service '${serviceName}' using template '${template}'`));

    // Extract variables from CUE content
    const variables = extractVariablesFromCue(content, serviceName);

    // Add service-specific variables
    variables.serviceName = serviceName;
    if (options.language) variables.language = options.language;
    if (options.port) variables.port = options.port;

    // Ensure target directory exists
    await fs.ensureDir(path.resolve(directory));

    // Execute template
    await templateManager.executeTemplate(template, path.resolve(directory), variables);

    console.log(chalk.green(`✅ Template '${template}' applied successfully to '${directory}'`));

    // Now update the CUE specification with the service definition
    const serviceConfig = generateBespokeServiceConfig(
      serviceName,
      options.language || "typescript",
      options.port,
      directory,
    );
    let updatedContent = insertIntoSection(content, "services", serviceName, serviceConfig.v1);

    // Add template reference to the service config
    updatedContent = insertIntoServiceSection(
      updatedContent,
      serviceName,
      "template",
      `"${template}"`,
    );

    // If this creates a UI service, add route to v2 structure
    if (
      !options.image &&
      (options.language === "typescript" || options.language === "javascript")
    ) {
      const routeConfig = {
        id: `${serviceName}:main`,
        path: options.port === 3000 ? "/" : `/${serviceName}`,
        capabilities: ["view"],
        components: [`${toTitleCase(serviceName)}Page`],
      };
      updatedContent = appendToArray(updatedContent, "ui: routes", routeConfig);

      // Add basic locator
      const locatorKey = `page:${serviceName}`;
      const locatorValue = `[data-testid="${serviceName}-page"]`;
      updatedContent = insertIntoSection(
        updatedContent,
        "locators",
        locatorKey,
        `"${locatorValue}"`,
      );
    }

    return updatedContent;
  } catch (error) {
    throw new Error(
      `Template generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Add a service to the specification
 */
async function addService(
  content: string,
  serviceName: string,
  options: {
    language?: string;
    port?: number;
    image?: string;
    directory?: string;
    template?: string;
    [key: string]: any;
  },
): Promise<string> {
  const { language = "typescript", port, image, directory, template } = options;

  // If template is specified, use template-based generation
  if (template) {
    return await addServiceWithTemplate(content, serviceName, options);
  }

  // Determine service type
  const isPrebuilt = !!image;
  const serviceConfig = isPrebuilt
    ? generatePrebuiltServiceConfig(serviceName, image!, port)
    : generateBespokeServiceConfig(serviceName, language, port, directory);

  // Insert service into both v1 and v2 structures
  let updatedContent = content;

  // Add to v1 services section
  updatedContent = insertIntoSection(updatedContent, "services", serviceName, serviceConfig.v1);

  // If this creates a UI service, add route to v2 structure
  if (!isPrebuilt && (language === "typescript" || language === "javascript")) {
    const routeConfig = {
      id: `${serviceName}:main`,
      path: port === 3000 ? "/" : `/${serviceName}`,
      capabilities: ["view"],
      components: [`${toTitleCase(serviceName)}Page`],
    };
    updatedContent = appendToArray(updatedContent, "ui: routes", routeConfig);

    // Add basic locator
    const locatorKey = `page:${serviceName}`;
    const locatorValue = `[data-testid="${serviceName}-page"]`;
    updatedContent = insertIntoSection(updatedContent, "locators", locatorKey, `"${locatorValue}"`);
  }

  return updatedContent;
}

/**
 * Add an API endpoint to a service
 */
async function addEndpoint(
  content: string,
  endpoint: string,
  options: {
    service?: string;
    method?: string;
    returns?: string;
    accepts?: string;
    [key: string]: any;
  },
): Promise<string> {
  const { service = "api", method = "GET", returns, accepts } = options;

  // Ensure the service exists
  if (!content.includes(`${service}:`)) {
    throw new Error(
      `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
    );
  }

  // Add health check validation for health endpoints
  if (endpoint === "/health" || endpoint.endsWith("/health")) {
    const healthConfig = `
    healthCheck: {
      path: "${endpoint}"
      port: 3000
    }`;
    content = insertIntoServiceSection(content, service, "healthCheck", healthConfig);
  }

  // Add to v2 paths structure for API documentation
  const pathConfig = generatePathConfig(method, returns, accepts);
  content = insertIntoSection(content, "paths", `"${endpoint}"`, pathConfig);

  return content;
}

/**
 * Add a UI route (v2 schema)
 */
async function addRoute(
  content: string,
  routePath: string,
  options: { id?: string; capabilities?: string; components?: string; [key: string]: any },
): Promise<string> {
  const routeId = options.id || generateRouteId(routePath);
  const capabilities = options.capabilities ? options.capabilities.split(",") : ["view"];
  const components = options.components ? options.components.split(",") : [];

  const routeConfig = {
    id: routeId,
    path: routePath,
    capabilities,
    ...(components.length > 0 && { components }),
  };

  return appendToArray(content, "ui: routes", routeConfig);
}

/**
 * Add a user flow for testing
 */
async function addFlow(
  content: string,
  flowId: string,
  options: {
    from?: string;
    to?: string;
    endpoint?: string;
    expect?: string;
    steps?: string;
    [key: string]: any;
  },
): Promise<string> {
  const { from, to, endpoint, expect: expectedStatus = "200", steps } = options;

  let flowSteps = [];

  if (steps) {
    // Parse custom steps (JSON format expected)
    try {
      flowSteps = JSON.parse(steps);
    } catch {
      throw new Error("Invalid steps format. Expected JSON array.");
    }
  } else if (from && to) {
    // Generate navigation flow
    flowSteps = [
      { visit: from },
      { click: `btn:goto-${to}` },
      { expect: { locator: `page:${to}`, state: "visible" } },
    ];
  } else if (endpoint) {
    // Generate API health check flow
    flowSteps = [
      { expect_api: { method: "GET", path: endpoint, status: parseInt(expectedStatus) } },
    ];
  } else {
    throw new Error("Flow must specify either --from/--to, --endpoint, or --steps");
  }

  const flowConfig = {
    id: flowId,
    steps: flowSteps,
  };

  return appendToArray(content, "flows", flowConfig);
}

/**
 * Add load balancer with health check invariants
 */
async function addLoadBalancer(
  content: string,
  options: { target?: string; healthCheck?: string; [key: string]: any },
): Promise<string> {
  const { target, healthCheck = "/health" } = options;

  if (!target) {
    throw new Error("Load balancer requires --target service");
  }

  // Ensure target service exists and has health endpoint
  if (!content.includes(`${target}:`)) {
    throw new Error(`Target service "${target}" not found`);
  }

  // Add load balancer service
  const lbConfig = {
    language: "container",
    type: "deployment",
    image: "nginx:alpine",
    ports: [{ name: "http", port: 80, targetPort: 80 }],
    config: {
      files: [
        {
          name: "nginx.conf",
          content: generateNginxConfig(target, healthCheck),
        },
      ],
    },
  };

  // Ensure target has health check
  content = ensureServiceHealthCheck(content, target, healthCheck);
  content = insertIntoSection(content, "services", "loadbalancer", lbConfig);

  return content;
}

/**
 * Add database with automatic service attachment
 */
async function addDatabase(
  content: string,
  dbName: string,
  options: {
    attachTo?: string;
    image?: string;
    port?: number;
    template?: string;
    [key: string]: any;
  },
): Promise<string> {
  const { attachTo, image = "postgres:15", port = 5432, template } = options;

  // If template is specified, use template-based generation
  if (template) {
    try {
      await templateManager.loadConfig();

      const alias = templateManager.getAlias(template);
      if (!alias) {
        const availableTemplates = Object.keys(templateManager.getAliases());
        throw new Error(
          `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
        );
      }

      console.log(chalk.blue(`🔧 Generating database '${dbName}' using template '${template}'`));

      // Extract variables from CUE content
      const variables = extractVariablesFromCue(content);
      variables.databaseName = dbName;
      variables.attachTo = attachTo;
      variables.image = image;
      variables.port = port;

      // Execute template for database setup (could include migration files, configs, etc.)
      const targetDir = `./database/${dbName}`;
      await templateManager.executeTemplate(template, path.resolve(targetDir), variables);

      console.log(chalk.green(`✅ Database template '${template}' applied to '${targetDir}'`));
    } catch (error) {
      throw new Error(
        `Database template generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const dbConfig = {
    serviceType: "prebuilt",
    language: "container",
    type: "statefulset",
    image,
    ports: [{ name: "db", port, targetPort: port }],
    volumes: [
      {
        name: "data",
        path: image.includes("postgres") ? "/var/lib/postgresql/data" : "/var/lib/mysql",
        size: "50Gi",
        type: "persistentVolumeClaim",
      },
    ],
    env: generateDbEnvVars(image, dbName),
  };

  content = insertIntoSection(content, "services", dbName, dbConfig);

  // If attaching to a service, add connection env vars
  if (attachTo) {
    const connectionString = generateDbConnectionString(image, dbName, port);
    content = insertIntoServiceSection(
      content,
      attachTo,
      "env.DATABASE_URL",
      `"${connectionString}"`,
    );
  }

  return content;
}

/**
 * Add cache service with automatic attachment
 */
async function addCache(
  content: string,
  cacheName: string,
  options: { attachTo?: string; image?: string; port?: number; [key: string]: any },
): Promise<string> {
  const { attachTo, image = "redis:7-alpine", port = 6379 } = options;

  const cacheConfig = {
    serviceType: "prebuilt",
    language: "container",
    type: "deployment",
    image,
    ports: [{ name: "cache", port, targetPort: port }],
    volumes: [{ name: "data", path: "/data", size: "10Gi" }],
  };

  content = insertIntoSection(content, "services", cacheName, cacheConfig);

  // If attaching to a service, add connection env vars
  if (attachTo) {
    const cacheUrl = `redis://${cacheName}:${port}`;
    content = insertIntoServiceSection(content, attachTo, "env.REDIS_URL", `"${cacheUrl}"`);
  }

  return content;
}

/**
 * Add locator for UI testing
 */
async function addLocator(
  content: string,
  locatorKey: string,
  options: { selector?: string; [key: string]: any },
): Promise<string> {
  const { selector } = options;

  if (!selector) {
    throw new Error("Locator requires --selector");
  }

  return insertIntoSection(content, "locators", locatorKey, `"${selector}"`);
}

/**
 * Add schema for API documentation
 */
async function addSchema(
  content: string,
  schemaName: string,
  options: { example?: string; rules?: string; [key: string]: any },
): Promise<string> {
  const { example, rules } = options;

  const schemaConfig: any = {};

  if (example) {
    try {
      schemaConfig.example = JSON.parse(example);
    } catch {
      throw new Error("Invalid example format. Expected JSON.");
    }
  }

  if (rules) {
    try {
      schemaConfig.rules = JSON.parse(rules);
    } catch {
      throw new Error("Invalid rules format. Expected JSON.");
    }
  }

  // Ensure components.schemas section exists
  if (!content.includes("components: schemas:")) {
    content = content.replace(
      /flows: \[/,
      `components: schemas: {}

flows: [`,
    );
  }

  return insertIntoSection(content, "components: schemas", schemaName, schemaConfig);
}

// Helper functions
function generatePrebuiltServiceConfig(name: string, image: string, port?: number) {
  const config = {
    serviceType: "prebuilt",
    language: "container",
    type: image.includes("postgres") || image.includes("mysql") ? "statefulset" : "deployment",
    image,
    ...(port && { ports: [{ name: "main", port, targetPort: port }] }),
  };

  return { v1: config };
}

function generateBespokeServiceConfig(
  name: string,
  language: string,
  port?: number,
  directory?: string,
) {
  const config = {
    serviceType: "bespoke",
    language,
    type: "deployment",
    sourceDirectory: directory || `./src/${name}`,
    ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
  };

  return { v1: config };
}

function generatePathConfig(method: string, returns?: string, accepts?: string) {
  const pathConfig: any = {};
  const operation: any = {};

  if (accepts) {
    operation.request = { $ref: `#/components/schemas/${accepts}` };
  }
  if (returns) {
    operation.response = { $ref: `#/components/schemas/${returns}` };
  }

  pathConfig[method.toLowerCase()] = operation;
  return pathConfig;
}

function generateRouteId(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "home:main";
  if (segments.length === 1) return `${segments[0]}:main`;
  return segments.join(":");
}

function generateNginxConfig(target: string, healthCheck: string): string {
  return `
upstream backend {
  server ${target}:3000 max_fails=3 fail_timeout=30s;
}

server {
  listen 80;
  
  location ${healthCheck} {
    proxy_pass http://backend;
    proxy_connect_timeout 5s;
    proxy_read_timeout 10s;
  }
  
  location / {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`.trim();
}

function generateDbEnvVars(image: string, dbName: string): Record<string, string> {
  if (image.includes("postgres")) {
    return {
      POSTGRES_DB: dbName,
      POSTGRES_USER: "user",
      POSTGRES_PASSWORD: "password",
    };
  } else if (image.includes("mysql")) {
    return {
      MYSQL_DATABASE: dbName,
      MYSQL_USER: "user",
      MYSQL_PASSWORD: "password",
      MYSQL_ROOT_PASSWORD: "rootpassword",
    };
  }
  return {};
}

function generateDbConnectionString(image: string, dbName: string, port: number): string {
  if (image.includes("postgres")) {
    return `postgresql://user:password@${dbName}:${port}/${dbName}`;
  } else if (image.includes("mysql")) {
    return `mysql://user:password@${dbName}:${port}/${dbName}`;
  }
  return `db://${dbName}:${port}/${dbName}`;
}

// CUE manipulation helpers
function insertIntoSection(content: string, section: string, key: string, value: any): string {
  const valueStr = typeof value === "object" ? formatCueObject(value) : value;

  const sectionRegex = new RegExp(`(${section}:\\s*{)([^}]*)(})`, "s");
  const match = content.match(sectionRegex);

  if (match) {
    const existing = match[2];
    const newEntry = `\n  ${key}: ${valueStr}`;
    const updated = existing.trim() ? `${existing}${newEntry}` : newEntry;
    return content.replace(sectionRegex, `$1${updated}\n$3`);
  } else {
    // Section doesn't exist, create it
    return content + `\n\n${section}: {\n  ${key}: ${valueStr}\n}`;
  }
}

function insertIntoServiceSection(
  content: string,
  service: string,
  key: string,
  value: string,
): string {
  const serviceRegex = new RegExp(`(${service}:\\s*{[^}]*)(})`, "s");
  return content.replace(serviceRegex, `$1  ${key}: ${value}\n$2`);
}

function appendToArray(content: string, arrayPath: string, item: any): string {
  const itemStr = formatCueObject(item);
  const arrayRegex = new RegExp(`(${arrayPath.replace(": ", ":\\s*")}\\s*\\[)([^\\]]*)(\\])`, "s");
  const match = content.match(arrayRegex);

  if (match) {
    const existing = match[2];
    const separator = existing.trim() ? ",\n  " : "\n  ";
    return content.replace(arrayRegex, `$1${existing}${separator}${itemStr}\n$3`);
  } else {
    return content.replace(arrayPath, `${arrayPath} [\n  ${itemStr}\n]`);
  }
}

function ensureServiceHealthCheck(content: string, service: string, healthPath: string): string {
  if (!content.includes(`${service}:`) || content.includes(`healthCheck:`)) {
    return content; // Service doesn't exist or already has health check
  }

  const healthCheck = `
    healthCheck: {
      path: "${healthPath}"
      port: 3000
    }`;

  return insertIntoServiceSection(content, service, "healthCheck", healthCheck);
}

function formatCueObject(obj: any): string {
  if (typeof obj === "string") return `"${obj}"`;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  if (Array.isArray(obj)) {
    const items = obj.map((item) => formatCueObject(item)).join(", ");
    return `[${items}]`;
  }

  if (typeof obj === "object" && obj !== null) {
    const entries = Object.entries(obj).map(([k, v]) => `  ${k}: ${formatCueObject(v)}`);
    return `{\n${entries.join("\n")}\n}`;
  }

  return String(obj);
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

async function validateAssembly(content: string): Promise<{ valid: boolean; errors: string[] }> {
  // TODO: Implement CUE validation
  // For now, basic syntax checks
  try {
    // Check for basic CUE syntax requirements
    if (!content.includes("package ")) {
      return { valid: false, errors: ["Missing package declaration"] };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [String(error)] };
  }
}

function showDiff(oldContent: string, newContent: string): string {
  // Simple diff showing what was added
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const addedLines = newLines.filter((line) => !oldLines.includes(line));
  return addedLines.map((line) => `+ ${line}`).join("\n");
}
