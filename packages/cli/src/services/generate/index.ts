/**
 * @packageDocumentation
 * Implements the `generate` command which powers Arbiter code generation.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import type {
  AppSpec,
  AssemblyConfig,
  ClientConfig,
  ConfigWithVersion,
  CueAssertion,
  CueAssertionBlock,
  DeploymentConfig,
  ServiceConfig as DeploymentServiceConfig,
  DeploymentTarget,
  EnhancedGenerateOptions,
  PathSpec,
  SchemaVersion,
  ServiceArtifactType,
  ServiceWorkload,
  TestCase,
  TestCompositionResult,
  TestSuite,
} from "@arbiter/shared";
import chalk from "chalk";
import fs from "fs-extra";
import * as YAML from "yaml";
import { ApiClient } from "../../api-client.js";
import { DEFAULT_PROJECT_STRUCTURE } from "../../config.js";
import { safeFileOperation } from "../../constraints/index.js";
import type {
  EndpointAssertionDefinition,
  EndpointTestCaseDefinition,
  EndpointTestGenerationConfig,
  ProjectConfig as LanguageProjectConfig,
  ServiceConfig as LanguageServiceConfig,
} from "../../language-plugins/index.js";
import type {
  CLIConfig,
  CapabilitySpec,
  GeneratorConfig,
  GeneratorTestingConfig,
  LanguageTestingConfig,
  MasterTestRunnerConfig,
  ProjectStructureConfig,
} from "../../types.js";
import { GenerationHookManager } from "../../utils/generation-hooks.js";
import {
  createRepositoryConfig,
  getSmartRepositoryConfig,
  validateRepositoryConfig,
} from "../../utils/git-detection.js";
import { GitHubSyncClient } from "../../utils/github-sync.js";
import {
  type PackageManagerCommandSet,
  detectPackageManager,
  getPackageManagerCommands,
} from "../../utils/package-manager.js";
import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "../../utils/service-metadata.js";
import { ShardedCUEStorage } from "../../utils/sharded-storage.js";
import { formatWarnings, validateSpecification } from "../../validation/warnings.js";
import { generateDockerComposeArtifacts, parseDockerComposeServices } from "./compose.js";
import type {
  ClientGenerationContext,
  ClientGenerationTarget,
  ServiceGenerationContext,
  ServiceGenerationTarget,
} from "./contexts.js";
import { ensureDirectory, setActiveHookManager, writeFileWithHooks } from "./hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "./shared.js";
import {
  configureTemplateOrchestrator,
  generateComponent,
  generateService,
  getConfiguredLanguagePlugin,
  initializeProject,
} from "./template-orchestrator.js";
import type { GenerateOptions } from "./types.js";
export type { GenerateOptions } from "./types.js";

function normalizeCapabilities(input: any): Record<string, CapabilitySpec> | null {
  if (!input) {
    return null;
  }

  if (Array.isArray(input)) {
    const entries: Record<string, CapabilitySpec> = {};
    input.forEach((raw, index) => {
      const base: CapabilitySpec =
        typeof raw === "string" ? { name: raw } : { ...(raw as CapabilitySpec) };
      const idSource =
        (typeof (raw as any)?.id === "string" && (raw as any).id) ||
        base.name ||
        `capability_${index + 1}`;
      const key = slugify(String(idSource), `capability_${index + 1}`);
      entries[key] = base;
    });
    return entries;
  }

  if (typeof input === "object") {
    return { ...(input as Record<string, CapabilitySpec>) };
  }

  return null;
}

function collectClientTargets(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
): ClientGenerationTarget[] {
  const entries = Object.entries(appSpec.clients ?? {});
  if (entries.length === 0) {
    const fallback = appSpec.product?.name || "app";
    return [createClientTarget(fallback, undefined, structure, outputDir)];
  }
  return entries.map(([key, config]) =>
    createClientTarget(key, config as ClientConfig, structure, outputDir),
  );
}

const PACKAGE_RELATIVE_KEYS = ["docsDirectory", "testsDirectory", "infraDirectory"] as const;
type PackageRelativeKey = (typeof PACKAGE_RELATIVE_KEYS)[number];

function isPackageRelative(structure: ProjectStructureConfig, key: PackageRelativeKey): boolean {
  return Boolean(structure.packageRelative?.[key]);
}

function toRelativePath(from: string, to: string): string | null {
  const relative = path.relative(from, to);
  if (!relative || relative.trim().length === 0 || relative === ".") {
    return null;
  }
  const segments = toPathSegments(relative);
  return segments.length > 0 ? joinRelativePath(...segments) : null;
}

function createClientTarget(
  identifier: string,
  clientConfig: ClientConfig | undefined,
  structure: ProjectStructureConfig,
  outputDir: string,
): ClientGenerationTarget {
  const slug = slugify(identifier, identifier);
  const configuredDir =
    typeof clientConfig?.sourceDirectory === "string" && clientConfig.sourceDirectory.length > 0
      ? clientConfig.sourceDirectory
      : undefined;
  const targetDir = configuredDir ?? path.join(structure.clientsDirectory, slug);
  const absoluteRoot = path.isAbsolute(targetDir) ? targetDir : path.join(outputDir, targetDir);
  const relativeFromRoot = path.relative(outputDir, absoluteRoot) || targetDir;
  const relativeRoot = joinRelativePath(relativeFromRoot);
  const routesDir = path.join(absoluteRoot, "src", "routes");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(absoluteRoot, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);
  const context: ClientGenerationContext = {
    root: absoluteRoot,
    routesDir,
    testsDir,
  };

  return { key: identifier, slug, relativeRoot, config: clientConfig, context };
}

function createServiceContext(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string,
): ServiceGenerationContext {
  const slug = slugify(serviceName, serviceName);
  const root = path.join(outputDir, structure.servicesDirectory, slug);
  const routesDir = path.join(root, "src", "routes");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(root, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);

  return { root, routesDir, testsDir };
}

function createServiceTarget(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string,
): ServiceGenerationTarget {
  const slug = slugify(serviceName, serviceName);
  const context = createServiceContext(serviceName, serviceConfig, structure, outputDir);
  const relativeRoot = joinRelativePath(structure.servicesDirectory, slug);
  const language = (serviceConfig?.language as string | undefined)?.toLowerCase() ?? "typescript";

  return {
    key: serviceName,
    slug,
    relativeRoot,
    language,
    config: (serviceConfig ?? {}) as Record<string, unknown>,
    context,
  };
}

async function ensureBaseStructure(
  structure: ProjectStructureConfig,
  outputDir: string,
  options: GenerateOptions,
): Promise<void> {
  const baseDirs = [
    structure.clientsDirectory,
    structure.servicesDirectory,
    structure.packagesDirectory,
    structure.toolsDirectory,
    structure.docsDirectory,
    structure.testsDirectory,
    structure.infraDirectory,
  ].filter(Boolean);

  for (const dir of baseDirs) {
    await ensureDirectory(path.join(outputDir, dir), options);
  }
}

// Simple command execution for CUE evaluation
async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {},
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => (stdout += data.toString()));
    proc.stderr?.on("data", (data) => (stderr += data.toString()));

    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ success: false, stdout, stderr: "Command timed out" });
    }, options.timeout || 10000);

    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    proc.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ success: false, stdout, stderr: error.message });
    });
  });
}

/**
 * Discover available specs in .arbiter/ directories
 */
function discoverSpecs(): Array<{ name: string; path: string }> {
  const specs: Array<{ name: string; path: string }> = [];

  if (fs.existsSync(".arbiter")) {
    const specDirs = fs
      .readdirSync(".arbiter", { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const specName of specDirs) {
      const assemblyPath = path.join(".arbiter", specName, "assembly.cue");
      if (fs.existsSync(assemblyPath)) {
        specs.push({ name: specName, path: assemblyPath });
      }
    }
  }

  return specs;
}

function isTypeScriptServiceLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

function deriveServiceAliases(serviceName: string, serviceSpec?: any): string[] {
  const aliases = new Set<string>();
  if (serviceName) {
    aliases.add(serviceName.toLowerCase());
    const withoutSuffix = serviceName.replace(/-(api|service|svc)$/i, "");
    aliases.add(withoutSuffix.toLowerCase());
    const tokens = serviceName.split(/[-_]/g);
    tokens.forEach((token) => {
      if (token) aliases.add(token.toLowerCase());
    });
  }

  const capabilities = Array.isArray(serviceSpec?.capabilities) ? serviceSpec.capabilities : [];
  for (const capability of capabilities) {
    const contract = capability?.contractRef;
    if (typeof contract === "string" && contract.length) {
      const [ref] = contract.split("@");
      if (ref) {
        ref
          .split(/[-_.:/]/)
          .filter(Boolean)
          .forEach((segment) => aliases.add(segment.toLowerCase()));
      }
    }
  }

  if (Array.isArray(serviceSpec?.domains)) {
    for (const domain of serviceSpec.domains) {
      if (typeof domain === "string") {
        aliases.add(domain.toLowerCase());
      }
    }
  }

  return Array.from(aliases).filter(Boolean);
}

function pathBelongsToService(pathKey: string, serviceName: string, serviceSpec: any): boolean {
  const aliases = deriveServiceAliases(serviceName, serviceSpec);
  if (aliases.length === 0) {
    return false;
  }
  const normalizedPath = pathKey.replace(/^\/+/, "").toLowerCase();
  if (!normalizedPath) {
    return false;
  }
  const firstSegment = normalizedPath.split("/")[0];

  if (aliases.includes(firstSegment)) {
    return true;
  }

  if (
    aliases.some(
      (alias) =>
        alias && (normalizedPath.startsWith(`${alias}/`) || normalizedPath.includes(`${alias}-`)),
    )
  ) {
    return true;
  }

  if (normalizedPath.includes("webhook") && aliases.some((alias) => alias.includes("webhook"))) {
    return true;
  }

  return false;
}

function determinePathOwnership(appSpec: AppSpec): Map<string, string> {
  const ownership = new Map<string, string>();
  if (appSpec.paths) {
    for (const [serviceName, pathSpec] of Object.entries(appSpec.paths)) {
      if (!pathSpec || typeof pathSpec !== "object") continue;
      const slug = slugify(serviceName, serviceName);
      for (const pathKey of Object.keys(pathSpec as Record<string, unknown>)) {
        ownership.set(pathKey, slug);
      }
    }
  }
  const services = Object.entries(appSpec.services ?? {}).filter(([, svc]) =>
    isTypeScriptServiceLanguage(svc?.language as string | undefined),
  );

  for (const flow of appSpec.flows ?? []) {
    for (const step of flow.steps ?? []) {
      const api = step.expect_api;
      if (!api?.path || ownership.has(api.path)) {
        continue;
      }

      for (const [serviceName, serviceSpec] of services) {
        if (pathBelongsToService(api.path, serviceName, serviceSpec)) {
          ownership.set(api.path, slugify(serviceName, serviceName));
          break;
        }
      }
    }
  }

  return ownership;
}

function buildDevProxyConfig(
  appSpec: AppSpec,
  pathOwnership: Map<string, string>,
): Record<string, { target: string; changeOrigin: boolean }> {
  const proxies: Record<string, { target: string; changeOrigin: boolean }> = {};

  for (const [pathKey, ownerSlug] of pathOwnership.entries()) {
    const normalized = pathKey.replace(/^\/+/, "");
    if (!normalized) continue;
    const firstSegment = normalized.split("/")[0];
    if (!firstSegment) continue;
    const prefix = `/${firstSegment}`;
    if (proxies[prefix]) continue;

    const serviceEntry = Object.entries(appSpec.services ?? {}).find(
      ([serviceName]) => slugify(serviceName, serviceName) === ownerSlug,
    );
    if (!serviceEntry) continue;
    const [, serviceSpec] = serviceEntry;
    if (!isTypeScriptServiceLanguage(serviceSpec?.language as string | undefined)) continue;

    const port = getPrimaryServicePort(serviceSpec, 3000);
    proxies[prefix] = {
      target: `http://127.0.0.1:${port}`,
      changeOrigin: true,
    };
  }

  return proxies;
}

async function enhanceClientDevServer(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget,
  options: GenerateOptions,
): Promise<void> {
  const viteConfigPath = path.join(clientTarget.context.root, "vite.config.ts");
  if (!fs.existsSync(viteConfigPath)) {
    return;
  }

  const pathOwnership = determinePathOwnership(appSpec);
  const proxies = buildDevProxyConfig(appSpec, pathOwnership);

  const proxyEntries = Object.entries(proxies)
    .map(
      ([prefix, proxy]) => `      '${prefix}': {
        target: '${proxy.target}',
        changeOrigin: ${proxy.changeOrigin ? "true" : "false"},
      },`,
    )
    .join("\n");

  const proxyBlock = Object.keys(proxies).length
    ? `    proxy: {
${proxyEntries}
    },
`
    : "";

  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
${proxyBlock}  },
  build: {
    target: 'es2022',
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
`;

  await writeFileWithHooks(viteConfigPath, viteConfig, options);
}

/**
 * Handle GitHub synchronization for epics and tasks
 */
async function handleGitHubSync(options: GenerateOptions, config: CLIConfig): Promise<void> {
  if (options.verbose) {
    console.log(chalk.dim("🔄 Starting GitHub sync handler..."));
  }

  try {
    // Smart repository configuration with Git auto-detection
    const smartRepoConfig = getSmartRepositoryConfig(config.github?.repository, {
      verbose: options.verbose,
    });

    // Handle case where no repository info could be determined
    if (!smartRepoConfig) {
      console.error(chalk.red("❌ No GitHub repository configuration found"));
      console.log(chalk.dim("Options to fix this:"));
      console.log(
        chalk.dim(
          "  1. Initialize Git and add GitHub remote: git remote add origin https://github.com/owner/repo.git",
        ),
      );
      console.log(chalk.dim("  2. Or add GitHub configuration to your .arbiter/config.json:"));
      console.log(
        chalk.dim(`{
  "github": {
    "repository": {
      "owner": "your-org",
      "repo": "your-repo"
    },
    "prefixes": {
      "epic": "[Epic]",
      "task": "[Task]"
    },
    "labels": {
      "default": ["arbiter-generated"]
    },
    "automation": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}`),
      );
      console.log(chalk.dim("\\nAnd set your GitHub token as an environment variable:"));
      console.log(chalk.dim("  export GITHUB_TOKEN=your_github_personal_access_token"));
      return;
    }

    const finalRepo = smartRepoConfig.repo;

    // Validate the final repository configuration
    const validation = validateRepositoryConfig(finalRepo);
    if (!validation.valid) {
      console.error(chalk.red("❌ Invalid repository configuration:"));
      validation.errors.forEach((error) => {
        console.log(chalk.red(`  • ${error}`));
      });
      if (validation.suggestions.length > 0) {
        console.log(chalk.dim("\\nSuggestions:"));
        validation.suggestions.forEach((suggestion) => {
          console.log(chalk.dim(`  • ${suggestion}`));
        });
      }
      return;
    }

    // Ensure we have owner and repo from somewhere
    if (!finalRepo.owner || !finalRepo.repo) {
      console.error(chalk.red("❌ Repository owner and name are required"));
      console.log(
        chalk.dim(
          "Either configure them in .arbiter/config.json or ensure your Git remote is set correctly",
        ),
      );
      return;
    }

    // Create GitHub configuration with the resolved repository info
    const githubConfig = {
      repository: finalRepo,
      prefixes: config.github?.prefixes || {
        epic: "[Epic]",
        task: "[Task]",
      },
      labels: config.github?.labels || {
        default: ["arbiter-generated"],
      },
      automation: config.github?.automation || {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: false,
      },
      templates: config.github?.templates,
    };

    // Display repository info
    if (options.verbose || smartRepoConfig.source !== "config") {
      const sourceInfo =
        smartRepoConfig.source === "detected"
          ? "auto-detected from Git remote"
          : smartRepoConfig.source === "merged"
            ? "merged from config and Git remote"
            : "from configuration";

      console.log(chalk.dim(`📁 Repository: ${finalRepo.owner}/${finalRepo.repo} (${sourceInfo})`));
    }

    // Load epics from the project
    console.log(chalk.blue("📋 Loading epics and tasks..."));
    const storage = new ShardedCUEStorage();
    await storage.initialize();
    const epics = await storage.listEpics();

    if (epics.length === 0) {
      console.log(chalk.yellow("⚠️  No epics found to sync"));
      console.log(chalk.dim("Create epics with: arbiter epic create <name>"));
      return;
    }

    console.log(
      chalk.dim(
        `Found ${epics.length} epics with ${epics.reduce((sum, epic) => sum + epic.tasks.length, 0)} total tasks`,
      ),
    );

    // Create GitHub sync client
    const githubClient = new GitHubSyncClient(githubConfig);

    // Determine if this is a dry run
    const isDryRun = options.githubDryRun || options.dryRun;

    if (isDryRun) {
      console.log(chalk.blue("🔍 GitHub Sync Preview (dry run)"));

      // Generate preview
      const preview = await githubClient.generateSyncPreview(epics);

      // Display preview results
      console.log(chalk.green("\\n📊 Sync Preview:"));

      // Epics
      if (preview.epics.create.length > 0) {
        console.log(chalk.cyan(`\\n  📝 Epics to create: ${preview.epics.create.length}`));
        preview.epics.create.forEach((epic) => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.update.length > 0) {
        console.log(chalk.yellow(`\\n  📝 Epics to update: ${preview.epics.update.length}`));
        preview.epics.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.close.length > 0) {
        console.log(chalk.red(`\\n  📝 Epics to close: ${preview.epics.close.length}`));
        preview.epics.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name} (${epic.status})`));
        });
      }

      // Tasks
      if (preview.tasks.create.length > 0) {
        console.log(chalk.cyan(`\\n  🔧 Tasks to create: ${preview.tasks.create.length}`));
        preview.tasks.create.forEach((task) => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.update.length > 0) {
        console.log(chalk.yellow(`\\n  🔧 Tasks to update: ${preview.tasks.update.length}`));
        preview.tasks.update.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.close.length > 0) {
        console.log(chalk.red(`\\n  🔧 Tasks to close: ${preview.tasks.close.length}`));
        preview.tasks.close.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.status})`));
        });
      }

      // Milestones
      if (preview.milestones.create.length > 0) {
        console.log(
          chalk.cyan(`\\n  🎯 Milestones to create: ${preview.milestones.create.length}`),
        );
        preview.milestones.create.forEach((epic) => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.update.length > 0) {
        console.log(
          chalk.yellow(`\\n  🎯 Milestones to update: ${preview.milestones.update.length}`),
        );
        preview.milestones.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.close.length > 0) {
        console.log(chalk.red(`\\n  🎯 Milestones to close: ${preview.milestones.close.length}`));
        preview.milestones.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name} (${epic.status})`));
        });
      }

      const totalChanges =
        preview.epics.create.length +
        preview.epics.update.length +
        preview.epics.close.length +
        preview.tasks.create.length +
        preview.tasks.update.length +
        preview.tasks.close.length +
        preview.milestones.create.length +
        preview.milestones.update.length +
        preview.milestones.close.length;

      if (totalChanges === 0) {
        console.log(chalk.green("\\n✅ No changes needed - everything is already in sync"));
      } else {
        console.log(
          chalk.blue("\\n💡 Run without --github-dry-run or --dry-run to apply these changes"),
        );
      }
    } else {
      console.log(chalk.blue("🚀 Syncing to GitHub..."));

      // Perform actual sync
      const syncResults = await githubClient.syncToGitHub(epics, false);

      // Group and display results
      const created = syncResults.filter((r) => r.action === "created");
      const updated = syncResults.filter((r) => r.action === "updated");
      const closed = syncResults.filter((r) => r.action === "closed");
      const skipped = syncResults.filter((r) => r.action === "skipped");

      console.log(chalk.green("\\n✅ GitHub Sync Complete:"));

      if (created.length > 0) {
        console.log(chalk.cyan(`  📝 Created: ${created.length} items`));
        created.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (updated.length > 0) {
        console.log(chalk.yellow(`  📝 Updated: ${updated.length} items`));
        updated.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (closed.length > 0) {
        console.log(chalk.red(`  📝 Closed: ${closed.length} items`));
        closed.forEach((result) => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`),
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (skipped.length > 0 && options.verbose) {
        console.log(chalk.dim(`  ⏭️  Skipped: ${skipped.length} items (no changes needed)`));
      }

      console.log(
        chalk.green(
          `\\n🔗 Check your GitHub repository: https://github.com/${finalRepo.owner}/${finalRepo.repo}/issues`,
        ),
      );
    }
  } catch (error) {
    console.error(
      chalk.red("❌ GitHub sync failed:"),
      error instanceof Error ? error.message : String(error),
    );
    if (options.verbose) {
      console.error(chalk.dim("Full error:"), error);
    }

    console.log(chalk.dim("\\nTroubleshooting tips:"));
    console.log(
      chalk.dim("  • Ensure GITHUB_TOKEN environment variable is set with proper permissions"),
    );
    console.log(chalk.dim("  • Verify your GitHub token has 'repo' or 'issues:write' permission"));
    console.log(chalk.dim("  • Check that the repository owner/name is correct"));
    console.log(chalk.dim("  • Ensure Git remote origin points to the correct GitHub repository"));
    console.log(chalk.dim("  • Use --verbose for more error details"));
    console.log(
      chalk.dim("  • Use --use-config or --use-git-remote to resolve repository conflicts"),
    );
  }
}

/**
 * Executes the `generate` command using the provided CLI and runtime options.
 *
 * @param options - Command-line options supplied by the user.
 * @param config - Fully resolved configuration for the running CLI instance.
 * @param specName - Optional named specification to generate instead of the default assembly.
 * @returns Zero on success; non-zero values indicate generation failed.
 */
