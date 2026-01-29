/**
 * @packageDocumentation
 * Service subcommand module - Handles adding services to CUE specifications.
 *
 * This module supports:
 * - Standard application services
 * - Infrastructure services (databases, caches, queues, load balancers)
 * - Platform-specific services (Cloudflare, Vercel, Supabase)
 * - Template-based service generation
 */

import type { PlatformServiceType, RouteConfig, ServiceConfig } from "@/cue/index.js";
import { toTitleCase } from "@/services/add/shared.js";
import { executeTemplate, validateTemplateExists } from "@/services/add/template-engine.js";
import {
  detectPlatform,
  getPlatformServiceDefaults,
} from "@/utils/util/core/platform-detection.js";
import chalk from "chalk";

/**
 * Infrastructure service types representing non-application services.
 */
type InfrastructureType = "database" | "cache" | "queue" | "load-balancer";

/**
 * Options for service template configuration.
 */
interface ServiceTemplateOptions {
  /** Programming language for the service */
  language?: string;
  /** Service port number */
  port?: number;
  /** Container image for external services */
  image?: string;
  /** Source directory path */
  directory?: string;
  /** Template alias to use */
  template?: string;
  /** Target platform */
  platform?: "cloudflare" | "vercel" | "supabase" | "kubernetes";
  /** Platform-specific service type */
  serviceType?: PlatformServiceType;
  /** Infrastructure type - makes this service a database, cache, queue, or load-balancer */
  type?: InfrastructureType;
  /** Service to attach this infrastructure service to */
  attachTo?: string;
  /** Target service for load balancer */
  target?: string;
  /** Health check path for load balancer */
  healthCheckPath?: string;
  /** Additional options */
  [key: string]: any;
}

/**
 * Add a service to the CUE specification.
 *
 * @param manipulator - CUE manipulator instance
 * @param content - Current CUE content
 * @param serviceName - Name of the service to add
 * @param options - Service configuration options
 * @returns Updated CUE content
 */
export async function addService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  // Handle infrastructure types (database, cache, queue, load-balancer)
  if (options.type) {
    return await addInfrastructureService(manipulator, content, serviceName, options);
  }

  if (options.template) {
    return await addServiceWithTemplate(manipulator, content, serviceName, options);
  }

  await logPlatformSuggestionsIfNeeded(options);

  const serviceConfig = buildServiceConfig(serviceName, options);
  let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

  if (shouldAddUIComponentsForStandardService(options)) {
    updatedContent = await addUIComponentsForService(
      manipulator,
      updatedContent,
      serviceName,
      options,
    );
  }

  return updatedContent;
}

/**
 * Log platform-specific suggestions if platform detection is available.
 * @param options - Service configuration options
 */
async function logPlatformSuggestionsIfNeeded(options: ServiceTemplateOptions): Promise<void> {
  if (options.platform || options.serviceType) {
    return;
  }

  const platformContext = await detectPlatform();
  if (platformContext.detected === "unknown" || platformContext.confidence <= 0.3) {
    return;
  }

  console.log(
    chalk.cyan(
      `🔍 Detected ${platformContext.detected} platform (${Math.round(platformContext.confidence * 100)}% confidence)`,
    ),
  );

  if (platformContext.suggestions.length > 0) {
    logPlatformSuggestions(platformContext.suggestions);
  }
}

/**
 * Log platform-specific service type suggestions.
 * @param suggestions - Array of service type suggestions with reasons
 */
function logPlatformSuggestions(suggestions: Array<{ serviceType: string; reason: string }>): void {
  console.log(chalk.dim("💡 Platform-specific suggestions:"));
  for (const suggestion of suggestions) {
    console.log(
      chalk.dim(`  • Use --service-type ${suggestion.serviceType} for ${suggestion.reason}`),
    );
  }
  console.log(chalk.dim("  • Or use --platform kubernetes for traditional container deployment"));
}

/**
 * Build the service configuration object based on options.
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Service configuration object
 */
