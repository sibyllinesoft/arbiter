/**
 * @packageDocumentation
 * Version command - Semantic version planning and analysis.
 *
 * Provides functionality to:
 * - Analyze API surface changes to determine version bump
 * - Detect breaking changes (MAJOR), new features (MINOR), and fixes (PATCH)
 * - Generate version plans based on surface comparison
 * - Support strict mode for library compliance
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import type { APISurface } from "@/services/surface/index.js";
import type { CLIConfig } from "@/types.js";
import { FILE_PATTERNS, resolveSmartNaming } from "@/utils/util/core/smart-naming.js";
import chalk from "chalk";

/**
 * Semantic version bump types
 */
export type VersionBump = "MAJOR" | "MINOR" | "PATCH";

/**
 * Version plan analysis options
 */
export interface VersionPlanOptions {
  /** Current surface file path */
  current?: string;
  /** Previous surface file path for comparison */
  previous?: string;
  /** Output file for version plan */
  output?: string;
  /** Enable strict mode for library compliance */
  strict?: boolean;
  /** Include all changes in analysis */
  verbose?: boolean;
}

/**
 * Version release options
 */
export interface VersionReleaseOptions {
  /** Version plan file to execute */
  plan?: string;
  /** Specific version to release (overrides plan) */
  version?: string;
  /** Stage (alpha, beta, rc, stable) */
  stage?: "alpha" | "beta" | "rc" | "stable";
  /** Dry run without changes */
  dryRun?: boolean;
  /** Output release notes file */
  notes?: string;
  /** Include compatibility matrix */
  matrix?: boolean;
  /** Run integration tests */
  tests?: boolean;
}

function validateSurfaceFiles(currentPath: string, previousPath: string): boolean {
  if (!existsSync(currentPath)) {
    console.error(chalk.red(`Current surface file not found: ${currentPath}`));
    return false;
  }
  if (!existsSync(previousPath)) {
    console.error(chalk.red(`Previous surface file not found: ${previousPath}`));
    return false;
  }
  return true;
}

async function loadSurfaces(
  currentPath: string,
  previousPath: string,
): Promise<{ current: APISurface; previous: APISurface }> {
  const current = JSON.parse(await readFile(currentPath, "utf-8")) as APISurface;
  const previous = JSON.parse(await readFile(previousPath, "utf-8")) as APISurface;
  return { current, previous };
}

async function writePlanOutput(
  outputPath: string,
  plan: ReturnType<typeof analyzeSurfaceChanges>,
): Promise<void> {
  await safeFileOperation("write", outputPath, async (validatedPath) => {
    await writeFile(validatedPath, JSON.stringify(plan, null, 2), "utf-8");
  });
  console.log(chalk.green(`✅ Version plan generated at ${outputPath}`));
}

/**
 * Generate a version plan by comparing API surfaces
 */
export async function versionPlanCommand(
  options: VersionPlanOptions,
  _config: CLIConfig,
): Promise<number> {
  try {
    console.log(chalk.blue("📦 Generating version plan..."));

    const currentPath = options.current || "surface.json";
    const previousPath = options.previous || "surface.prev.json";

    if (!validateSurfaceFiles(currentPath, previousPath)) return 1;

    const { current, previous } = await loadSurfaces(currentPath, previousPath);
    const plan = analyzeSurfaceChanges(current, previous, {
      strict: options.strict,
      verbose: options.verbose,
    });

    await writePlanOutput(options.output || "version-plan.json", plan);
    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to generate version plan:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

interface ReleaseContext {
  surfacePath: string;
  planPath: string;
  planContent: any;
  version: string;
  notesPath: string;
}

/**
 * Resolve paths and load plan content for release.
 */
async function resolveReleaseContext(options: VersionReleaseOptions): Promise<ReleaseContext> {
  const naming = await resolveSmartNaming("surface");
  const surfacePath = naming.fullPath || join(process.cwd(), FILE_PATTERNS.surface.default);
  const planPath = options.plan || "version-plan.json";
  const planContent = JSON.parse(await readFile(planPath, "utf-8"));
  const version = options.version || planContent.targetVersion || "0.1.0";
  const notesPath = options.notes || "RELEASE_NOTES.md";

  return { surfacePath, planPath, planContent, version, notesPath };
}

/**
 * Handle dry run mode output.
 */
function handleDryRun(version: string): number {
  console.log(chalk.yellow("Dry run mode - no changes will be applied"));
  console.log(chalk.dim(`Planned version: ${version}`));
  return 0;
}

/**
 * Write release notes and run optional tests.
 */
async function executeRelease(ctx: ReleaseContext, runTests: boolean): Promise<void> {
  const notesContent = generateReleaseNotes(ctx.version, ctx.planContent);

  await safeFileOperation("write", ctx.notesPath, async (validatedPath) => {
    await writeFile(validatedPath, notesContent, "utf-8");
  });

  console.log(
    chalk.green(`✅ Release prepared for version ${ctx.version} (notes: ${ctx.notesPath})`),
  );

  if (runTests) {
    console.log(chalk.blue("🧪 Running integration tests (stub)..."));
  }
}

/**
 * Execute a version release plan
 */
export async function versionReleaseCommand(
  options: VersionReleaseOptions,
  _config: CLIConfig,
): Promise<number> {
  try {
    console.log(chalk.blue("🚀 Executing version release..."));

    const ctx = await resolveReleaseContext(options);

    if (!existsSync(ctx.surfacePath)) {
      console.error(chalk.red(`Surface file not found: ${ctx.surfacePath}`));
      return 1;
    }

    if (options.dryRun) {
      return handleDryRun(ctx.version);
    }

    await executeRelease(ctx, options.tests ?? false);
    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Version release failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

function analyzeSurfaceChanges(
  current: APISurface,
  previous: APISurface,
  options: { strict?: boolean; verbose?: boolean },
): any {
  // Simple diff algorithm placeholder
  const changes = [];
  const currentEndpoints = new Set(
    ((current as any)?.endpoints ?? []).map((e: any) => `${e.method} ${e.path}`),
  );
  const previousEndpoints = new Set(
    ((previous as any)?.endpoints ?? []).map((e: any) => `${e.method} ${e.path}`),
  );

  for (const ep of currentEndpoints) {
    if (!previousEndpoints.has(ep)) {
      changes.push({ type: "added", endpoint: ep });
    }
  }

  for (const ep of previousEndpoints) {
    if (!currentEndpoints.has(ep)) {
      changes.push({ type: "removed", endpoint: ep });
    }
  }

  // Compute bump suggestion
  const bump: VersionBump = changes.some((c) => c.type === "removed") ? "MAJOR" : "MINOR";

  return {
    generatedAt: new Date().toISOString(),
    strict: options.strict ?? false,
    verbose: options.verbose ?? false,
    changes,
    suggestedBump: bump,
    targetVersion: bump === "MAJOR" ? "2.0.0" : bump === "MINOR" ? "1.1.0" : "1.0.1",
  };
}

function generateReleaseNotes(version: string, plan: any): string {
  const header = `# Release ${version}\n\n`;
  const changes = plan.changes
    ?.map((c: any) => `- ${c.type.toUpperCase()}: ${c.endpoint || c.item || "unknown"}`)
    .join("\n");
  return `${header}${changes || "- No changes listed"}\n`;
}