export async function generateCommand(
  options: GenerateOptions,
  config: CLIConfig,
  specName?: string,
): Promise<number> {
  if (options.verbose) {
    console.log(chalk.dim("🔧 Generate options:"), JSON.stringify(options, null, 2));
  }
  try {
    console.log(chalk.blue("🏗️  Generating project artifacts from assembly.cue..."));

    // First, try to emit the CUE file from stored specification in service
    if (config.localMode) {
      if (options.verbose) {
        console.log(chalk.dim("📁 Local mode enabled: using existing .arbiter CUE files"));
      }
    } else {
      await emitSpecificationFromService(config);
    }

    let assemblyPath: string;
    let assemblyContent: string;

    // Determine which assembly file to use
    if (specName || options.spec) {
      // Use specified spec name
      const targetSpec = specName || options.spec!;
      assemblyPath = path.join(".arbiter", targetSpec, "assembly.cue");

      if (!fs.existsSync(assemblyPath)) {
        console.error(chalk.red(`❌ Spec "${targetSpec}" not found at ${assemblyPath}`));

        // Show available specs
        const availableSpecs = discoverSpecs();
        if (availableSpecs.length > 0) {
          console.log(chalk.yellow("\n📋 Available specs:"));
          availableSpecs.forEach((spec) => {
            console.log(chalk.cyan(`  • ${spec.name}`));
          });
          console.log(chalk.dim(`\n💡 Usage: arbiter generate ${availableSpecs[0].name}`));
        } else {
          console.log(chalk.dim("No specs found in .arbiter/ directory"));
        }
        return 1;
      }

      console.log(chalk.dim(`📁 Using spec: ${targetSpec}`));
    } else {
      // Auto-discover approach
      const availableSpecs = discoverSpecs();

      if (availableSpecs.length === 0) {
        // Check for assembly.cue in .arbiter directory first
        const arbiterPath = path.resolve(".arbiter", "assembly.cue");

        if (fs.existsSync(arbiterPath)) {
          assemblyPath = arbiterPath;
          console.log(chalk.dim("📁 Using .arbiter/assembly.cue"));
        } else {
          console.error(chalk.red("❌ No assembly specifications found"));
          console.log(chalk.dim("Create a spec with: arbiter add service <name>"));
          console.log(chalk.dim("Or initialize with: arbiter init"));
          return 1;
        }
      } else if (availableSpecs.length === 1) {
        // Use the single available spec
        assemblyPath = availableSpecs[0].path;
        console.log(chalk.green(`✅ Auto-detected spec: ${availableSpecs[0].name}`));
      } else {
        // Multiple specs found - require user to specify
        console.error(chalk.red("❌ Multiple specs found. Please specify which one to use:"));
        console.log(chalk.yellow("\n📋 Available specs:"));
        availableSpecs.forEach((spec) => {
          console.log(chalk.cyan(`  • arbiter generate ${spec.name}`));
        });
        return 1;
      }
    }

    assemblyContent = fs.readFileSync(assemblyPath, "utf-8");
    const configWithVersion = await parseAssemblyFile(assemblyPath);

    if (options.verbose) {
      console.log(chalk.dim("Assembly configuration:"));
      console.log(
        chalk.dim(
          `Schema detected from ${configWithVersion.schema.detected_from} data (application model)`,
        ),
      );
      console.log(chalk.dim(JSON.stringify(configWithVersion, null, 2)));
    }

    // Validate specification completeness
    console.log(chalk.blue("🔍 Validating specification completeness..."));
    const validationResult = validateSpecification(configWithVersion.app);

    if (validationResult.hasErrors) {
      console.log(formatWarnings(validationResult));
      console.error(
        chalk.red("\n❌ Cannot generate with errors present. Please fix the errors above."),
      );
      return 1;
    }

    if (validationResult.hasWarnings) {
      console.log("\n" + chalk.yellow("⚠️  Specification validation warnings found:"));
      console.log(formatWarnings(validationResult));

      if (!options.force) {
        console.log(chalk.blue("\n💡 To proceed: Add --force flag to generate with warnings"));
        console.log(
          chalk.dim(
            "Recommendation: Fix the warnings above for a complete, production-ready specification.",
          ),
        );
        return 1;
      }

      console.log(chalk.yellow("\n⚠️  Generating despite warnings (--force used)"));
      console.log(chalk.red.bold("\n🚨 REMINDER FOR AI AGENTS:"));
      console.log(
        chalk.yellow(
          "You should have requested user approval before using --force with incomplete specifications.",
        ),
      );
      console.log(
        chalk.dim("This may result in production issues that require additional work later."),
      );
    } else {
      console.log(chalk.green("✅ Specification validation passed"));
    }

    // Determine project directory (generation happens in-place)
    const outputDir = path.resolve(options.projectDir ?? config.projectDir ?? process.cwd());

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Keep config.projectDir in sync so downstream helpers remain accurate
    config.projectDir = outputDir;

    const detectedPackageManager = detectPackageManager(undefined, outputDir);
    const packageManagerCommands = getPackageManagerCommands(detectedPackageManager);
    if (options.verbose) {
      console.log(chalk.dim(`🧺 Detected ${detectedPackageManager} for workspace instructions`));
    }

    const hookManager = config.generator?.hooks
      ? new GenerationHookManager({
          hooks: config.generator.hooks,
          workspaceRoot: config.projectDir || process.cwd(),
          outputDir: path.resolve(outputDir),
          configDir: config.configDir,
          dryRun: Boolean(options.dryRun),
        })
      : null;

    if (hookManager) {
      setActiveHookManager(hookManager);
      await hookManager.runBeforeGenerate();
    }

    const results = [];

    try {
      console.log(chalk.blue("🎨 Generating application artifacts..."));
      const projectStructure: ProjectStructureConfig = {
        ...DEFAULT_PROJECT_STRUCTURE,
        ...config.projectStructure,
        packageRelative: {
          ...DEFAULT_PROJECT_STRUCTURE.packageRelative,
          ...(config.projectStructure?.packageRelative ?? {}),
        },
      };

      const appResults = await generateAppArtifacts(
        configWithVersion,
        outputDir,
        options,
        projectStructure,
        config,
        packageManagerCommands,
      );
      results.push(...appResults);

      // Report results
      if (options.dryRun) {
        console.log(chalk.yellow("🔍 Dry run - files that would be generated:"));
        results.forEach((file) => console.log(chalk.dim(`  ${file}`)));
      } else {
        console.log(chalk.green(`✅ Generated ${results.length} files:`));
        results.forEach((file) => console.log(chalk.dim(`  ✓ ${file}`)));
      }

      if (hookManager) {
        await hookManager.runAfterGenerate(results);
      }

      // Handle GitHub synchronization if requested
      if (options.syncGithub || options.githubDryRun) {
        await handleGitHubSync(options, config);
      }

      return 0;
    } finally {
      if (hookManager) {
        setActiveHookManager(null);
      }
    }
  } catch (error) {
    console.error(
      chalk.red("❌ Generate failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Parse assembly.cue file and extract configuration with schema version detection
 */
async function parseAssemblyFile(assemblyPath: string): Promise<ConfigWithVersion> {
  try {
    // Use CUE to evaluate and export as JSON
    const result = await executeCommand("cue", ["eval", "--out", "json", assemblyPath], {
      timeout: 10000,
    });

    if (!result.success) {
      console.error("CUE evaluation failed:", result.stderr);
      return fallbackParseAssembly(assemblyPath);
    }

    const cueData = JSON.parse(result.stdout);

    // Detect schema version based on structure
    const schemaVersion = detectSchemaVersion(cueData);

    // Parse app schema
    return parseAppSchema(cueData, schemaVersion);
  } catch (error) {
    console.error("Error parsing CUE file:", error);
    return fallbackParseAssembly(assemblyPath);
  }
}

/**
 * Detect schema version based on CUE data structure
 */
function detectSchemaVersion(cueData: any): SchemaVersion {
  // Always use app schema - it's the primary and only supported schema now
  return {
    version: "app",
    detected_from: "metadata",
  };
}

/**
 * Parse App Specification schema
 */
function parseAppSchema(cueData: any, schemaVersion: SchemaVersion): ConfigWithVersion {
  const appSpec: AppSpec = {
    product: cueData.product || {
      name: "Unknown App",
    },
    config: cueData.config,
    ui: cueData.ui || {
      routes: [],
    },
    flows: cueData.flows || [],
    services: cueData.services,
    domain: cueData.domain,
    capabilities: normalizeCapabilities(cueData.capabilities),
    locators: cueData.locators || {},
    tests: cueData.tests,
    epics: cueData.epics,
    docs: cueData.docs,
    security: cueData.security,
    performance: cueData.performance,
    observability: cueData.observability,
    environments: cueData.environments,
    data: cueData.data,
    metadata: cueData.metadata,
    components: cueData.components,
    paths: cueData.paths,
    testability: cueData.testability,
    ops: cueData.ops,
    stateModels: cueData.stateModels,
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = cueData;

  return config;
}

// Fallback to file-based regex parsing if CUE evaluation fails
async function fallbackParseAssembly(assemblyPath: string): Promise<ConfigWithVersion> {
  const content = await fs.readFile(assemblyPath, "utf-8");

  // Always use app schema
  const schemaVersion: SchemaVersion = { version: "app", detected_from: "default" };

  console.warn("⚠️  CUE evaluation failed - using limited fallback parsing");

  // Extract basic information from the CUE file
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  const languageMatch = content.match(/language:\s*"([^"]+)"/);
  const productName = nameMatch ? nameMatch[1] : "Unknown App";
  const language = languageMatch ? languageMatch[1] : "typescript";

  const appSpec: AppSpec = {
    product: { name: productName },
    config: { language },
    ui: { routes: [] },
    locators: {},
    flows: [],
    capabilities: null,
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = { product: appSpec.product, config: appSpec.config };

  return config;
}

/**
 * Generate app-centric artifacts from app specification
 */
async function generateAppArtifacts(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const appSpec = configWithVersion.app;

  if (!appSpec) {
    return files;
  }

  console.log(chalk.green(`📱 Generating artifacts for: ${appSpec.product.name}`));

  await ensureBaseStructure(structure, outputDir, options);

  const clientTargets = collectClientTargets(appSpec, structure, outputDir);
  let testsWorkspaceRelative: string | undefined;

  for (const target of clientTargets) {
    const context = target.context;
    await ensureDirectory(context.root, options);

    const routeFiles = await generateUIComponents(appSpec, target, options);
    files.push(...routeFiles);

    const locatorCount = appSpec.locators ? Object.keys(appSpec.locators).length : 0;
    if (locatorCount > 0) {
      const locatorFiles = await generateLocatorDefinitions(appSpec, target, options);
      files.push(...locatorFiles);
    }

    if (appSpec.flows.length > 0) {
      const { files: testFiles, workspaceDir } = await generateFlowBasedTests(
        appSpec,
        outputDir,
        options,
        structure,
        target,
      );
      files.push(...testFiles);
      testsWorkspaceRelative = testsWorkspaceRelative ?? workspaceDir;
    }

    const projectFiles = await generateProjectStructure(
      appSpec,
      outputDir,
      options,
      structure,
      target,
      cliConfig,
      packageManager,
    );
    files.push(...projectFiles);
  }

  const primaryClientTarget = clientTargets[0];

  const endpointAssertionFiles = await generateEndpointAssertionTests(
    appSpec,
    outputDir,
    options,
    structure,
    cliConfig,
  );
  files.push(...endpointAssertionFiles);

  const capabilityFeatureFiles = await generateCapabilityFeatures(
    appSpec,
    outputDir,
    options,
    structure,
  );
  files.push(...capabilityFeatureFiles);

  if (appSpec.components || appSpec.paths) {
    const apiFiles = await generateAPISpecifications(appSpec, outputDir, options, structure);
    files.push(...apiFiles);
  }

  if (appSpec.services && Object.keys(appSpec.services).length > 0) {
    const serviceFiles = await generateServiceStructures(
      appSpec,
      outputDir,
      options,
      structure,
      cliConfig,
      packageManager,
    );
    files.push(...serviceFiles);
  }

  const moduleFiles = await generateModuleArtifacts(appSpec, outputDir, options, structure);
  files.push(...moduleFiles);

  const toolingFiles = await generateToolingArtifacts(appSpec, outputDir, options, structure);
  files.push(...toolingFiles);

  const docFiles = await generateDocumentationArtifacts(appSpec, outputDir, options, structure);
  files.push(...docFiles);

  const infraFiles = await generateInfrastructureArtifacts(
    configWithVersion,
    outputDir,
    options,
    structure,
    appSpec,
    primaryClientTarget,
    cliConfig,
    packageManager,
  );
  files.push(...infraFiles);

  const workflowFiles = await generateCIWorkflows(configWithVersion, outputDir, options);
  files.push(...workflowFiles);

  const testRunnerFiles = await generateMasterTestRunner(
    appSpec,
    outputDir,
    options,
    structure,
    cliConfig,
    testsWorkspaceRelative,
    clientTargets,
    packageManager,
  );
  files.push(...testRunnerFiles);

  const workspaceManifestFiles = await generateWorkspaceManifest(
    appSpec,
    outputDir,
    options,
    structure,
    clientTargets,
    testsWorkspaceRelative,
    packageManager,
  );
  files.push(...workspaceManifestFiles);

  return files;
}

type FlowRouteMetadata = {
  rootTestId?: string;
  actionTestIds: string[];
  successTestId?: string;
  apiInteractions: Array<{ method: string; path: string; status?: number }>;
};

function deriveFlowRouteMetadata(appSpec: AppSpec): Map<string, FlowRouteMetadata> {
  const metadata = new Map<string, FlowRouteMetadata>();
  const locatorMap = appSpec.locators || {};
  const routes = Array.isArray(appSpec.ui?.routes) ? appSpec.ui.routes : [];

  const resolveRouteId = (flowId: string): string => {
    if (routes.some((route) => route.id === flowId)) {
      return flowId;
    }
    const namespace = flowId.split(":")[0];
    const matchedRoute = routes.find((route) => route.id.startsWith(namespace)) ??
      routes[0] ?? { id: flowId };
    return matchedRoute.id;
  };

  for (const flow of appSpec.flows || []) {
    const routeId = resolveRouteId(flow.id);
    if (!metadata.has(routeId)) {
      metadata.set(routeId, {
        actionTestIds: [],
        apiInteractions: [],
      });
    }

    const entry = metadata.get(routeId)!;
    const actionSet = new Set(entry.actionTestIds);
    let lastExpectId = entry.successTestId;

    const recordAction = (raw: string | undefined) => {
      const id = extractTestId(raw, locatorMap);
      if (id) {
        actionSet.add(id);
      }
    };

    for (const step of flow.steps || []) {
      if (typeof step.click === "string") {
        recordAction(step.click);
      }
      if (typeof step.fill?.locator === "string") {
        recordAction(step.fill.locator);
      }
      if (typeof step.expect?.locator === "string") {
        const derivedId = extractTestId(step.expect.locator, locatorMap);
        if (derivedId) {
          lastExpectId = derivedId;
          if (!entry.rootTestId && step.expect.locator.startsWith("page:")) {
            entry.rootTestId = derivedId;
          }
        }
      }
      if (step.expect_api) {
        const method = (step.expect_api.method || "GET").toUpperCase();
        const path = step.expect_api.path;
        const key = `${method} ${path}`;
        const exists = entry.apiInteractions.some(
          (api) => `${(api.method || "GET").toUpperCase()} ${api.path}` === key,
        );
        if (!exists) {
          entry.apiInteractions.push({
            method,
            path,
            status: step.expect_api.status,
          });
        }
      }
    }

    if (!entry.rootTestId) {
      const namespace = routeId.split(":")[0];
      const pageKey =
        Object.keys(locatorMap).find((key) => key.startsWith("page:") && key.includes(namespace)) ||
        Object.keys(locatorMap).find((key) => key.startsWith("page:"));
      if (pageKey) {
        entry.rootTestId = extractTestId(pageKey, locatorMap) ?? entry.rootTestId;
      }
    }

    entry.actionTestIds = Array.from(actionSet);
    if (lastExpectId) {
      entry.successTestId = lastExpectId;
    }
  }

  return metadata;
}

function extractTestId(
  target: string | undefined,
  locatorMap: Record<string, string>,
): string | null {
  if (!target) return null;
  const mapped = locatorMap[target];
  if (mapped) {
    const match = mapped.match(/data-testid="([^"]+)"/);
    if (match) return match[1];
  }
  const directMatch = target.match(/data-testid="([^"]+)"/);
  if (directMatch) {
    return directMatch[1];
  }
  if (target.includes(":")) {
    return sanitizeTestId(target.split(":").pop() || target);
  }
  if (/[\[\].#]/.test(target)) {
    return sanitizeTestId(target.replace(/[^a-z0-9]+/gi, "-"));
  }
  return sanitizeTestId(target);
}

function sanitizeTestId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/--+/g, "-") || "test-id"
  );
}

function humanizeTestId(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildRouteComponentContent(
  route: any,
  componentName: string,
  definitionName: string,
  safePath: string,
  title: string,
  description: string,
  capabilityBlock: string,
  locatorMap: Record<string, string>,
  flowMetadata?: FlowRouteMetadata,
): string {
  const rootDataAttr =
    flowMetadata?.rootTestId && flowMetadata.rootTestId.length > 0
      ? ` data-testid="${flowMetadata.rootTestId}"`
      : "";
  const resolvedRootAttr = rootDataAttr || ` data-testid="${sanitizeTestId(route.id)}"`;

  const hasInteractiveFlow = flowMetadata && (flowMetadata.actionTestIds?.length || 0) > 0;

  if (!hasInteractiveFlow && !flowMetadata?.successTestId) {
    return `import type { FC } from 'react';
import type { RouteDefinition } from './types';

const ${componentName}: FC = () => {
  return (
    <section data-route="${route.id}" role="main"${resolvedRootAttr}>
      <header>
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
${capabilityBlock}    </section>
  );
};

export const ${definitionName}: RouteDefinition = {
  id: '${route.id}',
  path: '${safePath}',
  Component: ${componentName},
};
`;
  }

  const actionButtons = (flowMetadata?.actionTestIds || [])
    .map((testId) => {
      const label = humanizeTestId(testId);
      return `        <button
          type="button"
          data-testid="${testId}"
          onClick={() => handleAction('${testId}')}
          aria-pressed={activeAction === '${testId}'}
          className={activeAction === '${testId}' ? 'selected' : undefined}
        >
          ${label}
        </button>`;
    })
    .join("\n");

  const actionSection = actionButtons
    ? `      <section className="stub-actions">
${actionButtons}
      </section>`
    : "";

  const successBlock = flowMetadata?.successTestId
    ? `        {status === 'success' && (
          <div role="status" data-testid="${flowMetadata.successTestId}">
            <h3>Success</h3>
            <p>{activeAction ? \`Flow for \${activeAction} is ready.\` : 'Flow completed.'}</p>
          </div>
        )}`
    : "";

  const fetchCalls = flowMetadata?.apiInteractions?.length
    ? flowMetadata.apiInteractions
        .map(
          (api) => `      await fetch('${api.path}', {
        method: '${(api.method || "GET").toUpperCase()}',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: '${route.id}', action }),
      });`,
        )
        .join("\n")
    : "      await new Promise((resolve) => setTimeout(resolve, 300));";

  return `import { useState } from 'react';
import type { FC } from 'react';
import type { RouteDefinition } from './types';

const ${componentName}: FC = () => {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setActiveAction(action);
    setStatus('submitting');
    setErrorMessage(null);
    try {
${fetchCalls}
      setStatus('success');
    } catch (error) {
      console.error('Stub action failed', error);
      setStatus('error');
      setErrorMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <section data-route="${route.id}" role="main"${resolvedRootAttr}>
      <header>
        <h1>${title}</h1>
        <p>${description}</p>
      </header>
${capabilityBlock}${actionSection}
      <section aria-live="polite">
${successBlock}
        {status === 'error' && (
          <div role="alert">
            <p>{errorMessage}</p>
          </div>
        )}
      </section>
    </section>
  );
};

export const ${definitionName}: RouteDefinition = {
  id: '${route.id}',
  path: '${safePath}',
  Component: ${componentName},
};
`;
}

interface RouteBindingInput {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
  statusCode?: number;
}

function mergeRouteBindings(
  base: RouteBindingInput[],
  additional: RouteBindingInput[],
): RouteBindingInput[] {
  const routeMap = new Map<string, RouteBindingInput>();
  for (const binding of base) {
    const key = `${binding.method} ${binding.url}`.toUpperCase();
    routeMap.set(key, binding);
  }
  for (const binding of additional) {
    const key = `${binding.method} ${binding.url}`.toUpperCase();
    if (!routeMap.has(key)) {
      routeMap.set(key, binding);
    }
  }
  return Array.from(routeMap.values());
}

function deriveServiceEndpointsFromPaths(
  appSpec: AppSpec | undefined,
  serviceName: string,
  serviceSlug: string,
  serviceSpec: any,
  pathOwnership?: Map<string, string>,
): RouteBindingInput[] {
  if (!appSpec?.paths) {
    return [];
  }

  const results: RouteBindingInput[] = [];
  const serviceOriginal = serviceName;
  const normalizedOriginal = slugify(serviceOriginal, serviceOriginal);

  for (const [pathServiceName, pathSpec] of Object.entries(appSpec.paths)) {
    if (!pathSpec || typeof pathSpec !== "object") {
      continue;
    }

    const normalizedPathService = slugify(pathServiceName, pathServiceName);
    const explicitMatch =
      pathServiceName === serviceOriginal ||
      pathServiceName === serviceSlug ||
      normalizedPathService === serviceSlug ||
      normalizedPathService === normalizedOriginal;

    for (const [pathKey, pathDefinition] of Object.entries(pathSpec as Record<string, PathSpec>)) {
      const owner = pathOwnership?.get(pathKey);
      const belongs =
        explicitMatch ||
        owner === serviceSlug ||
        (!owner && pathBelongsToService(pathKey, serviceOriginal, serviceSpec));
      if (!belongs) {
        continue;
      }

      for (const method of SUPPORTED_HTTP_METHODS) {
        const operation = (pathDefinition as Record<string, any>)[method];
        if (!operation) {
          continue;
        }

        const summary = operation.summary || `${method.toUpperCase()} ${pathKey}`;
        const { statusCode, example } = extractResponseMetadata(operation);
        const replyPayload = example ?? {
          service: serviceSlug,
          status: "not_implemented",
          summary,
          method: method.toUpperCase(),
          path: pathKey,
        };

        results.push({
          method: method.toUpperCase(),
          url: pathKey,
          summary,
          reply: replyPayload,
          statusCode,
        });
      }
    }
  }

  return results;
}

function deriveServiceEndpointsFromFlows(
  appSpec: AppSpec | undefined,
  serviceName: string,
  serviceSlug: string,
  serviceSpec: any,
): RouteBindingInput[] {
  if (!appSpec?.flows) {
    return [];
  }

  const results: RouteBindingInput[] = [];
  const serviceOriginal = serviceName;

  for (const flow of appSpec.flows) {
    for (const step of flow.steps ?? []) {
      const api = step.expect_api;
      if (!api?.path) continue;
      if (!pathBelongsToService(api.path, serviceOriginal, serviceSpec)) continue;

      const method = (api.method || "GET").toUpperCase();
      const summary = `${flow.id} ${method} ${api.path}`;
      const statusCode = Number.isFinite(api.status)
        ? Number(api.status)
        : method === "POST"
          ? 201
          : 200;

      results.push({
        method,
        url: api.path,
        summary,
        reply: {
          service: serviceSlug,
          flow: flow.id,
          status: "not_implemented",
          method,
          path: api.path,
        },
        statusCode,
      });
    }
  }

  return results;
}

function extractResponseMetadata(operation: any): { statusCode: number; example?: unknown } {
  const responses = operation?.responses;
  if (!responses || typeof responses !== "object") {
    return { statusCode: 200 };
  }

  const preferredStatuses = ["200", "201", "202", "204", "default"];
  const responseEntries = Object.entries(responses);
  const orderedStatuses = [...preferredStatuses, ...responseEntries.map(([status]) => status)];

  for (const status of orderedStatuses) {
    const response = (responses as Record<string, any>)[status];
    if (!response) continue;

    const example =
      response.example ??
      extractExampleFromContent(response.content) ??
      response.examples?.default ??
      response.examples?.[0];

    if (example !== undefined) {
      const numericStatus = Number.parseInt(status, 10);
      return { statusCode: Number.isFinite(numericStatus) ? numericStatus : 200, example };
    }

    const numericStatus = Number.parseInt(status, 10);
    if (Number.isFinite(numericStatus)) {
      return { statusCode: numericStatus };
    }
  }

  return { statusCode: 200 };
}

function extractExampleFromContent(content: any): unknown {
  if (!content || typeof content !== "object") {
    return undefined;
  }
  for (const media of Object.values(content)) {
    if (!media || typeof media !== "object") continue;
    if ((media as any).example !== undefined) {
      return (media as any).example;
    }
    const schemaExample = (media as any).schema?.example;
    if (schemaExample !== undefined) {
      return schemaExample;
    }
  }
  return undefined;
}

/**
 * Generate UI components from app spec routes
 */
async function generateUIComponents(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];
  const context = clientTarget.context;
  const relativeRoot = clientTarget.relativeRoot;
  const language = clientTarget.config?.language || appSpec.config?.language || "typescript";

  if (language !== "typescript") {
    console.log(
      chalk.yellow(
        `⚠️  UI route generation currently supports TypeScript React projects. Skipping for '${language}'.`,
      ),
    );
    return files;
  }

  await ensureDirectory(context.routesDir, options);

  const typeFilePath = path.join(context.routesDir, "types.ts");
  const typeFileRelative = joinRelativePath(relativeRoot, "src", "routes", "types.ts");
  await writeFileWithHooks(
    typeFilePath,
    `import type { ComponentType } from 'react';\n\nexport interface RouteDefinition {\n  id: string;\n  path: string;\n  Component: ComponentType;\n  description?: string;\n  children?: RouteDefinition[];\n}\n\nexport type RouteDefinitions = RouteDefinition[];\n`,
    options,
  );
  files.push(typeFileRelative);

  const routeDefinitions: Array<{ importName: string }> = [];

  const locatorMap = appSpec.locators || {};
  const flowRoutes = deriveFlowRouteMetadata(appSpec);

  for (const route of appSpec.ui.routes) {
    const baseName = route.id
      .split(":")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
    const componentName = `${baseName}View`;
    const definitionName = `${baseName}Route`;
    const fileName = `${definitionName}.tsx`;
    const relPath = joinRelativePath(relativeRoot, "src", "routes", fileName);
    const filePath = path.join(context.routesDir, fileName);
    const rawPath = route.path || `/${route.id.replace(/:/g, "/")}`;
    const safePath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const title = route.name || baseName;
    const description =
      route.summary ||
      route.description ||
      (Array.isArray(route.capabilities) && route.capabilities.length > 0
        ? `Capabilities: ${route.capabilities.join(", ")}`
        : "Auto-generated view");

    const capabilityList = Array.isArray(route.capabilities)
      ? route.capabilities.map((cap) => `          <li>${cap}</li>`).join("\n")
      : "";

    const capabilityBlock = capabilityList
      ? `        <section className="route-capabilities">\n          <h2>Capabilities</h2>\n          <ul>\n${capabilityList}\n          </ul>\n        </section>\n`
      : "";

    const flowMetadata = flowRoutes.get(route.id);
    const componentContent = buildRouteComponentContent(
      route,
      componentName,
      definitionName,
      safePath,
      title,
      description,
      capabilityBlock,
      locatorMap,
      flowMetadata,
    );

    await writeFileWithHooks(filePath, componentContent, options);
    files.push(relPath);
    routeDefinitions.push({ importName: definitionName });
  }

  const aggregatorPath = path.join(context.routesDir, "index.tsx");
  const aggregatorRelative = joinRelativePath(relativeRoot, "src", "routes", "index.tsx");
  const imports = routeDefinitions
    .map((definition) => `import { ${definition.importName} } from './${definition.importName}';`)
    .join("\n");
  const definitionsArray = routeDefinitions.map((definition) => definition.importName).join(", ");

  const aggregatorContent = `import type { RouteObject } from 'react-router-dom';\nimport type { RouteDefinition } from './types';\n${imports ? `${imports}\n` : ""}\nconst definitions: RouteDefinition[] = [${definitionsArray}];\n\nconst toRouteObject = (definition: RouteDefinition): RouteObject => {\n  const View = definition.Component;\n  return {\n    path: definition.path,\n    element: <View />,\n    children: definition.children?.map(toRouteObject),\n  };\n};\n\nexport const routes: RouteObject[] = definitions.map(toRouteObject);\nexport type { RouteDefinition } from './types';\n`;

  await writeFileWithHooks(aggregatorPath, aggregatorContent, options);
  files.push(aggregatorRelative);

  const appRoutesPath = path.join(context.routesDir, "AppRoutes.tsx");
  const appRoutesRelative = joinRelativePath(relativeRoot, "src", "routes", "AppRoutes.tsx");
  const appRoutesContent = `import { useRoutes } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

export interface AppRoutesProps {
  routes: RouteObject[];
}

export function AppRoutes({ routes }: AppRoutesProps) {
  return useRoutes(routes);
}
`;

  await writeFileWithHooks(appRoutesPath, appRoutesContent, options);
  files.push(appRoutesRelative);

  return files;
}

/**
 * Generate test cases based on app flows
 */
async function generateFlowBasedTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTarget?: ClientGenerationTarget,
): Promise<{ files: string[]; workspaceDir?: string }> {
  const files: string[] = [];

  console.log(chalk.blue("🧪 Generating tests from flows..."));

  // Determine language for test generation
  const language = clientTarget?.config?.language || appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (!plugin) {
    console.log(
      chalk.yellow(`⚠️  No plugin available for ${language}, using default Playwright tests`),
    );
  }

  const defaultWorkspaceSegments = [
    ...toPathSegments(structure.testsDirectory || "tests"),
    clientTarget?.slug ?? "app",
  ];
  const workspaceRoot =
    clientTarget?.context?.testsDir ?? path.join(outputDir, ...defaultWorkspaceSegments);
  const relativeWorkspace = path.relative(outputDir, workspaceRoot);
  const workspaceSegments =
    relativeWorkspace.trim().length > 0
      ? toPathSegments(relativeWorkspace)
      : defaultWorkspaceSegments;
  const flowsDir = path.join(workspaceRoot, "flows");
  if (!fs.existsSync(flowsDir) && !options.dryRun) {
    fs.mkdirSync(flowsDir, { recursive: true });
  }

  for (const flow of appSpec.flows) {
    const testContent = generateDefaultFlowTest(flow, appSpec.locators);

    const testFileName = `${flow.id.replace(/:/g, "_")}.test.ts`;
    const testPath = path.join(flowsDir, testFileName);
    await writeFileWithHooks(testPath, testContent, options);
    files.push(joinRelativePath(...workspaceSegments, "flows", testFileName));
  }

  const workspaceFiles = await scaffoldPlaywrightWorkspace(
    appSpec,
    workspaceRoot,
    workspaceSegments,
    options,
    clientTarget,
    structure,
  );
  files.push(...workspaceFiles);

  const workspaceDir = joinRelativePath(...workspaceSegments) || ".";
  return { files, workspaceDir };
}