function buildServiceConfig(serviceName: string, options: ServiceTemplateOptions): ServiceConfig {
  const { language = "typescript", port, image, directory } = options;

  if (options.serviceType) {
    return buildPlatformServiceConfig(options, language, directory, port);
  }

  if (image) {
    return buildPrebuiltServiceConfig(image, port);
  }

  return buildInternalServiceConfig(serviceName, language, directory, port);
}

/**
 * Build configuration for a platform-specific service.
 * @param options - Service configuration options
 * @param language - Programming language for the service
 * @param directory - Optional source directory path
 * @param port - Optional port number
 * @returns Platform-specific service configuration
 */
function buildPlatformServiceConfig(
  options: ServiceTemplateOptions,
  language: string,
  directory?: string,
  port?: number,
): ServiceConfig {
  const platformDefaults = getPlatformServiceDefaults(options.serviceType!);
  return {
    serviceType: options.serviceType,
    type: platformDefaults.artifactType || "external",
    language: platformDefaults.language || language,
    workload: platformDefaults.workload || "serverless",
    ...(platformDefaults.platform && { platform: platformDefaults.platform }),
    ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
    ...(directory && { sourceDirectory: directory }),
    ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
  };
}

/**
 * Build configuration for a prebuilt container service.
 * @param image - Container image name
 * @param port - Optional port number
 * @returns Prebuilt service configuration
 */
function buildPrebuiltServiceConfig(image: string, port?: number): ServiceConfig {
  return {
    type: "external",
    language: "container",
    workload: image.includes("postgres") || image.includes("mysql") ? "statefulset" : "deployment",
    image,
    ...(port && { ports: [{ name: "main", port, targetPort: port }] }),
  };
}

/**
 * Build configuration for an internal application service.
 * @param serviceName - Name of the service
 * @param language - Programming language for the service
 * @param directory - Optional source directory path
 * @param port - Optional port number
 * @returns Internal service configuration
 */
function buildInternalServiceConfig(
  serviceName: string,
  language: string,
  directory?: string,
  port?: number,
): ServiceConfig {
  return {
    type: "internal",
    language,
    workload: "deployment",
    sourceDirectory: directory || `./src/${serviceName}`,
    ...(port && { ports: [{ name: "http", port, targetPort: port }] }),
  };
}

/**
 * Determine if UI components should be added for a standard service.
 * @param options - Service configuration options
 * @returns True if UI components should be added
 */
function shouldAddUIComponentsForStandardService(_options: ServiceTemplateOptions): boolean {
  // Services added via "arbiter add service" are backend services
  // They should not get UI routes/locators by default
  // Use "arbiter add client" for frontend applications that need UI components
  return false;
}

/**
 * Add an infrastructure service (database, cache, queue, load-balancer).
 * These are services with an additional infrastructureType field.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Updated CUE file content
 */
async function addInfrastructureService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { type: infraType, serviceType } = options;

  // Platform-specific service (e.g., cloudflare_d1, vercel_postgres)
  if (serviceType && serviceType !== "prebuilt") {
    return await addPlatformInfrastructureService(manipulator, content, serviceName, options);
  }

  // Container-based infrastructure service
  return await addContainerInfrastructureService(manipulator, content, serviceName, options);
}

/**
 * Add a platform-specific infrastructure service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Updated CUE file content
 */
async function addPlatformInfrastructureService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { type: infraType, serviceType, attachTo, port } = options;
  const platformDefaults = getPlatformServiceDefaults(serviceType!);

  const serviceConfig: ServiceConfig = {
    serviceType,
    infrastructureType: infraType,
    type: platformDefaults.artifactType || "external",
    language: platformDefaults.language || getDefaultLanguageForInfraType(infraType!),
    workload: platformDefaults.workload || "managed",
    ...(platformDefaults.platform && { platform: platformDefaults.platform }),
    ...(platformDefaults.runtime && { runtime: platformDefaults.runtime }),
    ...(attachTo && { attachTo }),
  };

  let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

  if (attachTo) {
    updatedContent = await attachServiceToTarget(
      manipulator,
      updatedContent,
      serviceName,
      infraType!,
      attachTo,
      port,
    );
  }

  return updatedContent;
}

