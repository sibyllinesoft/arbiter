/**
 * @packageDocumentation
 * Sync command - Unified synchronization of project state with Arbiter spec.
 *
 * Provides functionality to:
 * - Detect packages from manifests and create/update package entities
 * - Detect services from Docker/K8s configs and create resource entities
 * - Sync manifest files with Arbiter scripts/dependencies
 * - Sync tasks/groups with GitHub issues (optional, off by default)
 * - Support dry-run mode for previewing changes
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import { formatCUE } from "@/cue/index.js";
import type { CLIConfig, GitHubSyncConfig, SyncOptions } from "@/types.js";
import type { Group } from "@/utils/github/sharded-storage.js";
import {
  GitHubSyncClient,
  type SyncResult as GitHubSyncResult,
} from "@/utils/github/sync/github-sync.js";
import { detectGitHubRepository } from "@/utils/io/git-detection.js";
import { detectPackageManager, getPackageManagerCommands } from "@/utils/io/package-manager.js";
import { MarkdownStorage } from "@/utils/storage/markdown-storage.js";
import chalk from "chalk";
import fsExtra from "fs-extra";
import {
  type SyncResult,
  syncCargoToml,
  syncMakefile,
  syncPackageJson,
  syncPyprojectToml,
} from "./manifest-sync.js";

// Re-export for external consumers
export type { ConflictResolution, SyncResult } from "./manifest-sync.js";

// ============================================================================
// Types
// ============================================================================

interface ManifestFile {
  path: string;
  type: "package.json" | "pyproject.toml" | "Cargo.toml" | "go.mod" | "Makefile";
  exists: boolean;
  language: string;
}

interface DetectedPackage {
  name: string;
  language: string;
  version?: string;
  directory: string;
  manifest: string;
  framework?: string;
  subtype?: "service" | "frontend" | "tool" | "library" | "worker";
}

interface DetectedResource {
  name: string;
  kind: "database" | "cache" | "queue" | "storage" | "container" | "gateway" | "external";
  image?: string;
  ports?: Array<{ port: number; name?: string }>;
  engine?: string;
}

interface SyncContext {
  projectPath: string;
  dryRun: boolean;
  backup: boolean;
  force: boolean;
  verbose: boolean;
}

interface SyncReport {
  packagesCreated: string[];
  packagesUpdated: string[];
  resourcesCreated: string[];
  resourcesUpdated: string[];
  manifestsModified: string[];
  githubIssuesCreated: string[];
  githubIssuesUpdated: string[];
  githubIssuesClosed: string[];
  errors: string[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Sync command implementation - unified project synchronization
 */
