/**
 * Add command - Compositional interface for building specifications
 *
 * COMPLETELY REWRITTEN to use proper AST-based CUE manipulation
 * instead of fragile string concatenation.
 *
 * This command allows users to incrementally build up their project specification
 * stored under the .arbiter/ directory through discrete, validated operations
 * using the CUE tool.
 */

import * as path from "node:path";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";
import { ApiClient } from "../../api-client.js";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import { safeFileOperation } from "../../constraints/index.js";
import { formatCUE, validateCUE } from "../../cue/index.js";
import type { CLIConfig } from "../../types.js";
import { ensureProjectExists } from "../../utils/project.js";
import { toTitleCase } from "./shared.js";
import { addCache } from "./subcommands/cache.js";
import { addClient } from "./subcommands/client.js";
import { addContractOperation, addContractWorkflow } from "./subcommands/contracts.js";
import { addDatabase } from "./subcommands/database.js";
import { addEndpoint } from "./subcommands/endpoint.js";
import { addFlow } from "./subcommands/flow.js";
import { addLoadBalancer } from "./subcommands/load-balancer.js";
import { addLocator } from "./subcommands/locator.js";
// Module and package helpers are defined locally in this file
import { addRoute } from "./subcommands/route.js";
import { addSchema } from "./subcommands/schema.js";
import { addService } from "./subcommands/service.js";

export interface AddOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  template?: string;
}

/**
 * Main add command dispatcher
 */
