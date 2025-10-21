import * as path from "node:path";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";
import { ApiClient } from "../api-client.js";
import { createCUEManipulator, validateCUE } from "../cue/index.js";
import type { CLIConfig } from "../types.js";

export interface RemoveOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  method?: string;
  id?: string;
}

export async function removeCommand(
  subcommand: string,
  target: string,
  options: RemoveOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  const manipulator = createCUEManipulator();

  try {
    console.log(chalk.blue(`🧹 Removing ${subcommand}${target ? `: ${target}` : ""}`));

    const assemblyDir = path.resolve(".arbiter");
    const assemblyPath = path.join(assemblyDir, "assembly.cue");
    const useLocalOnly = config.localMode === true;

    if (useLocalOnly && options.verbose) {
      console.log(chalk.dim("📁 Local mode enabled: applying changes to .arbiter CUE files only"));
    }

    let assemblyContent = "";

    if (useLocalOnly) {
      if (!(await fs.pathExists(assemblyPath))) {
        console.error(chalk.red("❌ No local specification found at .arbiter/assembly.cue"));
        console.log(chalk.dim("Create one with: arbiter add service <name>"));
        return 1;
      }
      assemblyContent = await fs.readFile(assemblyPath, "utf-8");
    } else {
      const apiClient = new ApiClient(config);
      try {
        const storedSpec = await apiClient.getSpecification("assembly", assemblyPath);
        if (storedSpec.success && storedSpec.data?.content) {
          assemblyContent = storedSpec.data.content;
          if (options.verbose) {
            console.log(chalk.dim("📡 Retrieved specification from Arbiter service"));
          }
        } else {
          throw new Error("No stored specification found");
        }
      } catch (_error) {
        if (await fs.pathExists(assemblyPath)) {
          assemblyContent = await fs.readFile(assemblyPath, "utf-8");
          if (options.verbose) {
            console.log(chalk.dim("📁 Falling back to local .arbiter/assembly.cue"));
          }
        } else {
          console.error(chalk.red("❌ No specification available remotely or locally"));
          console.log(chalk.dim("Create one with: arbiter add service <name>"));
          return 1;
        }
      }
    }

    let updatedContent = assemblyContent;

    switch (subcommand) {
      case "service":
        updatedContent = await manipulator.removeService(assemblyContent, target);
        break;
      case "endpoint": {
        const method = options.method as string | undefined;
        updatedContent = await manipulator.removeEndpoint(assemblyContent, target, method);
        break;
      }
      case "route": {
        const identifier = {
          id: options.id as string | undefined,
          path: target,
        };
        updatedContent = await manipulator.removeRoute(assemblyContent, identifier);
        break;
      }
      case "flow":
        updatedContent = await manipulator.removeFlow(assemblyContent, target);
        break;
      case "database":
      case "cache":
      case "load-balancer": {
        const serviceName = subcommand === "load-balancer" ? "loadbalancer" : target;
        updatedContent = await manipulator.removeService(assemblyContent, serviceName);
        break;
      }
      case "locator":
        updatedContent = await manipulator.removeFromSection(assemblyContent, "locators", target);
        break;
      case "schema":
        updatedContent = await manipulator.removeFromSection(
          assemblyContent,
          "components.schemas",
          target,
        );
        break;
      case "package": {
        const packageName = normalizeIdentifier(target);
        updatedContent = await manipulator.removeFromSection(
          assemblyContent,
          "components.packages",
          packageName,
        );
        break;
      }
      case "component": {
        const componentName = normalizeIdentifier(target);
        updatedContent = await manipulator.removeFromSection(
          assemblyContent,
          "components.ui",
          componentName,
        );
        break;
      }
      case "module": {
        const moduleName = normalizeIdentifier(target);
        updatedContent = await manipulator.removeFromSection(
          assemblyContent,
          "components.modules",
          moduleName,
        );
        break;
      }
      default:
        console.error(chalk.red(`❌ Unknown subcommand: ${subcommand}`));
        console.log(
          chalk.dim(
            "Available subcommands: service, endpoint, route, flow, load-balancer, database, cache, locator, schema, package, component, module",
          ),
        );
        return 1;
    }

    if (updatedContent === assemblyContent) {
      const message = "Target not found; specification unchanged.";
      if (options.force) {
        console.log(chalk.dim(`ℹ️  ${message}`));
        return 0;
      }
      console.log(chalk.yellow(`⚠️  ${message}`));
      return 0;
    }

    const validationResult = await validateCUE(updatedContent);
    if (!validationResult.valid) {
      console.error(chalk.red("❌ CUE validation failed after removal:"));
      validationResult.errors.forEach((error) => {
        console.error(chalk.red(`  • ${error}`));
      });
      return 1;
    }

    if (options.dryRun) {
      console.log(chalk.yellow("🔍 Dry run - removal changes:"));
      console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
      return 0;
    }

    if (useLocalOnly) {
      await persistLocalAssembly(assemblyDir, assemblyPath, assemblyContent, updatedContent, {
        verbose: options.verbose,
        reason: "local mode",
      });
      return 0;
    }

    const apiClient = new ApiClient(config);
    try {
      const shardType = getShardTypeForSubcommand(subcommand);
      const storeResult = await apiClient.storeSpecification({
        content: updatedContent,
        type: shardType,
        path: assemblyPath,
        shard: shardType,
      });

      if (storeResult.success) {
        console.log(chalk.green(`✅ Updated specification in service (${subcommand})`));
        if (storeResult.data?.shard) {
          console.log(chalk.dim(`   Stored in shard: ${storeResult.data.shard}`));
        }
        if (options.verbose) {
          console.log(chalk.dim("Changes applied:"));
          console.log(chalk.dim(showDiff(assemblyContent, updatedContent)));
        }
        return 0;
      }

      throw new Error(storeResult.error || "Failed to store specification");
    } catch (_error) {
      console.log(chalk.yellow("⚠️  Service unavailable, storing locally as fallback"));
      await persistLocalAssembly(assemblyDir, assemblyPath, assemblyContent, updatedContent, {
        verbose: options.verbose,
        reason: "local fallback",
      });
      return 0;
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to remove component:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  } finally {
    await manipulator.cleanup();
  }
}

function persistLocalAssembly(
  assemblyDir: string,
  assemblyPath: string,
  previousContent: string,
  updatedContent: string,
  options: { verbose?: boolean; reason?: string },
): Promise<void> {
  return fs
    .ensureDir(assemblyDir)
    .then(() => fs.writeFile(assemblyPath, updatedContent, "utf-8"))
    .then(() => {
      const relativePath = path.relative(process.cwd(), assemblyPath) || assemblyPath;
      const suffix = options.reason ? ` (${options.reason})` : "";
      console.log(chalk.green(`✅ Updated ${relativePath}${suffix}`));

      if (options.verbose) {
        console.log(chalk.dim("Changes applied:"));
        console.log(chalk.dim(showDiff(previousContent, updatedContent)));
      }
    });
}

function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

function getShardTypeForSubcommand(subcommand: string): string {
  const mapping: Record<string, string> = {
    service: "services",
    endpoint: "endpoints",
    route: "routes",
    flow: "flows",
    database: "services",
    cache: "services",
    "load-balancer": "services",
    locator: "locators",
    schema: "schemas",
    package: "packages",
    component: "components",
    module: "modules",
  };

  return mapping[subcommand] || "assembly";
}

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
