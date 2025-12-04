// @ts-nocheck
import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { ApiClient } from "../../api-client.js";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import type { CLIConfig } from "../../types.js";
import { formatComponentTable, formatJson, formatYaml } from "../../utils/formatting.js";
import { withProgress } from "../../utils/progress.js";

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
  "epic",
  "task",
  "contract",
  "capability",
] as const;

type ValidType = (typeof VALID_TYPES)[number];

export async function listCommand(
  type: string,
  options: ListOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    if (!VALID_TYPES.includes(type as ValidType)) {
      console.error(chalk.red(`Invalid type: ${type}`));
      console.error(chalk.gray(`Valid types: ${VALID_TYPES.join(", ")}`));
      return 1;
    }

    if (config.localMode) {
      return await listComponentsLocally(type as ValidType, options, config);
    }

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

function buildComponentsFromSpec(spec: any, type: ValidType): any[] {
  switch (type) {
    case "service":
      return Object.entries(spec?.services ?? {}).map(([name, service]) => ({
        name,
        type,
        language: service?.language || "unknown",
        endpoints: Object.keys(service?.endpoints ?? {}),
      }));
    case "client":
      return Object.entries(spec?.modules ?? {})
        .filter(([, module]: [string, any]) => module?.metadata?.type === "frontend")
        .map(([name, module]) => ({
          name,
          type,
          language: module?.language || "unknown",
          framework: module?.metadata?.framework || "unknown",
        }));
    case "endpoint":
      return Object.entries(spec?.paths ?? {}).flatMap(([service, paths]: [string, any]) =>
        Object.entries(paths || {}).map(([endpointPath, handlers]: [string, any]) => ({
          name: `${service}${endpointPath}`,
          service,
          path: endpointPath,
          methods: Object.keys(handlers || {}),
          type,
        })),
      );
    case "route":
      return (spec?.ui?.routes ?? []).map((route: any) => ({
        name: route.id || route.path,
        path: route.path,
        capabilities: route.capabilities || [],
        type,
      }));
    case "view":
      return (spec?.ui?.views ?? []).map((view: any) => ({
        name: view.id || view.name,
        path: view.filePath,
        type,
      }));
    case "schema":
      return Object.entries(spec?.schemas ?? {}).map(([name, schema]) => ({
        name,
        type,
        references: Object.keys(schema?.references ?? {}),
      }));
    case "database":
      return Object.entries(spec?.databases ?? {}).map(([name, database]) => ({
        name,
        type,
        engine: database?.engine || "unknown",
      }));
    case "package":
      return Object.entries(spec?.packages ?? spec?.modules ?? {}).map(([name, pkg]) => ({
        name,
        type,
        language: pkg?.language || "unknown",
      }));
    case "tool":
      return Object.entries(spec?.tools ?? {}).map(([name, tool]) => ({
        name,
        type,
        commands: tool?.commands || [],
      }));
    case "infrastructure":
      return (spec?.infrastructure?.containers ?? []).map((container: any) => ({
        name: container.name,
        type,
        scope: container.scope,
        image: container.image,
      }));
    case "contract":
      return Object.entries(spec?.contracts?.workflows ?? {}).map(([name, contract]) => ({
        name,
        type,
        operations: Object.keys(contract?.operations ?? {}),
      }));
    case "flow":
      return Object.entries(
        spec?.processes ?? spec?.domain?.processes ?? spec?.domain?.stateMachines ?? {},
      ).map(([name, flow]) => ({
        name,
        type,
        states: Object.keys(flow?.states ?? {}),
      }));
    case "capability":
      return Object.entries(spec?.modules ?? {})
        .filter(([, module]: [string, any]) => module?.type === "capability")
        .map(([name, module]) => ({
          name,
          type,
          description: module?.description || "",
        }));
    default:
      return [];
  }
}

// Expose internal helpers for unit testing
export const __listTesting = {
  buildComponentsFromSpec,
  loadLocalAssemblySpec,
  VALID_TYPES,
};
// @ts-nocheck