/**
 * Add a container-based infrastructure service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Updated CUE file content
 */
async function addContainerInfrastructureService(
  manipulator: any,
  content: string,
  serviceName: string,
  options: ServiceTemplateOptions,
): Promise<string> {
  const { type: infraType, image, port, attachTo, target, healthCheckPath } = options;

  const serviceConfig = buildContainerInfraConfig(
    serviceName,
    infraType!,
    image!,
    port!,
    attachTo,
    target,
    healthCheckPath,
  );
  let updatedContent = await manipulator.addService(content, serviceName, serviceConfig);

  updatedContent = await maybeAttachToTarget(
    manipulator,
    updatedContent,
    serviceName,
    infraType!,
    attachTo,
    port!,
  );
  updatedContent = await maybeAddLoadBalancerHealthCheck(
    manipulator,
    updatedContent,
    infraType!,
    target,
    healthCheckPath,
    port,
  );

  return updatedContent;
}

/**
 * Build configuration for a container-based infrastructure service.
 * @param serviceName - Name of the service
 * @param infraType - Type of infrastructure (database, cache, queue, load-balancer)
 * @param image - Container image name
 * @param port - Port number
 * @param attachTo - Optional service to attach to
 * @param target - Optional target service for load balancer
 * @param healthCheckPath - Optional health check path
 * @returns Service configuration object
 */
function buildContainerInfraConfig(
  serviceName: string,
  infraType: InfrastructureType,
  image: string,
  port: number,
  attachTo?: string,
  target?: string,
  healthCheckPath?: string,
): ServiceConfig {
  return {
    type: "external",
    infrastructureType: infraType,
    language: "container",
    workload: getWorkloadForInfraType(infraType),
    image,
    ports: [{ name: getPortNameForInfraType(infraType), port, targetPort: port }],
    ...(needsVolume(infraType) && { volumes: [createVolumeForInfraType(infraType, image)] }),
    ...(infraType === "database" && { env: generateDbEnvVars(image, serviceName) }),
    ...(attachTo && { attachTo }),
    ...(target && { target }),
    ...(healthCheckPath && { healthCheck: { path: healthCheckPath, port: port || 3000 } }),
  };
}

/**
 * Conditionally attach an infrastructure service to a target service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the infrastructure service
 * @param infraType - Type of infrastructure
 * @param attachTo - Optional target service name
 * @param port - Port number
 * @returns Updated CUE file content
 */
async function maybeAttachToTarget(
  manipulator: any,
  content: string,
  serviceName: string,
  infraType: InfrastructureType,
  attachTo: string | undefined,
  port: number,
): Promise<string> {
  if (!attachTo) return content;
  return await attachServiceToTarget(manipulator, content, serviceName, infraType, attachTo, port);
}

/**
 * Conditionally add a health check for load balancer target services.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param infraType - Type of infrastructure
 * @param target - Optional target service name
 * @param healthCheckPath - Optional health check path
 * @param port - Optional port number
 * @returns Updated CUE file content
 */
async function maybeAddLoadBalancerHealthCheck(
  manipulator: any,
  content: string,
  infraType: InfrastructureType,
  target: string | undefined,
  healthCheckPath: string | undefined,
  port: number | undefined,
): Promise<string> {
  if (infraType !== "load-balancer" || !target) return content;
  return await addHealthCheckToTarget(
    manipulator,
    content,
    target,
    healthCheckPath || "/health",
    port || 3000,
  );
}

/** Infrastructure type to default language mapping */
const INFRA_LANGUAGE_MAP: Record<InfrastructureType, string> = {
  database: "sql",
  cache: "key-value",
  queue: "messaging",
  "load-balancer": "container",
};