async function scaffoldPlaywrightWorkspace(
  appSpec: AppSpec,
  workspaceRoot: string,
  workspaceSegments: string[],
  options: GenerateOptions,
  clientTarget: ClientGenerationTarget | undefined,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  if (!appSpec.flows || appSpec.flows.length === 0) {
    return [];
  }

  await ensureDirectory(workspaceRoot, options);
  const files: string[] = [];

  const slug = clientTarget?.slug ?? "app";
  const rel = (file: string) => joinRelativePath(...workspaceSegments, file);

  const packageJson = {
    name: `@${slug}/e2e`,
    private: true,
    version: "0.0.0",
    scripts: {
      test: "node ./support/run-e2e.mjs",
      "test:headed": "node ./support/run-e2e.mjs --headed",
      "test:ui": "node ./support/run-e2e.mjs --ui",
    },
    devDependencies: {
      "@playwright/test": "^1.48.2",
      typescript: "^5.5.4",
    },
  };

  await writeFileWithHooks(
    path.join(workspaceRoot, "package.json"),
    JSON.stringify(packageJson, null, 2),
    options,
  );
  files.push(rel("package.json"));

  const tsconfig = {
    compilerOptions: {
      target: "ESNext",
      module: "CommonJS",
      moduleResolution: "Node",
      types: ["node", "@playwright/test"],
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false,
    },
    include: ["**/*.ts"],
  };

  await writeFileWithHooks(
    path.join(workspaceRoot, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
    options,
  );
  files.push(rel("tsconfig.json"));

  const locatorsDir = path.join(workspaceRoot, "support");
  await ensureDirectory(locatorsDir, options);
  const locatorEntries = Object.entries(appSpec.locators || {}).length
    ? Object.entries(appSpec.locators)
    : [["page:root", '[data-testid="app-root"]']];
  const locatorsContent = `export const locators = {
${locatorEntries.map(([token, selector]) => `  '${token}': '${selector}',`).join("\n")}
} as const;

export type LocatorToken = keyof typeof locators;

export function getLocator(token: LocatorToken): string {
  return locators[token];
}

export function loc(token: LocatorToken | string): string {
  const record = locators as Record<string, string>;
  return record[token as LocatorToken] ?? String(token);
}
`;
  await writeFileWithHooks(path.join(locatorsDir, "locators.ts"), locatorsContent, options);
  files.push(rel(path.join("support", "locators.ts")));

  const runE2eScript = `#!/usr/bin/env node
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function portIsFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port, '0.0.0.0', () => {
      tester.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(preferred, envKey) {
  if (process.env[envKey]) {
    return Number(process.env[envKey]);
  }
  const start = Math.max(preferred, 1024);
  let attempts = 0;
  let candidate = start;
  while (attempts < 500) {
    if (await portIsFree(candidate)) {
      return candidate;
    }
    candidate += 1;
    attempts += 1;
  }
  throw new Error('Unable to locate a free port for ' + envKey);
}

async function allocatePorts() {
  return {
    E2E_WEB_PORT: await findAvailablePort(5173, 'E2E_WEB_PORT'),
    E2E_STOREFRONT_PORT: await findAvailablePort(3000, 'E2E_STOREFRONT_PORT'),
    E2E_CATALOG_PORT: await findAvailablePort(4000, 'E2E_CATALOG_PORT'),
    E2E_STRIPE_PORT: await findAvailablePort(4010, 'E2E_STRIPE_PORT'),
  };
}

async function main() {
  const assignments = await allocatePorts();
  const runner = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const projectRoot = path.resolve(__dirname, '..');

  const child = spawn(runner, ['playwright', 'test', ...process.argv.slice(2)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...Object.fromEntries(
        Object.entries(assignments).map(([key, value]) => [key, String(value)]),
      ),
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });

  child.on('error', (error) => {
    console.error('Failed to launch Playwright:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
`;

  await writeFileWithHooks(path.join(locatorsDir, "run-e2e.mjs"), runE2eScript, options, 0o755);
  files.push(rel(path.join("support", "run-e2e.mjs")));

  const playwrightConfig = buildPlaywrightConfig(appSpec, clientTarget, structure);
  await writeFileWithHooks(
    path.join(workspaceRoot, "playwright.config.ts"),
    playwrightConfig,
    options,
  );
  files.push(rel("playwright.config.ts"));

  return files;
}

function buildPlaywrightConfig(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget | undefined,
  structure: ProjectStructureConfig,
): string {
  const slug = clientTarget?.slug ?? "app";
  const clientBase =
    clientTarget?.relativeRoot ?? joinRelativePath(structure.clientsDirectory, slug);
  const clientDirRelative = path.posix.join("..", "..", clientBase);
  const tsServices = Object.entries(appSpec.services ?? {}).filter(([, svc]) =>
    isTypeScriptServiceLanguage((svc as any)?.language as string | undefined),
  );

  const webPortInit = "Number(process.env.E2E_WEB_PORT ?? 5173)";
  const storefrontPortInit = "Number(process.env.E2E_STOREFRONT_PORT ?? 3000)";
  const catalogPortInit = "Number(process.env.E2E_CATALOG_PORT ?? 4000)";
  const stripePortInit = "Number(process.env.E2E_STRIPE_PORT ?? 4010)";
  const webPortExpr = "webPort";
  const storefrontPortExpr = "storefrontPort";
  const catalogPortExpr = "catalogPort";
  const stripePortExpr = "stripePort";

  const serviceWebServers = tsServices
    .map(([serviceName, serviceSpec]) => {
      const serviceSlug = slugify(serviceName, serviceName);
      const portExpr = serviceSlug.includes("catalog")
        ? catalogPortExpr
        : serviceSlug.includes("stripe")
          ? stripePortExpr
          : storefrontPortExpr;
      const serviceDir = path.posix.join("..", "..", structure.servicesDirectory, serviceSlug);
      return `{
      command: 'npm run dev',
      cwd: path.resolve(__dirname, '${serviceDir}'),
      url: \`http://127.0.0.1:${"${"}${portExpr}${"}"}/healthz\`,
      env: {
        PORT: String(${portExpr}),
        HOST: '127.0.0.1',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    }`;
    })
    .join(",\n    ");

  const webServerEntries = `[
    {
      command: \`npm run dev -- --host 127.0.0.1 --port \${webPort}\`,
      cwd: clientDir,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        E2E_WEB_PORT: String(webPort),
      },
    }${serviceWebServers ? `,\n    ${serviceWebServers}` : ""}
  ]`;

  return `import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const clientDir = path.resolve(__dirname, '${clientDirRelative}');
const webPort = ${webPortInit};
const storefrontPort = ${storefrontPortInit};
const catalogPort = ${catalogPortInit};
const stripePort = ${stripePortInit};
const baseURL = process.env.E2E_BASE_URL ?? \`http://127.0.0.1:\${webPort}\`;

export default defineConfig({
  testDir: './flows',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: ${webServerEntries},
});
`;
}

async function generateEndpointAssertionTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
): Promise<string[]> {
  const files: string[] = [];
  const cases = collectEndpointAssertionCases(appSpec);

  if (cases.length === 0) {
    return files;
  }

  console.log(chalk.blue("🧪 Generating endpoint assertion tests..."));

  const language = (appSpec.config?.language || "typescript").toLowerCase();
  const testingConfig = cliConfig.generator?.plugins?.[language]?.testing;
  const framework = resolveTestingFramework(language, testingConfig?.framework);
  const plugin = getConfiguredLanguagePlugin(language);

  const defaultDirSegments = [...toPathSegments(structure.testsDirectory), "api", "assertions"];
  const configuredSegments = testingConfig?.outputDir
    ? toPathSegments(testingConfig.outputDir)
    : defaultDirSegments;

  const testsDir =
    configuredSegments.length > 0 ? path.join(outputDir, ...configuredSegments) : outputDir;
  const relativeDir = configuredSegments.length > 0 ? joinRelativePath(...configuredSegments) : ".";

  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  let handledByPlugin = false;

  if (plugin?.generateEndpointTests) {
    const generationConfig: EndpointTestGenerationConfig = {
      app: appSpec,
      cases,
      outputDir: testsDir,
      relativeDir,
      language,
      testing: testingConfig,
    };

    try {
      const generation = await plugin.generateEndpointTests(generationConfig);

      for (const file of generation.files) {
        const relativePath = file.path.replace(/^\/+/, "");
        const destination = path.join(testsDir, relativePath);
        const mode = file.executable ? 0o755 : undefined;

        await writeFileWithHooks(destination, file.content, options, mode);
        const relativeFile =
          configuredSegments.length > 0
            ? joinRelativePath(...configuredSegments, relativePath.replace(/^\.\//, ""))
            : relativePath.replace(/^\.\//, "");
        files.push(relativeFile);
      }

      if (generation.instructions && generation.instructions.length > 0) {
        generation.instructions.forEach((instruction) =>
          console.log(chalk.green(`✅ ${instruction}`)),
        );
      }

      handledByPlugin = generation.files.length > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        chalk.yellow(
          `⚠️  Plugin endpoint test generation failed for ${plugin.name}, falling back to default: ${message}`,
        ),
      );
    }
  }

  if (handledByPlugin) {
    return files;
  }

  switch (language) {
    case "typescript":
    case "javascript": {
      const normalized = language === "javascript" ? "javascript" : "typescript";
      const frameworkChoice = normalizeJsFramework(normalized, framework);
      console.log(
        chalk.dim(
          `   • Using ${frameworkChoice.toUpperCase()} template for ${normalized} endpoint assertions`,
        ),
      );
      const fileName = `endpoint-assertions.test.${normalized === "javascript" ? "js" : "ts"}`;
      const filePath = path.join(testsDir, fileName);
      const content = generateJsTsEndpointAssertionTest(normalized, frameworkChoice, cases);
      await writeFileWithHooks(filePath, content, options);
      files.push(
        configuredSegments.length > 0
          ? joinRelativePath(...configuredSegments, fileName)
          : fileName,
      );
      break;
    }
    case "python": {
      const frameworkChoice = framework === "pytest" ? "pytest" : "pytest";
      console.log(chalk.dim("   • Using PYTEST template for python endpoint assertions"));
      const fileName = "test_endpoint_assertions.py";
      const filePath = path.join(testsDir, fileName);
      const content = generatePythonEndpointAssertionTest(frameworkChoice, cases);
      await writeFileWithHooks(filePath, content, options);
      files.push(
        configuredSegments.length > 0
          ? joinRelativePath(...configuredSegments, fileName)
          : fileName,
      );
      break;
    }
    case "rust": {
      console.log(chalk.dim("   • Using Rust std test template for endpoint assertions"));
      const fileName = "endpoint_assertions.rs";
      const filePath = path.join(testsDir, fileName);
      const content = generateRustEndpointAssertionTest(cases);
      await writeFileWithHooks(filePath, content, options);
      files.push(
        configuredSegments.length > 0
          ? joinRelativePath(...configuredSegments, fileName)
          : fileName,
      );
      break;
    }
    case "go": {
      console.log(chalk.dim("   • Using Go testing template for endpoint assertions"));
      const fileName = "endpoint_assertions_test.go";
      const filePath = path.join(testsDir, fileName);
      const content = generateGoEndpointAssertionTest(cases);
      await writeFileWithHooks(filePath, content, options);
      files.push(
        configuredSegments.length > 0
          ? joinRelativePath(...configuredSegments, fileName)
          : fileName,
      );
      break;
    }
    default: {
      console.log(
        chalk.yellow(
          `⚠️  Endpoint assertion tests not generated for language '${language}'. Provide a language plugin implementation or add a generator fallback.`,
        ),
      );
    }
  }

  return files;
}

async function generateCapabilityFeatures(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const capabilities = appSpec.capabilities;

  if (!capabilities || Object.keys(capabilities).length === 0) {
    return [];
  }

  const entries = Object.entries(capabilities).filter(([, capability]) => {
    const spec = capability?.gherkin;
    return typeof spec === "string" && spec.trim().length > 0;
  });

  if (entries.length === 0) {
    return [];
  }

  const featuresDir = path.join(outputDir, structure.testsDirectory, "features", "capabilities");
  await ensureDirectory(featuresDir, options);

  const files: string[] = [];

  for (const [capabilityId, capability] of entries) {
    const identifier = capabilityId || capability.name || "capability";
    const slug = slugify(
      typeof identifier === "string" ? identifier : String(capabilityId),
      "capability",
    );
    const fileName = `${slug}.feature`;
    const filePath = path.join(featuresDir, fileName);

    const headerLines: string[] = [`# Capability: ${capability.name ?? capabilityId}`];

    if (capability.description) {
      headerLines.push(`# Description: ${capability.description}`);
    }
    if (capability.owner) {
      headerLines.push(`# Owner: ${capability.owner}`);
    }
    if (Array.isArray(capability.depends_on) && capability.depends_on.length > 0) {
      headerLines.push(`# Depends on: ${capability.depends_on.join(", ")}`);
    }
    if (Array.isArray(capability.tags) && capability.tags.length > 0) {
      headerLines.push(`# Tags: ${capability.tags.join(", ")}`);
    }

    headerLines.push("");

    const normalizedSpec = capability.gherkin!.replace(/\r\n?/g, "\n").trim();
    const featureBody = normalizedSpec.startsWith("Feature:")
      ? normalizedSpec
      : `Feature: ${capability.name ?? slug}\n${normalizedSpec}`;

    const content = [...headerLines, featureBody, ""].join("\n");
    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(structure.testsDirectory, "features", "capabilities", fileName));
  }

  return files;
}

const SUPPORTED_HTTP_METHODS: Array<keyof PathSpec> = ["get", "post", "put", "patch", "delete"];

function collectEndpointAssertionCases(appSpec: AppSpec): EndpointTestCaseDefinition[] {
  const cases: EndpointTestCaseDefinition[] = [];
  const pathGroups = appSpec.paths ?? {};

  for (const pathSpec of Object.values(pathGroups)) {
    if (!pathSpec || typeof pathSpec !== "object") {
      continue;
    }

    for (const [pathKey, operationSet] of Object.entries(pathSpec as Record<string, PathSpec>)) {
      for (const method of SUPPORTED_HTTP_METHODS) {
        const operation = (operationSet as Record<string, any>)[method];
        if (!operation || typeof operation !== "object") {
          continue;
        }

        const assertions = normalizeCueAssertionBlock(operation.assertions);
        if (assertions.length === 0) {
          continue;
        }

        const responses = operation.responses as Record<string, any> | undefined;
        let primaryResponseStatus: number | undefined;
        let primaryResponse: Record<string, unknown> | undefined;

        if (responses && typeof responses === "object") {
          const preferredOrder = ["200", "201", "202", "204"];
          const entries = Object.entries(responses).filter(([status]) => status);
          const preferredEntry = entries.find(([status]) => preferredOrder.includes(status));
          const fallbackEntry = entries[0];
          const chosen = preferredEntry ?? fallbackEntry;
          if (chosen) {
            primaryResponseStatus = Number.parseInt(chosen[0], 10);
            primaryResponse = chosen[1] as Record<string, unknown>;
          }
        }

        const requestBody = operation.requestBody as Record<string, unknown> | undefined;
        const metadata: Record<string, unknown> = {};

        if (requestBody && typeof requestBody === "object") {
          const requestContent = requestBody.content as
            | Record<string, Record<string, unknown>>
            | undefined;
          if (requestContent && typeof requestContent === "object") {
            const [contentType, media] = Object.entries(requestContent)[0] ?? [];
            metadata.requestBody = {
              contentType,
              schema: media?.schema,
              example: media?.example,
            };
          }
        }

        if (primaryResponse) {
          const responseContent = primaryResponse.content as
            | Record<string, Record<string, unknown>>
            | undefined;
          if (responseContent && typeof responseContent === "object") {
            const [contentType, media] = Object.entries(responseContent)[0] ?? [];
            metadata.response = {
              status: primaryResponseStatus,
              contentType,
              schema: media?.schema,
              example: media?.example,
            };
          }
        }

        cases.push({
          path: pathKey,
          method: method.toUpperCase(),
          assertions,
          status: primaryResponseStatus,
          metadata,
        });
      }
    }
  }

  return cases;
}

function normalizeCueAssertionBlock(
  block?: CueAssertionBlock,
): EndpointTestCaseDefinition["assertions"] {
  if (!block || typeof block !== "object") {
    return [];
  }

  const result: EndpointTestCaseDefinition["assertions"] = [];

  for (const [name, value] of Object.entries(block)) {
    const normalized = normalizeCueAssertion(name, value as CueAssertion);
    if (normalized) {
      result.push(normalized);
    }
  }

  return result;
}

function normalizeCueAssertion(
  name: string,
  value: CueAssertion,
): EndpointAssertionDefinition | null {
  if (typeof value === "boolean") {
    return {
      name,
      result: value,
      severity: "error",
      raw: value,
    };
  }

  if (value && typeof value === "object") {
    const severity =
      value.severity === "warn" || value.severity === "info" ? value.severity : "error";
    const tags = Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined;

    return {
      name,
      result: typeof value.assert === "boolean" ? value.assert : null,
      severity,
      message: value.message,
      tags,
      raw: value,
    };
  }

  return null;
}

function resolveTestingFramework(language: string, configuredFramework?: string | null): string {
  if (configuredFramework && configuredFramework.trim().length > 0) {
    return configuredFramework.trim().toLowerCase();
  }

  switch (language) {
    case "javascript":
      return "jest";
    case "typescript":
      return "vitest";
    case "python":
      return "pytest";
    case "rust":
      return "builtin";
    case "go":
      return "go-test";
    default:
      return "vitest";
  }
}

function normalizeJsFramework(
  language: "typescript" | "javascript",
  framework: string,
): "vitest" | "jest" {
  if (framework === "jest") {
    return "jest";
  }
  if (framework === "vitest") {
    return "vitest";
  }
  return language === "javascript" ? "jest" : "vitest";
}

function normalizeCasesForSerialization(cases: EndpointTestCaseDefinition[]): Array<{
  path: string;
  method: string;
  status: number | null;
  assertions: Array<{
    name: string;
    result: boolean | null;
    severity: string;
    message: string | null;
    tags: string[];
  }>;
}> {
  return cases.map(({ path, method, status, assertions }) => ({
    path,
    method,
    status: typeof status === "number" ? status : null,
    assertions: assertions.map((assertion) => ({
      name: assertion.name,
      result: assertion.result,
      severity: assertion.severity,
      message: assertion.message ?? null,
      tags: assertion.tags ?? [],
    })),
  }));
}

function generateJsTsEndpointAssertionTest(
  language: "typescript" | "javascript",
  framework: "vitest" | "jest",
  cases: EndpointTestCaseDefinition[],
): string {
  const payload = normalizeCasesForSerialization(cases);
  const serialized = JSON.stringify(payload, null, 2);
  const importLine =
    framework === "jest"
      ? "import { describe, it, expect } from '@jest/globals';"
      : "import { describe, it, expect } from 'vitest';";

  const typeDefinitions =
    language === "typescript"
      ? `\ntype EndpointAssertion = {\n  name: string;\n  result: boolean | null;\n  severity: 'error' | 'warn' | 'info';\n  message: string | null;\n  tags: string[];\n};\n\ntype EndpointTestCase = {\n  path: string;\n  method: string;\n  status: number | null;\n  assertions: EndpointAssertion[];\n};\n`
      : "";

  const casesDeclaration =
    language === "typescript"
      ? `const endpointCases: EndpointTestCase[] = ${serialized};`
      : `const endpointCases = ${serialized};`;

  return `// Generated by Arbiter - Endpoint assertion tests\n${importLine}${typeDefinitions}\n${casesDeclaration}\n\nendpointCases.forEach(({ method, path, assertions }) => {\n  describe(\`[\${method}] \${path}\`, () => {\n    assertions.forEach(assertion => {\n      const label = assertion.message || assertion.name;\n      const runner = assertion.result === null ? it.skip : it;\n      runner(label, () => {\n        expect(assertion.result, assertion.message || assertion.name).toBe(true);\n      });\n    });\n  });\n});\n`;
}

function generatePythonEndpointAssertionTest(
  _framework: string,
  cases: EndpointTestCaseDefinition[],
): string {
  const serialized = JSON.stringify(normalizeCasesForSerialization(cases), null, 2);

  return `# Generated by Arbiter - Endpoint assertion tests\nimport json\nimport pytest\n\nENDPOINT_CASES = json.loads(r'''${serialized}''')\n\n@pytest.mark.parametrize(\"case\", ENDPOINT_CASES, ids=lambda c: f\"{c['method']} {c['path']}\")\ndef test_endpoint_assertions(case):\n    for assertion in case['assertions']:\n        result = assertion.get('result')\n        message = assertion.get('message') or assertion['name']\n        if result is None:\n            pytest.skip(f\"{message} marked as TODO\")\n        assert result, message\n`;
}

function generateRustEndpointAssertionTest(cases: EndpointTestCaseDefinition[]): string {
  const renderedCases = normalizeCasesForSerialization(cases)
    .map((caseItem) => {
      const assertions = caseItem.assertions
        .map((assertion) => {
          const result =
            assertion.result === null ? "None" : `Some(${assertion.result ? "true" : "false"})`;
          const message = assertion.message
            ? `Some("${escapeRustString(assertion.message)}")`
            : "None";
          const tags =
            assertion.tags.length > 0
              ? `vec![${assertion.tags.map((tag) => `"${escapeRustString(tag)}"`).join(", ")}]`
              : "Vec::new()";

          return `                EndpointAssertion {\n                    name: "${escapeRustString(assertion.name)}",\n                    result: ${result},\n                    severity: "${escapeRustString(assertion.severity)}",\n                    message: ${message},\n                    tags: ${tags},\n                }`;
        })
        .join(",\n");

      const status = caseItem.status !== null ? `Some(${caseItem.status})` : "None";

      return `            EndpointCase {\n                path: "${escapeRustString(caseItem.path)}",\n                method: "${escapeRustString(caseItem.method)}",\n                status: ${status},\n                assertions: vec![\n${assertions}\n                ],\n            }`;
    })
    .join(",\n");

  return `// Generated by Arbiter - Endpoint assertion tests\n#[cfg(test)]\nmod tests {\n    struct EndpointAssertion<'a> {\n        name: &'a str,\n        result: Option<bool>,\n        severity: &'a str,\n        message: Option<&'a str>,\n        tags: Vec<&'a str>,\n    }\n\n    struct EndpointCase<'a> {\n        path: &'a str,\n        method: &'a str,\n        status: Option<u16>,\n        assertions: Vec<EndpointAssertion<'a>>,\n    }\n\n    fn endpoint_cases() -> Vec<EndpointCase<'static>> {\n        vec![\n${renderedCases}\n        ]\n    }\n\n    #[test]\n    fn endpoint_assertions_pass() {\n        for case in endpoint_cases() {\n            for assertion in case.assertions {\n                match assertion.result {\n                    Some(true) => {}\n                    Some(false) => {\n                        let message = assertion.message.unwrap_or(assertion.name);\n                        panic!(\"{} {} -> {} failed: {}\", case.method, case.path, assertion.name, message);\n                    }\n                    None => {\n                        println!(\"skipping {} {} -> {}\", case.method, case.path, assertion.name);\n                    }\n                }\n            }\n        }\n    }\n}\n`;
}

function generateGoEndpointAssertionTest(cases: EndpointTestCaseDefinition[]): string {
  const serialized = JSON.stringify(normalizeCasesForSerialization(cases));
  const escaped = escapeGoString(serialized);

  return (
    `// Generated by Arbiter - Endpoint assertion tests\npackage assertions\n\nimport (\n    \"encoding/json\"\n    \"testing\"\n)\n\ntype EndpointAssertion struct {\n    Name     string   ` +
    '`json:"name"`' +
    `\n    Result   *bool    ` +
    '`json:"result"`' +
    `\n    Severity string   ` +
    '`json:"severity"`' +
    `\n    Message  *string  ` +
    '`json:"message"`' +
    `\n    Tags     []string ` +
    '`json:"tags"`' +
    `\n}\n\ntype EndpointCase struct {\n    Path       string              ` +
    '`json:"path"`' +
    `\n    Method     string              ` +
    '`json:"method"`' +
    `\n    Status     *int                ` +
    '`json:"status"`' +
    `\n    Assertions []EndpointAssertion ` +
    '`json:"assertions"`' +
    `\n}\n\nfunc loadEndpointCases(t *testing.T) []EndpointCase {\n    data := []byte(\"${escaped}\")\n    var cases []EndpointCase\n    if err := json.Unmarshal(data, &cases); err != nil {\n        t.Fatalf(\"failed to parse endpoint cases: %v\", err)\n    }\n    return cases\n}\n\nfunc TestEndpointAssertions(t *testing.T) {\n    cases := loadEndpointCases(t)\n    for _, c := range cases {\n        for _, assertion := range c.Assertions {\n            if assertion.Result == nil {\n                t.Logf(\"skipping %s %s -> %s\", c.Method, c.Path, assertion.Name)\n                continue\n            }\n            if !*assertion.Result {\n                if assertion.Message != nil && *assertion.Message != \"\" {\n                    t.Fatalf(\"%s %s -> %s failed: %s\", c.Method, c.Path, assertion.Name, *assertion.Message)\n                }\n                t.Fatalf(\"%s %s -> %s failed\", c.Method, c.Path, assertion.Name)\n            }\n        }\n    }\n}\n`
  );
}

function escapeRustString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function escapeGoString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function buildDefaultTestCommands(
  packageManager: PackageManagerCommandSet,
): Record<string, string> {
  return {
    typescript: packageManager.run("test"),
    javascript: packageManager.run("test"),
    python: "pytest",
    rust: "cargo test",
    go: "go test ./...",
  };
}

type TestTask = {
  name: string;
  command: string;
  cwd: string;
};

function getPluginTestingConfig(
  generatorConfig: GeneratorConfig | undefined,
  language: string,
): LanguageTestingConfig | undefined {
  return generatorConfig?.plugins?.[language]?.testing;
}

function getMasterRunnerConfig(
  testing: GeneratorTestingConfig | undefined,
): MasterTestRunnerConfig | undefined {
  return testing?.master;
}

async function generateMasterTestRunner(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  testsWorkspace?: string,
  clientTargets: ClientGenerationTarget[] = [],
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const generatorConfig = cliConfig.generator;
  const masterConfig = getMasterRunnerConfig(generatorConfig?.testing);
  const runnerType = masterConfig?.type ?? "make";

  const pm =
    packageManager ?? getPackageManagerCommands(detectPackageManager(undefined, outputDir));
  const defaultTestCommands = buildDefaultTestCommands(pm);

  const tasks: TestTask[] = [];

  const serviceEntries = Object.entries(appSpec.services ?? {});
  for (const [serviceName, serviceConfig] of serviceEntries) {
    if (!serviceConfig || typeof serviceConfig !== "object") continue;
    const slug = slugify(serviceName, serviceName);
    const context = createServiceContext(serviceName, serviceConfig, structure, outputDir);
    const language = (serviceConfig.language as string | undefined)?.toLowerCase() ?? "typescript";
    const languageConfig = getPluginTestingConfig(generatorConfig, language);
    const testCommand = resolveTestingCommand(language, languageConfig, defaultTestCommands);
    if (!testCommand) continue;

    const serviceDir = joinRelativePath(structure.servicesDirectory, slug);
    tasks.push({
      name: `test-service-${slug}`,
      command: testCommand,
      cwd: serviceDir,
    });
  }

  const clientTasks = await buildClientTestTasks(
    clientTargets,
    generatorConfig,
    defaultTestCommands,
  );
  tasks.push(...clientTasks);

  const assertionTask = await buildEndpointAssertionTask(
    appSpec,
    outputDir,
    structure,
    generatorConfig,
    pm,
  );
  if (assertionTask) {
    tasks.push(assertionTask);
  }

  if (runnerType === "node") {
    const scriptPath = path.join(
      outputDir,
      masterConfig?.output ?? path.join("tests", "run-all.mjs"),
    );
    await ensureDirectory(path.dirname(scriptPath), options);
    const scriptContent = createNodeRunnerScript(tasks);
    await writeFileWithHooks(scriptPath, scriptContent, options, 0o755);
    const relativePath = path.relative(outputDir, scriptPath).replace(/\\\\/g, "/");
    files.push(relativePath.length > 0 ? relativePath : path.basename(scriptPath));
    if (options.verbose) {
      console.log(chalk.dim(`🧰 Master test runner written to ${scriptPath}`));
    }
    return files;
  }

  const makefilePath = path.join(outputDir, masterConfig?.output ?? "Makefile");
  await ensureDirectory(path.dirname(makefilePath), options);

  const aggregatorTargets = ["test", "lint", "build", "test-e2e"];
  const shouldIncludeE2E = Boolean(testsWorkspace);
  const taskTargets = tasks.map((task) => task.name);
  let makefile = `.PHONY: ${[...aggregatorTargets, ...taskTargets].join(" ")}\n\n`;
  makefile += `test:\n\t${pm.run("test")}\n\n`;
  makefile += `lint:\n\t${pm.run("lint")}\n\n`;
  makefile += `build:\n\t${pm.run("build")}\n\n`;
  if (testsWorkspace) {
    makefile += `test-e2e:\n\t${pm.run("test:e2e")}\n\n`;
  } else {
    makefile += 'test-e2e:\n\t@echo "No end-to-end tests configured yet."\n\n';
  }
  if (tasks.length > 0) {
    for (const task of tasks) {
      const cwd = task.cwd || ".";
      const command = cwd === "." ? task.command : `(cd ${cwd} && ${task.command})`;
      makefile += `${task.name}:\n\t${command}\n\n`;
    }
  }

  await writeFileWithHooks(makefilePath, makefile, options);
  if (options.verbose) {
    console.log(chalk.dim(`🧰 Master test runner written to ${makefilePath}`));
  }
  const relativeMake = path.relative(outputDir, makefilePath).replace(/\\\\/g, "/");
  files.push(relativeMake.length > 0 ? relativeMake : path.basename(makefilePath));

  return files;
}

async function generateWorkspaceManifest(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTargets: ClientGenerationTarget[],
  testsWorkspace?: string,
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const workspaceSet = new Set<string>();
  const unitWorkspaceSet = new Set<string>();
  const pm =
    packageManager ?? getPackageManagerCommands(detectPackageManager(undefined, outputDir));

  const addUnitWorkspace = (workspace: string) => {
    workspaceSet.add(workspace);
    unitWorkspaceSet.add(workspace);
  };

  for (const target of clientTargets) {
    addUnitWorkspace(target.relativeRoot);
  }
  if (appSpec.services) {
    for (const [serviceName, serviceSpec] of Object.entries(appSpec.services)) {
      if (!isWorkspaceFriendlyLanguage(serviceSpec?.language as string | undefined)) continue;
      const slug = slugify(serviceName, serviceName);
      addUnitWorkspace(joinRelativePath(structure.servicesDirectory, slug));
    }
  }
  if (testsWorkspace) {
    workspaceSet.add(testsWorkspace);
  }

  if (workspaceSet.size === 0) {
    return [];
  }

  const workspaces = Array.from(workspaceSet).sort();
  const unitWorkspaces = Array.from(unitWorkspaceSet).sort();
  const runAcrossAllWorkspaces = (script: string): string => {
    switch (pm.name) {
      case "npm":
        return `${pm.run(script)} --workspaces --if-present`;
      case "pnpm":
        return `pnpm run -r --if-present ${script}`;
      case "yarn":
        return `yarn workspaces run ${script}`;
      default:
        return workspaces.map((workspace) => `(cd ${workspace} && ${pm.run(script)})`).join(" && ");
    }
  };

  const runInWorkspaces = (targets: string[], script: string, fallback: string): string => {
    if (targets.length === 0) {
      return fallback;
    }
    return targets.map((workspace) => `(cd ${workspace} && ${pm.run(script)})`).join(" && ");
  };

  const unitTestCommand = runInWorkspaces(
    unitWorkspaces,
    "test",
    'echo "No unit test workspaces defined yet."',
  );

  const scripts: Record<string, string> = {
    lint: runAcrossAllWorkspaces("lint"),
    build: runAcrossAllWorkspaces("build"),
    test: unitTestCommand,
    format: runAcrossAllWorkspaces("format"),
  };

  if (testsWorkspace) {
    scripts["test:e2e"] = `(cd ${testsWorkspace} && ${pm.run("test")})`;
  }

  const workspaceName = `${slugify(appSpec.product?.name, "app")}-workspace`;
  const manifest = {
    name: workspaceName,
    private: true,
    version: "0.0.0",
    workspaces,
    scripts,
  };

  const manifestPath = path.join(outputDir, "package.json");
  await writeFileWithHooks(manifestPath, JSON.stringify(manifest, null, 2), options);

  return ["package.json"];
}

function isWorkspaceFriendlyLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

function resolveTestingCommand(
  language: string,
  config: LanguageTestingConfig | undefined,
  defaults: Record<string, string>,
): string | undefined {
  if (config?.command && config.command.trim().length > 0) {
    return config.command.trim();
  }
  return defaults[language];
}

async function buildClientTestTasks(
  clientTargets: ClientGenerationTarget[],
  generatorConfig: GeneratorConfig | undefined,
  defaultTestCommands: Record<string, string>,
): Promise<TestTask[]> {
  const tasks: TestTask[] = [];
  for (const target of clientTargets) {
    const clientLanguage = (target.config?.language || "typescript").toLowerCase();
    if (clientLanguage !== "typescript" && clientLanguage !== "javascript") {
      continue;
    }

    const languageConfig = getPluginTestingConfig(generatorConfig, clientLanguage);
    const command = resolveTestingCommand(clientLanguage, languageConfig, defaultTestCommands);
    if (!command) continue;

    tasks.push({
      name: `test-client-${target.slug}`,
      command,
      cwd: target.relativeRoot,
    });
  }
  return tasks;
}

async function buildEndpointAssertionTask(
  appSpec: AppSpec,
  outputDir: string,
  structure: ProjectStructureConfig,
  generatorConfig: GeneratorConfig | undefined,
  packageManager: PackageManagerCommandSet,
): Promise<TestTask | null> {
  const tsServices = Object.entries(appSpec.services ?? {}).filter(
    ([, svc]) => (svc?.language as string | undefined)?.toLowerCase() === "typescript",
  );

  if (tsServices.length === 0) {
    return null;
  }

  const tsConfig = getPluginTestingConfig(generatorConfig, "typescript");
  const assertionsDir = tsConfig?.outputDir ?? "tests/assertions/ts";
  const assertionsPath = path.join(outputDir, assertionsDir);
  const exists = await fs.pathExists(assertionsPath);
  if (!exists) {
    return null;
  }

  const [serviceName, serviceConfig] = tsServices[0];
  const serviceSlug = slugify(serviceName, serviceName);
  const serviceDir = joinRelativePath(structure.servicesDirectory, serviceSlug);
  const relativeAssertions = path.relative(path.join(outputDir, serviceDir), assertionsPath) || ".";
  const command = tsConfig?.command
    ? tsConfig.command
    : packageManager.exec("vitest", `run ${relativeAssertions} --run`);

  return {
    name: "test-endpoint-assertions",
    command,
    cwd: serviceDir,
  };
}

function createNodeRunnerScript(tasks: TestTask[]): string {
  const taskList = JSON.stringify(tasks, null, 2);
  return [
    "#!/usr/bin/env node",
    "import { spawn } from 'node:child_process';",
    "import { resolve } from 'node:path';",
    "",
    "const rootDir = process.cwd();",
    `const tasks = ${taskList};`,
    "",
    "async function runTask(task) {",
    "  return new Promise((resolvePromise, rejectPromise) => {",
    "    const cwd = resolve(rootDir, task.cwd || '.');",
    "    console.log('\n▶ ' + task.name + ' (cwd: ' + (task.cwd || '.') + ')');",
    "    const child = spawn(task.command, {",
    "      cwd,",
    "      shell: true,",
    "      stdio: 'inherit',",
    "    });",
    "    child.on('close', code => {",
    "      if (code === 0) {",
    "        resolvePromise();",
    "      } else {",
    "        rejectPromise(new Error(task.name + ' exited with code ' + code));",
    "      }",
    "    });",
    "    child.on('error', rejectPromise);",
    "  });",
    "}",
    "",
    "async function main() {",
    "  if (tasks.length === 0) {",
    "    console.log('No automated tests are configured yet.');",
    "    return;",
    "  }",
    "  for (const task of tasks) {",
    "    await runTask(task);",
    "  }",
    "  console.log('\n✅ All tests completed successfully');",
    "}",
    "",
    "main().catch(error => {",
    "  console.error('\n❌ ' + error.message);",
    "  process.exit(1);",
    "});",
    "",
  ].join("\n");
}

/**
 * Generate default Playwright test content
 */
function generateDefaultFlowTest(flow: any, locators: Record<string, string>): string {
  const steps: any[] = Array.isArray(flow.steps) ? flow.steps : [];
  const preconditionsBlock = buildPreconditionsBlock(flow.preconditions);
  const bodyLines: string[] = [];
  let apiWaitCounter = 1;

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];

    if (isActionStep(step)) {
      const pendingApis: any[] = [];
      let lookahead = i + 1;
      while (lookahead < steps.length && isExpectApiStep(steps[lookahead])) {
        pendingApis.push(steps[lookahead]);
        lookahead += 1;
      }

      const waitDescriptors = pendingApis.map((apiStep) => ({
        name: `apiWait${apiWaitCounter++}`,
        expectation: apiStep.expect_api,
      }));

      waitDescriptors.forEach(({ name, expectation }) =>
        bodyLines.push(buildApiWaitDeclaration(name, expectation)),
      );
      bodyLines.push(buildActionLine(step, locators));
      waitDescriptors.forEach(({ name, expectation }) =>
        bodyLines.push(buildApiAwaitLine(name, expectation)),
      );
      i += pendingApis.length;
      continue;
    }

    if (isExpectApiStep(step)) {
      const waitVar = `apiWait${apiWaitCounter++}`;
      bodyLines.push(buildApiWaitDeclaration(waitVar, step.expect_api));
      bodyLines.push(buildApiAwaitLine(waitVar, step.expect_api));
      continue;
    }

    if (step.visit) {
      bodyLines.push(
        `    await page.goto('${escapeSingleQuotedLiteral(normalizeVisitPath(step.visit))}');`,
      );
      continue;
    }

    if (step.expect) {
      bodyLines.push(buildExpectationLine(step.expect, locators));
      continue;
    }

    bodyLines.push(`    // TODO: Unsupported step ${JSON.stringify(step)}`);
  }

  return `import { test, expect } from '@playwright/test';
import { loc } from '../support/locators';

test.describe('${flow.id}', () => {${preconditionsBlock}
  test('${flow.id} flow', async ({ page }) => {
${bodyLines.join("\n")}
  });
});
`;
}

