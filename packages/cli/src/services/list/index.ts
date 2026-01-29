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
import type { CLIConfig } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import { formatComponentTable, formatJson, formatYaml } from "@/utils/util/output/formatting.js";
import chalk from "chalk";
import fs from "fs-extra";

export interface ListOptions {
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
 */
async function listComponentsRemotely(
  type: ValidType,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  const client = new ApiClient(config);
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

export async function listCommand(
  type: string,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    if (!isValidType(type)) {
      reportInvalidType(type);
      return 1;
    }

    if (config.localMode) {
      return await listComponentsLocally(type, options, config);
    }

    return await listComponentsRemotely(type, options, config);
  } catch (error) {
    console.error(chalk.red("List command failed:"), (error as Error).message);
    return 2;
  }
}

async function listComponentsLocally(
  type: ValidType,
  _options: ListOptions,
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
