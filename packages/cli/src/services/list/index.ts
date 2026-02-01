/**
 * @packageDocumentation
 * List command - List specification components.
 *
 * Provides functionality to:
 * - List services, clients, endpoints, routes
 * - List flows, schemas, packages, and tools
 * - Output in table, JSON, or YAML format
 */

import path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { ApiClient } from "@/io/api/api-client.js";
import { isMarkdownStorage } from "@/services/add/markdown-handlers.js";
import type { CLIConfig } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import { Storage } from "@/utils/storage/index.js";
import { MarkdownStorage } from "@/utils/storage/markdown-storage.js";
import { EntitySchemas, filterEntities } from "@/utils/storage/schema.js";
import type { EntityNode, EntityType } from "@/utils/storage/types.js";
import { formatComponentTable, formatJson, formatYaml } from "@/utils/util/output/formatting.js";
import chalk from "chalk";
import fs from "fs-extra";

/**
 * List options - format/verbose are explicit, all other properties
 * are dynamic filter fields from entity schemas
 */
export interface ListOptions extends Record<string, unknown> {
  format?: "table" | "json" | "yaml";
  verbose?: boolean;
}

const VALID_TYPES = [
  "service",
  "client",
  "endpoint",
  "route",
  "view",
  "model",
  "event",
  "job",
  "middleware",
  "config",
  "deployment",
  "component",
  "package",
  "flow",
  "locator",
  "schema",
  "cache",
  "database",
  "load-balancer",
  "tool",
  "infrastructure",
  "group",
  "task",
  "note",
  "contract",
  "capability",
] as const;

type ValidType = (typeof VALID_TYPES)[number];

/**
 * Validate component type
 */
function isValidType(type: string): type is ValidType {
  return VALID_TYPES.includes(type as ValidType);
}

/**
 * Report invalid type error
 */
function reportInvalidType(type: string): void {
  console.error(chalk.red(`Invalid type: ${type}`));
  console.error(chalk.gray(`Valid types: ${VALID_TYPES.join(", ")}`));
}

/**
 * Output components in the specified format
 */