function buildPreconditionsBlock(preconditions: any): string {
  if (!preconditions) {
    return "";
  }

  const lines: string[] = [
    "",
    "  test.beforeEach(async ({ page }) => {",
    "    // Setup preconditions",
  ];

  if (preconditions.role) {
    lines.push(`    // Role: ${preconditions.role}`);
  }
  if (preconditions.env) {
    lines.push(`    // Environment: ${preconditions.env}`);
  }
  if (Array.isArray(preconditions.seed)) {
    for (const seed of preconditions.seed) {
      lines.push(`    // Seed: ${seed.factory} as ${seed.as}`);
    }
  }

  lines.push("  });");
  return lines.join("\n");
}

function isActionStep(step: any): boolean {
  return Boolean(step?.click || step?.fill);
}

function isExpectApiStep(step: any): boolean {
  return Boolean(step?.expect_api);
}

function buildActionLine(step: any, locators: Record<string, string>): string {
  if (step.click) {
    const locatorExpr = resolveLocatorExpression(step.click, locators);
    return `    await page.locator(${locatorExpr}).click();`;
  }

  if (step.fill) {
    const locatorExpr = resolveLocatorExpression(step.fill.locator, locators);
    const value = escapeSingleQuotedLiteral(step.fill.value ?? "");
    return `    await page.locator(${locatorExpr}).fill('${value}');`;
  }

  return "    // TODO: Unsupported action step";
}

function buildExpectationLine(expectation: any, locators: Record<string, string>): string {
  const locatorExpr = resolveLocatorExpression(expectation.locator, locators);
  if (expectation.text) {
    return `    await expect(page.locator(${locatorExpr})).toHaveText('${escapeSingleQuotedLiteral(
      expectation.text,
    )}');`;
  }

  const matcher = mapExpectationMatcher(expectation.state);
  return `    await expect(page.locator(${locatorExpr})).${matcher};`;
}

function buildApiWaitDeclaration(variable: string, expectation: any): string {
  const method = (expectation?.method || "GET").toUpperCase();
  const pathName = expectation?.path || "/";
  return `    const ${variable} = page.waitForResponse((response) => {
      try {
        const url = new URL(response.url());
        return response.request().method() === '${method}' && url.pathname === '${pathName}';
      } catch {
        return false;
      }
    });`;
}

function buildApiAwaitLine(variable: string, expectation: any): string {
  const status = expectation?.status ?? 200;
  return `    {
      const response = await ${variable};
      expect(response.status()).toBe(${status});
    }`;
}

function mapExpectationMatcher(state: string | undefined): string {
  switch ((state || "visible").toLowerCase()) {
    case "hidden":
      return "toBeHidden()";
    case "attached":
      return "toBeAttached()";
    case "detached":
      return "toBeDetached()";
    case "enabled":
      return "toBeEnabled()";
    case "disabled":
      return "toBeDisabled()";
    default:
      return "toBeVisible()";
  }
}

function resolveLocatorExpression(target: string, locators: Record<string, string>): string {
  if (target && locators[target]) {
    return `loc('${escapeSingleQuotedLiteral(target)}')`;
  }
  const normalized = target ?? "";
  if (!normalized) {
    return "`" + "`";
  }
  return `\`${escapeTemplateLiteral(normalized)}\``;
}

function normalizeVisitPath(visit: any): string {
  if (typeof visit === "string") {
    return visit;
  }
  if (visit && typeof visit === "object" && typeof visit.path === "string") {
    return visit.path;
  }
  return "/";
}

function escapeSingleQuotedLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

/**
 * Generate API specifications from components and paths
 */
async function generateAPISpecifications(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];

  console.log(chalk.blue("📋 Generating API specifications..."));

  // Determine language for API generation
  const language = appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  const apiDir = path.join(outputDir, structure.docsDirectory, "api");
  if (!fs.existsSync(apiDir) && !options.dryRun) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Generate API services using language plugin if available
  if (plugin?.capabilities?.api && appSpec.components) {
    console.log(chalk.blue(`🚀 Generating ${language} API services using ${plugin.name}...`));

    // Generate services for each component that has API methods
    for (const [componentName, component] of Object.entries(appSpec.components || {})) {
      if (component.methods && component.methods.length > 0) {
        const serviceConfig: LanguageServiceConfig = {
          name: componentName,
          type: "api",
          methods: component.methods,
          validation: true,
        };

        try {
          const result = await generateService(language, serviceConfig);

          // Write all generated files
          for (const file of result.files) {
            const fullPath = path.join(apiDir, file.path.replace(/^src\//i, ""));
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir) && !options.dryRun) {
              fs.mkdirSync(dir, { recursive: true });
            }

            await writeFileWithHooks(fullPath, file.content, options);

            files.push(
              joinRelativePath(structure.docsDirectory, "api", file.path.replace(/^src\//i, "")),
            );
          }
        } catch (error) {
          console.error(
            chalk.red(`❌ Failed to generate ${language} service for ${componentName}:`),
            error.message,
          );
        }
      }
    }
  }

  // Generate OpenAPI spec if paths are defined (universal, not language-specific)
  if (appSpec.paths) {
    const openApiSpec = {
      openapi: "3.0.3",
      info: {
        title: appSpec.product.name,
        version: "1.0.0",
        description: appSpec.product.goals?.join("; ") || "Generated API specification",
      },
      paths: {} as Record<string, any>,
      components: { schemas: {} as Record<string, any> },
    };

    // Add component schemas if available
    if (appSpec.components?.schemas) {
      openApiSpec.components.schemas = Object.fromEntries(
        Object.entries(appSpec.components.schemas).map(([name, schema]) => [
          name,
          {
            type: "object",
            example: schema.example,
            ...(schema.examples && { examples: schema.examples }),
          },
        ]),
      );
    }

    const resolveMediaContent = (content?: Record<string, any>) => {
      if (!content || typeof content !== "object") {
        return undefined;
      }
      const entries = Object.entries(content).map(([contentType, media]) => {
        if (!contentType) {
          return null;
        }
        const mediaObject: Record<string, unknown> = {};
        if (media && typeof media === "object") {
          const schemaCandidate = (media as Record<string, unknown>).schema;
          const schemaRefCandidate = (media as Record<string, unknown>).schemaRef;
          if (schemaCandidate && typeof schemaCandidate === "object") {
            mediaObject.schema = schemaCandidate;
          } else if (
            typeof schemaRefCandidate === "string" &&
            schemaRefCandidate.trim().length > 0
          ) {
            mediaObject.schema = { $ref: schemaRefCandidate.trim() };
          }
          if ((media as Record<string, unknown>).example !== undefined) {
            mediaObject.example = (media as Record<string, unknown>).example;
          }
        }

        return [contentType, Object.keys(mediaObject).length > 0 ? mediaObject : {}] as [
          string,
          Record<string, unknown>,
        ];
      });

      const sanitized = entries.filter(Boolean) as Array<[string, Record<string, unknown>]>;
      if (!sanitized.length) {
        return undefined;
      }
      return Object.fromEntries(sanitized);
    };

    const convertParameters = (parameters?: any[]): any[] | undefined => {
      if (!Array.isArray(parameters) || parameters.length === 0) {
        return undefined;
      }

      const converted = parameters
        .filter((parameter) => parameter && typeof parameter === "object")
        .map((parameter) => {
          const coerced = parameter as Record<string, unknown>;
          const schemaCandidate = coerced.schema;
          const schemaRefCandidate = coerced.schemaRef;
          let schema: unknown;
          if (schemaCandidate && typeof schemaCandidate === "object") {
            schema = schemaCandidate;
          } else if (
            typeof schemaRefCandidate === "string" &&
            schemaRefCandidate.trim().length > 0
          ) {
            schema = { $ref: schemaRefCandidate.trim() };
          }
          return {
            name: coerced.name,
            in: coerced["in"],
            description: coerced.description,
            required:
              typeof coerced.required === "boolean" ? coerced.required : coerced["in"] === "path",
            deprecated: coerced.deprecated,
            example: coerced.example,
            ...(schema ? { schema } : {}),
          };
        })
        .filter((param) => typeof param.name === "string" && param.name.trim().length > 0);

      return converted.length > 0 ? converted : undefined;
    };

    const convertRequestBody = (requestBody: unknown): any => {
      if (!requestBody || typeof requestBody !== "object") {
        return undefined;
      }
      const coerced = requestBody as Record<string, unknown>;
      const content = resolveMediaContent(coerced.content as Record<string, any>);
      if (!content) {
        return undefined;
      }
      return {
        description: coerced.description,
        required: typeof coerced.required === "boolean" ? coerced.required : undefined,
        content,
      };
    };

    const convertResponses = (responses: unknown): Record<string, any> | undefined => {
      if (!responses || typeof responses !== "object") {
        return undefined;
      }

      const convertedEntries = Object.entries(responses)
        .filter(([status]) => status)
        .map(([status, value]) => {
          if (!value || typeof value !== "object") {
            return null;
          }
          const responseRecord = value as Record<string, unknown>;
          const content = resolveMediaContent(responseRecord.content as Record<string, any>);
          const headers = responseRecord.headers;
          return [
            status,
            {
              description:
                typeof responseRecord.description === "string"
                  ? responseRecord.description
                  : "Response",
              ...(headers && typeof headers === "object" ? { headers } : {}),
              ...(content ? { content } : {}),
            },
          ] as [string, Record<string, unknown>];
        })
        .filter(Boolean) as Array<[string, Record<string, unknown>]>;

      if (!convertedEntries.length) {
        return undefined;
      }
      return Object.fromEntries(convertedEntries);
    };

    const flattenedPaths: Record<string, PathSpec> = {};
    for (const pathMap of Object.values(appSpec.paths)) {
      if (!pathMap || typeof pathMap !== "object") {
        continue;
      }
      for (const [pathKey, pathSpec] of Object.entries(pathMap as Record<string, PathSpec>)) {
        flattenedPaths[pathKey] = pathSpec;
      }
    }

    // Convert paths to OpenAPI format
    for (const [pathKey, pathSpec] of Object.entries(flattenedPaths)) {
      openApiSpec.paths[pathKey] = {};

      for (const [method, operation] of Object.entries(pathSpec)) {
        if (!operation) {
          continue;
        }

        const isLegacyOperation =
          typeof (operation as any).response !== "undefined" ||
          typeof (operation as any).request !== "undefined";

        if (isLegacyOperation) {
          const legacyOperation = operation as Record<string, any>;
          const responseStatus = legacyOperation.status || (method === "get" ? 200 : 201);
          openApiSpec.paths[pathKey][method] = {
            summary: `${method.toUpperCase()} ${pathKey}`,
            ...(legacyOperation.request && {
              requestBody: {
                content: {
                  "application/json": {
                    schema: legacyOperation.request.$ref
                      ? { $ref: legacyOperation.request.$ref }
                      : {},
                    example: legacyOperation.request.example,
                  },
                },
              },
            }),
            responses: {
              [responseStatus]: {
                description: "Success",
                content: {
                  "application/json": {
                    schema: legacyOperation.response?.$ref
                      ? { $ref: legacyOperation.response.$ref }
                      : {},
                    example: legacyOperation.response?.example,
                  },
                },
              },
            },
            ...(legacyOperation.assertions ? { "x-assertions": legacyOperation.assertions } : {}),
          };
          continue;
        }

        const modernOperation = operation as Record<string, unknown>;
        const parameters = convertParameters(modernOperation.parameters as any[]);
        const requestBody = convertRequestBody(modernOperation.requestBody);
        const responses = convertResponses(modernOperation.responses);

        openApiSpec.paths[pathKey][method] = {
          summary:
            typeof modernOperation.summary === "string"
              ? modernOperation.summary
              : `${method.toUpperCase()} ${pathKey}`,
          description:
            typeof modernOperation.description === "string"
              ? modernOperation.description
              : undefined,
          operationId:
            typeof modernOperation.operationId === "string"
              ? modernOperation.operationId
              : undefined,
          tags: Array.isArray(modernOperation.tags) ? modernOperation.tags : undefined,
          deprecated:
            typeof modernOperation.deprecated === "boolean"
              ? modernOperation.deprecated
              : undefined,
          ...(parameters ? { parameters } : {}),
          ...(requestBody ? { requestBody } : {}),
          responses: responses ?? {
            default: {
              description: "Response",
            },
          },
          ...(modernOperation.assertions ? { "x-assertions": modernOperation.assertions } : {}),
        };
      }
    }

    const specPath = path.join(apiDir, "openapi.json");
    await writeFileWithHooks(specPath, JSON.stringify(openApiSpec, null, 2), options);
    files.push(joinRelativePath(structure.docsDirectory, "api", "openapi.json"));
  }

  return files;
}

async function generateModuleArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];

  if (!appSpec.components && !appSpec.domain && !appSpec.stateModels) {
    return files;
  }

  const packagesRoot = path.join(outputDir, structure.packagesDirectory);
  await ensureDirectory(packagesRoot, options);

  if (appSpec.components) {
    for (const [componentName, componentSpec] of Object.entries(appSpec.components)) {
      const fileName = `${componentName}.json`;
      const filePath = path.join(packagesRoot, fileName);
      await writeFileWithHooks(filePath, JSON.stringify(componentSpec, null, 2), options);
      files.push(joinRelativePath(structure.packagesDirectory, fileName));
    }
  }

  if (appSpec.domain) {
    const domainPath = path.join(packagesRoot, "domain.json");
    await writeFileWithHooks(domainPath, JSON.stringify(appSpec.domain, null, 2), options);
    files.push(joinRelativePath(structure.packagesDirectory, "domain.json"));
  }

  if (appSpec.stateModels) {
    const stateModelsPath = path.join(packagesRoot, "state-models.json");
    await writeFileWithHooks(
      stateModelsPath,
      JSON.stringify(appSpec.stateModels, null, 2),
      options,
    );
    files.push(joinRelativePath(structure.packagesDirectory, "state-models.json"));
  }

  return files;
}

