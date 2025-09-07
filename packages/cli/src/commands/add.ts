/**
 * Add command - Compositional interface for building specifications
 *
 * COMPLETELY REWRITTEN to use proper AST-based CUE manipulation
 * instead of fragile string concatenation.
 *
 * This command allows users to incrementally build up their arbiter.assembly.cue
 * specification through discrete, validated operations using the CUE tool.
 */

import fs from "fs-extra";
import * as path from "node:path";
import chalk from "chalk";
import type { CLIConfig } from "../types.js";
import { templateManager, extractVariablesFromCue } from "../templates/index.js";
import {
  createCUEManipulator,
  validateCUE,
  formatCUE,
  type ServiceConfig,
  type EndpointConfig,
  type DatabaseConfig,
  type RouteConfig,
  type FlowConfig,
} from "../cue/index.js";

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
  const manipulator = createCUEManipulator();

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

    // Route to appropriate handler using AST-based manipulation
    switch (subcommand) {
      case "service":
        updatedContent = await addService(manipulator, assemblyContent, name, options);
        break;
      case "endpoint":
        updatedContent = await addEndpoint(manipulator, assemblyContent, name, options);
        break;
      case "route":
        updatedContent = await addRoute(manipulator, assemblyContent, name, options);
        break;
      case "flow":
        updatedContent = await addFlow(manipulator, assemblyContent, name, options);
        break;
      case "load-balancer":
        updatedContent = await addLoadBalancer(manipulator, assemblyContent, options);
        break;
      case "database":
        updatedContent = await addDatabase(manipulator, assemblyContent, name, options);
        break;
      case "cache":
        updatedContent = await addCache(manipulator, assemblyContent, name, options);
        break;
      case "locator":
        updatedContent = await addLocator(manipulator, assemblyContent, name, options);
        break;
      case "schema":
        updatedContent = await addSchema(manipulator, assemblyContent, name, options);
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

    // Validate the updated content using CUE tool
    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      console.error(chalk.red("❌ CUE validation failed:"));
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
  } finally {
    await manipulator.cleanup();
  }
}

/**
 * Initialize a new assembly file with basic structure
 */
async function initializeAssembly(): Promise<string> {
  const projectName = path.basename(process.cwd());

  const content = `package ${projectName.replace(/[^a-zA-Z0-9]/g, "")}

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

services: {}`;

  // Format using CUE tool
  return await formatCUE(content);
}

/**
 * Add a service using AST-based manipulation
 */
async function addService(
  manipulator: any,
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
    return await addServiceWithTemplate(manipulator, content, serviceName, options);
  }

  // Determine service type and create proper config
  const isPrebuilt = !!image;
  const serviceConfig: ServiceConfig = isPrebuilt
    ? {
        serviceType: "prebuilt",
        language: "container",
        type: image.includes("postgres") || image.includes("mysql") ? "statefulset" : "deployment",
        image: image!,
        ...(port && { ports: [{ name: "main", port, targetPort: port }] }),
      }
    : {
        serviceType: "bespoke",
        language,
        type: "deployment",
        sourceDirectory: directory || `./src/${serviceName}`,
        ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
      };

  // Add service using AST manipulation
  let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

  // If this creates a UI service, add route to v2 structure
  if (!isPrebuilt && (language === "typescript" || language === "javascript")) {
    const routeConfig: RouteConfig = {
      id: `${serviceName}:main`,
      path: port === 3000 ? "/" : `/${serviceName}`,
      capabilities: ["view"],
      components: [`${toTitleCase(serviceName)}Page`],
    };
    updatedContent = await manipulator.addRoute(updatedContent, routeConfig);

    // Add basic locator
    const locatorKey = `page:${serviceName}`;
    const locatorValue = `[data-testid="${serviceName}-page"]`;
    updatedContent = await manipulator.addToSection(
      updatedContent,
      "locators",
      locatorKey,
      locatorValue,
    );
  }

  return updatedContent;
}

/**
 * Add a service using a template (with AST-based CUE manipulation)
 */