export async function syncProject(options: SyncOptions, config: CLIConfig): Promise<number> {
  const context: SyncContext = {
    projectPath: config.projectDir ?? process.cwd(),
    dryRun: options.dryRun || false,
    backup: options.backup || false,
    force: options.force || false,
    verbose: config.verbose || false,
  };

  console.log(chalk.blue("🔄 Arbiter sync"));
  console.log(chalk.dim(`Project: ${context.projectPath}`));

  if (context.dryRun) {
    console.log(chalk.yellow("📋 Dry run mode - no files will be modified\n"));
  }

  const report: SyncReport = {
    packagesCreated: [],
    packagesUpdated: [],
    resourcesCreated: [],
    resourcesUpdated: [],
    manifestsModified: [],
    githubIssuesCreated: [],
    githubIssuesUpdated: [],
    githubIssuesClosed: [],
    errors: [],
  };

  try {
    // Phase 1: Detect project structure
    console.log(chalk.blue("\n📦 Phase 1: Detecting project structure..."));
    const packages = await detectPackages(context);
    const resources = await detectResources(context);

    if (packages.length > 0) {
      console.log(chalk.green(`  Found ${packages.length} package(s)`));
      for (const pkg of packages) {
        console.log(
          chalk.dim(`    • ${pkg.name} (${pkg.language}${pkg.subtype ? `, ${pkg.subtype}` : ""})`),
        );
      }
    }

    if (resources.length > 0) {
      console.log(chalk.green(`  Found ${resources.length} resource(s)`));
      for (const res of resources) {
        console.log(chalk.dim(`    • ${res.name} (${res.kind})`));
      }
    }

    // Phase 2: Update spec entities
    console.log(chalk.blue("\n📝 Phase 2: Updating spec entities..."));
    await updateSpecEntities(context, packages, resources, report);

    // Phase 3: Sync manifest files
    console.log(chalk.blue("\n🔧 Phase 3: Syncing manifest files..."));
    await syncManifestFiles(context, report);

    // Phase 4: GitHub issue sync (optional)
    if (options.github) {
      console.log(chalk.blue("\n🐙 Phase 4: Syncing with GitHub issues..."));
      await syncGitHubIssues(context, report);
    }

    // Display results
    displaySyncReport(report, context.dryRun, options.github);

    return report.errors.length > 0 ? 1 : 0;
  } catch (error) {
    console.error(
      chalk.red("\n❌ Sync failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

// ============================================================================
// Package Detection
// ============================================================================

async function detectPackages(context: SyncContext): Promise<DetectedPackage[]> {
  const packages: DetectedPackage[] = [];

  // Check root and common subdirectories
  const searchPaths = ["", "packages", "apps", "services", "clients", "tools", "libs", "src"];

  for (const subdir of searchPaths) {
    const searchDir = path.join(context.projectPath, subdir);

    if (!(await fsExtra.pathExists(searchDir))) continue;

    // Check for root-level manifests
    const rootPkg = await detectPackageInDir(searchDir, subdir || ".");
    if (rootPkg) {
      packages.push(rootPkg);
    }

    // Check subdirectories (but not recursively deep)
    if (subdir) {
      try {
        const entries = await fs.readdir(searchDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_")) {
            const pkgDir = path.join(searchDir, entry.name);
            const pkg = await detectPackageInDir(pkgDir, path.join(subdir, entry.name));
            if (pkg) {
              packages.push(pkg);
            }
          }
        }
      } catch {
        // Directory might not be readable
      }
    }
  }

  return packages;
}

async function detectPackageInDir(dir: string, relPath: string): Promise<DetectedPackage | null> {
  // Try each manifest type
  const detectors: Array<() => Promise<DetectedPackage | null>> = [
    () => detectNodePackage(dir, relPath),
    () => detectPythonPackage(dir, relPath),
    () => detectRustPackage(dir, relPath),
    () => detectGoPackage(dir, relPath),
  ];

  for (const detect of detectors) {
    const pkg = await detect();
    if (pkg) return pkg;
  }

  return null;
}

async function detectNodePackage(dir: string, relPath: string): Promise<DetectedPackage | null> {
  const manifestPath = path.join(dir, "package.json");
  if (!(await fsExtra.pathExists(manifestPath))) return null;

  try {
    const content = await fs.readFile(manifestPath, "utf-8");
    const pkg = JSON.parse(content);

    // Infer subtype from dependencies and scripts
    let subtype: DetectedPackage["subtype"] = "library";
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.express || deps.fastify || deps.hono || deps.koa || deps["@nestjs/core"]) {
      subtype = "service";
    } else if (deps.react || deps.vue || deps.svelte || deps["@angular/core"] || deps.next) {
      subtype = "frontend";
    } else if (pkg.bin) {
      subtype = "tool";
    }

    // Detect framework
    let framework: string | undefined;
    if (deps.next) framework = "next";
    else if (deps.react) framework = "react";
    else if (deps.vue) framework = "vue";
    else if (deps.svelte) framework = "svelte";
    else if (deps.hono) framework = "hono";
    else if (deps.express) framework = "express";
    else if (deps.fastify) framework = "fastify";

    return {
      name: pkg.name || path.basename(dir),
      language: "typescript",
      version: pkg.version,
      directory: relPath,
      manifest: "package.json",
      framework,
      subtype,
    };
  } catch {
    return null;
  }
}

async function detectPythonPackage(dir: string, relPath: string): Promise<DetectedPackage | null> {
  const manifestPath = path.join(dir, "pyproject.toml");
  if (!(await fsExtra.pathExists(manifestPath))) return null;

  try {
    const content = await fs.readFile(manifestPath, "utf-8");

    // Simple TOML parsing for name and version
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);

    // Detect framework
    let framework: string | undefined;
    let subtype: DetectedPackage["subtype"] = "library";

    if (content.includes("fastapi") || content.includes("FastAPI")) {
      framework = "fastapi";
      subtype = "service";
    } else if (content.includes("django") || content.includes("Django")) {
      framework = "django";
      subtype = "service";
    } else if (content.includes("flask") || content.includes("Flask")) {
      framework = "flask";
      subtype = "service";
    }

    if (content.includes("[project.scripts]") || content.includes("[tool.poetry.scripts]")) {
      subtype = "tool";
    }

    return {
      name: nameMatch?.[1] || path.basename(dir),
      language: "python",
      version: versionMatch?.[1],
      directory: relPath,
      manifest: "pyproject.toml",
      framework,
      subtype,
    };
  } catch {
    return null;
  }
}

async function detectRustPackage(dir: string, relPath: string): Promise<DetectedPackage | null> {
  const manifestPath = path.join(dir, "Cargo.toml");
  if (!(await fsExtra.pathExists(manifestPath))) return null;

  try {
    const content = await fs.readFile(manifestPath, "utf-8");

    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);

    // Detect framework and type
    let framework: string | undefined;
    let subtype: DetectedPackage["subtype"] = "library";

    if (content.includes("axum")) {
      framework = "axum";
      subtype = "service";
    } else if (content.includes("actix")) {
      framework = "actix";
      subtype = "service";
    } else if (content.includes("rocket")) {
      framework = "rocket";
      subtype = "service";
    }

    if (content.includes("[[bin]]")) {
      subtype = subtype === "library" ? "tool" : subtype;
    }

    return {
      name: nameMatch?.[1] || path.basename(dir),
      language: "rust",
      version: versionMatch?.[1],
      directory: relPath,
      manifest: "Cargo.toml",
      framework,
      subtype,
    };
  } catch {
    return null;
  }
}