async function generateDocumentationArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];
  const docsRoot = path.join(outputDir, structure.docsDirectory);
  await ensureDirectory(docsRoot, options);

  const overviewSections: string[] = [];
  overviewSections.push(`# ${appSpec.product.name}

${appSpec.product.description || "Auto-generated documentation overview."}
`);

  if (appSpec.product.goals?.length) {
    overviewSections.push("## Product Goals\n");
    overviewSections.push(appSpec.product.goals.map((goal) => `- ${goal}`).join("\n"));
    overviewSections.push("");
  }

  if (appSpec.ui.routes.length > 0) {
    overviewSections.push("## Routes\n");
    overviewSections.push(
      appSpec.ui.routes
        .map((route) => {
          const routePath = route.path ?? route.id ?? "";
          const displayName = route.name ?? route.id ?? routePath;
          return `- \`${routePath}\`: ${displayName}`;
        })
        .join("\n"),
    );
    overviewSections.push("");
  }

  if (appSpec.services && Object.keys(appSpec.services).length > 0) {
    overviewSections.push("## Services\n");
    overviewSections.push(
      Object.entries(appSpec.services)
        .map(
          ([name, svc]) =>
            `- **${name}**: ${svc?.description || svc?.technology || "Service definition"}`,
        )
        .join("\n"),
    );
    overviewSections.push("");
  }

  const overviewPath = path.join(docsRoot, "overview.md");
  await writeFileWithHooks(overviewPath, overviewSections.join("\n"), options);
  files.push(joinRelativePath(structure.docsDirectory, "overview.md"));

  if (appSpec.flows.length > 0) {
    const flowsPath = path.join(docsRoot, "flows.md");
    const flowsContent = ["# User Flows", ""]
      .concat(
        appSpec.flows.map((flow) => {
          const steps = flow.steps
            ?.map((step: any, idx: number) => `  ${idx + 1}. ${JSON.stringify(step)}`)
            .join("\n");
          return `## ${flow.id}\n\n${flow.description || "Generated flow"}\n\n${steps ? "**Steps:**\n" + steps + "\n" : ""}`;
        }),
      )
      .join("\n");

    await writeFileWithHooks(flowsPath, flowsContent, options);
    files.push(joinRelativePath(structure.docsDirectory, "flows.md"));
  }

  return files;
}

async function generateToolingArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];
  const toolsRoot = path.join(outputDir, structure.toolsDirectory);
  await ensureDirectory(toolsRoot, options);

  const automationNotes = appSpec.ops?.automation?.notes || [];
  const toolingContent = [
    `# Tooling for ${appSpec.product.name}`,
    "",
    appSpec.ops?.automation?.tools?.length
      ? "## Automated Tools\n" +
        appSpec.ops.automation.tools.map((tool: string) => `- ${tool}`).join("\n")
      : "## Automated Tools\n- No tooling defined in specification.\n",
    automationNotes.length
      ? ["## Notes\n", ...automationNotes.map((note: string) => `- ${note}`), ""].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const toolingPath = path.join(toolsRoot, "README.md");
  await writeFileWithHooks(toolingPath, toolingContent, options);
  files.push(joinRelativePath(structure.toolsDirectory, "README.md"));

  return files;
}

async function generateInfrastructureArtifacts(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  appSpec: AppSpec,
  clientTarget?: ClientGenerationTarget,
  _cliConfig?: CLIConfig,
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const cueData = (configWithVersion as any)._fullCueData;

  if (!cueData?.deployments && !cueData?.services) {
    return files;
  }

  const projectName = slugify(appSpec.product?.name, "app");
  const baseConfig = {
    name: projectName,
    language: appSpec.config?.language || "typescript",
  };

  const terraformFiles = await generateTerraformKubernetes(
    baseConfig,
    outputDir,
    configWithVersion,
    options,
    structure,
  );
  files.push(...terraformFiles);

  const composeFiles = await generateDockerComposeArtifacts(
    baseConfig,
    outputDir,
    configWithVersion,
    options,
    structure,
    clientTarget?.context,
    undefined,
    packageManager,
  );
  files.push(...composeFiles);

  return files;
}

/**
 * Generate locator definitions for UI testing
 */
async function generateLocatorDefinitions(
  appSpec: AppSpec,
  clientTarget: ClientGenerationTarget,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];

  console.log(chalk.blue("🎯 Generating locator definitions..."));

  const locatorsContent = `// UI Locators - Generated by Arbiter
// These locators provide a stable contract between tests and UI implementation

export const locators = {
${Object.entries(appSpec.locators)
  .map(([token, selector]) => `  '${token}': '${selector}',`)
  .join("\n")}
} as const;

export type LocatorToken = keyof typeof locators;

// Helper function to get locator by token
export function getLocator(token: LocatorToken): string {
  return locators[token];
}

// Type-safe locator access
export function loc(token: LocatorToken): string {
  return locators[token];
}
`;

  const locatorsDir = path.join(clientTarget.context.root, "src", "routes");
  const locatorsPath = path.join(locatorsDir, "locators.ts");

  await ensureDirectory(locatorsDir, options);

  await writeFileWithHooks(locatorsPath, locatorsContent, options);
  files.push(joinRelativePath(clientTarget.relativeRoot, "src", "routes", "locators.ts"));

  return files;
}

/**
 * Generate project structure
 */
async function generateProjectStructure(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTarget: ClientGenerationTarget,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const context = clientTarget.context;
  const relativeRoot = clientTarget.relativeRoot;

  // Determine language from app spec config
  const language = appSpec.config?.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (plugin) {
    console.log(chalk.blue(`📦 Initializing ${language} project using ${plugin.name}...`));

    configureTemplateOrchestrator(language, cliConfig);

    // Create project configuration for the language plugin
    const projectConfig: LanguageProjectConfig = {
      name: appSpec.product.name.toLowerCase().replace(/\s+/g, "-"),
      description: appSpec.product.goals?.join("; ") || "Generated by Arbiter",
      features: [],
      testing: true,
    };

    try {
      const result = await initializeProject(language, projectConfig);

      // Write all generated files from the language plugin
      for (const file of result.files) {
        const fullPath = path.join(context.root, file.path);
        const dir = path.dirname(fullPath);

        await ensureDirectory(dir, options);

        await writeFileWithHooks(
          fullPath,
          file.content,
          options,
          file.executable ? 0o755 : undefined,
        );

        files.push(joinRelativePath(relativeRoot, file.path));
      }

      // Log additional setup instructions from the language plugin
      if (result.instructions) {
        result.instructions.forEach((instruction) => console.log(chalk.green(`✅ ${instruction}`)));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize ${language} project:`), error.message);
      return files;
    }
  } else {
    console.log(
      chalk.yellow(`⚠️  No language plugin available for '${language}', using minimal structure`),
    );

    // Fallback: create minimal project structure
    const packageJson = {
      name: appSpec.product.name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      description: appSpec.product.goals?.join("; ") || "Generated by Arbiter",
      arbiter: {
        projectStructure: {
          services: structure.servicesDirectory,
          packages: structure.packagesDirectory,
          tools: structure.toolsDirectory,
          docs: structure.docsDirectory,
          tests: structure.testsDirectory,
          infra: structure.infraDirectory,
        },
      },
    };

    const packagePath = path.join(context.root, "package.json");
    await ensureDirectory(path.dirname(packagePath), options);
    await writeFileWithHooks(packagePath, JSON.stringify(packageJson, null, 2), options);
    files.push(joinRelativePath(relativeRoot, "package.json"));
  }

  // Generate README
  const workflowCommands = [
    packageManager.install,
    `${packageManager.exec("playwright", "install --with-deps")}   # one-time Playwright browser install`,
    packageManager.run("lint"),
    packageManager.run("build"),
    packageManager.run("test"),
    packageManager.run("test:e2e"),
  ].join("\n");

  const makeTestEquivalent = packageManager.run("test");
  const makeE2eEquivalent = packageManager.run("test:e2e");

  const readmeContent = `# ${appSpec.product.name}

Generated by Arbiter from app specification.

## Overview

${appSpec.product.goals ? appSpec.product.goals.map((goal) => `- ${goal}`).join("\n") : "No goals specified"}

${
  appSpec.product.constraints
    ? `
## Constraints

${appSpec.product.constraints.map((constraint) => `- ${constraint}`).join("\n")}
`
    : ""
}

## Routes

${appSpec.ui.routes.map((route) => `- **${route.path}** (${route.id}): ${route.capabilities.join(", ")}`).join("\n")}

## Flows

${appSpec.flows.map((flow) => `- **${flow.id}**: ${flow.steps.length} steps`).join("\n")}

## Development Workflow

\`\`\`bash
${workflowCommands}
\`\`\`

### Make Targets
\`\`\`bash
make test       # equivalent to ${makeTestEquivalent}
make test-e2e   # equivalent to ${makeE2eEquivalent}
\`\`\`
`;

  const readmePath = path.join(context.root, "README.md");
  await writeFileWithHooks(readmePath, readmeContent, options);
  files.push(joinRelativePath(relativeRoot, "README.md"));

  const dockerArtifacts = await generateClientDockerArtifacts(
    clientTarget,
    appSpec,
    options,
    cliConfig,
    packageManager,
  );

  files.push(...dockerArtifacts.map((artifact) => joinRelativePath(relativeRoot, artifact)));

  await enhanceClientDevServer(appSpec, clientTarget, options);

  return files;
}

/**
 * Generate service structures from app specification
 */
async function generateServiceStructures(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const files: string[] = [];
  const pathOwnership = determinePathOwnership(appSpec);

  if (!appSpec.services || Object.keys(appSpec.services).length === 0) {
    return files;
  }

  console.log(chalk.blue("🔧 Generating service structures..."));

  for (const [serviceName, serviceConfig] of Object.entries(appSpec.services)) {
    if (!serviceConfig || typeof serviceConfig !== "object") continue;

    const serviceTarget = createServiceTarget(serviceName, serviceConfig, structure, outputDir);
    const { context: serviceContext } = serviceTarget;
    await ensureDirectory(serviceContext.root, options);

    const language = serviceTarget.language;
    const relativePrefix = [structure.servicesDirectory, serviceTarget.slug];

    console.log(
      chalk.dim(`  • ${serviceName} (${language}) -> ${joinRelativePath(...relativePrefix)}`),
    );

    const generationPayload = {
      name: serviceTarget.slug,
      originalName: serviceTarget.key,
      version: "1.0.0",
      service: serviceConfig,
      routesDir: serviceContext.routesDir,
    };

    let generated: string[] = [];
    let supportsCodeScaffold = true;

    switch (language) {
      case "typescript":
        generated = await generateTypeScriptFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceTarget,
          appSpec,
          pathOwnership,
        );
        break;
      case "python":
        generated = await generatePythonFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceTarget,
        );
        break;
      case "go":
        generated = await generateGoFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceTarget,
        );
        break;
      case "rust":
        generated = await generateRustFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceTarget,
        );
        break;
      case "container":
      case "prebuilt":
      case "image":
        console.log(
          chalk.dim("    ℹ️  Using prebuilt/container workload; generating infrastructure only."),
        );
        supportsCodeScaffold = false;
        break;
      default:
        console.log(
          chalk.yellow(
            `    ⚠️  Service language '${language}' not supported for automated scaffolding.`,
          ),
        );
        supportsCodeScaffold = false;
        break;
    }

    if (generated.length > 0) {
      files.push(
        ...generated.map((file) => joinRelativePath(...relativePrefix, file.replace(/^\.\//, ""))),
      );
    }

    if (supportsCodeScaffold) {
      const dockerArtifacts = await generateServiceDockerArtifacts(
        serviceTarget,
        serviceConfig,
        options,
        cliConfig,
        structure,
        packageManager,
      );

      files.push(
        ...dockerArtifacts.map((artifact) => joinRelativePath(...relativePrefix, artifact)),
      );
    }

    const infraArtifacts = await generateServiceInfrastructureArtifacts(
      serviceTarget,
      serviceConfig,
      options,
    );
    files.push(
      ...infraArtifacts.map((artifact) =>
        joinRelativePath(...relativePrefix, artifact.replace(/^\.\//, "")),
      ),
    );
  }

  return files;
}

interface DockerTemplateSelection {
  dockerfile?: string;
  dockerignore?: string;
}

async function generateServiceDockerArtifacts(
  serviceTarget: ServiceGenerationTarget,
  serviceSpec: any,
  options: GenerateOptions,
  cliConfig: CLIConfig,
  _structure: ProjectStructureConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const language = serviceTarget.language;
  const context = serviceTarget.context;
  const override = resolveDockerTemplateSelection(cliConfig, "service", language);

  const defaults = buildDefaultServiceDockerArtifacts(
    language,
    serviceTarget,
    serviceSpec,
    packageManager,
  );

  if (!override && !defaults) {
    return [];
  }

  const dockerfileContent = override?.dockerfile
    ? await loadDockerTemplateContent(override.dockerfile, cliConfig)
    : defaults?.dockerfile;

  const dockerignoreContent = override?.dockerignore
    ? await loadDockerTemplateContent(override.dockerignore, cliConfig)
    : defaults?.dockerignore;

  const written: string[] = [];

  if (dockerfileContent) {
    const dockerfilePath = path.join(context.root, "Dockerfile");
    await writeFileWithHooks(dockerfilePath, ensureTrailingNewline(dockerfileContent), options);
    written.push("Dockerfile");
  }

  if (dockerignoreContent) {
    const dockerignorePath = path.join(context.root, ".dockerignore");
    await writeFileWithHooks(dockerignorePath, ensureTrailingNewline(dockerignoreContent), options);
    written.push(".dockerignore");
  }

  return written;
}

async function generateClientDockerArtifacts(
  clientTarget: ClientGenerationTarget,
  appSpec: AppSpec,
  options: GenerateOptions,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
): Promise<string[]> {
  const language = appSpec.config?.language?.toLowerCase() || "typescript";
  const override = resolveDockerTemplateSelection(cliConfig, "client", language);
  const defaults = buildDefaultClientDockerArtifacts(
    language,
    clientTarget,
    appSpec,
    packageManager,
  );

  if (!override && !defaults) {
    return [];
  }

  const dockerfileContent = override?.dockerfile
    ? await loadDockerTemplateContent(override.dockerfile, cliConfig)
    : defaults?.dockerfile;

  const dockerignoreContent = override?.dockerignore
    ? await loadDockerTemplateContent(override.dockerignore, cliConfig)
    : defaults?.dockerignore;

  const written: string[] = [];

  if (dockerfileContent) {
    const dockerfilePath = path.join(clientTarget.context.root, "Dockerfile");
    await writeFileWithHooks(dockerfilePath, ensureTrailingNewline(dockerfileContent), options);
    written.push("Dockerfile");
  }

  if (dockerignoreContent) {
    const dockerignorePath = path.join(clientTarget.context.root, ".dockerignore");
    await writeFileWithHooks(dockerignorePath, ensureTrailingNewline(dockerignoreContent), options);
    written.push(".dockerignore");
  }

  return written;
}

function resolveDockerTemplateSelection(
  cliConfig: CLIConfig,
  kind: "service" | "client",
  identifier: string,
): DockerTemplateSelection | null {
  const dockerConfig = cliConfig.generator?.docker;
  if (!dockerConfig) {
    return null;
  }

  const normalizedId = identifier.toLowerCase();
  const defaults =
    kind === "service" ? dockerConfig.defaults?.service : dockerConfig.defaults?.client;
  const catalog = kind === "service" ? dockerConfig.services : dockerConfig.clients;

  let selected: DockerTemplateSelection | undefined = defaults ? { ...defaults } : undefined;

  if (catalog) {
    let entry: DockerTemplateSelection | undefined = catalog[normalizedId] ?? catalog[identifier];

    if (!entry) {
      for (const [key, value] of Object.entries(catalog)) {
        if (key.toLowerCase() === normalizedId) {
          entry = value;
          break;
        }
      }
    }

    if (entry) {
      selected = { ...(selected ?? {}), ...entry };
    }
  }

  if (!selected) {
    return null;
  }

  return selected;
}

async function generateServiceInfrastructureArtifacts(
  serviceTarget: ServiceGenerationTarget,
  serviceSpec: any,
  options: GenerateOptions,
): Promise<string[]> {
  const outputs: string[] = [];
  const context = serviceTarget.context;
  const serviceSlug = serviceTarget.slug;
  const displayName = serviceTarget.key;
  const envBlock = collectServiceEnvironmentVariables(serviceSpec);
  const artifactType =
    serviceSpec?.type ??
    serviceSpec?.artifactType ??
    (serviceSpec ? resolveServiceArtifactType(serviceSpec) : undefined);

  const readmeLines = [
    `# ${displayName}`,
    "",
    "This directory contains application code and infrastructure references generated by Arbiter.",
    "",
    "## Runtime Image",
    "",
    `- **Image:** ${serviceSpec?.image ?? `ghcr.io/your-org/${serviceSlug}:latest`}`,
    artifactType ? `- **Artifact Type:** ${artifactType}` : "",
    "",
    "## Ports",
    "",
  ];

  const ports = Array.isArray(serviceSpec?.ports) ? serviceSpec.ports : [];
  if (ports.length > 0) {
    for (const port of ports) {
      readmeLines.push(
        `- ${port.name || "port"}: ${port.port}${port.targetPort ? ` → ${port.targetPort}` : ""}`,
      );
    }
  } else {
    readmeLines.push("- None declared (update the spec to expose health or admin ports).");
  }

  readmeLines.push("", "## Environment", "");
  if (Object.keys(envBlock).length > 0) {
    for (const [key, value] of Object.entries(envBlock)) {
      readmeLines.push(`- ${key}=${value}`);
    }
  } else {
    readmeLines.push("- No environment variables declared.");
  }

  if (Array.isArray(serviceSpec?.dependencies) && serviceSpec.dependencies.length > 0) {
    readmeLines.push("", "## Dependencies", "");
    for (const dep of serviceSpec.dependencies) {
      readmeLines.push(`- ${dep}`);
    }
  }

  const readmePath = path.join(context.root, "README.md");
  await writeFileWithHooks(readmePath, ensureTrailingNewline(readmeLines.join("\n")), options);
  outputs.push("README.md");

  const manifestDir = path.join(context.root, "manifests");
  await ensureDirectory(manifestDir, options);
  const primaryPort = getPrimaryServicePort(serviceSpec, 8080);
  const manifestImage = serviceSpec?.image ?? `ghcr.io/your-org/${serviceSlug}:latest`;
  const healthConfig = resolveHealthConfiguration(serviceSpec, primaryPort);
  const probeBlock = buildKubernetesProbeBlock(healthConfig);
  const envYaml =
    Object.keys(envBlock).length > 0
      ? Object.entries(envBlock)
          .map(
            ([key, value]) =>
              `        - name: ${key}\n          value: "${String(value).replace(/"/g, '\\"')}"`,
          )
          .join("\n")
      : '        # - name: SAMPLE_VAR\n        #   value: "example"';

  const volumeMounts =
    Array.isArray(serviceSpec?.volumes) && serviceSpec.volumes.length > 0
      ? serviceSpec.volumes
          .map(
            (volume: any) =>
              `        - name: ${volume.name || "data"}\n          mountPath: ${volume.path || "/data"}`,
          )
          .join("\n")
      : "";

  const volumes =
    Array.isArray(serviceSpec?.volumes) && serviceSpec.volumes.length > 0
      ? serviceSpec.volumes
          .map(
            (volume: any) =>
              `      - name: ${volume.name || "data"}\n        persistentVolumeClaim:\n          claimName: ${volume.name || "data"}-pvc`,
          )
          .join("\n")
      : "";

  const deploymentYaml = [
    "apiVersion: apps/v1",
    "kind: Deployment",
    `metadata:\n  name: ${serviceSlug}`,
    "spec:",
    "  replicas: 1",
    "  selector:",
    "    matchLabels:",
    `      app: ${serviceSlug}`,
    "  template:",
    "    metadata:",
    "      labels:",
    `        app: ${serviceSlug}`,
    "    spec:",
    "      containers:",
    "        - name: app",
    `          image: ${manifestImage}`,
    "          ports:",
    `            - containerPort: ${primaryPort}`,
    "          env:",
    envYaml,
    probeBlock,
    volumeMounts ? "          volumeMounts:\n" + volumeMounts : "",
    volumes ? "      volumes:\n" + volumes : "",
  ]
    .filter(Boolean)
    .join("\n");

  const manifestPath = path.join(manifestDir, "deployment.yaml");
  await writeFileWithHooks(manifestPath, ensureTrailingNewline(deploymentYaml), options);
  outputs.push(path.join("manifests", "deployment.yaml"));

  if (Object.keys(envBlock).length > 0) {
    const envExample = Object.entries(envBlock)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const envPath = path.join(context.root, ".env.example");
    await writeFileWithHooks(envPath, ensureTrailingNewline(envExample), options);
    outputs.push(".env.example");
  }

  return outputs;
}

function collectServiceEnvironmentVariables(serviceSpec: any): Record<string, string> {
  const env: Record<string, string> = {};
  mergeEnvironmentBlock(env, serviceSpec?.env);
  mergeEnvironmentBlock(env, serviceSpec?.config?.environment);
  return env;
}

function mergeEnvironmentBlock(
  target: Record<string, string>,
  source?: Record<string, unknown>,
): void {
  if (!source) return;
  for (const [key, rawValue] of Object.entries(source)) {
    const normalized = normalizeEnvironmentValue(rawValue);
    if (typeof normalized === "string" && key) {
      target[key] = normalized;
    }
  }
}

function normalizeEnvironmentValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record && Object.prototype.hasOwnProperty.call(record, "value")) {
      const resolved = record.value;
      if (resolved !== undefined && resolved !== null) {
        return String(resolved);
      }
    }

    if (record && Object.prototype.hasOwnProperty.call(record, "default")) {
      const resolved = record.default;
      if (resolved !== undefined && resolved !== null) {
        return String(resolved);
      }
    }

    if (typeof record?.secret === "string" && record.secret.length > 0) {
      return `\${${record.secret}}`;
    }

    if (typeof record?.name === "string" && typeof record?.from === "string") {
      return `\${${record.name}}`;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return undefined;
}

interface HealthConfiguration {
  path: string;
  port: number;
  interval: string;
  timeout: string;
  initialDelaySeconds: number;
}

function resolveHealthConfiguration(
  serviceSpec: any,
  defaultPort: number,
): HealthConfiguration | null {
  const config = serviceSpec?.healthCheck;
  const rawPath =
    (typeof config?.path === "string" && config.path.trim().length > 0
      ? config.path
      : "/healthz") || "/healthz";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const port =
    typeof config?.port === "number" && Number.isFinite(config.port) ? config.port : defaultPort;
  const interval =
    (typeof config?.interval === "string" && config.interval.trim().length > 0
      ? config.interval
      : null) || "30s";
  const timeout =
    (typeof config?.timeout === "string" && config.timeout.trim().length > 0
      ? config.timeout
      : null) || "10s";

  return {
    path: normalizedPath,
    port,
    interval,
    timeout,
    initialDelaySeconds:
      typeof config?.initialDelaySeconds === "number" ? config.initialDelaySeconds : 5,
  };
}

function durationToSeconds(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d+)(ms|s|m)$/i);
    if (match) {
      const amount = Number.parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      switch (unit) {
        case "ms":
          return Math.max(1, Math.round(amount / 1000));
        case "s":
          return amount;
        case "m":
          return amount * 60;
      }
    }
  }

  return fallback;
}

