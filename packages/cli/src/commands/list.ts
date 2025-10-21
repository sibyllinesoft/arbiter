import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { ApiClient } from "../api-client.js";
import { createCUEManipulator } from "../cue/index.js";
import type { CLIConfig } from "../types.js";
import { formatComponentTable, formatJson, formatYaml } from "../utils/formatting.js";
import { withProgress } from "../utils/progress.js";

export interface ListOptions {
  format?: "table" | "json" | "yaml";
  verbose?: boolean;
}

const VALID_TYPES = [
  "service",
  "endpoint",
  "route",
  "model",
  "event",
  "job",
  "middleware",
  "config",
  "deployment",
  "component",
  "module",
  "package",
  "flow",
  "locator",
  "schema",
  "cache",
  "database",
  "load-balancer",
] as const;

type ValidType = (typeof VALID_TYPES)[number];

export async function listCommand(
  type: string,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    // Validate type parameter
    if (!VALID_TYPES.includes(type as ValidType)) {
      console.error(chalk.red(`Invalid type: ${type}`));
      console.error(chalk.gray(`Valid types: ${VALID_TYPES.join(", ")}`));
      return 1;
    }

    if (config.localMode) {
      return await listComponentsLocally(type as ValidType, options, config);
    }

    const client = new ApiClient(config);

    // List components with progress indicator
    const result = await withProgress({ text: `Listing ${type}s...` }, () =>
      client.listComponents(type),
    );

    if (!result.success) {
      console.error(chalk.red("List failed:"), result.error);
      return 1;
    }

    const components = result.data || [];

    // Handle empty results
    if (components.length === 0) {
      console.log(chalk.yellow(`No ${type}s found`));
      return 0;
    }

    // Format and display results based on output format
    const outputFormat = options.format || config.format;
    switch (outputFormat) {
      case "json":
        console.log(formatJson(components));
        break;
      case "yaml":
        console.log(formatYaml(components));
        break;
      case "table":
      default:
        console.log(formatComponentTable(components));
        break;
    }

    // Show summary if verbose
    if (options.verbose) {
      console.log(chalk.gray(`\nFound ${components.length} ${type}(s)`));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("List command failed:"), error.message);
    return 2;
  }
}

