// @ts-nocheck
import * as path from "node:path";
import chalk from "chalk";
import { diffLines } from "diff";
import fs from "fs-extra";
import { ApiClient } from "../../api-client.js";
import { getCueManipulator } from "../../constraints/cli-integration.js";
import { safeFileOperation } from "../../constraints/index.js";
import { validateCUE } from "../../cue/index.js";
import type { CLIConfig } from "../../types.js";
import { ensureProjectExists } from "../../utils/project.js";

export interface RemoveOptions {
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;
  method?: string;
  service?: string;
  id?: string;
}

export async function removeCommand(
  subcommand: string,
  target: string,
  options: RemoveOptions & Record<string, any>,
  config: CLIConfig,
): Promise<number> {
  const manipulator = getCueManipulator();
  const projectDir = config.projectDir || process.cwd();

  try {
    console.log(chalk.blue(`🧹 Removing ${subcommand}${target ? `: ${target}` : ""}`));

    const assemblyDir = path.resolve(projectDir, ".arbiter");
    const assemblyPath = path.join(assemblyDir, "assembly.cue");
    const useLocalOnly = config.localMode === true;

    if (useLocalOnly && options.verbose) {
      console.log(chalk.dim("📁 Local mode enabled: applying changes to .arbiter CUE files only"));
    }

    let assemblyContent = "";

    // Try .arbiter path first in local mode, fallback to config
    const searchPaths = useLocalOnly
      ? [assemblyPath, config.specPath || "arbiter.assembly.cue"]
      : [config.specPath || "arbiter.assembly.cue"];

    let foundPath: string | null = null;
    for (const candidate of searchPaths) {
      if (await fs.pathExists(candidate)) {
        foundPath = candidate;
        assemblyContent = await fs.readFile(candidate, "utf-8");
        break;
      }
    }

    if (!foundPath) {
      console.error(
        chalk.red("❌ No assembly file found"),
        chalk.dim(
          `(searched: ${searchPaths.map((p) => path.relative(process.cwd(), p)).join(", ")})`,
        ),
      );
      return 1;
    }

    // Original version for diff
    const originalContent = assemblyContent;

    // Validate before modification if not forcing
    if (!options.force) {
      const validation = await validateCUE(assemblyContent);
      if (!validation.valid) {
        console.error(chalk.red("❌ Assembly validation failed before removal:"));
        for (const error of validation.errors) {
          console.error(chalk.red(`  • ${error}`));
        }
        console.error(chalk.dim("Use --force to bypass validation and attempt removal anyway."));
        return 1;
      }
    }

    // Perform removal using CUE manipulator
    const updatedContent = await manipulator.removeDeclaration(assemblyContent, {
      type: subcommand,
      identifier: target,
      method: options.method,
      service: options.service,
      id: options.id,
    });

    // Validate after modification
    const validation = await validateCUE(updatedContent);
    if (!validation.valid) {
      console.error(chalk.red("❌ Resulting assembly is invalid:"));
      for (const error of validation.errors) {
        console.error(chalk.red(`  • ${error}`));
      }
      return 1;
    }

    if (options.dryRun) {
      console.log(chalk.dim("\nDry run - showing diff only (no changes written):\n"));
      const diff = diffLines(originalContent, updatedContent);
      for (const part of diff) {
        const color = part.added ? "green" : part.removed ? "red" : "gray";
        const prefix = part.added ? "+" : part.removed ? "-" : " ";
        process.stdout.write(chalk[color](prefix + part.value));
      }
      console.log();
      return 0;
    }

    // Write changes safely
    await safeFileOperation("write", foundPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, updatedContent, "utf-8");
    });

    console.log(chalk.green(`✅ Removed ${subcommand}${target ? `: ${target}` : ""}`));

    // Sync with remote if not local-only
    if (!useLocalOnly) {
      const apiClient = new ApiClient(config);
      const relativePath = path.relative(process.cwd(), foundPath);
      const syncResult = await apiClient.syncFile(relativePath, updatedContent);
      if (!syncResult.success) {
        console.error(
          chalk.yellow("⚠️  Local removal succeeded but remote sync failed:"),
          syncResult.error,
        );
        return syncResult.exitCode ?? 0;
      }
      if (options.verbose) {
        console.log(chalk.dim("🔄 Synced updated assembly to server."));
      }

      // Keep project catalog in sync for any supported entity removals
      const entityType = mapSubcommandToEntityType(subcommand);
      if (entityType) {
        try {
          const projectId = await ensureProjectExists(apiClient, config);
          // Always attempt deletion by ID first, then by name to ensure event emission.
          const artifactId = await findArtifactId(apiClient, projectId, entityType, target);
          if (artifactId) {
            const deleteResult = await apiClient.deleteProjectEntity(projectId, artifactId);
            if (!deleteResult.success) {
              console.error(
                chalk.yellow("⚠️  Removed locally, but failed to delete remote entity:"),
                deleteResult.error,
              );
            } else if (options.verbose) {
              console.log(chalk.dim(`🗑️  Removed remote ${entityType} entity (${artifactId}).`));
            }
          }

          const byNameResult = await apiClient.deleteProjectEntitiesByName(
            projectId,
            entityType,
            target,
          );
          if (byNameResult.deleted.length > 0 && options.verbose) {
            console.log(
              chalk.dim(
                `🗑️  Removed ${byNameResult.deleted.length} remote ${entityType} artifact(s) by name (${target}).`,
              ),
            );
          } else if (!artifactId && byNameResult.deleted.length === 0 && options.verbose) {
            console.log(
              chalk.dim(
                `ℹ️  No matching remote ${entityType} entity found (name: ${target}), skipping entity delete.`,
              ),
            );
          }
        } catch (syncError) {
          console.error(
            chalk.yellow("⚠️  Local removal succeeded, but remote entity sync failed:"),
            syncError instanceof Error ? syncError.message : String(syncError),
          );
        }
      }
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Remove failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Map remove subcommand names to project entity types
 */
function mapSubcommandToEntityType(subcommand: string): string | null {
  const normalized = subcommand.trim().toLowerCase();
  const map: Record<string, string> = {
    service: "service",
    database: "database",
    package: "package",
    tool: "tool",
    frontend: "frontend",
    "load-balancer": "infrastructure",
    cache: "database", // treat cache services as database-like artifacts (redis, etc.)
    route: "route",
    flow: "flow",
    capability: "capability",
    epic: "epic",
    task: "task",
  };

  return map[normalized] || null;
}

/**
 * Find an artifact ID by name/type in the project catalog using resolved artifacts first,
 * then falling back to spec collections for routes/flows/capabilities.
 */
async function findArtifactId(
  client: ApiClient,
  projectId: string,
  type: string,
  name: string,
): Promise<string | null> {
  const projectResult = await client.getProject(projectId);
  if (!projectResult.success) return null;

  const resolved = projectResult.data?.resolved ?? projectResult.data;
  const artifacts: any[] = Array.isArray(resolved?.artifacts) ? resolved.artifacts : [];

  const target = normalizeName(name);

  // 1) Prefer artifacts list (works for service/database/package/tool/frontend/infrastructure/etc.)
  const artifactMatch = artifacts.find(
    (a) => normalizeName(a?.name) === target && (a?.type || "").toLowerCase() === type,
  );
  if (artifactMatch?.id) return artifactMatch.id as string;

  // 2) Fallback to spec collections for route/flow/capability (non-artifact types)
  const spec = resolved?.spec;
  if (!spec || typeof spec !== "object") return null;

  switch (type) {
    case "route": {
      const routes: any[] = Array.isArray(spec.ui?.routes) ? spec.ui.routes : [];
      const match = routes.find((r) => normalizeName(r?.name || r?.id || r?.path) === target);
      return match?.id || null;
    }
    case "flow": {
      const flows: any[] = Array.isArray(spec.flows) ? spec.flows : [];
      const match = flows.find((f) => normalizeName(f?.id || f?.name) === target);
      return match?.id || null;
    }
    case "capability": {
      const caps = spec.capabilities || {};
      for (const [capId, cap] of Object.entries(caps)) {
        if (normalizeName(capId) === target || normalizeName((cap as any).name) === target) {
          return capId;
        }
      }
      return null;
    }
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
// @ts-nocheck