function buildKubernetesProbeBlock(config: HealthConfiguration | null): string {
  if (!config) {
    return "";
  }

  const periodSeconds = durationToSeconds(config.interval, 30);
  const timeoutSeconds = durationToSeconds(config.timeout, 10);
  const readinessDelay = Math.max(2, Math.floor(config.initialDelaySeconds / 2));

  return [
    "          livenessProbe:",
    "            httpGet:",
    `              path: ${config.path}`,
    `              port: ${config.port}`,
    `            initialDelaySeconds: ${config.initialDelaySeconds}`,
    `            periodSeconds: ${periodSeconds}`,
    `            timeoutSeconds: ${timeoutSeconds}`,
    "          readinessProbe:",
    "            httpGet:",
    `              path: ${config.path}`,
    `              port: ${config.port}`,
    `            initialDelaySeconds: ${readinessDelay}`,
    `            periodSeconds: ${Math.max(5, periodSeconds)}`,
    `            timeoutSeconds: ${timeoutSeconds}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function getTerraformWorkloadType(type: string): string {
  switch (type) {
    case "statefulset":
      return "stateful_set";
    default:
      return type;
  }
}

async function loadDockerTemplateContent(
  templatePath: string,
  cliConfig: CLIConfig,
): Promise<string> {
  const baseDir = cliConfig.configDir || cliConfig.projectDir || process.cwd();
  const resolved = path.isAbsolute(templatePath)
    ? templatePath
    : path.resolve(baseDir, templatePath);

  try {
    return await fs.readFile(resolved, "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read Docker template at ${resolved}: ${message}`);
  }
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function buildDefaultServiceDockerArtifacts(
  language: string,
  target: ServiceGenerationTarget,
  serviceSpec: any,
  packageManager: PackageManagerCommandSet,
): DockerTemplateSelection | null {
  switch (language) {
    case "typescript":
    case "javascript":
      return buildTypeScriptServiceDockerArtifacts(serviceSpec, packageManager);
    case "python":
      return buildPythonServiceDockerArtifacts(serviceSpec);
    case "go":
      return buildGoServiceDockerArtifacts(serviceSpec);
    case "rust":
      return buildRustServiceDockerArtifacts(serviceSpec, target);
    default:
      console.log(
        chalk.dim(
          `    Skipping Dockerfile generation for unsupported service language '${language}'.`,
        ),
      );
      return null;
  }
}

function buildDefaultClientDockerArtifacts(
  language: string,
  _target: ClientGenerationTarget,
  _appSpec: AppSpec,
  packageManager: PackageManagerCommandSet,
): DockerTemplateSelection | null {
  switch (language) {
    case "typescript":
    case "javascript":
      return buildTypeScriptClientDockerArtifacts(packageManager);
    default:
      console.log(
        chalk.dim(
          `    Skipping client Dockerfile generation for unsupported language '${language}'.`,
        ),
      );
      return null;
  }
}

function getPrimaryServicePort(serviceSpec: any, fallback: number): number {
  const ports = Array.isArray(serviceSpec?.ports) ? serviceSpec.ports : [];
  if (ports.length === 0) {
    return fallback;
  }

  const portEntry = ports[0];
  const candidate = Number(portEntry?.targetPort ?? portEntry?.port);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

function buildTypeScriptServiceDockerArtifacts(
  serviceSpec: any,
  packageManager: PackageManagerCommandSet,
): DockerTemplateSelection {
  const port = getPrimaryServicePort(serviceSpec, 3000);
  const setupLines: string[] = [];
  switch (packageManager.name) {
    case "pnpm":
      setupLines.push("RUN corepack enable pnpm");
      break;
    case "yarn":
      setupLines.push("RUN corepack enable yarn");
      break;
    case "bun":
      setupLines.push("RUN curl -fsSL https://bun.sh/install | bash");
      setupLines.push("ENV BUN_INSTALL=/root/.bun");
      setupLines.push("ENV PATH=$BUN_INSTALL/bin:$PATH");
      break;
    default:
      break;
  }

  const installCommand = (() => {
    switch (packageManager.name) {
      case "pnpm":
        return "pnpm install --frozen-lockfile";
      case "yarn":
        return "yarn install --frozen-lockfile";
      case "bun":
        return "bun install";
      default:
        return "npm install";
    }
  })();

  const pruneCommand = (() => {
    switch (packageManager.name) {
      case "npm":
        return "npm prune --production";
      case "pnpm":
        return "pnpm prune --prod";
      default:
        return undefined;
    }
  })();

  const dockerfile = [
    "# syntax=docker/dockerfile:1",
    "FROM node:20-bullseye AS base",
    "WORKDIR /usr/src/app",
    ...setupLines,
    "COPY package*.json ./",
    `RUN ${installCommand}`,
    "",
    "COPY . .",
    `RUN ${packageManager.run("build")}`,
    pruneCommand ? `RUN ${pruneCommand}` : "",
    "",
    "ENV NODE_ENV=production",
    `ENV PORT=${port}`,
    `EXPOSE ${port}`,
    "",
    'CMD ["node", "dist/index.js"]',
  ]
    .filter((line) => line !== "")
    .join("\n");

  const dockerignore = `node_modules
dist
coverage
.turbo
.cache
.git
tests
*.log
.env*
Dockerfile
.dockerignore
`;

  return { dockerfile, dockerignore };
}

function buildPythonServiceDockerArtifacts(serviceSpec: any): DockerTemplateSelection {
  const port = getPrimaryServicePort(serviceSpec, 8000);

  const dockerfile = `# syntax=docker/dockerfile:1
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements*.txt ./
RUN if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi

COPY . .

ENV PORT=${port}
EXPOSE ${port}

CMD ["/bin/sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port \${PORT:-${port}}"]
`;

  const dockerignore = `__pycache__
*.pyc
*.pyo
.venv
.mypy_cache
.pytest_cache
tests
.git
.env*
Dockerfile
.dockerignore
`;

  return { dockerfile, dockerignore };
}

function buildGoServiceDockerArtifacts(serviceSpec: any): DockerTemplateSelection {
  const port = getPrimaryServicePort(serviceSpec, 8080);

  const dockerfile = `# syntax=docker/dockerfile:1
FROM golang:1.21-alpine AS build
WORKDIR /src

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/service ./...

FROM alpine:3.19
WORKDIR /app
RUN adduser -D -g '' appuser
USER appuser

COPY --from=build /bin/service ./service

ENV PORT=${port}
EXPOSE ${port}

CMD ["./service"]
`;

  const dockerignore = `bin
pkg
.git
tests
coverage
Dockerfile
.dockerignore
`;

  return { dockerfile, dockerignore };
}

function buildRustServiceDockerArtifacts(
  serviceSpec: any,
  target: ServiceGenerationTarget,
): DockerTemplateSelection {
  const port = getPrimaryServicePort(serviceSpec, 3000);
  const binaryName = target.slug;
  const context = target.context;

  const dockerfile = `# syntax=docker/dockerfile:1
FROM rust:1.74 AS build
WORKDIR /usr/src/app

COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs
RUN cargo fetch

COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /usr/src/app/target/release/${binaryName} /usr/local/bin/${binaryName}

ENV PORT=${port}
EXPOSE ${port}

CMD ["${binaryName}"]
`;

  const dockerignore = `target
**/*.rs.bk
.git
tests
Dockerfile
.dockerignore
`;

  return { dockerfile, dockerignore };
}

function buildTypeScriptClientDockerArtifacts(
  packageManager: PackageManagerCommandSet,
): DockerTemplateSelection {
  const port = 4173;
  const setupLines: string[] = [];
  switch (packageManager.name) {
    case "pnpm":
      setupLines.push("RUN corepack enable pnpm");
      break;
    case "yarn":
      setupLines.push("RUN corepack enable yarn");
      break;
    case "bun":
      setupLines.push("RUN curl -fsSL https://bun.sh/install | bash");
      setupLines.push("ENV BUN_INSTALL=/root/.bun");
      setupLines.push("ENV PATH=$BUN_INSTALL/bin:$PATH");
      break;
    default:
      break;
  }

  const installCommand = (() => {
    switch (packageManager.name) {
      case "pnpm":
        return "pnpm install --frozen-lockfile";
      case "yarn":
        return "yarn install --frozen-lockfile";
      case "bun":
        return "bun install";
      default:
        return "npm install";
    }
  })();

  const previewArgs = (() => {
    switch (packageManager.name) {
      case "pnpm":
        return ["pnpm", "run", "preview", "--", "--host", "0.0.0.0", "--port", String(port)];
      case "yarn":
        return ["yarn", "preview", "--host", "0.0.0.0", "--port", String(port)];
      case "bun":
        return ["bun", "run", "preview", "--", "--host", "0.0.0.0", "--port", String(port)];
      default:
        return ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", String(port)];
    }
  })();

  const dockerfile = [
    "# syntax=docker/dockerfile:1",
    "FROM node:20-bullseye",
    "WORKDIR /usr/src/app",
    ...setupLines,
    "COPY package*.json ./",
    `RUN ${installCommand}`,
    "",
    "COPY . .",
    `RUN ${packageManager.run("build")}`,
    "",
    "ENV NODE_ENV=production",
    `ENV PORT=${port}`,
    `EXPOSE ${port}`,
    "",
    `CMD [${previewArgs.map((token) => `"${token}"`).join(", ")}]`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const dockerignore = `node_modules
dist
.turbo
.cache
coverage
tests
.git
.env*
Dockerfile
.dockerignore
`;

  return { dockerfile, dockerignore };
}

/**
 * Generate language-specific files
 */
async function generateLanguageFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  assemblyConfig?: any,
  cliConfig?: CLIConfig,
): Promise<string[]> {
  const files: string[] = [];

  // Use language plugin system for code generation
  const language = config.language || "typescript";
  const plugin = getConfiguredLanguagePlugin(language);

  if (plugin) {
    console.log(chalk.blue(`📦 Generating ${language} project using ${plugin.name}...`));

    if (cliConfig) {
      configureTemplateOrchestrator(language, cliConfig);
    }

    // Initialize project using the language plugin
    const projectConfig: LanguageProjectConfig = {
      name: config.name,
      description: config.description,
      features: config.features || [],
      testing: config.testing !== false,
    };

    try {
      const result = await initializeProject(language, projectConfig);

      // Write all generated files
      for (const file of result.files) {
        const fullPath = path.join(outputDir, file.path);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir) && !options.dryRun) {
          fs.mkdirSync(dir, { recursive: true });
        }

        await writeFileWithHooks(
          fullPath,
          file.content,
          options,
          file.executable ? 0o755 : undefined,
        );

        files.push(file.path);
      }

      // Log additional setup instructions
      if (result.instructions) {
        result.instructions.forEach((instruction) => console.log(chalk.green(`✅ ${instruction}`)));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate ${language} project:`), error.message);
      // Fallback to legacy generation for unsupported languages
      if (language === "shell" || language === "bash") {
        files.push(...(await generateShellFiles(config, outputDir, options, structure)));
      }
    }
  } else {
    console.log(chalk.yellow(`⚠️  No plugin available for language: ${language}`));
    // Fallback for unsupported languages
    if (language === "shell" || language === "bash") {
      files.push(...(await generateShellFiles(config, outputDir, options, structure)));
    }
  }

  return files;
}

/**
 * Generate TypeScript project files
 */
async function generateTypeScriptFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
  appSpec?: AppSpec,
  pathOwnership?: Map<string, string>,
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};
  const defaultPort = getPrimaryServicePort(serviceSpec, 3000);

  const packageJson = {
    name: config.name,
    version: config.version,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      start: "node dist/index.js",
      build: "tsc -p tsconfig.json",
      test: "vitest run --passWithNoTests",
      lint: 'eslint "src/**/*.ts"',
    },
    dependencies: {
      fastify: "^4.25.0",
      "@fastify/cors": "^9.0.0",
    },
    devDependencies: {
      "@types/node": "^20.0.0",
      typescript: "^5.0.0",
      tsx: "^4.15.6",
      eslint: "^8.57.1",
      "@typescript-eslint/parser": "^7.18.0",
      "@typescript-eslint/eslint-plugin": "^7.18.0",
      vitest: "^1.2.0",
    },
  };

  const packagePath = path.join(outputDir, "package.json");
  await writeFileWithHooks(packagePath, JSON.stringify(packageJson, null, 2), options);
  files.push("package.json");

  const tsconfigJson = {
    compilerOptions: {
      outDir: "dist",
      rootDir: "src",
      module: "NodeNext",
      target: "ES2022",
      moduleResolution: "NodeNext",
      resolveJsonModule: true,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
    },
    include: ["src"],
    exclude: ["dist", "node_modules"],
  };

  const tsconfigPath = path.join(outputDir, "tsconfig.json");
  await writeFileWithHooks(tsconfigPath, JSON.stringify(tsconfigJson, null, 2), options);
  files.push("tsconfig.json");

  const eslintConfig = `module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
      env: {
        node: true,
      },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
  ],
};
`;
  await writeFileWithHooks(path.join(outputDir, ".eslintrc.cjs"), eslintConfig, options);
  files.push(".eslintrc.cjs");

  const srcDir = path.join(outputDir, "src");
  await ensureDirectory(srcDir, options);

  const indexContent = `import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes/index.js';

async function bootstrap() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

  const defaultPort = ${defaultPort};
  const port = Number(process.env.PORT || defaultPort);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info('Service "${config.name}" listening on %d', port);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { bootstrap };
`;

  const indexPath = path.join(srcDir, "index.ts");
  await writeFileWithHooks(indexPath, indexContent, options);
  files.push("src/index.ts");

  const routesDir = serviceTarget?.context.routesDir || path.join(srcDir, "routes");
  await ensureDirectory(routesDir, options);

  const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
  const parsedRoutes = endpoints.map((endpoint: any, index: number) => {
    if (typeof endpoint === "string") {
      const [methodPart, ...urlParts] = endpoint.trim().split(/\s+/);
      return {
        method: (methodPart || "GET").toUpperCase(),
        url: urlParts.join(" ") || `/${config.name}`,
        summary: undefined,
        reply: `not_implemented_${index}`,
        statusCode: 200,
      };
    }

    return {
      method: (endpoint.method || "GET").toUpperCase(),
      url: endpoint.path || endpoint.url || `/${config.name}`,
      summary: endpoint.summary,
      reply: endpoint.replyExample || `not_implemented_${index}`,
      statusCode: endpoint.statusCode || 200,
    };
  });
  const derivedRoutes = deriveServiceEndpointsFromPaths(
    appSpec,
    config.originalName ?? config.name,
    config.name,
    serviceSpec,
    pathOwnership,
  );
  const flowDerivedRoutes = deriveServiceEndpointsFromFlows(
    appSpec,
    config.originalName ?? config.name,
    config.name,
    serviceSpec,
  );
  const combinedRoutes = mergeRouteBindings(
    mergeRouteBindings(parsedRoutes, derivedRoutes),
    flowDerivedRoutes,
  );

  const routesIndexPath = path.join(routesDir, "index.ts");
  const routesIndexContent = `import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RouteBinding {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
  statusCode?: number;
}

const routeDefinitions: RouteBinding[] = ${JSON.stringify(combinedRoutes, null, 2)};
const SERVICE_NAME = "${config.name}";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.status(200).send({
      status: 'ok',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    });
  });

  for (const definition of routeDefinitions) {
    app.route({
      method: definition.method as any,
      url: definition.url,
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.status(definition.statusCode ?? 200).send({
          route: definition.url,
          status: 'stubbed',
          summary: definition.summary,
          example: definition.reply,
        });
      },
    });
  }

  if (routeDefinitions.length === 0) {
    app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
      reply.status(200).send({
        service: SERVICE_NAME,
        status: 'pending_implementation',
        message: 'Update src/routes/index.ts to expose application endpoints.',
      });
    });
  }
}

export const routes = routeDefinitions;
`;

  await writeFileWithHooks(routesIndexPath, routesIndexContent, options);
  files.push("src/routes/index.ts");

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(resolvedTestsDir) && !options.dryRun) {
    fs.mkdirSync(resolvedTestsDir, { recursive: true });
  }
  if (serviceTarget?.context) {
    const relative = toRelativePath(serviceTarget.context.root, resolvedTestsDir);
    if (relative) {
      files.push(relative.endsWith("/") ? relative : `${relative}/`);
    }
  } else {
    const testsDirRelative = joinRelativePath(...effectiveTestSegments);
    if (testsDirRelative) {
      files.push(`${testsDirRelative}/`);
    }
  }

  return files;
}

/**
 * Generate Python project files
 */
async function generatePythonFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};

  const pyprojectToml = `[build-system]\nrequires = [\"setuptools>=45\", \"wheel\"]\nbuild-backend = \"setuptools.build_meta\"\n\n[project]\nname = \"${config.name}\"\nversion = \"${config.version}\"\ndescription = \"Generated by Arbiter\"\nrequires-python = \">=3.10\"\ndependencies = [\n    \"fastapi>=0.110.0\",\n    \"uvicorn[standard]>=0.27.0\",\n    \"pydantic>=2.5.0\"\n]\n`;

  const pyprojectPath = path.join(outputDir, "pyproject.toml");
  await writeFileWithHooks(pyprojectPath, pyprojectToml, options);
  files.push("pyproject.toml");

  const requirementsPath = path.join(outputDir, "requirements.txt");
  const requirementsContent = `fastapi>=0.110.0\nuvicorn[standard]>=0.27.0\n`;
  await writeFileWithHooks(requirementsPath, requirementsContent, options);
  files.push("requirements.txt");

  const appDir = path.join(outputDir, "app");
  await ensureDirectory(appDir, options);
  const routesDir = path.join(appDir, "routes");
  await ensureDirectory(routesDir, options);

  const port = typeof serviceSpec.port === "number" ? serviceSpec.port : 8000;
  const mainContent = `from fastapi import FastAPI\nfrom .routes import register_routes\n\napp = FastAPI(title=\"${config.name}\")\n\n@app.on_event(\"startup\")\nasync def startup_event() -> None:\n    await register_routes(app)\n\n\n@app.get(\"/health\")\nasync def healthcheck() -> dict[str, str]:\n    return {\"status\": \"ok\"}\n\n\ndef build_app() -> FastAPI:\n    return app\n\n\nif __name__ == \"__main__\":\n    import uvicorn\n\n    uvicorn.run(app, host=\"0.0.0.0\", port=${port})\n`;

  await writeFileWithHooks(path.join(appDir, "main.py"), mainContent, options);
  files.push("app/main.py");

  const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
  const parsedRoutes = endpoints.map((endpoint: any, index: number) => {
    if (typeof endpoint === "string") {
      const [methodPart, ...urlParts] = endpoint.trim().split(/\\s+/);
      const method = (methodPart ?? "GET").toLowerCase();
      const url = urlParts.join(" ") || `/${config.name}`;
      return {
        method,
        url,
        name: `${method}_${index}`,
        summary: undefined as string | undefined,
      };
    }

    const method = (endpoint?.method ?? "GET").toLowerCase();
    const url = endpoint?.path ?? endpoint?.url ?? `/${config.name}`;
    return {
      method,
      url,
      name: endpoint?.operationId ?? `handler_${index}`,
      summary: endpoint?.summary as string | undefined,
    };
  });

  const defaultRoute = {
    method: "get",
    url: "/",
    name: `${config.name}_root`,
    summary: `Default endpoint for ${config.name}`,
  };

  const routeBlocks = (parsedRoutes.length > 0 ? parsedRoutes : [defaultRoute])
    .map((route) => {
      const summary = (route.summary ?? "Generated endpoint stub")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ");
      return [
        `@router.${route.method}(\"${route.url}\")`,
        `async def ${route.name}() -> dict[str, str]:`,
        `    \"\"\"${summary}\"\"\"`,
        `    return {\"route\": \"${route.url}\", \"status\": \"not_implemented\"}`,
        "",
      ].join("\n");
    })
    .join("\n");

  const routesInit = [
    "from fastapi import APIRouter, FastAPI",
    "",
    "router = APIRouter()",
    "",
    routeBlocks,
    "async def register_routes(app: FastAPI) -> None:",
    "    app.include_router(router)",
    "",
  ]
    .filter(Boolean)
    .join("\n");

  await writeFileWithHooks(path.join(routesDir, "__init__.py"), routesInit, options);
  files.push("app/routes/__init__.py");

  await writeFileWithHooks(path.join(appDir, "__init__.py"), "", options);
  files.push("app/__init__.py");

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(resolvedTestsDir) && !options.dryRun) {
    fs.mkdirSync(resolvedTestsDir, { recursive: true });
  }
  if (serviceTarget?.context) {
    const relative = toRelativePath(serviceTarget.context.root, resolvedTestsDir);
    if (relative) {
      files.push(relative.endsWith("/") ? relative : `${relative}/`);
    }
  } else {
    const testsDirRelative = joinRelativePath(...effectiveTestSegments);
    if (testsDirRelative) {
      files.push(`${testsDirRelative}/`);
    }
  }

  return files;
}

/**
 * Generate Rust project files
 */
async function generateRustFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(resolvedTestsDir) && !options.dryRun) {
    fs.mkdirSync(resolvedTestsDir, { recursive: true });
  }
  if (serviceTarget?.context) {
    const relative = toRelativePath(serviceTarget.context.root, resolvedTestsDir);
    if (relative) {
      files.push(relative.endsWith("/") ? relative : `${relative}/`);
    }
  } else {
    const testsDirRelative = joinRelativePath(...effectiveTestSegments);
    if (testsDirRelative) {
      files.push(`${testsDirRelative}/`);
    }
  }

  const cargoToml = `[package]
name = "${config.name}"
version = "${config.version}"
edition = "2021"

[dependencies]
axum = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tower = "0.5"

[dev-dependencies]
hyper = "1"
tokio = { version = "1", features = ["full"] }
`;

  const cargoPath = path.join(outputDir, "Cargo.toml");
  await writeFileWithHooks(cargoPath, cargoToml, options);
  files.push("Cargo.toml");

  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const mainContent = `use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::net::SocketAddr;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

fn build_router() -> Router {
    Router::new().route(
        "/health",
        get(|| async { Json(HealthResponse { status: "ok" }) }),
    )
}

#[tokio::main]
async fn main() {
    let router = build_router();
    let port = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse::<u16>().ok())
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    println!("{} listening on {}", env!("CARGO_PKG_NAME"), addr);

    axum::Server::bind(&addr)
        .serve(router.into_make_service())
        .await
        .expect("server failed");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    #[tokio::test]
    async fn health_endpoint_returns_ok() {
        let app = build_router();
        let response = app
            .oneshot(Request::builder().uri("/health").body(()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}
`;

  await writeFileWithHooks(path.join(srcDir, "main.rs"), mainContent, options);
  files.push("src/main.rs");

  return files;
}