/** Infrastructure type to workload type mapping */
const INFRA_WORKLOAD_MAP: Record<
  InfrastructureType,
  "deployment" | "statefulset" | "serverless" | "managed"
> = {
  database: "statefulset",
  cache: "deployment",
  queue: "deployment",
  "load-balancer": "deployment",
};

/** Infrastructure type to port name mapping */
const INFRA_PORT_NAME_MAP: Record<InfrastructureType, string> = {
  database: "db",
  cache: "cache",
  queue: "amqp",
  "load-balancer": "http",
};

/**
 * Get the default language for an infrastructure type.
 * @param infraType - Type of infrastructure
 * @returns Default language string
 */
function getDefaultLanguageForInfraType(infraType: InfrastructureType): string {
  return INFRA_LANGUAGE_MAP[infraType] || "container";
}

/**
 * Get the workload type for an infrastructure type.
 * @param infraType - Type of infrastructure
 * @returns Workload type string
 */
function getWorkloadForInfraType(
  infraType: InfrastructureType,
): "deployment" | "statefulset" | "serverless" | "managed" {
  return INFRA_WORKLOAD_MAP[infraType] || "deployment";
}

/**
 * Get the port name for an infrastructure type.
 * @param infraType - Type of infrastructure
 * @returns Port name string
 */
function getPortNameForInfraType(infraType: InfrastructureType): string {
  return INFRA_PORT_NAME_MAP[infraType] || "main";
}

/**
 * Determine if an infrastructure type requires a volume.
 * @param infraType - Type of infrastructure
 * @returns True if the infrastructure type needs a volume
 */
function needsVolume(infraType: InfrastructureType): boolean {
  return infraType === "database" || infraType === "cache";
}

/**
 * Create a volume configuration for an infrastructure type.
 * @param infraType - Type of infrastructure
 * @param image - Container image name
 * @returns Volume configuration object
 */
function createVolumeForInfraType(
  infraType: InfrastructureType,
  image: string,
): { name: string; path: string; size: string; type: string } {
  if (infraType === "database") {
    const dataPath = image.includes("postgres")
      ? "/var/lib/postgresql/data"
      : image.includes("mysql")
        ? "/var/lib/mysql"
        : image.includes("mongo")
          ? "/data/db"
          : "/var/lib/data";
    return { name: "data", path: dataPath, size: "50Gi", type: "persistentVolumeClaim" };
  }

  if (infraType === "cache") {
    return { name: "data", path: "/data", size: "10Gi", type: "persistentVolumeClaim" };
  }

  return { name: "data", path: "/var/lib/data", size: "10Gi", type: "persistentVolumeClaim" };
}

/**
 * Generate database environment variables based on image type.
 * @param image - Container image name
 * @param dbName - Database name
 * @returns Environment variable key-value pairs
 */
function generateDbEnvVars(image: string, dbName: string): Record<string, string> {
  if (image.includes("mysql")) {
    return {
      MYSQL_DATABASE: dbName,
      MYSQL_USER: `${dbName}_user`,
      MYSQL_PASSWORD: `${dbName}_password`,
      MYSQL_ROOT_PASSWORD: `${dbName}_root`,
      DATABASE_URL: `mysql://$MYSQL_USER:$MYSQL_PASSWORD@${dbName}:3306/${dbName}`,
    };
  }

  if (image.includes("mongo")) {
    return {
      MONGO_INITDB_DATABASE: dbName,
      MONGODB_URL: `mongodb://${dbName}:27017/${dbName}`,
    };
  }

  // Default to PostgreSQL
  return {
    POSTGRES_DB: dbName,
    POSTGRES_USER: `${dbName}_user`,
    POSTGRES_PASSWORD: `${dbName}_password`,
    DATABASE_URL: `postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@${dbName}:5432/${dbName}`,
  };
}

/**
 * Attach an infrastructure service to a target service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the infrastructure service
 * @param infraType - Type of infrastructure
 * @param targetService - Target service name
 * @param port - Port number
 * @returns Updated CUE file content
 */