async function listComponentsLocally(
  type: ValidType,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    const spec = await loadLocalAssemblySpec(config);

    if (!spec) {
      console.error(
        chalk.red("Local specification not found:"),
        path.join(config.projectDir ?? process.cwd(), ".arbiter", "assembly.cue"),
      );
      console.log(chalk.dim("Generate one with: arbiter add service <name>"));
      return 1;
    }

    const components = buildComponentsFromSpec(spec, type);

    if (components.length === 0) {
      console.log(chalk.yellow(`No ${type}s found`));
      return 0;
    }

    const outputFormat = options.format || config.format;
    switch (outputFormat) {
      case "json":
        console.log(formatJson(components));
        break;
      case "yaml":
        console.log(formatYaml(components));
        break;
      case "table":
      default:
        console.log(formatComponentTable(components));
        break;
    }

    if (options.verbose) {
      console.log(chalk.gray(`\nFound ${components.length} ${type}(s)`));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("List command failed in local mode:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

async function loadLocalAssemblySpec(config: CLIConfig): Promise<any | null> {
  const projectRoot = config.projectDir || process.cwd();
  const assemblyPath = path.resolve(projectRoot, ".arbiter", "assembly.cue");

  if (!(await fs.pathExists(assemblyPath))) {
    return null;
  }

  const content = await fs.readFile(assemblyPath, "utf-8");
  const manipulator = createCUEManipulator();

  try {
    return await manipulator.parse(content);
  } finally {
    await manipulator.cleanup();
  }
}

function buildComponentsFromSpec(spec: any, type: ValidType): any[] {
  switch (type) {
    case "service":
      return buildServiceComponents(spec);
    case "endpoint":
      return buildEndpointComponents(spec);
    case "route":
      return buildRouteComponents(spec);
    case "flow":
      return buildFlowComponents(spec);
    case "locator":
      return buildLocatorComponents(spec);
    case "schema":
      return buildSchemaComponents(spec);
    case "package":
      return buildPackageComponents(spec);
    case "component":
      return buildUIComponents(spec);
    case "module":
      return buildModuleComponents(spec);
    case "cache":
      return buildCacheComponents(spec);
    case "database":
      return buildDatabaseComponents(spec);
    case "load-balancer":
      return buildLoadBalancerComponents(spec);
    default:
      return [];
  }
}

function buildServiceComponents(spec: any): any[] {
  return Object.entries(spec?.services ?? {}).map(([name, service]: [string, any]) =>
    createComponent(
      name,
      "service",
      service?.status || "active",
      [service?.language, service?.type].filter(Boolean).join(" "),
    ),
  );
}

function buildEndpointComponents(spec: any): any[] {
  const paths = spec?.paths ?? {};
  const components: any[] = [];

  for (const [endpointPath, methods] of Object.entries(paths)) {
    if (typeof methods !== "object" || methods === null) continue;

    for (const [method, details] of Object.entries(methods as Record<string, any>)) {
      const upperMethod = method.toUpperCase();
      const description = details?.summary || details?.description || "";
      components.push(
        createComponent(`${upperMethod} ${endpointPath}`, "endpoint", "active", description),
      );
    }
  }

  return components;
}

function buildRouteComponents(spec: any): any[] {
  const routes = spec?.ui?.routes ?? [];
  return routes.map((route: any) =>
    createComponent(
      route?.id || route?.path || "route",
      "route",
      "active",
      route?.path || route?.description || "",
    ),
  );
}

function buildFlowComponents(spec: any): any[] {
  const flows = spec?.flows ?? [];
  return flows.map((flow: any) =>
    createComponent(flow?.id || "flow", "flow", "active", `${flow?.steps?.length ?? 0} steps`),
  );
}

function buildLocatorComponents(spec: any): any[] {
  const locatorsRecord: Record<string, unknown> = spec?.locators ?? {};
  return Object.entries(locatorsRecord).map(([key, value]) =>
    createComponent(key, "locator", "active", String(value)),
  );
}

function buildSchemaComponents(spec: any): any[] {
  const schemasRecord: Record<string, any> = spec?.components?.schemas ?? {};
  return Object.entries(schemasRecord).map(([name, schema]) =>
    createComponent(name, "schema", "active", schema?.description || ""),
  );
}

function buildPackageComponents(spec: any): any[] {
  const packagesRecord: Record<string, any> = spec?.components?.packages ?? {};
  return Object.entries(packagesRecord).map(([name, pkg]) =>
    createComponent(name, "package", "active", pkg?.description || pkg?.version || ""),
  );
}

function buildUIComponents(spec: any): any[] {
  const componentsRecord: Record<string, any> = spec?.components?.ui ?? {};
  return Object.entries(componentsRecord).map(([name, component]) =>
    createComponent(name, "component", "active", component?.framework || ""),
  );
}

function buildModuleComponents(spec: any): any[] {
  const modulesRecord: Record<string, any> = spec?.components?.modules ?? {};
  return Object.entries(modulesRecord).map(([name, module]) =>
    createComponent(name, "module", "active", module?.language || ""),
  );
}

function buildCacheComponents(spec: any): any[] {
  const servicesRecord: Record<string, any> = spec?.services ?? {};
  return Object.entries(servicesRecord)
    .filter(([, service]) => isCacheService(service))
    .map(([name, service]) =>
      createComponent(
        name,
        "cache",
        "active",
        service?.serviceType || service?.type || "cache service",
      ),
    );
}

function buildDatabaseComponents(spec: any): any[] {
  const databaseServices: Record<string, any> = spec?.services ?? {};
  return Object.entries(databaseServices)
    .filter(([, service]) => isDatabaseService(service))
    .map(([name, service]) =>
      createComponent(
        name,
        "database",
        "active",
        service?.serviceType || service?.image || "database service",
      ),
    );
}

function buildLoadBalancerComponents(spec: any): any[] {
  const loadBalancer = spec?.services?.loadbalancer;
  if (!loadBalancer) {
    return [];
  }

  return [
    createComponent(
      "loadbalancer",
      "load-balancer",
      loadBalancer?.status || "active",
      loadBalancer?.serviceType || loadBalancer?.image || "load balancer service",
    ),
  ];
}

function isCacheService(service: any): boolean {
  if (!service) return false;
  const type = String(service.serviceType || service.type || "").toLowerCase();
  return ["cache", "kv", "redis", "memcached"].some((keyword) => type.includes(keyword));
}

function isDatabaseService(service: any): boolean {
  if (!service) return false;
  const type = String(service.serviceType || service.type || service.image || "").toLowerCase();
  return ["postgres", "mysql", "database", "db", "sql", "mongo", "d1"].some((keyword) =>
    type.includes(keyword),
  );
}

function createComponent(
  name: string,
  type: string,
  status: string,
  description: string,
): { name: string; type: string; status: string; description: string } {
  return {
    name,
    type,
    status: status || "unknown",
    description: description || "",
  };
}