async function generateGoFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceTarget?: ServiceGenerationTarget,
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory || "tests");
  const resolvedTestsDir =
    serviceTarget?.context?.testsDir || path.join(outputDir, ...testsDirSegments);
  if (!fs.existsSync(resolvedTestsDir) && !options.dryRun) {
    fs.mkdirSync(resolvedTestsDir, { recursive: true });
  }
  if (serviceTarget?.context) {
    const relative = toRelativePath(serviceTarget.context.root, resolvedTestsDir);
    if (relative) {
      files.push(relative.endsWith("/") ? relative : `${relative}/`);
    }
  } else if (testsDirSegments.length > 0) {
    const testsDirRelative = joinRelativePath(...testsDirSegments);
    files.push(`${testsDirRelative}/`);
  }

  // go.mod
  const goMod = `module ${config.name}

go 1.21

require ()
`;

  const goModPath = path.join(outputDir, "go.mod");
  await writeFileWithHooks(goModPath, goMod, options);
  files.push("go.mod");

  // main.go
  const mainGo = `// ${config.name} - Generated by Arbiter
// Version: ${config.version}
package main

import "fmt"

func main() {
    fmt.Println("Hello from ${config.name}!")
}
`;

  const mainGoPath = path.join(outputDir, "main.go");
  await writeFileWithHooks(mainGoPath, mainGo, options);
  files.push("main.go");

  // Create test directory placeholder
  const testDir = path.join(resolvedTestsDir, "api");
  if (!fs.existsSync(testDir) && !options.dryRun) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  return files;
}

/**
 * Generate Shell/Bash project files
 */
async function generateShellFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);

  // Makefile
  const makefile = `# ${config.name} - Generated by Arbiter
# Version: ${config.version}

.PHONY: test install clean

test:
\tbash test/run_tests.sh

install:
\tcp src/${config.name} /usr/local/bin/

clean:
\trm -f *.log *.tmp
`;

  const makefilePath = path.join(outputDir, "Makefile");
  await writeFileWithHooks(makefilePath, makefile, options);
  files.push("Makefile");

  // Create src directory
  const srcDir = path.join(outputDir, "src");
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const mainScript = `#!/bin/bash
# ${config.name} - Generated by Arbiter  
# Version: ${config.version}

set -euo pipefail

main() {
    echo "Hello from ${config.name}!"
}

# Run main if script is executed directly
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "$@"
fi
`;

  const scriptPath = path.join(srcDir, config.name);
  await writeFileWithHooks(scriptPath, mainScript, options, 0o755);
  files.push(`src/${config.name}`);

  // Create tests directory
  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}

const ARBITER_APP_JOB_ID = "arbiter_app";
const ARBITER_SERVICE_JOB_PREFIX = "arbiter_service_";

/**
 * Generate or update GitHub Actions workflows based on the current specification.
 *
 * The workflow writer is idempotent and only manages Arbiter-owned jobs,
 * allowing teams to add or customise additional jobs without losing changes.
 */
async function generateCIWorkflows(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const files: string[] = [];
  const appSpec = configWithVersion.app;

  if (!appSpec) {
    return files;
  }

  const workflowDir = path.join(outputDir, ".github", "workflows");
  await ensureDirectory(workflowDir, options);

  const workflowPath = path.join(workflowDir, "ci.yml");
  let workflowContent = "";
  let workflow: Record<string, any> = {};

  if (fs.existsSync(workflowPath)) {
    try {
      workflowContent = await fs.readFile(workflowPath, "utf-8");
      const parsed = YAML.parse(workflowContent);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        workflow = parsed as Record<string, any>;
      }
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️  Unable to parse existing workflow at ${workflowPath}: ${
            error instanceof Error ? error.message : String(error)
          }\n    A fresh workflow will be generated.`,
        ),
      );
      workflow = {};
    }
  }

  const applicationName = appSpec.product?.name ?? "Application";
  const managedServices = extractServiceSummaries(configWithVersion);
  const primaryLanguage = inferPrimaryLanguage(appSpec, managedServices);
  const buildTool = appSpec.config?.buildTool;

  // Preserve existing triggers but ensure CI defaults exist.
  workflow.name ||= `${applicationName} CI`;
  workflow.on = ensureDefaultWorkflowTriggers(workflow.on);

  const jobs: Record<string, any> =
    workflow.jobs && typeof workflow.jobs === "object" ? { ...workflow.jobs } : {};

  const managedJobIds = new Set<string>();

  const appJob = createLanguageJob({
    jobName: `${applicationName} (${formatLanguage(primaryLanguage)})`,
    language: primaryLanguage,
    buildTool,
  });

  if (appJob) {
    jobs[ARBITER_APP_JOB_ID] = appJob;
    managedJobIds.add(ARBITER_APP_JOB_ID);
  } else {
    delete jobs[ARBITER_APP_JOB_ID];
  }

  for (const service of managedServices) {
    if (service.artifactType !== "internal") {
      const jobId = `${ARBITER_SERVICE_JOB_PREFIX}${service.slug}`;
      delete jobs[jobId];
      continue;
    }

    const jobId = `${ARBITER_SERVICE_JOB_PREFIX}${service.slug}`;
    const serviceJob = createLanguageJob({
      jobName: `${service.displayName} (${formatLanguage(service.language)})`,
      language: service.language,
      buildTool: service.buildTool ?? buildTool,
      workingDirectory: service.workingDirectory,
    });

    if (serviceJob) {
      if (jobs[ARBITER_APP_JOB_ID]) {
        serviceJob.needs = Array.from(new Set([ARBITER_APP_JOB_ID, ...(serviceJob.needs || [])]));
      }
      jobs[jobId] = serviceJob;
      managedJobIds.add(jobId);
    } else {
      delete jobs[jobId];
    }
  }

  for (const existingJobId of Object.keys(jobs)) {
    if (isManagedWorkflowJob(existingJobId) && !managedJobIds.has(existingJobId)) {
      delete jobs[existingJobId];
    }
  }

  workflow.jobs = jobs;

  const headerComment = `# ${applicationName} CI workflow\n# Arbiter-managed jobs (prefixed with '${ARBITER_SERVICE_JOB_PREFIX}' and '${ARBITER_APP_JOB_ID}') are kept in sync with your specifications.\n`;

  const serializedWorkflow =
    headerComment + YAML.stringify(workflow, { indent: 2, lineWidth: 0 }).trimEnd() + "\n";

  const normalizedExisting = workflowContent
    ? workflowContent.replace(/\r\n/g, "\n").trimEnd() + "\n"
    : "";

  if (normalizedExisting === serializedWorkflow) {
    return files;
  }

  await writeFileWithHooks(workflowPath, serializedWorkflow, options);
  files.push(".github/workflows/ci.yml");

  return files;
}

interface ServiceSummary {
  name: string;
  displayName: string;
  slug: string;
  language: string;
  buildTool?: string;
  workingDirectory?: string;
  artifactType: ServiceArtifactType;
}

function extractServiceSummaries(configWithVersion: ConfigWithVersion): ServiceSummary[] {
  const cueData = (configWithVersion as any)._fullCueData || {};
  const servicesInput =
    cueData.services && typeof cueData.services === "object" ? cueData.services : {};
  const summaries: ServiceSummary[] = [];

  for (const [serviceName, rawConfig] of Object.entries(servicesInput)) {
    const parsed = parseDeploymentServiceConfig(serviceName, rawConfig);
    if (!parsed) {
      continue;
    }

    const language = parsed.language || configWithVersion.app.config?.language || "typescript";
    const buildTool =
      (rawConfig as any)?.buildTool ||
      (rawConfig as any)?.build?.tool ||
      configWithVersion.app.config?.buildTool;

    const workingDirectory =
      typeof parsed.sourceDirectory === "string"
        ? parsed.sourceDirectory
        : typeof (rawConfig as any)?.sourceDirectory === "string"
          ? (rawConfig as any).sourceDirectory
          : undefined;

    const artifactType = parsed.artifactType;

    summaries.push({
      name: serviceName,
      displayName: friendlyServiceName(serviceName),
      slug: slugify(serviceName, serviceName),
      language,
      buildTool,
      workingDirectory,
      artifactType,
    });
  }

  return summaries;
}

function ensureDefaultWorkflowTriggers(onConfig: any): Record<string, any> {
  const triggers: Record<string, any> =
    onConfig && typeof onConfig === "object" && !Array.isArray(onConfig) ? { ...onConfig } : {};

  if (!triggers.push) {
    triggers.push = { branches: ["main", "develop"] };
  }

  if (!triggers.pull_request) {
    triggers.pull_request = { branches: ["main"] };
  }

  return triggers;
}

interface LanguageJobParams {
  jobName: string;
  language: string;
  buildTool?: string;
  workingDirectory?: string;
}

interface WorkflowStep {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  "working-directory"?: string;
  shell?: string;
}

function createLanguageJob(params: LanguageJobParams): Record<string, any> | null {
  const { jobName, language, buildTool, workingDirectory } = params;

  if (!language || language === "container") {
    return null;
  }

  const steps: WorkflowStep[] = [];

  steps.push({
    name: "Checkout repository",
    uses: "actions/checkout@v4",
  });

  steps.push(...getSetupSteps(language, buildTool));

  pushRunStep(
    steps,
    "Install dependencies",
    getInstallCommand(language, buildTool),
    workingDirectory,
  );
  pushRunStep(steps, "Lint", getLintCommand(language, buildTool), workingDirectory);
  pushRunStep(steps, "Test", getTestCommand(language, buildTool), workingDirectory);
  pushRunStep(steps, "Build", getBuildCommand(language, buildTool), workingDirectory);

  if (steps.length <= 1) {
    return null;
  }

  return {
    name: jobName,
    "runs-on": "ubuntu-latest",
    steps,
  };
}

function getSetupSteps(language: string, buildTool?: string): WorkflowStep[] {
  switch (language) {
    case "typescript": {
      const steps: WorkflowStep[] = [
        {
          name: "Setup Node.js",
          uses: "actions/setup-node@v4",
          with: {
            "node-version": "20",
            cache: buildTool === "bun" ? undefined : "npm",
          },
        },
      ];

      if (buildTool === "bun") {
        steps.push({
          name: "Setup Bun",
          uses: "oven-sh/setup-bun@v1",
        });
      }

      return steps;
    }
    case "python":
      return [
        {
          name: "Setup Python",
          uses: "actions/setup-python@v5",
          with: {
            "python-version": "3.11",
          },
        },
      ];
    case "rust":
      return [
        {
          name: "Setup Rust toolchain",
          uses: "dtolnay/rust-toolchain@stable",
        },
      ];
    case "go":
      return [
        {
          name: "Setup Go",
          uses: "actions/setup-go@v5",
          with: {
            "go-version": "1.21",
          },
        },
      ];
    default:
      return [];
  }
}

function pushRunStep(
  steps: WorkflowStep[],
  name: string,
  command: string,
  workingDirectory?: string,
): void {
  if (!command || isNoopCommand(command)) {
    return;
  }

  const step: WorkflowStep = {
    name,
    run: command,
  };

  if (workingDirectory && workingDirectory !== "." && workingDirectory !== "./") {
    step["working-directory"] = workingDirectory;
  }

  steps.push(step);
}

function isNoopCommand(command: string): boolean {
  return /^echo\s+"[^"]*not defined"/i.test(command.trim());
}

function isManagedWorkflowJob(jobId: string): boolean {
  return jobId === ARBITER_APP_JOB_ID || jobId.startsWith(ARBITER_SERVICE_JOB_PREFIX);
}

function inferPrimaryLanguage(appSpec: AppSpec | undefined, services: ServiceSummary[]): string {
  if (appSpec?.config?.language) {
    return appSpec.config.language;
  }

  const bespokeService = services.find((service) => service.artifactType === "internal");
  if (bespokeService) {
    return bespokeService.language;
  }

  if (services.length > 0) {
    return services[0]?.language ?? "typescript";
  }

  return "typescript";
}

function friendlyServiceName(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLanguage(language: string): string {
  if (!language) {
    return "Unknown";
  }
  return language.charAt(0).toUpperCase() + language.slice(1);
}

/**
 * Generate documentation
 */
async function generateDocumentation(
  _config: any,
  _outputDir: string,
  _options: GenerateOptions,
): Promise<string[]> {
  // Documentation generation will be handled by the docs command
  return [];
}

function getPrerequisites(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun"
        ? "- [Bun](https://bun.sh) v1.0+"
        : "- [Node.js](https://nodejs.org) v18+\n- [npm](https://npmjs.com) or [yarn](https://yarnpkg.com)";
    case "python":
      return "- [Python](https://python.org) 3.8+\n- [pip](https://pip.pypa.io)";
    case "rust":
      return "- [Rust](https://rustup.rs) 1.70+";
    case "go":
      return "- [Go](https://golang.org) 1.21+";
    case "shell":
      return "- [Bash](https://www.gnu.org/software/bash/) 4.0+";
    default:
      return `- Development environment for ${language}`;
  }
}

function getInstallCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun install" : "npm install";
    case "python":
      return "pip install -e .";
    case "rust":
      return "cargo build";
    case "go":
      return "go mod tidy";
    case "shell":
      return "make install";
    default:
      return 'echo "Install command not defined"';
  }
}

function getRunCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun run src/index.ts" : "npm start";
    case "python":
      return "python -m " + "PLACEHOLDER";
    case "rust":
      return "cargo run";
    case "go":
      return "go run main.go";
    case "shell":
      return "./src/PLACEHOLDER";
    default:
      return 'echo "Run command not defined"';
  }
}

function getTestCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun test" : "npm test";
    case "python":
      return "pytest";
    case "rust":
      return "cargo test";
    case "go":
      return "go test ./...";
    case "shell":
      return "make test";
    default:
      return 'echo "Test command not defined"';
  }
}

function getBuildCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun build" : "npm run build";
    case "python":
      return "python -m build";
    case "rust":
      return "cargo build --release";
    case "go":
      return "go build";
    case "shell":
      return 'echo "No build step needed"';
    default:
      return 'echo "Build command not defined"';
  }
}

function getLintCommand(language: string, buildTool?: string): string {
  switch (language) {
    case "typescript":
      return buildTool === "bun" ? "bun run lint" : "npm run lint";
    case "python":
      return "ruff check . && mypy .";
    case "rust":
      return "cargo clippy -- -D warnings";
    case "go":
      return "golangci-lint run";
    case "shell":
      return "shellcheck src/*";
    default:
      return 'echo "Lint command not defined"';
  }
}

// Terraform + Kubernetes generation
async function generateTerraformKubernetes(
  config: any,
  outputDir: string,
  assemblyConfig: any,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];
  const infraDirSegments = toPathSegments(structure.infraDirectory);
  const effectiveInfraSegments = infraDirSegments.length > 0 ? infraDirSegments : ["terraform"];
  const infraDirRelative = joinRelativePath(...effectiveInfraSegments);
  await ensureDirectory(path.join(outputDir, ...effectiveInfraSegments), options);

  // Parse assembly to extract services and cluster references
  const { services, cluster } = parseDeploymentServices(assemblyConfig);

  // Generate main.tf with provider configuration
  const mainTf = generateTerraformMain(cluster, config.name);
  const mainPath = path.join(outputDir, ...effectiveInfraSegments, "main.tf");
  await writeFileWithHooks(mainPath, mainTf, options);
  files.push(joinRelativePath(infraDirRelative, "main.tf"));

  // Generate variables.tf
  const variablesTf = generateTerraformVariables(services, cluster);
  const variablesPath = path.join(outputDir, ...effectiveInfraSegments, "variables.tf");
  await writeFileWithHooks(variablesPath, variablesTf, options);
  files.push(joinRelativePath(infraDirRelative, "variables.tf"));

  // Generate services.tf with Kubernetes resources
  const servicesTf = generateTerraformServices(services, config.name);
  const servicesPath = path.join(outputDir, ...effectiveInfraSegments, "services.tf");
  await writeFileWithHooks(servicesPath, servicesTf, options);
  files.push(joinRelativePath(infraDirRelative, "services.tf"));

  // Generate outputs.tf
  const outputsTf = generateTerraformOutputs(services, config.name);
  const outputsPath = path.join(outputDir, ...effectiveInfraSegments, "outputs.tf");
  await writeFileWithHooks(outputsPath, outputsTf, options);
  files.push(joinRelativePath(infraDirRelative, "outputs.tf"));

  // Generate README for Terraform deployment
  const readme = generateTerraformReadme(services, cluster, config.name);
  const readmePath = path.join(outputDir, ...effectiveInfraSegments, "README.md");
  await writeFileWithHooks(readmePath, readme, options);
  files.push(joinRelativePath(infraDirRelative, "README.md"));

  return files;
}

function parseDeploymentServices(assemblyConfig: any): {
  services: DeploymentService[];
  cluster: ClusterConfig | null;
} {
  const services: DeploymentService[] = [];
  let cluster: ClusterConfig | null = null;

  // Use the full CUE data if available
  const cueData = assemblyConfig._fullCueData || assemblyConfig;

  // Extract cluster configuration from environment-scoped deployments
  const deployments = cueData?.deployments;
  if (deployments && typeof deployments === "object") {
    const entries = Object.entries(deployments as Record<string, DeploymentConfig>);
    const match =
      entries.find(([, cfg]) => cfg?.target === "kubernetes") ||
      entries.find(([, cfg]) => cfg?.target === "both") ||
      entries[0];

    const deploymentConfig = match?.[1];
    if (deploymentConfig?.cluster) {
      cluster = {
        name: deploymentConfig.cluster.name || "default",
        provider: deploymentConfig.cluster.provider || "kubernetes",
        context: deploymentConfig.cluster.context,
        namespace: deploymentConfig.cluster.namespace || "default",
        config: deploymentConfig.cluster.config || {},
      };
    }
  }

  // Extract services from properly parsed CUE configuration
  if (cueData?.services) {
    for (const [serviceName, serviceConfig] of Object.entries(cueData.services)) {
      const service = parseDeploymentServiceConfig(serviceName, serviceConfig as any);
      if (service) {
        services.push(service);
      }
    }
  }

  return { services, cluster };
}

interface DeploymentService {
  name: string;
  language: string;
  artifactType: ServiceArtifactType;
  type: ServiceWorkload;
  workload: ServiceWorkload;
  image?: string;
  sourceDirectory?: string;
  buildContext?: {
    dockerfile?: string;
    target?: string;
    buildArgs?: Record<string, string>;
  };
  ports?: Array<{ name: string; port: number; targetPort?: number; protocol?: string }>;
  env?: Record<string, string>;
  volumes?: Array<{
    name: string;
    path: string;
    size?: string;
    type?: "persistentVolumeClaim" | "configMap" | "secret";
  }>;
  config?: {
    files?: Array<{ name: string; content: string | Record<string, any> }>;
    [key: string]: any;
  };
  replicas?: number;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  healthCheck?: {
    path?: string;
    port?: number;
    initialDelay?: number;
    periodSeconds?: number;
  };
}

interface ClusterConfig {
  name: string;
  provider: "kubernetes" | "eks" | "gke" | "aks";
  context?: string;
  namespace: string;
  config: Record<string, any>;
}

function parseDeploymentServiceConfig(name: string, config: any): DeploymentService | null {
  const artifactType = resolveServiceArtifactType(config);
  const workload =
    (resolveServiceWorkload(config) as ServiceWorkload | undefined) ??
    (typeof config.workload === "string" ? (config.workload as ServiceWorkload) : undefined) ??
    "deployment";

  const service: DeploymentService = {
    name: name,
    language: config.language || "container",
    artifactType,
    type: workload,
    workload,
    replicas: config.replicas || 1,
  };

  // Service configuration
  if (config.image) service.image = config.image;
  if (config.sourceDirectory) service.sourceDirectory = config.sourceDirectory;
  if (config.buildContext) service.buildContext = config.buildContext;
  if (config.ports) service.ports = config.ports;
  if (config.env) service.env = config.env;
  if (config.volumes) {
    service.volumes = config.volumes.map((vol: any) => ({
      ...vol,
      type: vol.type || "persistentVolumeClaim",
    }));
  }
  if (config.resources) service.resources = config.resources;
  if (config.labels) service.labels = config.labels;
  if (config.annotations) service.annotations = config.annotations;
  if (config.config) service.config = config.config;
  if (config.healthCheck) service.healthCheck = config.healthCheck;

  return service;
}

// Terraform generation functions
function generateTerraformMain(cluster: ClusterConfig | null, projectName: string): string {
  const clusterName = cluster?.name || "default";
  const namespace = cluster?.namespace || projectName.toLowerCase();

  return `terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "kubernetes" {
  # Configuration will be loaded from kubeconfig by default
  # Override these values via terraform.tfvars if needed
  config_path    = var.kubeconfig_path
  config_context = var.cluster_context
}

# Create namespace if it doesn't exist
resource "kubernetes_namespace" "${namespace.replace(/-/g, "_")}" {
  metadata {
    name = "${namespace}"
    labels = {
      name    = "${namespace}"
      project = "${projectName.toLowerCase()}"
    }
  }
}
`;
}

function generateTerraformVariables(
  services: DeploymentService[],
  cluster: ClusterConfig | null,
): string {
  const clusterName = cluster?.name || "default";

  return `variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "cluster_context" {
  description = "Kubernetes cluster context to use"
  type        = string
  default     = "${cluster?.context || clusterName}"
}

variable "namespace" {
  description = "Kubernetes namespace for deployment"
  type        = string
  default     = "${cluster?.namespace || "default"}"
}

variable "image_tag" {
  description = "Docker image tag for services"
  type        = string
  default     = "latest"
}

${services
  .map((service) => {
    const serviceName = service.name.replace(/-/g, "_");
    return `variable "${serviceName}_replicas" {
  description = "Number of replicas for ${service.name}"
  type        = number
  default     = ${service.replicas || 1}
}`;
  })
  .join("\n\n")}
`;
}

function generateTerraformServices(services: DeploymentService[], projectName: string): string {
  return services.map((service) => generateTerraformService(service, projectName)).join("\n\n");
}

function generateTerraformService(service: DeploymentService, projectName: string): string {
  const serviceName = service.name.replace(/-/g, "_");
  const namespace = projectName.toLowerCase();
  const terraformWorkloadType = getTerraformWorkloadType(service.type);

  let terraform = `# ${service.name} ${service.type}
resource "kubernetes_${terraformWorkloadType}" "${serviceName}" {
  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, "_")}.metadata[0].name
    labels = {
      app     = "${service.name}"
      project = "${projectName.toLowerCase()}"${
        service.labels
          ? Object.entries(service.labels)
              .map(([k, v]) => `\n      ${k} = "${v}"`)
              .join("")
          : ""
      }
    }${
      service.annotations
        ? `
    annotations = {${Object.entries(service.annotations)
      .map(([k, v]) => `\n      "${k}" = "${v}"`)
      .join("")}
    }`
        : ""
    }
  }

  spec {${
    service.type === "statefulset"
      ? `
    service_name = kubernetes_service.${serviceName}.metadata[0].name`
      : ""
  }
    replicas = var.${serviceName}_replicas
    
    selector {
      match_labels = {
        app = "${service.name}"
      }
    }

    template {
      metadata {
        labels = {
          app     = "${service.name}"
          project = "${projectName.toLowerCase()}"
        }
      }

      spec {
        container {
          name  = "${service.name}"
          image = "${service.image || `${service.name}:\${var.image_tag}`}"
`;

  // Add ports
  if (service.ports && service.ports.length > 0) {
    service.ports.forEach((port) => {
      terraform += `
          port {
            name           = "${port.name}"
            container_port = ${port.targetPort || port.port}
            protocol       = "${port.protocol || "TCP"}"
          }`;
    });
  }

  // Add environment variables
  if (service.env && Object.keys(service.env).length > 0) {
    Object.entries(service.env).forEach(([key, value]) => {
      terraform += `
          env {
            name  = "${key}"
            value = "${value}"
          }`;
    });
  }

  // Add resources
  if (service.resources) {
    terraform += `
          resources {`;
    if (service.resources.requests) {
      terraform += `
            requests = {`;
      if (service.resources.requests.cpu)
        terraform += `
              cpu    = "${service.resources.requests.cpu}"`;
      if (service.resources.requests.memory)
        terraform += `
              memory = "${service.resources.requests.memory}"`;
      terraform += `
            }`;
    }
    if (service.resources.limits) {
      terraform += `
            limits = {`;
      if (service.resources.limits.cpu)
        terraform += `
              cpu    = "${service.resources.limits.cpu}"`;
      if (service.resources.limits.memory)
        terraform += `
              memory = "${service.resources.limits.memory}"`;
      terraform += `
            }`;
    }
    terraform += `
          }`;
  }

  // Add volume mounts
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach((volume) => {
      terraform += `
          volume_mount {
            name       = "${volume.name}"
            mount_path = "${volume.path}"
          }`;
    });
  }

  terraform += `
        }`;

  // Add volumes
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach((volume) => {
      terraform += `
        volume {
          name = "${volume.name}"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.${serviceName}_${volume.name.replace(/-/g, "_")}.metadata[0].name
          }
        }`;
    });
  }

  terraform += `
      }
    }
  }
}`;

  // Generate Service resource if has ports
  if (service.ports && service.ports.length > 0) {
    terraform += `

resource "kubernetes_service" "${serviceName}" {
  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, "_")}.metadata[0].name
    labels = {
      app     = "${service.name}"
      project = "${projectName.toLowerCase()}"
    }
  }

  spec {
    selector = {
      app = "${service.name}"
    }

${service.ports
  .map(
    (port) => `    port {
      name        = "${port.name}"
      port        = ${port.port}
      target_port = ${port.targetPort || port.port}
      protocol    = "${port.protocol || "TCP"}"
    }`,
  )
  .join("\n")}
  }
}`;
  }

  // Generate PVCs for volumes
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach((volume) => {
      terraform += `

resource "kubernetes_persistent_volume_claim" "${serviceName}_${volume.name.replace(/-/g, "_")}" {
  metadata {
    name      = "${service.name}-${volume.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, "_")}.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "${volume.size || "10Gi"}"
      }
    }
  }
}`;
    });
  }

  return terraform;
}