export async function runAddCommand(
  subcommand: string,
  name: string,
  options: AddOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  const manipulator = getCueManipulator();

  try {
    console.log(chalk.blue(`🔧 Adding ${subcommand}: ${name}`));

    // Get existing assembly content from sharded storage in service
    const assemblyDir = path.resolve(".arbiter"); // Move to .arbiter directory
    const assemblyPath = path.join(assemblyDir, "assembly.cue");
    let assemblyContent = "";

    const useLocalOnly = config.localMode === true;
    if (useLocalOnly && options.verbose) {
      console.log(chalk.dim("📁 Local mode enabled: using .arbiter CUE files only"));
    }

    if (useLocalOnly) {
      if (await fs.pathExists(assemblyPath)) {
        assemblyContent = await fs.readFile(assemblyPath, "utf-8");
        if (options.verbose) {
          console.log(chalk.dim("📁 Loaded existing specification from .arbiter directory"));
        }
      } else {
        console.log(
          chalk.yellow("⚠️  No existing specification found. Creating new specification..."),
        );
        assemblyContent = await initializeAssembly();
      }
    } else {
      // Initialize API client to try getting existing specification from sharded storage
      const apiClient = new ApiClient(config);

      try {
        // First try to get the specification from the service's sharded storage
        const storedSpec = await apiClient.getSpecification("assembly", assemblyPath);
        if (storedSpec.success && storedSpec.data && storedSpec.data.content) {
          assemblyContent = storedSpec.data.content;
          if (options.verbose) {
            console.log(
              chalk.dim("📡 Retrieved existing specification from service (sharded storage)"),
            );
          }
        } else {
          throw new Error("No stored specification found");
        }
      } catch (_apiError) {
        // Fallback to local .arbiter storage only
        if (await fs.pathExists(assemblyPath)) {
          assemblyContent = await fs.readFile(assemblyPath, "utf-8");
          if (options.verbose) {
            console.log(chalk.dim("📁 Retrieved existing specification from .arbiter directory"));
          }
        } else {
          // Initialize with basic structure
          console.log(
            chalk.yellow("⚠️  No existing specification found. Creating new specification..."),
          );
          assemblyContent = await initializeAssembly();
        }
      }
    }

    let updatedContent = assemblyContent;

    const persistLocalAssembly = async (content: string, reason: string) => {
      await fs.ensureDir(assemblyDir);
      await safeFileOperation("write", assemblyPath, async (validatedPath) => {
        await fs.writeFile(validatedPath, content, "utf-8");
      });

      const relativePath = path.relative(process.cwd(), assemblyPath) || assemblyPath;
      const suffix = reason ? ` (${reason})` : "";
      console.log(chalk.green(`✅ Updated ${relativePath}${suffix}`));

      if (options.verbose) {
        console.log(chalk.dim("Added configuration:"));
        console.log(chalk.dim(showDiff(assemblyContent, content)));
      }
    };

    // Route to appropriate handler using AST-based manipulation
    switch (subcommand) {
      case "service":
        updatedContent = await addService(manipulator, assemblyContent, name, options);
        break;
      case "client":
        updatedContent = await addClient(manipulator, assemblyContent, name, options);
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
      case "contract":
        updatedContent = await addContractWorkflow(manipulator, assemblyContent, name, options);
        break;
      case "contract-operation": {
        const contractName = options.contract;
        if (typeof contractName !== "string" || contractName.trim().length === 0) {
          throw new Error("Contract name is required for contract-operation subcommand");
        }
        updatedContent = await addContractOperation(
          manipulator,
          assemblyContent,
          contractName,
          name,
          options,
        );
        break;
      }
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
            "Available subcommands: service, client, endpoint, route, flow, load-balancer, database, cache, locator, schema, contract, contract-operation, package, component",
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
    } else if (useLocalOnly) {
      await persistLocalAssembly(updatedContent, "local mode");
    } else {
      // Initialize API client and store specification in service database
      const apiClient = new ApiClient(config);
      let storeSucceeded = false;

      try {
        // Determine shard type based on subcommand
        const shardType = getShardTypeForSubcommand(subcommand);

        // Store the updated CUE specification in the service with sharding
        const storeResult = await apiClient.storeSpecification({
          content: updatedContent,
          type: shardType,
          path: assemblyPath,
          shard: shardType, // Use shard type as shard identifier
        });

        if (storeResult.success) {
          storeSucceeded = true;
          console.log(chalk.green(`✅ Updated specification in service (${subcommand}: ${name})`));
          console.log(
            chalk.dim("💡 CUE files will be generated to .arbiter/ when specification is complete"),
          );

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
        console.error(
          chalk.red("❌ Failed to store specification with Arbiter service:"),
          apiError instanceof Error ? apiError.message : String(apiError),
        );
        console.error(
          chalk.dim("Tip: re-run with --local if you intentionally want to work offline."),
        );
        return 1;
      }

      if (storeSucceeded) {
        await syncEntityWithProject(apiClient, config, subcommand, name, options);
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

ui: {
  routes: [
    {
      id:   "app:home"
      path: "/"
      capabilities: ["view"]
      components: ["HomePage"]
    },
  ]
}

locators: {
  "page:home":  "[data-testid=\\"home-page\\"]"
  "btn:start":  "[data-testid=\\"start-button\\"]"
  "toast:ok":   "[data-testid=\\"toast-ok\\"]"
}

flows: [
  {
    id: "baseline_e2e"
    steps: [
      { visit: "/" },
      { expect: { locator: "page:home",  state: "visible" } },
      { click:  "btn:start" },
      { expect: { locator: "toast:ok", text: { contains: "ready" } } },
    ]
  },
]

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
 * Flow configuration options
 */
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
    packageConfig.exports = options.exports.split(",").map((e) => e.trim());
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
    componentConfig.props = options.props.split(",").map((p) => p.trim());
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
    type: "package",
    language: options.language || "typescript",
    directory: options.directory || `src/modules/${moduleName}`,
  };

  if (options.functions) {
    moduleConfig.functions = options.functions.split(",").map((f) => f.trim());
  }

  if (options.types) {
    moduleConfig.types = options.types.split(",").map((t) => t.trim());
  }

  return await manipulator.addToSection(content, "components.modules", moduleName, moduleConfig);
}

// Helper functions
function showDiff(oldContent: string, newContent: string): string {
  const diff = diffLines(oldContent, newContent);

  return diff
    .flatMap((part) =>
      part.value
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          if (part.added) return `+ ${line}`;
          if (part.removed) return `- ${line}`;
          return `  ${line}`;
        }),
    )
    .join("\n");
}

/**
 * Determine shard type based on add subcommand for better organization
 */
function getShardTypeForSubcommand(subcommand: string): string {
  const shardMapping: Record<string, string> = {
    service: "services",
    client: "clients",
    endpoint: "endpoints",
    route: "routes",
    flow: "flows",
    database: "services", // Databases go with services
    "load-balancer": "services", // Load balancers go with services
    schema: "schemas",
    locator: "locators",
    contract: "contracts",
    "contract-operation": "contracts",
  };

  return shardMapping[subcommand] || "assembly";
}

async function syncEntityWithProject(
  client: ApiClient,
  config: CLIConfig,
  subcommand: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const entityType = mapSubcommandToEntityType(subcommand);
  if (!entityType) return;

  const projectId = await ensureProjectExists(client, config);

  switch (entityType) {
    case "service":
      await upsertServiceEntity(client, projectId, name, options);
      console.log(chalk.dim(`🗄️  Synced service "${name}" with project catalog`));
      break;
    case "database":
      await upsertDatabaseEntity(client, projectId, name, options);
      console.log(chalk.dim(`🗄️  Synced database "${name}" with project catalog`));
      break;
    default:
      await upsertGenericEntity(client, projectId, entityType, name, options);
      console.log(chalk.dim(`🗄️  Synced ${entityType} "${name}" with project catalog`));
  }
}

async function upsertServiceEntity(
  client: ApiClient,
  projectId: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const artifactId = await findExistingArtifactId(client, projectId, "service", name);
  const values = buildServiceEntityValues(name, options);

  if (artifactId) {
    const result = await client.updateProjectEntity(projectId, artifactId, {
      type: "service",
      values,
    });
    if (!result.success) {
      throw new Error(result.error || `Failed to update service "${name}" in project catalog`);
    }
  } else {
    const result = await client.createProjectEntity(projectId, { type: "service", values });
    if (!result.success) {
      throw new Error(result.error || `Failed to register service "${name}" in project catalog`);
    }
  }
}

async function upsertDatabaseEntity(
  client: ApiClient,
  projectId: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const artifactId = await findExistingArtifactId(client, projectId, "database", name);
  const values = buildDatabaseEntityValues(name, options);

  if (artifactId) {
    const result = await client.updateProjectEntity(projectId, artifactId, {
      type: "database",
      values,
    });
    if (!result.success) {
      throw new Error(result.error || `Failed to update database "${name}" in project catalog`);
    }
  } else {
    const result = await client.createProjectEntity(projectId, { type: "database", values });
    if (!result.success) {
      throw new Error(result.error || `Failed to register database "${name}" in project catalog`);
    }
  }
}

async function upsertGenericEntity(
  client: ApiClient,
  projectId: string,
  type: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const artifactId = await findExistingArtifactId(client, projectId, type, name);
  const values = buildGenericEntityValues(type, name, options);

  if (artifactId) {
    const result = await client.updateProjectEntity(projectId, artifactId, { type, values });
    if (!result.success) {
      throw new Error(result.error || `Failed to update ${type} "${name}" in project catalog`);
    }
  } else {
    const result = await client.createProjectEntity(projectId, { type, values });
    if (!result.success) {
      throw new Error(result.error || `Failed to register ${type} "${name}" in project catalog`);
    }
  }
}

async function findExistingArtifactId(
  client: ApiClient,
  projectId: string,
  type: string,
  name: string,
): Promise<string | null> {
  const projectResult = await client.getProject(projectId);
  if (!projectResult.success) {
    throw new Error(projectResult.error || `Failed to fetch project ${projectId} details`);
  }

  const spec = projectResult.data?.resolved?.spec ?? projectResult.data?.spec;
  if (!spec || typeof spec !== "object") {
    return null;
  }

  // Prefer artifacts if available
  const artifacts = Array.isArray(projectResult.data?.resolved?.artifacts)
    ? projectResult.data.resolved.artifacts
    : [];

  const target = normalizeName(name);

  const artifactMatch = artifacts.find(
    (a: any) => normalizeName(a?.name) === target && (a?.type || "").toLowerCase() === type,
  );
  if (artifactMatch?.id) return artifactMatch.id as string;

  // Fallback to spec collections for specific types
  const collectionKey = mapEntityTypeToSpecCollection(type);
  if (!collectionKey) return null;

  const collection = spec[collectionKey] as Record<string, any> | undefined;
  if (!collection || typeof collection !== "object") {
    return null;
  }

  for (const entry of Object.values(collection)) {
    if (!entry || typeof entry !== "object") continue;
    const entryNameRaw =
      typeof (entry as any).name === "string"
        ? (entry as any).name
        : typeof (entry as any).displayName === "string"
          ? (entry as any).displayName
          : typeof (entry as any).metadata?.name === "string"
            ? (entry as any).metadata.name
            : undefined;
    if (!entryNameRaw) continue;

    if (entryNameRaw.trim().toLowerCase() !== target) {
      continue;
    }

    const idCandidate =
      typeof (entry as any).artifactId === "string"
        ? (entry as any).artifactId
        : typeof (entry as any).metadata?.artifactId === "string"
          ? (entry as any).metadata.artifactId
          : typeof (entry as any).id === "string"
            ? (entry as any).id
            : undefined;
    if (idCandidate) {
      return idCandidate;
    }
  }

  return null;
}

function mapEntityTypeToSpecCollection(type: string): string | null {
  switch (type) {
    case "service":
      return "services";
    case "database":
      return "databases";
    case "package":
      return "components"; // packages live under components.packages but resolved flatten; handled via artifacts mostly
    case "tool":
    case "frontend":
    case "infrastructure":
      return "components";
    case "route":
      return "ui"; // handled separately elsewhere; artifacts cover main cases
    default:
      return null;
  }
}

function normalizeName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function buildServiceEntityValues(
  name: string,
  options: Record<string, any>,
): Record<string, unknown> {
  const language =
    typeof options.language === "string" && options.language.trim().length > 0
      ? options.language.trim()
      : "typescript";

  const values: Record<string, unknown> = {
    name,
    language,
  };

  if (typeof options.port === "number" && Number.isFinite(options.port)) {
    values.port = options.port;
  }

  if (typeof options.serviceType === "string" && options.serviceType.trim().length > 0) {
    values.serviceType = options.serviceType.trim();
  }

  const inferredSource =
    typeof options.directory === "string" && options.directory.trim().length > 0
      ? options.directory.trim()
      : `./src/${name}`;
  values.sourcePath = inferredSource;

  return values;
}

function buildDatabaseEntityValues(
  name: string,
  options: Record<string, any>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { name };
  if (typeof options.type === "string" && options.type.trim().length > 0) {
    values.type = options.type.trim();
  }
  return values;
}

function buildGenericEntityValues(
  type: string,
  name: string,
  options: Record<string, any>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { name };

  if (options?.path) values.path = options.path;
  if (options?.description) values.description = options.description;
  if (options?.id) values.id = options.id;

  switch (type) {
    case "route":
      values.path = options.path ?? name;
      values.id = options.id ?? name;
      break;
    case "flow":
      values.id = options.id ?? name;
      break;
    case "capability":
      values.id = options.id ?? name;
      break;
    default:
      break;
  }

  return values;
}

function mapSubcommandToEntityType(subcommand: string): string | null {
  const normalized = subcommand.trim().toLowerCase();
  const map: Record<string, string> = {
    service: "service",
    database: "database",
    package: "package",
    tool: "tool",
    frontend: "frontend",
    "load-balancer": "infrastructure",
    cache: "database",
    route: "route",
    flow: "flow",
    capability: "capability",
    epic: "epic",
    task: "task",
  };

  return map[normalized] || null;
}