async function attachServiceToTarget(
  manipulator: any,
  content: string,
  serviceName: string,
  infraType: InfrastructureType,
  targetService: string,
  port: number,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (ast.services?.[targetService]) {
      if (!ast.services[targetService].env) {
        ast.services[targetService].env = {};
      }

      const envVars = generateEnvVarsForInfraType(infraType, serviceName, port);
      Object.assign(ast.services[targetService].env, envVars);

      // Also add to dependencies
      if (!ast.services[targetService].dependencies) {
        ast.services[targetService].dependencies = {};
      }
      ast.services[targetService].dependencies[infraType] = {
        service: serviceName,
        description: `${infraType} service`,
      };

      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Could not attach ${infraType} to service ${targetService}`));
  }
  return content;
}

/** Function type for generating environment variables */
type EnvVarGenerator = (serviceName: string, port: number) => Record<string, string>;

/** Infrastructure type to environment variable generator mapping */
const INFRA_ENV_GENERATORS: Partial<Record<InfrastructureType, EnvVarGenerator>> = {
  database: (serviceName, port) => ({
    DATABASE_URL: `postgres://${serviceName}:${port}/${serviceName}`,
  }),
  cache: (serviceName, port) => ({ REDIS_URL: `redis://${serviceName}:${port}` }),
  queue: (serviceName, port) => ({ AMQP_URL: `amqp://${serviceName}:${port}` }),
};

/**
 * Generate environment variables for an infrastructure type.
 * @param infraType - Type of infrastructure
 * @param serviceName - Name of the service
 * @param port - Port number
 * @returns Environment variable key-value pairs
 */
function generateEnvVarsForInfraType(
  infraType: InfrastructureType,
  serviceName: string,
  port: number,
): Record<string, string> {
  const generator = INFRA_ENV_GENERATORS[infraType];
  return generator ? generator(serviceName, port) : {};
}

/**
 * Add a health check configuration to a target service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param target - Target service name
 * @param healthCheckPath - Health check endpoint path
 * @param port - Port number
 * @returns Updated CUE file content
 */
async function addHealthCheckToTarget(
  manipulator: any,
  content: string,
  target: string,
  healthCheckPath: string,
  port: number,
): Promise<string> {
  try {
    const ast = await manipulator.parse(content);
    if (ast.services?.[target] && !ast.services[target].healthCheck) {
      ast.services[target].healthCheck = {
        path: healthCheckPath,
        port,
      };
      return await manipulator.serialize(ast, content);
    }
  } catch (error) {
    console.warn(chalk.yellow(`⚠️  Could not add health check to target service ${target}`));
  }
  return content;
}

/**
 * Add a service using a template.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Updated CUE file content
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
      updatedContent = await addUIComponentsForService(
        manipulator,
        updatedContent,
        serviceName,
        options,
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
 * Create a service configuration from template options.
 * @param serviceName - Name of the service
 * @param directory - Source directory path
 * @param options - Service configuration options
 * @returns Service configuration object
 */
function createTemplateServiceConfig(
  serviceName: string,
  directory: string,
  options: ServiceTemplateOptions,
): ServiceConfig {
  return {
    type: "internal",
    language: options.language || "typescript",
    workload: "deployment",
    sourceDirectory: directory,
    template: options.template!,
    ...(options.port && {
      ports: [{ name: "http", port: options.port, targetPort: options.port }],
    }),
  };
}

/**
 * Determine if UI components should be added based on options.
 * @param options - Service configuration options
 * @returns True if UI components should be added
 */
function shouldAddUIComponents(_options: ServiceTemplateOptions): boolean {
  // Services added via "arbiter add service" are backend services
  // They should not get UI routes/locators by default
  return false;
}

/**
 * Add UI components (routes and locators) for a service.
 * @param manipulator - CUE file manipulator instance
 * @param content - Current CUE file content
 * @param serviceName - Name of the service
 * @param options - Service configuration options
 * @returns Updated CUE file content
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