function outputComponents(components: any[], format: string | undefined): void {
  switch (format) {
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
}

/**
 * List components from remote API
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 */
async function listComponentsRemotely(
  type: ValidType,
  options: ListOptions,
  config: CLIConfig,
  injectedClient?: ApiClient,
): Promise<number> {
  const client = injectedClient ?? new ApiClient(config);
  const result = await withProgress({ text: `Listing ${type}s...` }, () =>
    client.listComponents(type),
  );

  if (!result.success) {
    console.error(chalk.red("List failed:"), result.error);
    return 1;
  }

  const components = result.data || [];
  if (components.length === 0) {
    console.log(chalk.yellow(`No ${type}s found`));
    return 0;
  }

  outputComponents(components, options.format || config.format);

  if (options.verbose) {
    console.log(chalk.gray(`\nFound ${components.length} ${type}(s)`));
  }

  return 0;
}

/**
 * List command entry point
 * @param injectedClient - Optional pre-created ApiClient (for testing)
 */
export async function listCommand(
  type: string,
  options: ListOptions,
  config: CLIConfig,
  injectedClient?: ApiClient,
): Promise<number> {
  try {
    if (!isValidType(type)) {
      reportInvalidType(type);
      return 1;
    }

    if (config.localMode) {
      return await listComponentsLocally(type, options, config);
    }

    return await listComponentsRemotely(type, options, config, injectedClient);
  } catch (error) {
    console.error(chalk.red("List command failed:"), (error as Error).message);
    return 2;
  }
}

async function listComponentsLocally(
  type: ValidType,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    const projectDir = config.projectDir ?? process.cwd();

    // Check if project uses markdown-first storage
    const useMarkdown = await isMarkdownStorage(projectDir);

    if (useMarkdown) {
      return await listFromMarkdownStorage(type, options, projectDir);
    }

    // Handle task and note types separately (they use dedicated storage files)
    if (type === "task" || type === "note") {
      return await listStorageItems(type, options, config);
    }

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
      console.log(chalk.yellow(`No ${type}s found locally`));
      return 0;
    }

    console.log(formatComponentTable(components));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("Failed to list components locally:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Map ValidType to EntityType for markdown storage queries
 */
function mapTypeToEntityType(type: ValidType): EntityType | EntityType[] | null {
  const typeMap: Partial<Record<ValidType, EntityType | EntityType[]>> = {
    service: "service",
    client: "client",
    endpoint: "endpoint",
    route: "route",
    database: "resource",
    cache: "resource",
    infrastructure: "resource",
    group: "group",
    task: "task",
    note: "note",
    schema: "schema",
    contract: "contract",
    flow: "flow",
    locator: "locator",
  };
  return typeMap[type] ?? null;
}

/**
 * List entities from markdown storage
 */
async function listFromMarkdownStorage(
  type: ValidType,
  options: ListOptions,
  projectDir: string,
): Promise<number> {
  const storage = new MarkdownStorage(path.join(projectDir, ".arbiter"));

  // Map CLI type to entity type(s)
  const entityType = mapTypeToEntityType(type);

  if (!entityType) {
    console.log(chalk.yellow(`Type "${type}" is not supported with markdown storage yet`));
    return 0;
  }

  // Load entities
  const entityTypes = Array.isArray(entityType) ? entityType : [entityType];
  const entities = await storage.list(entityTypes);

  // Additional filtering for resource subtypes
  let filteredEntities = entities;
  if (type === "database") {
    filteredEntities = entities.filter((e) => e.frontmatter.kind === "database");
  } else if (type === "cache") {
    filteredEntities = entities.filter((e) => e.frontmatter.kind === "cache");
  } else if (type === "infrastructure") {
    // Show all resources
  }

  if (filteredEntities.length === 0) {
    console.log(chalk.yellow(`No ${type}s found`));
    return 0;
  }

  // Format for output
  const components = filteredEntities.map((entity) => formatEntityForOutput(entity, type));

  const format = options.format || "table";
  if (format === "json") {
    console.log(formatJson(components));
  } else if (format === "yaml") {
    console.log(formatYaml(components));
  } else {
    console.log(formatComponentTable(components));
  }

  if (options.verbose) {
    console.log(chalk.gray(`\nFound ${components.length} ${type}(s)`));
  }

  return 0;
}

/**
 * Format an EntityNode for CLI output
 */
function formatEntityForOutput(entity: EntityNode, type: ValidType): Record<string, unknown> {
  const base = {
    name: entity.name,
    type,
    id: entity.entityId,
    path: entity.filePath,
  };

  switch (type) {
    case "service":
      return {
        ...base,
        language: entity.frontmatter.language ?? "unknown",
        port: entity.frontmatter.port,
        subtype: entity.frontmatter.subtype,
        endpoints: entity.childIds.length,
      };

    case "client":
      return {
        ...base,
        language: entity.frontmatter.language ?? "unknown",
        framework: entity.frontmatter.framework,
        subtype: entity.frontmatter.subtype ?? "frontend",
      };

    case "endpoint":
      return {
        ...base,
        path: entity.frontmatter.path,
        methods: entity.frontmatter.methods ?? [],
      };

    case "database":
    case "cache":
    case "infrastructure":
      return {
        ...base,
        kind: entity.frontmatter.kind,
        engine: entity.frontmatter.engine,
        provider: entity.frontmatter.provider,
      };

    case "group":
      return {
        ...base,
        kind: entity.frontmatter.kind ?? "group",
        status: entity.frontmatter.status ?? "open",
        due: entity.frontmatter.due,
        tasks: entity.childIds.length,
      };

    case "task":
      return {
        ...base,
        status: entity.frontmatter.status ?? "open",
        priority: entity.frontmatter.priority,
        assignees: entity.frontmatter.assignees ?? [],
      };

    case "note":
      return {
        ...base,
        kind: entity.frontmatter.kind ?? "note",
        target: entity.frontmatter.target,
        resolved: entity.frontmatter.resolved ?? false,
      };

    default:
      return base;
  }
}

/**
 * List tasks or notes from dedicated markdown storage
 */
async function listStorageItems(
  type: "task" | "note",
  options: ListOptions,
  _config: CLIConfig,
): Promise<number> {
  const projectDir = _config.projectDir ?? process.cwd();
  const storage = new Storage({
    baseDir: path.join(projectDir, ".arbiter"),
    notesDir: path.join(projectDir, ".arbiter", "notes"),
    tasksDir: path.join(projectDir, ".arbiter", "tasks"),
  });

  await storage.initialize();

  // Get schema for this entity type
  const schema = EntitySchemas[type];

  if (type === "task") {
    const allTasks = await storage.listIssues();

    // Apply schema-based filters
    const tasks = schema
      ? (filterEntities(
          allTasks as unknown as Record<string, unknown>[],
          schema,
          options as Record<string, unknown>,
        ) as unknown as typeof allTasks)
      : allTasks;

    if (tasks.length === 0) {
      console.log(chalk.yellow("No tasks found"));
      return 0;
    }

    const format = options.format || "table";
    if (format === "json") {
      console.log(formatJson(tasks as unknown as Record<string, unknown>[]));
    } else if (format === "yaml") {
      console.log(formatYaml(tasks as unknown as Record<string, unknown>[]));
    } else {
      console.log(storage.formatIssues(tasks, "table"));
    }
  } else {
    const allNotes = await storage.listComments();

    // Apply schema-based filters
    const notes = schema
      ? (filterEntities(
          allNotes as unknown as Record<string, unknown>[],
          schema,
          options as Record<string, unknown>,
        ) as unknown as typeof allNotes)
      : allNotes;

    if (notes.length === 0) {
      console.log(chalk.yellow("No notes found"));
      return 0;
    }

    const format = options.format || "table";
    if (format === "json") {
      console.log(formatJson(notes as unknown as Record<string, unknown>[]));
    } else if (format === "yaml") {
      console.log(formatYaml(notes as unknown as Record<string, unknown>[]));
    } else {
      console.log(storage.formatComments(notes, "table"));
    }
  }

  return 0;
}

async function loadLocalAssemblySpec(_config: CLIConfig): Promise<any | null> {
  const assemblyPath = path.resolve(".arbiter", "assembly.cue");
  if (!(await fs.pathExists(assemblyPath))) {
    return null;
  }

  const manipulator = getCueManipulator();
  try {
    const content = await fs.readFile(assemblyPath, "utf-8");
    return await manipulator.parse(content);
  } catch (error) {
    console.error(chalk.red("Failed to parse local specification:"), error);
    return null;
  } finally {
    await manipulator.cleanup();
  }
}

type SpecRecord = Record<string, unknown>;
type ComponentMapper = (spec: SpecRecord, type: ValidType) => SpecRecord[];

function getEntries(data: unknown): Array<[string, SpecRecord]> {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data as Record<string, SpecRecord>);
}

function mapEntries(
  data: unknown,
  mapper: (name: string, item: SpecRecord) => SpecRecord,
): SpecRecord[] {
  return getEntries(data).map(([name, item]) => mapper(name, item));
}

const componentMappers: Partial<Record<ValidType, ComponentMapper>> = {
  service: (spec, type) =>
    mapEntries(spec.services, (name, svc) => ({
      name,
      type,
      language: svc.language || "unknown",
      endpoints: Object.keys((svc.endpoints as SpecRecord) ?? {}),
    })),

  client: (spec, type) =>
    getEntries(spec.modules)
      .filter(([, mod]) => (mod.metadata as SpecRecord)?.type === "frontend")
      .map(([name, mod]) => ({
        name,
        type,
        language: mod.language || "unknown",
        framework: (mod.metadata as SpecRecord)?.framework || "unknown",
      })),

  endpoint: (spec, type) =>
    getEntries(spec.paths).flatMap(([service, paths]) =>
      getEntries(paths).map(([endpointPath, handlers]) => ({
        name: `${service}${endpointPath}`,
        service,
        path: endpointPath,
        methods: Object.keys((handlers as SpecRecord) ?? {}),
        type,
      })),
    ),

  route: (spec, type) =>
    (((spec.ui as SpecRecord)?.routes as Array<SpecRecord>) ?? []).map((route) => ({
      name: route.id || route.path,
      path: route.path,
      capabilities: route.capabilities || [],
      type,
    })),

  view: (spec, type) =>
    (((spec.ui as SpecRecord)?.views as Array<SpecRecord>) ?? []).map((view) => ({
      name: view.id || view.name,
      path: view.filePath,
      type,
    })),

  schema: (spec, type) =>
    mapEntries(spec.schemas ?? (spec.components as SpecRecord)?.schemas, (name, schema) => ({
      name,
      type,
      references: Object.keys((schema.references as SpecRecord) ?? {}),
    })),

  database: (spec, type) =>
    mapEntries(spec.databases, (name, db) => ({
      name,
      type,
      engine: db.engine || "unknown",
    })),

  package: (spec, type) =>
    mapEntries(spec.packages ?? spec.modules, (name, pkg) => ({
      name,
      type,
      language: pkg.language || "unknown",
    })),

  tool: (spec, type) =>
    mapEntries(spec.tools, (name, tool) => ({
      name,
      type,
      commands: tool.commands || [],
    })),

  infrastructure: (spec, type) =>
    (((spec.infrastructure as SpecRecord)?.containers as Array<SpecRecord>) ?? []).map(
      (container) => ({
        name: container.name,
        type,
        scope: container.scope,
        image: container.image,
      }),
    ),

  contract: (spec, type) =>
    mapEntries((spec.contracts as SpecRecord)?.workflows, (name, contract) => ({
      name,
      type,
      operations: Object.keys((contract.operations as SpecRecord) ?? {}),
    })),

  flow: (spec, type) =>
    mapEntries(
      spec.processes ??
        (spec.domain as SpecRecord)?.processes ??
        (spec.domain as SpecRecord)?.stateMachines,
      (name, flow) => ({
        name,
        type,
        states: Object.keys((flow.states as SpecRecord) ?? {}),
      }),
    ),

  capability: (spec, type) =>
    getEntries(spec.modules)
      .filter(([, mod]) => mod.type === "capability")
      .map(([name, mod]) => ({
        name,
        type,
        description: mod.description || "",
      })),
};

function buildComponentsFromSpec(spec: SpecRecord, type: ValidType): SpecRecord[] {
  const mapper = componentMappers[type];
  return mapper ? mapper(spec, type) : [];
}

// Expose internal helpers for unit testing
export const __listTesting = {
  buildComponentsFromSpec,
  loadLocalAssemblySpec,
  VALID_TYPES,
};