async function detectGoPackage(dir: string, relPath: string): Promise<DetectedPackage | null> {
  const manifestPath = path.join(dir, "go.mod");
  if (!(await fsExtra.pathExists(manifestPath))) return null;

  try {
    const content = await fs.readFile(manifestPath, "utf-8");

    const moduleMatch = content.match(/module\s+(\S+)/);
    const moduleName = moduleMatch?.[1] || path.basename(dir);
    const name = moduleName.split("/").pop() || moduleName;

    // Detect framework
    let framework: string | undefined;
    let subtype: DetectedPackage["subtype"] = "library";

    if (content.includes("github.com/go-chi/chi")) {
      framework = "chi";
      subtype = "service";
    } else if (content.includes("github.com/gin-gonic/gin")) {
      framework = "gin";
      subtype = "service";
    } else if (content.includes("github.com/labstack/echo")) {
      framework = "echo";
      subtype = "service";
    } else if (content.includes("github.com/gofiber/fiber")) {
      framework = "fiber";
      subtype = "service";
    }

    // Check for main.go to determine if it's an executable
    const mainPath = path.join(dir, "main.go");
    const cmdPath = path.join(dir, "cmd");
    if ((await fsExtra.pathExists(mainPath)) || (await fsExtra.pathExists(cmdPath))) {
      subtype = subtype === "library" ? "tool" : subtype;
    }

    return {
      name,
      language: "go",
      directory: relPath,
      manifest: "go.mod",
      framework,
      subtype,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Resource Detection (Docker/K8s)
// ============================================================================

async function detectResources(context: SyncContext): Promise<DetectedResource[]> {
  const resources: DetectedResource[] = [];

  // Check docker-compose files
  const composeFiles = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];

  for (const file of composeFiles) {
    const filePath = path.join(context.projectPath, file);
    if (await fsExtra.pathExists(filePath)) {
      const detected = await parseDockerCompose(filePath);
      resources.push(...detected);
      break; // Only use first found compose file
    }
  }

  return resources;
}

async function parseDockerCompose(filePath: string): Promise<DetectedResource[]> {
  const resources: DetectedResource[] = [];

  try {
    const content = await fs.readFile(filePath, "utf-8");

    // Simple YAML parsing for services section
    const servicesMatch = content.match(/services:\s*\n([\s\S]*?)(?=\n[a-z]|\n*$)/i);
    if (!servicesMatch) return resources;

    const servicesBlock = servicesMatch[1];
    const serviceRegex = /^\s{2}(\w[\w-]*):\s*\n/gm;
    let match;

    while ((match = serviceRegex.exec(servicesBlock)) !== null) {
      const serviceName = match[1];

      // Find the service block
      const startIdx = match.index + match[0].length;
      let endIdx = servicesBlock.length;

      // Find next service at same indentation level
      const nextService = servicesBlock.slice(startIdx).match(/^\s{2}\w[\w-]*:/m);
      if (nextService?.index) {
        endIdx = startIdx + nextService.index;
      }

      const serviceBlock = servicesBlock.slice(startIdx, endIdx);

      // Extract image
      const imageMatch = serviceBlock.match(/image:\s*["']?([^\s"'\n]+)["']?/);
      const image = imageMatch?.[1];

      // Infer resource kind from image name
      let kind: DetectedResource["kind"] = "container";
      let engine: string | undefined;

      if (image) {
        const imageLower = image.toLowerCase();
        if (
          imageLower.includes("postgres") ||
          imageLower.includes("mysql") ||
          imageLower.includes("mariadb") ||
          imageLower.includes("mongo")
        ) {
          kind = "database";
          if (imageLower.includes("postgres")) engine = "postgres";
          else if (imageLower.includes("mysql")) engine = "mysql";
          else if (imageLower.includes("mariadb")) engine = "mariadb";
          else if (imageLower.includes("mongo")) engine = "mongodb";
        } else if (imageLower.includes("redis") || imageLower.includes("memcached")) {
          kind = "cache";
          if (imageLower.includes("redis")) engine = "redis";
          else if (imageLower.includes("memcached")) engine = "memcached";
        } else if (
          imageLower.includes("rabbitmq") ||
          imageLower.includes("kafka") ||
          imageLower.includes("nats")
        ) {
          kind = "queue";
          if (imageLower.includes("rabbitmq")) engine = "rabbitmq";
          else if (imageLower.includes("kafka")) engine = "kafka";
          else if (imageLower.includes("nats")) engine = "nats";
        } else if (imageLower.includes("minio") || imageLower.includes("s3")) {
          kind = "storage";
        } else if (
          imageLower.includes("nginx") ||
          imageLower.includes("traefik") ||
          imageLower.includes("caddy")
        ) {
          kind = "gateway";
        }
      }

      // Extract ports
      const ports: Array<{ port: number; name?: string }> = [];
      const portsMatch = serviceBlock.match(/ports:\s*\n([\s\S]*?)(?=\n\s{4}\w|$)/);
      if (portsMatch) {
        const portRegex = /["']?(\d+):(\d+)["']?/g;
        let portMatch;
        while ((portMatch = portRegex.exec(portsMatch[1])) !== null) {
          ports.push({ port: parseInt(portMatch[2], 10) });
        }
      }

      // Skip if it looks like application code (has build context, no image of known infrastructure)
      const hasBuild = serviceBlock.includes("build:");
      if (hasBuild && kind === "container") {
        continue; // Skip application services - they should be detected as packages
      }

      resources.push({
        name: serviceName,
        kind,
        image,
        ports: ports.length > 0 ? ports : undefined,
        engine,
      });
    }
  } catch {
    // Couldn't parse compose file
  }

  return resources;
}

// ============================================================================
// Spec Entity Updates
// ============================================================================

async function updateSpecEntities(
  context: SyncContext,
  packages: DetectedPackage[],
  resources: DetectedResource[],
  report: SyncReport,
): Promise<void> {
  const assemblyPath = path.join(context.projectPath, ".arbiter", "assembly.cue");

  // Load or create assembly
  let assemblyContent: string;
  let existingSpec: any = {};

  if (await fsExtra.pathExists(assemblyPath)) {
    assemblyContent = await fs.readFile(assemblyPath, "utf-8");
    try {
      const manipulator = getCueManipulator();
      existingSpec = await manipulator.parse(assemblyContent);
      await manipulator.cleanup();
    } catch {
      // Couldn't parse existing spec
    }
  } else {
    assemblyContent = generateInitialAssembly(context.projectPath);
    await fsExtra.ensureDir(path.dirname(assemblyPath));
  }

  const existingPackages = existingSpec.packages || {};
  const existingResources = existingSpec.resources || {};

  // Track what we're adding/updating
  const packagesToAdd: Record<string, any> = {};
  const resourcesToAdd: Record<string, any> = {};

  // Process packages
  for (const pkg of packages) {
    const slug = slugify(pkg.name);
    const existing = existingPackages[slug];

    const packageConfig: any = {
      name: pkg.name,
      language: pkg.language,
      manifest: pkg.manifest,
      sourceDirectory: pkg.directory,
    };

    if (pkg.version) packageConfig.version = pkg.version;
    if (pkg.framework) packageConfig.framework = pkg.framework;
    if (pkg.subtype) packageConfig.subtype = pkg.subtype;

    if (existing) {
      // Only update if there are meaningful changes
      if (hasChanges(existing, packageConfig)) {
        packagesToAdd[slug] = packageConfig;
        report.packagesUpdated.push(pkg.name);
      }
    } else {
      packagesToAdd[slug] = packageConfig;
      report.packagesCreated.push(pkg.name);
    }
  }

  // Process resources
  for (const res of resources) {
    const slug = slugify(res.name);
    const existing = existingResources[slug];

    const resourceConfig: any = {
      name: res.name,
      kind: res.kind,
    };

    if (res.image) resourceConfig.image = res.image;
    if (res.engine) resourceConfig.engine = res.engine;
    if (res.ports) {
      resourceConfig.ports = res.ports.map((p) => ({
        name: p.name || res.name,
        port: p.port,
      }));
    }

    if (existing) {
      if (hasChanges(existing, resourceConfig)) {
        resourcesToAdd[slug] = resourceConfig;
        report.resourcesUpdated.push(res.name);
      }
    } else {
      resourcesToAdd[slug] = resourceConfig;
      report.resourcesCreated.push(res.name);
    }
  }

  // Generate updated assembly content
  if (Object.keys(packagesToAdd).length > 0 || Object.keys(resourcesToAdd).length > 0) {
    const updatedContent = await generateUpdatedAssembly(
      assemblyContent,
      packagesToAdd,
      resourcesToAdd,
    );

    if (!context.dryRun) {
      await fsExtra.ensureDir(path.dirname(assemblyPath));
      await fs.writeFile(assemblyPath, updatedContent, "utf-8");
      console.log(chalk.green(`  ✅ Updated ${path.relative(context.projectPath, assemblyPath)}`));
    } else {
      console.log(
        chalk.yellow(`  Would update ${path.relative(context.projectPath, assemblyPath)}`),
      );
    }
  } else {
    console.log(chalk.dim("  No entity changes needed"));
  }
}

function hasChanges(existing: any, updated: any): boolean {
  // Simple comparison - check if key fields differ
  for (const key of Object.keys(updated)) {
    if (JSON.stringify(existing[key]) !== JSON.stringify(updated[key])) {
      return true;
    }
  }
  return false;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function generateInitialAssembly(projectPath: string): string {
  const projectName = path.basename(projectPath);
  return `package arbiter

// Auto-generated by arbiter sync
// Modify as needed for your project

metadata: {
  name: "${projectName}"
}

packages: {}

resources: {}
`;
}

async function generateUpdatedAssembly(
  currentContent: string,
  packages: Record<string, any>,
  resources: Record<string, any>,
): Promise<string> {
  // Try to use CUE manipulator for merging
  try {
    const manipulator = getCueManipulator();

    let content = currentContent;

    // Add packages
    for (const [slug, pkg] of Object.entries(packages)) {
      content = await manipulator.addToSection(content, "packages", slug, pkg);
    }

    // Add resources
    for (const [slug, res] of Object.entries(resources)) {
      content = await manipulator.addToSection(content, "resources", slug, res);
    }

    await manipulator.cleanup();
    return await formatCUE(content);
  } catch {
    // Fallback: append to content
    let newContent = currentContent;

    if (Object.keys(packages).length > 0) {
      const packagesStr = generateCueSection("packages", packages);
      if (!currentContent.includes("packages:")) {
        newContent += "\n" + packagesStr;
      }
    }

    if (Object.keys(resources).length > 0) {
      const resourcesStr = generateCueSection("resources", resources);
      if (!currentContent.includes("resources:")) {
        newContent += "\n" + resourcesStr;
      }
    }

    return newContent;
  }
}

function generateCueSection(name: string, items: Record<string, any>): string {
  const lines = [`${name}: {`];

  for (const [key, value] of Object.entries(items)) {
    lines.push(`  "${key}": {`);
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string") {
        lines.push(`    ${k}: "${v}"`);
      } else if (Array.isArray(v)) {
        lines.push(`    ${k}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`    ${k}: ${JSON.stringify(v)}`);
      }
    }
    lines.push("  }");
  }

  lines.push("}");
  return lines.join("\n");
}

// ============================================================================
// Manifest Sync
// ============================================================================

async function syncManifestFiles(context: SyncContext, report: SyncReport): Promise<void> {
  const manifests = await detectManifestFiles(context.projectPath);

  if (manifests.length === 0) {
    console.log(chalk.dim("  No manifest files to sync"));
    return;
  }

  for (const manifest of manifests) {
    const filePath = path.join(context.projectPath, manifest.path);

    try {
      const result = await syncManifest(manifest, filePath, context);
      if (result.modified) {
        report.manifestsModified.push(manifest.path);
        const action = context.dryRun ? "Would modify" : "Modified";
        console.log(chalk.green(`  ✅ ${action} ${manifest.path}`));
      } else {
        console.log(chalk.dim(`  ⏭️  ${manifest.path} (no changes)`));
      }
    } catch (error) {
      report.errors.push(
        `${manifest.path}: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log(chalk.red(`  ❌ Failed to sync ${manifest.path}`));
    }
  }
}

async function detectManifestFiles(projectPath: string): Promise<ManifestFile[]> {
  const manifests: ManifestFile[] = [
    { path: "package.json", type: "package.json", exists: false, language: "typescript" },
    { path: "pyproject.toml", type: "pyproject.toml", exists: false, language: "python" },
    { path: "Cargo.toml", type: "Cargo.toml", exists: false, language: "rust" },
    { path: "go.mod", type: "go.mod", exists: false, language: "go" },
    { path: "Makefile", type: "Makefile", exists: false, language: "make" },
  ];

  for (const manifest of manifests) {
    const fullPath = path.join(projectPath, manifest.path);
    manifest.exists = await fsExtra.pathExists(fullPath);
  }

  return manifests.filter((m) => m.exists);
}

async function syncManifest(
  manifest: ManifestFile,
  filePath: string,
  context: SyncContext,
): Promise<SyncResult> {
  const processors: Record<string, typeof syncPackageJson> = {
    "package.json": syncPackageJson,
    "pyproject.toml": syncPyprojectToml,
    "Cargo.toml": syncCargoToml,
    Makefile: syncMakefile,
  };

  const processor = processors[manifest.type];
  if (processor) {
    return processor(filePath, context.dryRun, context.backup, context.force);
  }

  return { modified: false, conflicts: [], checksum: "" };
}

// ============================================================================
// GitHub Issue Sync
// ============================================================================

/**
 * Sync local tasks/groups with GitHub issues
 */
async function syncGitHubIssues(context: SyncContext, report: SyncReport): Promise<void> {
  // Check for GITHUB_TOKEN
  const token = process.env.GITHUB_TOKEN || process.env.ARBITER_GITHUB_TOKEN;
  if (!token) {
    console.log(chalk.yellow("  ⚠️  GITHUB_TOKEN not set, skipping GitHub sync"));
    console.log(chalk.dim("    Set GITHUB_TOKEN environment variable to enable GitHub issue sync"));
    return;
  }

  // Auto-detect repository from git remote
  const repoDetection = detectGitHubRepository();
  if (!repoDetection.detected || !repoDetection.remote) {
    console.log(chalk.yellow("  ⚠️  Could not detect GitHub repository from git remote"));
    console.log(chalk.dim("    Ensure this is a git repository with a GitHub remote"));
    return;
  }

  const { owner, repo } = repoDetection.remote;
  console.log(chalk.dim(`  Repository: ${owner}/${repo}`));

  // Load groups/tasks from storage
  const groups = await loadGroupsForGitHubSync(context.projectPath);

  if (groups.length === 0) {
    console.log(chalk.dim("  No groups/tasks found to sync"));
    return;
  }

  console.log(
    chalk.dim(
      `  Found ${groups.length} group(s) with ${groups.reduce((sum, g) => sum + g.tasks.length, 0)} task(s)`,
    ),
  );

  // Create GitHub sync config
  const githubConfig: GitHubSyncConfig = {
    repository: {
      owner,
      repo,
      tokenEnv: "GITHUB_TOKEN",
    },
    automation: {
      createMilestones: true,
      autoClose: true,
    },
  };

  try {
    const syncClient = new GitHubSyncClient(githubConfig);

    if (context.dryRun) {
      // Generate preview only
      const preview = await syncClient.generateSyncPreview(groups);

      const totalCreates = preview.groups.create.length + preview.tasks.create.length;
      const totalUpdates = preview.groups.update.length + preview.tasks.update.length;
      const totalCloses = preview.groups.close.length + preview.tasks.close.length;

      if (totalCreates > 0) {
        console.log(chalk.yellow(`  Would create ${totalCreates} issue(s)`));
        for (const group of preview.groups.create) {
          report.githubIssuesCreated.push(`[group] ${group.name}`);
        }
        for (const task of preview.tasks.create) {
          report.githubIssuesCreated.push(`[task] ${task.name}`);
        }
      }
      if (totalUpdates > 0) {
        console.log(chalk.yellow(`  Would update ${totalUpdates} issue(s)`));
        for (const { group } of preview.groups.update) {
          report.githubIssuesUpdated.push(`[group] ${group.name}`);
        }
        for (const { task } of preview.tasks.update) {
          report.githubIssuesUpdated.push(`[task] ${task.name}`);
        }
      }
      if (totalCloses > 0) {
        console.log(chalk.yellow(`  Would close ${totalCloses} issue(s)`));
        for (const { group } of preview.groups.close) {
          report.githubIssuesClosed.push(`[group] ${group.name}`);
        }
        for (const { task } of preview.tasks.close) {
          report.githubIssuesClosed.push(`[task] ${task.name}`);
        }
      }
      if (totalCreates === 0 && totalUpdates === 0 && totalCloses === 0) {
        console.log(chalk.dim("  All issues are in sync"));
      }
    } else {
      // Perform actual sync
      const results = await syncClient.syncToGitHub(groups);

      for (const result of results) {
        const label =
          result.type === "group" ? "[group]" : result.type === "task" ? "[task]" : "[milestone]";
        const name = result.details || result.itemId;

        switch (result.action) {
          case "created":
            report.githubIssuesCreated.push(`${label} ${name}`);
            if (result.githubNumber) {
              console.log(chalk.green(`  ✅ Created #${result.githubNumber}: ${name}`));
            }
            break;
          case "updated":
            report.githubIssuesUpdated.push(`${label} ${name}`);
            if (result.githubNumber) {
              console.log(chalk.green(`  ✅ Updated #${result.githubNumber}: ${name}`));
            }
            break;
          case "closed":
            report.githubIssuesClosed.push(`${label} ${name}`);
            if (result.githubNumber) {
              console.log(chalk.green(`  ✅ Closed #${result.githubNumber}: ${name}`));
            }
            break;
          case "skipped":
            console.log(chalk.dim(`  ⏭️  Skipped: ${name}`));
            break;
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push(`GitHub sync: ${message}`);
    console.log(chalk.red(`  ❌ GitHub sync failed: ${message}`));
  }
}

/**
 * Load groups/tasks from markdown storage for GitHub sync
 */
async function loadGroupsForGitHubSync(projectPath: string): Promise<Group[]> {
  const arbiterDir = path.join(projectPath, ".arbiter");
  return loadGroupsFromMarkdownStorage(arbiterDir);
}

/**
 * Load groups from markdown-first storage
 */
async function loadGroupsFromMarkdownStorage(arbiterDir: string): Promise<Group[]> {
  const storage = new MarkdownStorage(arbiterDir);

  if (!(await storage.isInitialized())) {
    return [];
  }

  const graph = await storage.load();
  const groups: Group[] = [];

  // Find all group entities and their child tasks
  for (const node of graph.nodes.values()) {
    if (node.type === "group") {
      const group: Group = {
        id: node.entityId,
        name: node.name,
        description: node.body || undefined,
        type: (node.frontmatter.kind as Group["type"]) || "group",
        priority: (node.frontmatter.priority as Group["priority"]) || "medium",
        status: mapStatusToGroupStatus(node.frontmatter.status as string),
        dueDate: node.frontmatter.due as string | undefined,
        labels: node.frontmatter.labels as string[] | undefined,
        tasks: [],
      };

      // Find child tasks
      for (const childId of node.childIds) {
        const childNode = graph.nodes.get(childId);
        if (childNode && childNode.type === "task") {
          group.tasks.push({
            id: childNode.entityId,
            groupId: node.entityId,
            name: childNode.name,
            description: childNode.body || undefined,
            type: mapTaskType(childNode.frontmatter.kind as string),
            priority: (childNode.frontmatter.priority as any) || "medium",
            status: mapStatusToTaskStatus(childNode.frontmatter.status as string),
            assignee: Array.isArray(childNode.frontmatter.assignees)
              ? (childNode.frontmatter.assignees as string[])[0]
              : undefined,
            labels: childNode.frontmatter.labels as string[] | undefined,
          });
        }
      }

      groups.push(group);
    }
  }

  // Also collect standalone tasks (not in a group) into a default group
  const standaloneTasks: Group["tasks"] = [];
  for (const node of graph.nodes.values()) {
    if (node.type === "task" && !node.parentId) {
      standaloneTasks.push({
        id: node.entityId,
        groupId: "standalone",
        name: node.name,
        description: node.body || undefined,
        type: mapTaskType(node.frontmatter.kind as string),
        priority: (node.frontmatter.priority as any) || "medium",
        status: mapStatusToTaskStatus(node.frontmatter.status as string),
        assignee: Array.isArray(node.frontmatter.assignees)
          ? (node.frontmatter.assignees as string[])[0]
          : undefined,
        labels: node.frontmatter.labels as string[] | undefined,
      });
    }
  }

  if (standaloneTasks.length > 0) {
    groups.push({
      id: "standalone",
      name: "Standalone Tasks",
      description: "Tasks not assigned to a specific group",
      type: "group",
      priority: "medium",
      status: "in_progress",
      tasks: standaloneTasks,
    });
  }

  return groups;
}

/**
 * Map markdown status to Group status
 */
function mapStatusToGroupStatus(status?: string): Group["status"] {
  switch (status) {
    case "open":
    case "planning":
      return "planning";
    case "in_progress":
    case "active":
      return "in_progress";
    case "done":
    case "completed":
    case "closed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "planning";
  }
}

/**
 * Map task kind to Task type
 */
function mapTaskType(
  kind?: string,
): "feature" | "bug" | "refactor" | "test" | "docs" | "devops" | "research" {
  switch (kind) {
    case "feature":
      return "feature";
    case "bug":
    case "fix":
      return "bug";
    case "refactor":
      return "refactor";
    case "test":
      return "test";
    case "docs":
    case "documentation":
      return "docs";
    case "devops":
    case "infra":
    case "infrastructure":
      return "devops";
    case "research":
    case "spike":
      return "research";
    default:
      return "feature";
  }
}

/**
 * Map markdown status to Task status
 */
function mapStatusToTaskStatus(
  status?: string,
): "todo" | "in_progress" | "review" | "testing" | "completed" | "cancelled" {
  switch (status) {
    case "open":
    case "todo":
      return "todo";
    case "in_progress":
    case "active":
      return "in_progress";
    case "review":
      return "review";
    case "testing":
      return "testing";
    case "done":
    case "completed":
    case "closed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "todo";
  }
}

// ============================================================================
// Reporting
// ============================================================================

function displaySyncReport(report: SyncReport, dryRun: boolean, includeGitHub = false): void {
  console.log(chalk.green("\n🎉 Sync complete!"));

  const action = dryRun ? "would be" : "were";

  if (report.packagesCreated.length > 0) {
    console.log(chalk.cyan(`  📦 ${report.packagesCreated.length} package(s) ${action} created`));
  }
  if (report.packagesUpdated.length > 0) {
    console.log(chalk.cyan(`  📦 ${report.packagesUpdated.length} package(s) ${action} updated`));
  }
  if (report.resourcesCreated.length > 0) {
    console.log(chalk.cyan(`  🗄️  ${report.resourcesCreated.length} resource(s) ${action} created`));
  }
  if (report.resourcesUpdated.length > 0) {
    console.log(chalk.cyan(`  🗄️  ${report.resourcesUpdated.length} resource(s) ${action} updated`));
  }
  if (report.manifestsModified.length > 0) {
    console.log(
      chalk.cyan(`  📄 ${report.manifestsModified.length} manifest(s) ${action} modified`),
    );
  }

  // GitHub issue sync results
  if (includeGitHub) {
    if (report.githubIssuesCreated.length > 0) {
      console.log(
        chalk.cyan(`  🐙 ${report.githubIssuesCreated.length} GitHub issue(s) ${action} created`),
      );
    }
    if (report.githubIssuesUpdated.length > 0) {
      console.log(
        chalk.cyan(`  🐙 ${report.githubIssuesUpdated.length} GitHub issue(s) ${action} updated`),
      );
    }
    if (report.githubIssuesClosed.length > 0) {
      console.log(
        chalk.cyan(`  🐙 ${report.githubIssuesClosed.length} GitHub issue(s) ${action} closed`),
      );
    }
  }

  if (report.errors.length > 0) {
    console.log(chalk.red(`\n⚠️  ${report.errors.length} error(s):`));
    for (const error of report.errors) {
      console.log(chalk.red(`    • ${error}`));
    }
  }

  if (dryRun) {
    console.log(chalk.yellow("\n💡 Run without --dry-run to apply changes"));
  }
}

// Export for testing
export { detectPackages, detectResources, detectManifestFiles };