async function addServiceWithTemplate(
  manipulator: any,
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

    // Now update the CUE specification with the service definition using AST manipulation
    const serviceConfig: ServiceConfig = {
      serviceType: "bespoke",
      language: options.language || "typescript",
      type: "deployment",
      sourceDirectory: directory,
      template: template,
      ...(options.port && {
        ports: [{ name: "http", port: options.port, targetPort: options.port }],
      }),
    };

    let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

    // If this creates a UI service, add route to v2 structure
    if (
      !options.image &&
      (options.language === "typescript" || options.language === "javascript")
    ) {
      const routeConfig: RouteConfig = {
        id: `${serviceName}:main`,
        path: options.port === 3000 ? "/" : `/${serviceName}`,
        capabilities: ["view"],
        components: [`${toTitleCase(serviceName)}Page`],
      };
      updatedContent = await manipulator.addRoute(updatedContent, routeConfig);

      // Add basic locator
      const locatorKey = `page:${serviceName}`;
      const locatorValue = `[data-testid="${serviceName}-page"]`;
      updatedContent = await manipulator.addToSection(
        updatedContent,
        "locators",
        locatorKey,
        locatorValue,
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
 * Add an API endpoint using AST-based manipulation
 */
async function addEndpoint(
  manipulator: any,
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

  // Ensure the service exists by parsing the content
  try {
    const ast = await manipulator.parse(content);
    if (!ast.services || !ast.services[service]) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  } catch (parseError) {
    // Fallback check for service existence
    if (!content.includes(`${service}:`)) {
      throw new Error(
        `Service "${service}" not found. Add it first with: arbiter add service ${service}`,
      );
    }
  }

  // Build endpoint configuration
  const endpointConfig: EndpointConfig = {
    method,
    ...(accepts && { request: { $ref: `#/components/schemas/${accepts}` } }),
    ...(returns && { response: { $ref: `#/components/schemas/${returns}` } }),
  };

  // Add endpoint using AST manipulation
  let updatedContent = await manipulator.addEndpoint(content, endpoint, endpointConfig);

  // Add health check validation for health endpoints
  if (endpoint === "/health" || endpoint.endsWith("/health")) {
    const healthCheck = {
      path: endpoint,
      port: 3000,
    };

    // Update the service with health check info
    try {
      const ast = await manipulator.parse(updatedContent);
      if (!ast.services[service].healthCheck) {
        ast.services[service].healthCheck = healthCheck;
        updatedContent = await manipulator.serialize(ast, updatedContent);
      }
    } catch (error) {
      // Fallback: try to add health check directly
      console.warn(`Could not add health check via AST, health endpoint added to paths only`);
    }
  }

  return updatedContent;
}

/**
 * Add a UI route using AST-based manipulation
 */
async function addRoute(
  manipulator: any,
  content: string,
  routePath: string,
  options: { id?: string; capabilities?: string; components?: string; [key: string]: any },
): Promise<string> {
  const routeId = options.id || generateRouteId(routePath);
  const capabilities = options.capabilities
    ? options.capabilities.split(",").map((s: string) => s.trim())
    : ["view"];
  const components = options.components
    ? options.components.split(",").map((s: string) => s.trim())
    : [];

  const routeConfig: RouteConfig = {
    id: routeId,
    path: routePath,
    capabilities,
    ...(components.length > 0 && { components }),
  };

  return await manipulator.addRoute(content, routeConfig);
}

/**
 * Add a user flow using AST-based manipulation
 */
async function addFlow(
  manipulator: any,
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

  const flowConfig: FlowConfig = {
    id: flowId,
    steps: flowSteps,
  };

  return await manipulator.addFlow(content, flowConfig);
}

/**
 * Add load balancer using AST-based manipulation
 */
async function addLoadBalancer(
  manipulator: any,
  content: string,
  options: { target?: string; healthCheck?: string; [key: string]: any },
): Promise<string> {
  const { target, healthCheck = "/health" } = options;

  if (!target) {
    throw new Error("Load balancer requires --target service");
  }

  // Ensure target service exists
  try {
    const ast = await manipulator.parse(content);
    if (!ast.services || !ast.services[target]) {
      throw new Error(`Target service "${target}" not found`);
    }
  } catch (parseError) {
    if (!content.includes(`${target}:`)) {
      throw new Error(`Target service "${target}" not found`);
    }
  }

  // Add load balancer service configuration
  const lbConfig: ServiceConfig = {
    serviceType: "prebuilt",
    language: "container",
    type: "deployment",
    image: "nginx:alpine",
    ports: [{ name: "http", port: 80, targetPort: 80 }],
    // Note: nginx.conf generation would be handled by the template system
    // For now, we'll add a simplified configuration marker
    template: "nginx-loadbalancer",
  };

  let updatedContent = await manipulator.addService(content, "loadbalancer", lbConfig);

  // Ensure target service has health check
  try {
    const ast = await manipulator.parse(updatedContent);
    if (!ast.services[target].healthCheck) {
      ast.services[target].healthCheck = {
        path: healthCheck,
        port: 3000,
      };
      updatedContent = await manipulator.serialize(ast, updatedContent);
    }
  } catch (error) {
    console.warn(`Could not add health check to target service ${target}`);
  }

  return updatedContent;
}

/**
 * Add database using AST-based manipulation
 */
async function addDatabase(
  manipulator: any,
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

      // Execute template for database setup
      const targetDir = `./database/${dbName}`;
      await templateManager.executeTemplate(template, path.resolve(targetDir), variables);

      console.log(chalk.green(`✅ Database template '${template}' applied to '${targetDir}'`));
    } catch (error) {
      throw new Error(
        `Database template generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const dbConfig: DatabaseConfig = {
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
    ...(attachTo && { attachTo }),
  };

  return await manipulator.addDatabase(content, dbName, dbConfig);
}

/**
 * Add cache service using AST-based manipulation
 */
async function addCache(
  manipulator: any,
  content: string,
  cacheName: string,
  options: { attachTo?: string; image?: string; port?: number; [key: string]: any },
): Promise<string> {
  const { attachTo, image = "redis:7-alpine", port = 6379 } = options;

  const cacheConfig: ServiceConfig = {
    serviceType: "prebuilt",
    language: "container",
    type: "deployment",
    image,
    ports: [{ name: "cache", port, targetPort: port }],
    volumes: [{ name: "data", path: "/data", size: "10Gi" }],
  };

  let updatedContent = await manipulator.addService(content, cacheName, cacheConfig);

  // If attaching to a service, add connection env vars
  if (attachTo) {
    try {
      const ast = await manipulator.parse(updatedContent);
      if (ast.services && ast.services[attachTo]) {
        if (!ast.services[attachTo].env) {
          ast.services[attachTo].env = {};
        }
        const cacheUrl = `redis://${cacheName}:${port}`;
        ast.services[attachTo].env.REDIS_URL = cacheUrl;
        updatedContent = await manipulator.serialize(ast, updatedContent);
      }
    } catch (error) {
      console.warn(`Could not add cache connection to service ${attachTo}`);
    }
  }

  return updatedContent;
}

/**
 * Add locator using AST-based manipulation
 */
async function addLocator(
  manipulator: any,
  content: string,
  locatorKey: string,
  options: { selector?: string; [key: string]: any },
): Promise<string> {
  const { selector } = options;

  if (!selector) {
    throw new Error("Locator requires --selector");
  }

  return await manipulator.addToSection(content, "locators", locatorKey, selector);
}

/**
 * Add schema using AST-based manipulation
 */
async function addSchema(
  manipulator: any,
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

  return await manipulator.addToSection(content, "components.schemas", schemaName, schemaConfig);
}

// Helper functions
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

function generateRouteId(path: string): string {
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 0) return "home:main";
  if (segments.length === 1) return `${segments[0]}:main`;
  return segments.join(":");
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

function showDiff(oldContent: string, newContent: string): string {
  // Simple diff showing what was added
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  const addedLines = newLines.filter((line) => !oldLines.includes(line));
  return addedLines.map((line) => `+ ${line}`).join("\n");
}