function generateTerraformOutputs(services: DeploymentService[], projectName: string): string {
  const outputs = services
    .filter((service) => service.ports && service.ports.length > 0)
    .map((service) => {
      const serviceName = service.name.replace(/-/g, "_");
      return `output "${serviceName}_service_ip" {
  description = "Cluster IP of the ${service.name} service"
  value       = kubernetes_service.${serviceName}.spec[0].cluster_ip
}

output "${serviceName}_ports" {
  description = "Ports exposed by ${service.name} service"
  value       = [${service.ports?.map((p) => `"${p.port}"`).join(", ")}]
}`;
    });

  return `output "namespace" {
  description = "Kubernetes namespace"
  value       = kubernetes_namespace.${projectName.toLowerCase().replace(/-/g, "_")}.metadata[0].name
}

${outputs.join("\n\n")}
`;
}

function generateTerraformReadme(
  services: DeploymentService[],
  cluster: ClusterConfig | null,
  projectName: string,
): string {
  const clusterName = cluster?.name || "default";
  const namespace = cluster?.namespace || projectName.toLowerCase();

  return `# ${projectName} - Terraform Kubernetes Deployment

This directory contains Terraform configurations for deploying ${projectName} to Kubernetes.

## Prerequisites

- [Terraform](https://terraform.io) >= 1.0
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) configured with cluster access
- Kubernetes cluster accessible via kubeconfig

## Configuration

### Cluster Configuration
- **Cluster**: ${clusterName}
- **Namespace**: ${namespace}
- **Context**: ${cluster?.context || clusterName}

## Services

${services
  .map(
    (service) => `### ${service.name}
- **Language**: ${service.language}
- **Type**: ${service.type}
- **Image**: ${service.image || `${service.name}:latest`}${
      service.ports
        ? `
- **Ports**: ${service.ports.map((p) => `${p.port}/${p.protocol || "TCP"} (${p.name})`).join(", ")}`
        : ""
    }
- **Replicas**: ${service.replicas || 1}${
      service.volumes
        ? `
- **Storage**: ${service.volumes.map((v) => `${v.name} → ${v.path} (${v.size || "10Gi"})`).join(", ")}`
        : ""
    }`,
  )
  .join("\n\n")}

## Deployment

### 1. Initialize Terraform
\`\`\`bash
terraform init
\`\`\`

### 2. Review the Plan
\`\`\`bash
terraform plan
\`\`\`

### 3. Apply Configuration
\`\`\`bash
terraform apply
\`\`\`

### 4. Verify Deployment
\`\`\`bash
kubectl get all -n ${namespace}
\`\`\`

## Customization

Create a \`terraform.tfvars\` file to customize deployment:

\`\`\`hcl
# Cluster configuration
kubeconfig_path = "~/.kube/config"
cluster_context = "${cluster?.context || clusterName}"
namespace       = "${namespace}"

# Image configuration  
image_tag = "v1.0.0"

# Service scaling
${services.map((service) => `${service.name.replace(/-/g, "_")}_replicas = ${service.replicas || 1}`).join("\n")}
\`\`\`

## Access Services

${services
  .filter((s) => s.ports && s.ports.length > 0)
  .map(
    (service) => `### ${service.name}
\`\`\`bash
kubectl port-forward -n ${namespace} service/${service.name} ${service.ports?.[0].port}:${service.ports?.[0].port}
\`\`\`
Access at: http://localhost:${service.ports?.[0].port}
`,
  )
  .join("\n")}

## State Management

This configuration uses local state. For production deployments, configure remote state:

\`\`\`hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state"
    key    = "${projectName}/terraform.tfstate"
    region = "us-west-2"
  }
}
\`\`\`

## Cleanup

\`\`\`bash
terraform destroy
\`\`\`

## Troubleshooting

### Check pod status
\`\`\`bash
kubectl get pods -n ${namespace}
kubectl describe pod <pod-name> -n ${namespace}
\`\`\`

### View logs
\`\`\`bash
kubectl logs -f <pod-name> -n ${namespace}
\`\`\`

### Apply changes
After modifying Terraform files:
\`\`\`bash
terraform plan
terraform apply
\`\`\`
`;
}

// ====================================================
// TEST COMPOSITION AND INTELLIGENT NAMESPACING
// ====================================================

/**
 * Test composition engine for merging existing and generated tests
 */
class TestCompositionEngine {
  private specName: string;
  private namespace: string;

  constructor(specName: string, baseNamespace?: string) {
    this.specName = specName;
    this.namespace = baseNamespace || this.generateBaseNamespace(specName);
  }

  /**
   * Discover existing test files in the project
   */
  async discoverExistingTests(outputDir: string): Promise<TestSuite[]> {
    const testSuites: TestSuite[] = [];
    const testDirs = ["tests", "test", "__tests__", "spec"];

    for (const testDir of testDirs) {
      const fullPath = path.join(outputDir, testDir);
      if (fs.existsSync(fullPath)) {
        const testFiles = await this.findTestFiles(fullPath);
        for (const testFile of testFiles) {
          const suite = await this.parseTestFile(testFile);
          if (suite) {
            testSuites.push(suite);
          }
        }
      }
    }

    return testSuites;
  }

  /**
   * Generate namespace for new tests based on spec and service
   */
  generateTestNamespace(serviceName: string): string {
    return `${this.namespace}.${serviceName}`.toLowerCase().replace(/[^a-z0-9.]/g, "_");
  }

  /**
   * Merge existing and new test suites intelligently
   */
  mergeTestSuites(existing: TestSuite[], newSuites: TestSuite[]): TestCompositionResult {
    const result: TestCompositionResult = {
      merged: [],
      conflicts: [],
      generated: [],
      preserved: [],
    };

    // Create a map of existing tests by namespace
    const existingMap = new Map<string, TestSuite>();
    existing.forEach((suite) => existingMap.set(suite.namespace, suite));

    // Process new test suites
    for (const newSuite of newSuites) {
      const existingSuite = existingMap.get(newSuite.namespace);

      if (!existingSuite) {
        // No conflict - add new suite as-is
        result.merged.push(newSuite);
        result.generated.push(...newSuite.cases);
      } else {
        // Conflict exists - merge intelligently
        const merged = this.mergeConflictingSuites(existingSuite, newSuite);
        result.merged.push(merged.suite);
        result.conflicts.push(...merged.conflicts);
        result.generated.push(...merged.generated);
        result.preserved.push(...merged.preserved);

        // Remove from existing map so we don't duplicate
        existingMap.delete(newSuite.namespace);
      }
    }

    // Add remaining existing suites (no conflicts)
    existingMap.forEach((suite) => {
      result.merged.push(suite);
      result.preserved.push(...suite.cases);
    });

    return result;
  }

  /**
   * Safely merge two conflicting test suites
   */
  private mergeConflictingSuites(
    existing: TestSuite,
    newSuite: TestSuite,
  ): {
    suite: TestSuite;
    conflicts: Array<{ test: string; reason: string; resolution: "skip" | "merge" | "replace" }>;
    generated: TestCase[];
    preserved: TestCase[];
  } {
    const result = {
      suite: { ...existing },
      conflicts: [] as Array<{
        test: string;
        reason: string;
        resolution: "skip" | "merge" | "replace";
      }>,
      generated: [] as TestCase[],
      preserved: [...existing.cases] as TestCase[],
    };

    // Create a map of existing test cases by name
    const existingCases = new Map<string, TestCase>();
    existing.cases.forEach((testCase) => existingCases.set(testCase.name, testCase));

    // Process new test cases
    for (const newCase of newSuite.cases) {
      const existingCase = existingCases.get(newCase.name);

      if (!existingCase) {
        // No conflict - add new case
        result.suite.cases.push(newCase);
        result.generated.push(newCase);
      } else if (this.isGeneratedTest(existingCase)) {
        // Existing test is generated - safe to replace
        const index = result.suite.cases.findIndex((c) => c.name === newCase.name);
        if (index >= 0) {
          result.suite.cases[index] = newCase;
          result.generated.push(newCase);
          result.conflicts.push({
            test: newCase.name,
            reason: "Generated test updated",
            resolution: "replace",
          });
        }
      } else {
        // Existing test is custom - preserve and rename new test
        const renamedCase = {
          ...newCase,
          name: `${newCase.name}_generated`,
          namespace: `${newCase.namespace}.generated`,
        };
        result.suite.cases.push(renamedCase);
        result.generated.push(renamedCase);
        result.conflicts.push({
          test: newCase.name,
          reason: "Custom test exists",
          resolution: "skip",
        });
      }
    }

    return result;
  }

  /**
   * Check if a test case was generated (vs. custom written)
   */
  private isGeneratedTest(testCase: TestCase): boolean {
    return (
      testCase.metadata?.generated === true ||
      testCase.metadata?.source === "arbiter" ||
      testCase.namespace.includes("generated")
    );
  }

  /**
   * Generate base namespace from spec name
   */
  private generateBaseNamespace(specName: string): string {
    return `arbiter.${specName}`.toLowerCase().replace(/[^a-z0-9.]/g, "_");
  }

  /**
   * Find test files recursively in a directory
   */
  private async findTestFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findTestFiles(fullPath)));
      } else if (this.isTestFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if a file is a test file based on naming conventions
   */
  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\.(js|ts|py|rs|go)$/,
      /\.spec\.(js|ts|py|rs|go)$/,
      /_test\.(js|ts|py|rs|go)$/,
      /test_.*\.(py)$/,
    ];

    return testPatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Parse a test file and extract test cases (simplified parser)
   */
  private async parseTestFile(filePath: string): Promise<TestSuite | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const ext = path.extname(filePath);

      // Basic parsing - in real implementation would use proper AST parsing
      const testCases: TestCase[] = [];

      if (ext === ".js" || ext === ".ts") {
        // JavaScript/TypeScript test parsing
        const testMatches = content.match(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g);
        testMatches?.forEach((match, index) => {
          const nameMatch = match.match(/['"`]([^'"`]+)['"`]/);
          if (nameMatch) {
            testCases.push({
              name: nameMatch[1],
              namespace: this.extractNamespaceFromFile(filePath),
              steps: [], // Would extract from test body in real implementation
              metadata: {
                generated: false,
                source: "existing",
                lastModified: new Date().toISOString(),
              },
            });
          }
        });
      } else if (ext === ".py") {
        // Python test parsing
        const testMatches = content.match(/def\s+(test_\w+)/g);
        testMatches?.forEach((match) => {
          const nameMatch = match.match(/def\s+(test_\w+)/);
          if (nameMatch) {
            testCases.push({
              name: nameMatch[1],
              namespace: this.extractNamespaceFromFile(filePath),
              steps: [],
              metadata: {
                generated: false,
                source: "existing",
                lastModified: new Date().toISOString(),
              },
            });
          }
        });
      }

      if (testCases.length > 0) {
        return {
          name: path.basename(filePath, path.extname(filePath)),
          namespace: this.extractNamespaceFromFile(filePath),
          cases: testCases,
          setup: [],
          teardown: [],
        };
      }
    } catch (error) {
      console.warn(`Warning: Could not parse test file ${filePath}:`, error);
    }

    return null;
  }

  /**
   * Extract namespace from file path
   */
  private extractNamespaceFromFile(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const parts = relativePath.split(path.sep);

    // Remove file extension and test suffix
    const fileName = path.basename(filePath, path.extname(filePath));
    const cleanFileName = fileName.replace(/\.(test|spec)$/, "");

    // Build namespace from path
    const namespaceParts = [...parts.slice(0, -1), cleanFileName];
    return namespaceParts
      .join(".")
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "_");
  }
}

/**
 * Generate test cases for services based on their configuration
 */
function generateServiceTests(services: DeploymentServiceConfig[], specName: string): TestSuite[] {
  const testSuites: TestSuite[] = [];
  const engine = new TestCompositionEngine(specName);

  for (const service of services) {
    const namespace = engine.generateTestNamespace(service.name);

    const testCases: TestCase[] = [];

    // Generate basic service tests
    if (service.ports && service.ports.length > 0) {
      // Health check test
      testCases.push({
        name: `${service.name}_health_check`,
        namespace: namespace,
        description: `Health check for ${service.name} service`,
        steps: [
          {
            action: "http_request",
            params: {
              method: "GET",
              url: `http://localhost:${service.ports[0].port}/health`,
              timeout: 5000,
            },
            expected: { status: 200 },
          },
        ],
        metadata: {
          generated: true,
          source: "arbiter",
          lastModified: new Date().toISOString(),
        },
      });

      // Port connectivity test
      for (const port of service.ports) {
        testCases.push({
          name: `${service.name}_port_${port.port}_connectivity`,
          namespace: namespace,
          description: `Test ${port.name || port.port} port connectivity`,
          steps: [
            {
              action: "tcp_connect",
              params: {
                host: "localhost",
                port: port.port,
                timeout: 3000,
              },
              expected: { connected: true },
            },
          ],
          metadata: {
            generated: true,
            source: "arbiter",
            lastModified: new Date().toISOString(),
          },
        });
      }
    }

    // Generate environment variable tests
    if (service.env && Object.keys(service.env).length > 0) {
      testCases.push({
        name: `${service.name}_environment_variables`,
        namespace: namespace,
        description: `Verify environment variables for ${service.name}`,
        steps: [
          {
            action: "check_environment",
            params: {
              service: service.name,
              variables: Object.keys(service.env),
            },
            expected: { all_present: true },
          },
        ],
        metadata: {
          generated: true,
          source: "arbiter",
          lastModified: new Date().toISOString(),
        },
      });
    }

    // Generate volume tests
    if (service.volumes && service.volumes.length > 0) {
      for (const volume of service.volumes) {
        testCases.push({
          name: `${service.name}_volume_${volume.name}_mounted`,
          namespace: namespace,
          description: `Verify ${volume.name} volume is mounted at ${volume.path}`,
          steps: [
            {
              action: "check_volume_mount",
              params: {
                service: service.name,
                path: volume.path,
                volume: volume.name,
              },
              expected: { mounted: true, writable: true },
            },
          ],
          metadata: {
            generated: true,
            source: "arbiter",
            lastModified: new Date().toISOString(),
          },
        });
      }
    }

    // Generate service-type specific tests
    if (service.artifactType === "external") {
      // Test for pre-built services (like ClickHouse, Redis)
      testCases.push({
        name: `${service.name}_image_version`,
        namespace: namespace,
        description: `Verify ${service.name} is running expected image`,
        steps: [
          {
            action: "check_image",
            params: {
              service: service.name,
              expectedImage: service.image,
            },
            expected: { image_matches: true },
          },
        ],
        metadata: {
          generated: true,
          source: "arbiter",
          lastModified: new Date().toISOString(),
        },
      });
    }

    if (testCases.length > 0) {
      testSuites.push({
        name: `${service.name}_tests`,
        namespace: namespace,
        cases: testCases,
        setup: [
          {
            action: "wait_for_service",
            params: {
              service: service.name,
              timeout: 30000,
            },
          },
        ],
        teardown: [],
      });
    }
  }

  return testSuites;
}

/**
 * Write test composition results to files
 */
async function writeTestFiles(
  testResult: TestCompositionResult,
  outputDir: string,
  language: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig = DEFAULT_PROJECT_STRUCTURE,
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ["tests"];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  const testsDir = path.join(outputDir, ...effectiveTestSegments);

  if (!fs.existsSync(testsDir) && !options.dryRun) {
    await fs.mkdir(testsDir, { recursive: true });
  }

  // Write test suites based on language
  for (const suite of testResult.merged) {
    const fileName = `${suite.name}.${getTestFileExtension(language)}`;
    const filePath = path.join(testsDir, fileName);

    const content = generateTestFileContent(suite, language);

    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(testsDirRelative, fileName));
  }

  // Write test composition report
  const reportPath = path.join(testsDir, "composition_report.json");
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResult.merged.reduce((sum, suite) => sum + suite.cases.length, 0),
      generatedTests: testResult.generated.length,
      preservedTests: testResult.preserved.length,
      conflicts: testResult.conflicts.length,
    },
    details: {
      conflicts: testResult.conflicts,
      generated: testResult.generated.map((t) => ({ name: t.name, namespace: t.namespace })),
      preserved: testResult.preserved.map((t) => ({ name: t.name, namespace: t.namespace })),
    },
  };

  await writeFileWithHooks(reportPath, JSON.stringify(report, null, 2), options);
  files.push(joinRelativePath(testsDirRelative, "composition_report.json"));

  return files;
}

function getTestFileExtension(language: string): string {
  switch (language) {
    case "typescript":
      return "test.ts";
    case "javascript":
      return "test.js";
    case "python":
      return "test.py";
    case "rust":
      return "rs";
    case "go":
      return "go";
    default:
      return "test.js";
  }
}

function generateTestFileContent(suite: TestSuite, language: string): string {
  switch (language) {
    case "typescript":
    case "javascript":
      return generateJavaScriptTestContent(suite);
    case "python":
      return generatePythonTestContent(suite);
    case "rust":
      return generateRustTestContent(suite);
    case "go":
      return generateGoTestContent(suite);
    default:
      return generateJavaScriptTestContent(suite);
  }
}

function generateJavaScriptTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('${suite.name}', () => {
${
  suite.setup && suite.setup.length > 0
    ? `  beforeAll(async () => {
${suite.setup.map((step) => `    // ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
  });

`
    : ""
}${suite.cases
  .map(
    (testCase) => `  test('${testCase.name}', async () => {
    // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}
    
    // TODO: Implement test logic
    expect(true).toBe(true); // Placeholder
  });`,
  )
  .join("\n\n")}
${
  suite.teardown && suite.teardown.length > 0
    ? `
  afterAll(async () => {
${suite.teardown.map((step) => `    // ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
  });`
    : ""
}
});
`;
}

function generatePythonTestContent(suite: TestSuite): string {
  return `"""${suite.name} - Generated by Arbiter
Namespace: ${suite.namespace}
Generated: ${new Date().toISOString()}
"""

import pytest
import asyncio
from typing import Dict, Any


class Test${suite.name.replace(/_/g, "")}:
    """Test suite for ${suite.name}"""
${
  suite.setup && suite.setup.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def setup_class(self):
        """Setup for test class"""
${suite.setup.map((step) => `        # ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
        pass
`
    : ""
}
${suite.cases
  .map(
    (
      testCase,
    ) => `    async def test_${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}(self):
        """${testCase.description || "Generated test"}"""
${testCase.steps
  .map(
    (step) => `        # ${step.action}: ${JSON.stringify(step.params)}
        # Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}
        
        # TODO: Implement test logic
        assert True  # Placeholder`,
  )
  .join("\n\n")}
${
  suite.teardown && suite.teardown.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def teardown_class(self):
        """Teardown for test class"""
${suite.teardown.map((step) => `        # ${step.action}: ${JSON.stringify(step.params)}`).join("\n")}
        pass`
    : ""
}
`;
}

function generateRustTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

#[cfg(test)]
mod ${suite.name.replace(/-/g, "_")} {
    use super::*;
    use tokio_test;

${suite.cases
  .map(
    (testCase) => `    #[tokio::test]
    async fn ${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}() {
        // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `        // ${step.action}: ${JSON.stringify(step.params)}
        // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}
        
        // TODO: Implement test logic
        assert!(true); // Placeholder
    }`,
  )
  .join("\n\n")}
}
`;
}

function generateGoTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

package main

import (
    "testing"
    "context"
    "time"
)

${suite.cases
  .map(
    (testCase) => `func Test${testCase.name.replace(/[^a-zA-Z0-9]/g, "")}(t *testing.T) {
    // ${testCase.description || "Generated test"}
${testCase.steps
  .map(
    (step) => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`,
  )
  .join("\n")}
    
    // TODO: Implement test logic
    if true != true { // Placeholder
        t.Errorf("Test failed")
    }
}`,
  )
  .join("\n\n")}
`;
}

/**
 * Main function to generate and compose tests with existing test suites
 */
async function generateAndComposeTests(
  assemblyConfig: any,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  try {
    const testConfig = extractTestConfiguration(assemblyConfig);
    const testComposition = await composeTestSuites(testConfig, outputDir);
    const files = await writeTestFiles(
      testComposition.result,
      outputDir,
      testConfig.language,
      options,
    );

    if (options.verbose) {
      reportTestComposition(testComposition.result);
    }

    return files;
  } catch (error) {
    return handleTestGenerationError(error);
  }
}

/**
 * Extract test configuration from assembly config
 */
function extractTestConfiguration(assemblyConfig: any) {
  const { services } = parseDockerComposeServices(assemblyConfig);
  const specName = assemblyConfig?.metadata?.name || "default";
  const language = assemblyConfig?.config?.language || "typescript";

  return { services, specName, language };
}

/**
 * Compose test suites by merging existing and new tests
 */
async function composeTestSuites(
  config: { services: any; specName: string; language: string },
  outputDir: string,
) {
  const engine = new TestCompositionEngine(config.specName);

  const existingTests = await engine.discoverExistingTests(outputDir);
  const newTestSuites = generateServiceTests(config.services, config.specName);
  const result = engine.mergeTestSuites(existingTests, newTestSuites);

  return { engine, result };
}

/**
 * Report test composition results
 */
function reportTestComposition(testResult: any): void {
  console.log(chalk.blue("\n📋 Test Composition Summary:"));
  console.log(chalk.dim(`  Generated: ${testResult.generated.length} test cases`));
  console.log(chalk.dim(`  Preserved: ${testResult.preserved.length} existing test cases`));
  console.log(chalk.dim(`  Conflicts: ${testResult.conflicts.length} resolved`));

  if (testResult.conflicts.length > 0) {
    reportTestConflicts(testResult.conflicts);
  }
}

/**
 * Report test conflict resolution details
 */
function reportTestConflicts(conflicts: any[]): void {
  console.log(chalk.yellow("\n⚠️  Test Conflicts Resolved:"));
  conflicts.forEach((conflict) => {
    console.log(chalk.dim(`  • ${conflict.test}: ${conflict.reason} (${conflict.resolution})`));
  });
}

/**
 * Handle test generation errors
 */
function handleTestGenerationError(error: unknown): string[] {
  console.warn(
    chalk.yellow(
      `⚠️  Test generation failed: ${error instanceof Error ? error.message : String(error)}`,
    ),
  );
  return [];
}

/**
 * Emit sharded CUE specifications from service to .arbiter directory before generation
 */
async function emitSpecificationFromService(config: CLIConfig): Promise<void> {
  if (config.localMode) {
    return;
  }

  if (process.env.ARBITER_SKIP_REMOTE_SPEC === "1") {
    return;
  }

  try {
    const apiClient = new ApiClient(config);

    // Ensure .arbiter directory exists
    await fs.ensureDir(".arbiter");

    // Try to get the stored specifications from service (sharded)
    const assemblyPath = path.resolve(".arbiter", "assembly.cue");
    const storedSpec = await apiClient.getSpecification("assembly", assemblyPath);

    if (storedSpec.success && storedSpec.data && storedSpec.data.content) {
      // Emit the main assembly CUE file to .arbiter directory
      await safeFileOperation("write", assemblyPath, async (validatedPath) => {
        await fs.writeFile(validatedPath, storedSpec.data.content, "utf-8");
      });
      console.log(
        chalk.green("📄 Emitted CUE specification from service to .arbiter/assembly.cue"),
      );

      // Also try to get any sharded specification files
      await emitShardedSpecifications(apiClient);
    } else {
      console.log(chalk.dim("💡 No stored specification found, using existing CUE files"));
    }
  } catch (error) {
    // Service unavailable, continue with existing file-based workflow
    console.log(chalk.dim("💡 Service unavailable, using existing CUE files"));
  }
}

/**
 * Emit additional sharded CUE files from service
 */
async function emitShardedSpecifications(apiClient: ApiClient): Promise<void> {
  try {
    // Try to get any additional sharded files (services, endpoints, etc.)
    const shardTypes = ["services", "endpoints", "schemas", "flows"];

    for (const shardType of shardTypes) {
      const shardPath = path.resolve(".arbiter", `${shardType}.cue`);
      const shardSpec = await apiClient.getSpecification(shardType, shardPath);

      if (shardSpec.success && shardSpec.data && shardSpec.data.content) {
        await safeFileOperation("write", shardPath, async (validatedPath) => {
          await fs.writeFile(validatedPath, shardSpec.data.content, "utf-8");
        });
        console.log(chalk.dim(`  📄 Emitted ${shardType} shard to .arbiter/${shardType}.cue`));
      }
    }
  } catch (error) {
    // Sharded files are optional, continue silently
  }
}
