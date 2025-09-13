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
import { ApiClient } from "../api-client.js";
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
  type PlatformServiceType,
} from "../cue/index.js";
import { detectPlatform, getPlatformServiceDefaults } from "../utils/platform-detection.js";

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
  config: CLIConfig,
): Promise<number> {
  const manipulator = createCUEManipulator();

  try {
    console.log(chalk.blue(`🔧 Adding ${subcommand}: ${name}`));

    // Get existing assembly content from sharded storage in service
    const assemblyPath = path.resolve(".arbiter", "assembly.cue"); // Move to .arbiter directory
    let assemblyContent = "";

    // Initialize API client to try getting existing specification from sharded storage
    const apiClient = new ApiClient(config);
    
    try {
      // First try to get the specification from the service's sharded storage
      const storedSpec = await apiClient.getSpecification('assembly', assemblyPath);
      if (storedSpec.success && storedSpec.data && storedSpec.data.content) {
        assemblyContent = storedSpec.data.content;
        if (options.verbose) {
          console.log(chalk.dim("📡 Retrieved existing specification from service (sharded storage)"));
        }
      } else {
        throw new Error("No stored specification found");
      }
    } catch (apiError) {
      // Fallback to file system - check both .arbiter directory and legacy location
      const legacyPath = path.resolve("arbiter.assembly.cue");
      
      if (fs.existsSync(assemblyPath)) {
        assemblyContent = fs.readFileSync(assemblyPath, "utf-8");
        if (options.verbose) {
          console.log(chalk.dim("📁 Retrieved existing specification from .arbiter directory"));
        }
      } else if (fs.existsSync(legacyPath)) {
        assemblyContent = fs.readFileSync(legacyPath, "utf-8");
        if (options.verbose) {
          console.log(chalk.dim("📁 Retrieved existing specification from legacy location"));
        }
      } else {
        // Initialize with basic structure
        console.log(chalk.yellow("⚠️  No existing specification found. Creating new specification..."));
        assemblyContent = await initializeAssembly();
      }
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
      case "package":
        updatedContent = await addPackage(manipulator, assemblyContent, name, options);
        break;
      case "component":
        updatedContent = await addComponent(manipulator, assemblyContent, name, options);
        break;
      case "module":
        updatedContent = await addModule(manipulator, assemblyContent, name, options);
        break;
      default:
        console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
        console.log(
          chalk.dim(
            "Available subcommands: service, endpoint, route, flow, load-balancer, database, cache, locator, schema, package, component, module",
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

    // Store specification in service or preview changes
    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - changes that would be made:"));
      console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
    } else {
      // Initialize API client and store specification in service database
      const apiClient = new ApiClient(config);
      
      try {
        // Determine shard type based on subcommand
        const shardType = getShardTypeForSubcommand(subcommand);
        
        // Store the updated CUE specification in the service with sharding
        const storeResult = await apiClient.storeSpecification({
          content: updatedContent,
          type: shardType,
          path: assemblyPath,
          shard: shardType // Use shard type as shard identifier
        });
        
        if (storeResult.success) {
          console.log(chalk.green(`✅ Updated specification in service (${subcommand}: ${name})`));
          console.log(chalk.dim(`💡 CUE files will be generated to .arbiter/ when specification is complete`));
          
          if (storeResult.data?.shard) {
            console.log(chalk.dim(`   Stored in shard: ${storeResult.data.shard}`));
          }

          if (options.verbose) {
            console.log(chalk.dim("Added configuration:"));
            console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
          }
        } else {
          throw new Error(storeResult.error || "Failed to store specification");
        }
      } catch (apiError) {
        // Fallback to file system if API is not available
        console.log(chalk.yellow("⚠️  Service unavailable, storing locally as fallback"));
        
        // Ensure .arbiter directory exists
        await fs.ensureDir('.arbiter');
        
        // Write to .arbiter directory
        await fs.writeFile(assemblyPath, updatedContent, 'utf-8');
        console.log(chalk.green(`✅ Updated ${path.basename(assemblyPath)} (local fallback)`));
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
    platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
    serviceType?: PlatformServiceType;
    [key: string]: any;
  },
): Promise<string> {
  const { language = "typescript", port, image, directory, template } = options;

  // If template is specified, use template-based generation
  if (template) {
    return await addServiceWithTemplate(manipulator, content, serviceName, options);
  }

  // Detect platform context if not explicitly specified
  let platformContext;
  if (!options.platform && !options.serviceType) {
    platformContext = await detectPlatform();
    
    if (platformContext.detected !== "unknown" && platformContext.confidence > 0.3) {
      console.log(chalk.cyan(`🔍 Detected ${platformContext.detected} platform (${Math.round(platformContext.confidence * 100)}% confidence)`));
      
      // Show platform-specific suggestions
      if (platformContext.suggestions.length > 0) {
        console.log(chalk.dim("💡 Platform-specific suggestions:"));
        for (const suggestion of platformContext.suggestions) {
          console.log(chalk.dim(`  • Use --service-type ${suggestion.serviceType} for ${suggestion.reason}`));
        }
        console.log(chalk.dim("  • Or use --platform kubernetes for traditional container deployment"));
      }
    }
  }

  // Determine service type and create proper config
  const isPrebuilt = !!image;
  let serviceConfig: ServiceConfig;
  
  if (options.serviceType) {
    // Use explicitly specified platform-specific service type
    const platformDefaults = getPlatformServiceDefaults(options.serviceType);
    serviceConfig = {
      serviceType: options.serviceType,
      language: platformDefaults.language || language,
      type: platformDefaults.type || "serverless",
      ...(platformDefaults.platform && { platform: platformDefaults.platform }),
      ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
      ...(directory && { sourceDirectory: directory }),
      ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
    };
  } else if (isPrebuilt) {
    // Container-based service
    serviceConfig = {
      serviceType: "prebuilt",
      language: "container",
      type: (image && (image.includes("postgres") || image.includes("mysql"))) ? "statefulset" : "deployment",
      image: image!,
      ...(port && { ports: [{ name: "main", port, targetPort: port }] }),
    };
  } else {
    // Traditional bespoke service
    serviceConfig = {
      serviceType: "bespoke",
      language,
      type: "deployment",
      sourceDirectory: directory || `./src/${serviceName}`,
      ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
    };
  }

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
 * Service template options
 */
interface ServiceTemplateOptions {
  language?: string;
  port?: number;
  image?: string;
  directory?: string;
  template?: string;
  [key: string]: any;
}

/**
 * Add a service using a template (with AST-based CUE manipulation)
 */
async function addServiceWithTemplate(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { template, directory = `./src/${serviceName}` } = options;

  if (!template) {
    throw new Error("Template name is required for template-based generation");
  }

  try {
    await validateTemplateExists(template);
    await executeTemplate(serviceName, template, content, directory, options);
    const serviceConfig = createTemplateServiceConfig(serviceName, directory, options);
    
    let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);
    
    if (shouldAddUIComponents(options)) {
      updatedContent = await addUIComponentsForService(manipulator, updatedContent, serviceName, options);
    }
    
    return updatedContent;
  } catch (error) {
    throw new Error(
      `Template generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate that template exists in template manager
 */
async function validateTemplateExists(template: string): Promise<void> {
  await templateManager.loadConfig();
  
  const alias = templateManager.getAlias(template);
  if (!alias) {
    const availableTemplates = Object.keys(templateManager.getAliases());
    throw new Error(
      `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
    );
  }
}

/**
 * Execute template generation
 */
async function executeTemplate(
  serviceName: string,
  template: string,
  content: string,
  directory: string,
  options: ServiceTemplateOptions,
): Promise<void> {
  console.log(chalk.blue(`🔧 Generating service '${serviceName}' using template '${template}'`));
  
  const variables = extractVariablesFromCue(content, serviceName);
  variables.serviceName = serviceName;
  if (options.language) variables.language = options.language;
  if (options.port) variables.port = options.port;
  
  await fs.ensureDir(path.resolve(directory));
  await templateManager.executeTemplate(template, path.resolve(directory), variables);
  
  console.log(chalk.green(`✅ Template '${template}' applied successfully to '${directory}'`));
}

/**
 * Create service configuration for template-based service
 */
function createTemplateServiceConfig(
  serviceName: string,
  directory: string,
  options: ServiceTemplateOptions,
): ServiceConfig {
  return {
    serviceType: "bespoke",
    language: options.language || "typescript",
    type: "deployment",
    sourceDirectory: directory,
    template: options.template!,
    ...(options.port && {
      ports: [{ name: "http", port: options.port, targetPort: options.port }],
    }),
  };
}

/**
 * Check if UI components should be added
 */
function shouldAddUIComponents(options: ServiceTemplateOptions): boolean {
  return (
    !options.image &&
    (options.language === "typescript" || options.language === "javascript")
  );
}

/**
 * Add UI components and routes for service
 */
async function addUIComponentsForService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const routeConfig: RouteConfig = {
    id: `${serviceName}:main`,
    path: options.port === 3000 ? "/" : `/${serviceName}`,
    capabilities: ["view"],
    components: [`${toTitleCase(serviceName)}Page`],
  };
  
  let updatedContent = await manipulator.addRoute(content, routeConfig);
  
  const locatorKey = `page:${serviceName}`;
  const locatorValue = `[data-testid="${serviceName}-page"]`;
  updatedContent = await manipulator.addToSection(
    updatedContent,
    "locators",
    locatorKey,
    locatorValue,
  );
  
  return updatedContent;
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
 * Flow configuration options
 */
interface FlowOptions {
  from?: string;
  to?: string;
  endpoint?: string;
  expect?: string;
  steps?: string;
  [key: string]: any;
}

/**
 * Flow step types
 */
type FlowStep = 
  | { visit: string }
  | { click: string }
  | { expect: { locator: string; state: string } }
  | { expect_api: { method: string; path: string; status: number } };

/**
 * Add a user flow using AST-based manipulation
 */
async function addFlow(
  manipulator: any,
  content: string,
  flowId: string,
  options: FlowOptions,
): Promise<string> {
  const flowSteps = generateFlowSteps(options);
  const flowConfig: FlowConfig = {
    id: flowId,
    steps: flowSteps,
  };

  return await manipulator.addFlow(content, flowConfig);
}

/**
 * Generate flow steps based on options
 */
function generateFlowSteps(options: FlowOptions): FlowStep[] {
  if (options.steps) {
    return parseCustomSteps(options.steps);
  }
  
  if (options.from && options.to) {
    return generateNavigationFlow(options.from, options.to);
  }
  
  if (options.endpoint) {
    return generateApiHealthFlow(options.endpoint, options.expect || "200");
  }
  
  throw new Error("Flow must specify either --from/--to, --endpoint, or --steps");
}

/**
 * Parse custom steps from JSON string
 */
function parseCustomSteps(stepsJson: string): FlowStep[] {
  try {
    return JSON.parse(stepsJson);
  } catch {
    throw new Error("Invalid steps format. Expected JSON array.");
  }
}

/**
 * Generate navigation flow between pages
 */
function generateNavigationFlow(from: string, to: string): FlowStep[] {
  return [
    { visit: from },
    { click: `btn:goto-${to}` },
    { expect: { locator: `page:${to}`, state: "visible" } },
  ];
}

/**
 * Generate API health check flow
 */
function generateApiHealthFlow(endpoint: string, expectedStatus: string): FlowStep[] {
  return [
    { expect_api: { method: "GET", path: endpoint, status: parseInt(expectedStatus) } },
  ];
}

/**
 * Validate that target service exists in content
 */
function validateTargetServiceExists(manipulator: any, content: string, target: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      const ast = await manipulator.parse(content);
      resolve(!!(ast.services && ast.services[target]));
    } catch {
      resolve(content.includes(`${target}:`));
    }
  });
}

/**
 * Create load balancer service configuration
 */
function createLoadBalancerConfig(): ServiceConfig {
  return {
    serviceType: "prebuilt",
    language: "container",
    type: "deployment",
    image: "nginx:alpine",
    ports: [{ name: "http", port: 80, targetPort: 80 }],
    template: "nginx-loadbalancer",
  };
}

/**
 * Add health check to target service
 */
async function addHealthCheckToTarget(
  manipulator: any,
  content: string,
  target: string,
  healthCheck: string,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (!ast.services[target].healthCheck) {
      ast.services[target].healthCheck = {
        path: healthCheck,
        port: 3000,
      };
      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(`Could not add health check to target service ${target}`);
  }
  return content;
}

/**
 * Load balancer options interface
 */
interface LoadBalancerOptions {
  target?: string;
  healthCheck?: string;
  [key: string]: any;
}

/**
 * Load balancer configuration parameters
 */
interface LoadBalancerParams {
  target: string;
  healthCheck: string;
}

/**
 * Add load balancer using AST-based manipulation
 */
async function addLoadBalancer(
  manipulator: any,
  content: string,
  options: LoadBalancerOptions,
): Promise<string> {
  const params = validateAndNormalizeLoadBalancerOptions(options);
  await ensureTargetServiceExists(manipulator, content, params.target);
  
  return await createLoadBalancerWithHealthCheck(manipulator, content, params);
}

/**
 * Validate and normalize load balancer options
 */
function validateAndNormalizeLoadBalancerOptions(options: LoadBalancerOptions): LoadBalancerParams {
  const { target, healthCheck = "/health" } = options;

  if (!target) {
    throw new Error("Load balancer requires --target service");
  }

  return { target, healthCheck };
}

/**
 * Ensure target service exists, throw error if not found
 */
async function ensureTargetServiceExists(
  manipulator: any,
  content: string,
  target: string,
): Promise<void> {
  const targetExists = await validateTargetServiceExists(manipulator, content, target);
  if (!targetExists) {
    throw new Error(`Target service "${target}" not found`);
  }
}

/**
 * Create load balancer service and configure health check
 */
async function createLoadBalancerWithHealthCheck(
  manipulator: any,
  content: string,
  params: LoadBalancerParams,
): Promise<string> {
  const lbConfig = createLoadBalancerConfig();
  let updatedContent = await manipulator.addService(content, "loadbalancer", lbConfig);
  
  updatedContent = await addHealthCheckToTarget(
    manipulator, 
    updatedContent, 
    params.target, 
    params.healthCheck
  );

  return updatedContent;
}

/**
 * Add database using AST-based manipulation
 */
async function addDatabase(
  manipulator: any,
  content: string,
  dbName: string,
  options: DatabaseAddOptions,
): Promise<string> {
  const dbOptions = normalizeDatabaseOptions(options);

  if (dbOptions.template) {
    await handleTemplateBasedDatabaseCreation(dbName, content, dbOptions);
  }

  const dbConfig = createDatabaseConfiguration(dbName, dbOptions);
  return await manipulator.addDatabase(content, dbName, dbConfig);
}

/**
 * Database add options interface
 */
interface DatabaseAddOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

/**
 * Normalized database options with defaults
 */
interface NormalizedDatabaseOptions {
  attachTo?: string;
  image: string;
  port: number;
  template?: string;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

/**
 * Database configuration defaults
 */
const DATABASE_DEFAULTS = {
  image: "postgres:15",
  port: 5432,
  volumeSize: "50Gi",
} as const;

/**
 * Normalize database options with defaults
 */
function normalizeDatabaseOptions(options: DatabaseAddOptions): NormalizedDatabaseOptions {
  return {
    attachTo: options.attachTo,
    image: options.image ?? DATABASE_DEFAULTS.image,
    port: options.port ?? DATABASE_DEFAULTS.port,
    template: options.template,
    serviceType: options.serviceType,
    platform: options.platform,
  };
}

/**
 * Handle template-based database creation
 */
async function handleTemplateBasedDatabaseCreation(
  dbName: string,
  content: string,
  options: NormalizedDatabaseOptions,
): Promise<void> {
  try {
    await templateManager.loadConfig();
    
    validateTemplateExistsSync(options.template!);
    
    console.log(chalk.blue(`🔧 Generating database '${dbName}' using template '${options.template}'`));
    
    const variables = prepareTemplateVariables(content, dbName, options);
    const targetDir = `./database/${dbName}`;
    
    await templateManager.executeTemplate(options.template!, path.resolve(targetDir), variables);
    
    console.log(chalk.green(`✅ Database template '${options.template}' applied to '${targetDir}'`));
  } catch (error) {
    throw new Error(
      `Database template generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Validate template exists synchronously and throw error if not found
 */
function validateTemplateExistsSync(template: string): void {
  const alias = templateManager.getAlias(template);
  if (!alias) {
    const availableTemplates = Object.keys(templateManager.getAliases());
    throw new Error(
      `Template '${template}' not found. Available templates: ${availableTemplates.join(", ")}`,
    );
  }
}

/**
 * Prepare template variables for database generation
 */
function prepareTemplateVariables(
  content: string,
  dbName: string,
  options: NormalizedDatabaseOptions,
): Record<string, any> {
  const variables = extractVariablesFromCue(content);
  variables.databaseName = dbName;
  variables.attachTo = options.attachTo;
  variables.image = options.image;
  variables.port = options.port;
  return variables;
}

/**
 * Create database configuration object
 */
function createDatabaseConfiguration(
  dbName: string,
  options: NormalizedDatabaseOptions,
): DatabaseConfig {
  // Check for platform-specific service types
  if (options.serviceType && options.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(options.serviceType);
    return {
      serviceType: options.serviceType,
      language: platformDefaults.language || "sql",
      type: platformDefaults.type || "managed",
      ...(platformDefaults.platform && { platform: platformDefaults.platform }),
      ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
      ...(options.attachTo && { attachTo: options.attachTo }),
      // Platform-managed services don't need traditional container config
    };
  }
  
  // Traditional container-based database
  return {
    serviceType: "prebuilt",
    language: "container",
    type: "statefulset",
    image: options.image,
    ports: [{ name: "db", port: options.port, targetPort: options.port }],
    volumes: [createDatabaseVolume(options.image)],
    env: generateDbEnvVars(options.image, dbName),
    ...(options.attachTo && { attachTo: options.attachTo }),
  };
}

/**
 * Create database volume configuration based on image type
 */
function createDatabaseVolume(image: string): VolumeConfig {
  if (!image) {
    // Default path for undefined image
    return {
      name: "data",
      path: "/var/lib/data",
      size: DATABASE_DEFAULTS.volumeSize,
      type: "persistentVolumeClaim",
    };
  }
  
  const dataPath = image.includes("postgres") 
    ? "/var/lib/postgresql/data" 
    : "/var/lib/mysql";
    
  return {
    name: "data",
    path: dataPath,
    size: DATABASE_DEFAULTS.volumeSize,
    type: "persistentVolumeClaim",
  };
}

/**
 * Volume configuration interface
 */
interface VolumeConfig {
  name: string;
  path: string;
  size: string;
  type: string;
}

/**
 * Cache service configuration options
 */
interface CacheServiceOptions {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  [key: string]: any;
}

/**
 * Cache configuration with defaults
 */
interface CacheConfig {
  attachTo?: string;
  image?: string;
  port?: number;
  serviceType?: PlatformServiceType;
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
}

/**
 * Default cache configuration
 */
const CACHE_DEFAULTS = {
  image: "redis:7-alpine",
  port: 6379,
  volumeSize: "10Gi",
} as const;

/**
 * Add cache service using AST-based manipulation
 */
async function addCache(
  manipulator: any,
  content: string,
  cacheName: string,
  options: CacheServiceOptions,
): Promise<string> {
  const cacheConfig = normalizeCacheOptions(options);
  const serviceConfig = createCacheServiceConfig(cacheConfig);
  
  let updatedContent = await manipulator.addService(content, cacheName, serviceConfig);
  
  if (cacheConfig.attachTo) {
    updatedContent = await attachCacheToService(manipulator, updatedContent, cacheName, cacheConfig);
  }
  
  return updatedContent;
}

/**
 * Normalize cache options with defaults
 */
function normalizeCacheOptions(options: CacheServiceOptions): CacheConfig {
  return {
    attachTo: options.attachTo,
    image: options.image ?? (options.serviceType ? undefined : CACHE_DEFAULTS.image),
    port: options.port ?? (options.serviceType ? undefined : CACHE_DEFAULTS.port),
    serviceType: options.serviceType,
    platform: options.platform,
  };
}

/**
 * Create cache service configuration
 */
function createCacheServiceConfig(config: CacheConfig): ServiceConfig {
  // Check for platform-specific service types
  if (config.serviceType && config.serviceType !== "prebuilt") {
    const platformDefaults = getPlatformServiceDefaults(config.serviceType);
    return {
      serviceType: config.serviceType,
      language: platformDefaults.language || "key-value",
      type: platformDefaults.type || "managed",
      ...(platformDefaults.platform && { platform: platformDefaults.platform }),
      ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
      ...(config.attachTo && { attachTo: config.attachTo }),
      // Platform-managed caches don't need traditional container config
    };
  }
  
  // Traditional container-based cache
  return {
    serviceType: "prebuilt",
    language: "container",
    type: "deployment",
    image: config.image!,
    ports: [{ name: "cache", port: config.port!, targetPort: config.port! }],
    volumes: [{ name: "data", path: "/data", size: CACHE_DEFAULTS.volumeSize }],
  };
}

/**
 * Attach cache connection to target service
 */
async function attachCacheToService(
  manipulator: any,
  content: string,
  cacheName: string,
  config: CacheConfig,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (ast.services && ast.services[config.attachTo!]) {
      if (!ast.services[config.attachTo!].env) {
        ast.services[config.attachTo!].env = {};
      }
      
      // Generate environment variables based on cache type
      let envVars: Record<string, string> = {};
      
      if (config.serviceType && config.serviceType !== "prebuilt") {
        // Platform-managed cache - use platform-specific env vars
        envVars = generatePlatformCacheEnvVars(config.serviceType, cacheName);
      } else {
        // Traditional container-based cache
        envVars = { REDIS_URL: `redis://${cacheName}:${config.port}` };
      }
      
      Object.assign(ast.services[config.attachTo!].env, envVars);
      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(`Could not add cache connection to service ${config.attachTo}`);
  }
  return content;
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

/**
 * Add a reusable package/library
 */
async function addPackage(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    language?: string;
    directory?: string;
    exports?: string;
    version?: string;
  },
): Promise<string> {
  const packageName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const packageConfig: any = {
    name: packageName,
    type: "package",
    language: options.language || "typescript",
    version: options.version || "0.1.0",
    directory: options.directory || `packages/${packageName}`,
  };

  if (options.exports) {
    packageConfig.exports = options.exports.split(",").map(e => e.trim());
  }

  return await manipulator.addToSection(content, "components.packages", packageName, packageConfig);
}

/**
 * Add a UI component
 */
async function addComponent(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    framework?: string;
    directory?: string;
    props?: string;
    stories?: boolean;
  },
): Promise<string> {
  const componentName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const componentConfig: any = {
    name: componentName,
    type: "component",
    framework: options.framework || "react",
    directory: options.directory || `src/components/${componentName}`,
  };

  if (options.props) {
    componentConfig.props = options.props.split(",").map(p => p.trim());
  }

  if (options.stories) {
    componentConfig.storybook = true;
  }

  return await manipulator.addToSection(content, "components.ui", componentName, componentConfig);
}

/**
 * Add a standalone module
 */
async function addModule(
  manipulator: any,
  content: string,
  name: string,
  options: AddOptions & {
    language?: string;
    directory?: string;
    functions?: string;
    types?: string;
  },
): Promise<string> {
  const moduleName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const moduleConfig: any = {
    name: moduleName,
    type: "module",
    language: options.language || "typescript",
    directory: options.directory || `src/modules/${moduleName}`,
  };

  if (options.functions) {
    moduleConfig.functions = options.functions.split(",").map(f => f.trim());
  }

  if (options.types) {
    moduleConfig.types = options.types.split(",").map(t => t.trim());
  }

  return await manipulator.addToSection(content, "components.modules", moduleName, moduleConfig);
}

// Helper functions
function generateDbEnvVars(image: string, dbName: string): Record<string, string> {
  if (!image) return {};
  
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

/**
 * Generate platform-specific cache environment variables
 */
function generatePlatformCacheEnvVars(serviceType: string, cacheName: string): Record<string, string> {
  switch (serviceType) {
    case "cloudflare_kv":
      return {
        KV_NAMESPACE_ID: `${cacheName}_namespace_id`,
        KV_BINDING_NAME: cacheName.toUpperCase(),
        CACHE_URL: `kv://${cacheName}`,
      };
    case "vercel_kv":
      return {
        KV_REST_API_URL: `https://${cacheName}.kv.vercel-storage.com`,
        KV_REST_API_TOKEN: `${cacheName}_token`,
        KV_URL: `redis://${cacheName}`,
        CACHE_URL: `vercel-kv://${cacheName}`,
      };
    default:
      return {
        CACHE_URL: `${serviceType}://${cacheName}`,
      };
  }
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

/**
 * Determine shard type based on add subcommand for better organization
 */
function getShardTypeForSubcommand(subcommand: string): string {
  const shardMapping: Record<string, string> = {
    'service': 'services',
    'endpoint': 'endpoints', 
    'route': 'routes',
    'flow': 'flows',
    'database': 'services', // Databases go with services
    'load-balancer': 'services', // Load balancers go with services
    'schema': 'schemas',
    'locator': 'locators'
  };
  
  return shardMapping[subcommand] || 'assembly';
}
