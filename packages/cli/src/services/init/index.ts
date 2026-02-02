/**
 * @packageDocumentation
 * Init command - Initialize new Arbiter projects with markdown-first storage.
 *
 * Provides functionality to:
 * - Initialize projects from config-driven presets (plopfile bundles)
 * - Create markdown structure in .arbiter directory
 * - Support layered preset discovery (project → user → builtin)
 * - Handle both local and server-assisted initialization
 */

import os from "node:os";
import path from "node:path";
import { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig, InitOptions } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import chalk from "chalk";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

/**
 * Preset metadata
 */
interface PresetInfo {
  id: string;
  name: string;
  description: string;
  language?: string;
  category?: string;
  source: "builtin" | "project" | "user";
}

/**
 * Built-in presets (embedded in code for standalone binary compatibility)
 */
const BUILTIN_PRESETS: PresetInfo[] = [
  {
    id: "cli-node",
    name: "CLI Tool (Node.js/TypeScript)",
    description: "Command-line tool or library using Node.js/TypeScript/Bun",
    language: "typescript",
    category: "cli",
    source: "builtin",
  },
  {
    id: "cli-python",
    name: "CLI Tool (Python)",
    description: "Command-line tool or library using Python",
    language: "python",
    category: "cli",
    source: "builtin",
  },
  {
    id: "cli-rust",
    name: "CLI Tool (Rust)",
    description: "Command-line tool or library using Rust",
    language: "rust",
    category: "cli",
    source: "builtin",
  },
  {
    id: "cli-go",
    name: "CLI Tool (Go)",
    description: "Command-line tool or library using Go",
    language: "go",
    category: "cli",
    source: "builtin",
  },
  {
    id: "web-app",
    name: "Web Application",
    description: "Full-stack web application with frontend and backend",
    category: "web",
    source: "builtin",
  },
  {
    id: "api-service",
    name: "API Service",
    description: "RESTful API service with database integration",
    category: "api",
    source: "builtin",
  },
];

/**
 * Get preset search paths for custom presets (project → user)
 */
function getCustomPresetSearchPaths(projectDir?: string): string[] {
  const paths: string[] = [];

  // Project-level presets
  if (projectDir) {
    paths.push(path.join(projectDir, ".arbiter", "presets"));
  }
  paths.push(path.join(process.cwd(), ".arbiter", "presets"));

  // User-level presets
  paths.push(path.join(os.homedir(), ".arbiter", "presets"));

  return paths;
}

/**
 * Discover custom presets from file system
 */
async function discoverCustomPresets(projectDir?: string): Promise<PresetInfo[]> {
  const presets: PresetInfo[] = [];
  const searchPaths = getCustomPresetSearchPaths(projectDir);

  for (const basePath of searchPaths) {
    if (!(await fs.pathExists(basePath))) continue;

    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;

        const modulePath = path.join(basePath, entry.name, "module.js");
        if (!(await fs.pathExists(modulePath))) continue;

        try {
          const mod = await import(modulePath);
          presets.push({
            id: mod.id || entry.name,
            name: mod.name || entry.name,
            description: mod.description || "",
            language: mod.language,
            category: mod.category,
            source: basePath.includes(path.join(".arbiter", "presets")) ? "project" : "user",
          });
        } catch {
          // Skip presets that fail to load
        }
      }
    } catch {
      // Directory not readable
    }
  }

  return presets;
}

/**
 * Get all available presets (custom + builtin)
 */
async function discoverPresets(projectDir?: string): Promise<PresetInfo[]> {
  const customPresets = await discoverCustomPresets(projectDir);

  // Custom presets override builtins with the same ID
  const customIds = new Set(customPresets.map((p) => p.id));
  const builtins = BUILTIN_PRESETS.filter((p) => !customIds.has(p.id));

  return [...customPresets, ...builtins];
}

/**
 * Generate README.md content for a preset
 */
function generateReadmeContent(projectName: string, preset: PresetInfo): string {
  const now = new Date().toISOString();
  const language = preset.language || "typescript";

  return `---
type: project
entityId: ${uuidv4()}
createdAt: ${now}
updatedAt: ${now}
preset: ${preset.id}
language: ${language}
tags:
  - ${preset.category || "project"}
  - ${language}
---

# ${projectName}

${preset.category === "cli" ? "Command-line tool" : "Project"} built with ${language}.

## Getting Started

Run \`arbiter sync\` to detect packages and create service entities.

\`\`\`bash
arbiter sync
\`\`\`

## Viewing Your Spec

- **CLI**: \`arbiter list service\`, \`arbiter list package\`
- **Browser**: \`arbiter view\` to start documentation server
- **Obsidian**: Open \`.arbiter/\` folder as a vault

## Adding Entities

\`\`\`bash
# Add a service
arbiter add service my-service --language ${language}

# Add a task
arbiter add task "Implement feature X"

# Add a group (milestone)
arbiter add group "v1.0 Release"
\`\`\`
`;
}

/**
 * Generate config.json content for a preset
 */
function generateConfigContent(preset: PresetInfo): string {
  return JSON.stringify(
    {
      preset: preset.id,
      language: preset.language || "typescript",
      storage: "markdown",
      sync: {
        autoDetectPackages: true,
        createMarkdownEntities: true,
      },
    },
    null,
    2,
  );
}

/**
 * Create project locally with markdown-first storage
 */
async function createProjectLocally(projectName: string, preset: PresetInfo): Promise<number> {
  const arbiterDir = path.join(process.cwd(), ".arbiter");
  const readmePath = path.join(arbiterDir, "README.md");
  const configPath = path.join(arbiterDir, "config.json");

  // Check if .arbiter directory already exists with README.md
  if (await fs.pathExists(readmePath)) {
    console.error(chalk.red("Project already initialized. Found existing .arbiter/README.md"));
    return 1;
  }

  // Also check for legacy assembly.cue
  const assemblyPath = path.join(arbiterDir, "assembly.cue");
  if (await fs.pathExists(assemblyPath)) {
    console.error(chalk.red("Project already initialized. Found existing .arbiter/assembly.cue"));
    console.log(chalk.dim("Run 'arbiter migrate --to-markdown' to migrate to the new format."));
    return 1;
  }

  // Create .arbiter directory
  await fs.ensureDir(arbiterDir);

  // Generate and write README.md
  const readmeContent = generateReadmeContent(projectName, preset);
  await fs.writeFile(readmePath, readmeContent, "utf-8");

  // Generate and write config.json
  const configContent = generateConfigContent(preset);
  await fs.writeFile(configPath, configContent, "utf-8");

  showProjectCreatedMessage(projectName, preset.name);
  return 0;
}

/**
 * Display project creation success message
 */
function showProjectCreatedMessage(projectName: string, presetName: string): void {
  console.log(chalk.green(`\n✓ Created project "${projectName}" from ${presetName} preset`));
  console.log(chalk.dim("\n💡 Your project has been created with markdown-first storage"));
  console.log(chalk.dim("   Run 'arbiter sync' to detect packages and create entities"));
  console.log(chalk.dim("   Use 'arbiter add <entity>' to add more components"));
  console.log(chalk.dim("   Use 'arbiter view' to browse your spec in a web browser"));
}

/**
 * Create project via API
 */
async function createProjectWithApi(
  config: CLIConfig,
  projectName: string,
  preset: PresetInfo,
): Promise<number> {
  const apiClient = new ApiClient(config);
  const result = await apiClient.createProject({
    name: projectName,
    presetId: preset.id,
  });

  if (!result.success) {
    console.error(chalk.red("Failed to create project:"), result.error);
    return result.exitCode ?? 1;
  }

  showProjectCreatedMessage(projectName, preset.name);
  return 0;
}

/**
 * Initialize a new project from a preset
 */
export async function initCommand(
  displayName: string | undefined,
  options: InitOptions,
  config?: CLIConfig,
): Promise<number> {
  try {
    // Discover available presets
    const presets = await discoverPresets(config?.projectDir);

    if (options.listPresets) {
      await printPresetList(presets);
      return 0;
    }

    // Validate preset selection
    if (!options.preset) {
      console.error(chalk.red("Please choose an init preset using --preset <id>."));
      await printPresetList(presets);
      return 1;
    }

    const preset = presets.find((p) => p.id === options.preset);
    if (!preset) {
      console.error(chalk.red(`Unknown preset: ${options.preset}`));
      await printPresetList(presets);
      return 1;
    }

    const projectName = displayName || options.name || path.basename(process.cwd());

    // Default to local mode
    const useLocalMode = config?.localMode !== false;

    if (useLocalMode) {
      return await withProgress(
        {
          text: `Creating project "${projectName}" from ${preset.name} preset...`,
          color: "green",
        },
        () => createProjectLocally(projectName, preset),
      );
    }

    // Fall back to API mode
    if (!config) {
      console.error(
        chalk.red("Config is required when using API mode. Run with --local or configure API."),
      );
      return 2;
    }

    return await withProgress(
      {
        text: `Creating project "${projectName}" from ${preset.name} preset...`,
        color: "green",
      },
      () => createProjectWithApi(config, projectName, preset),
    );
  } catch (error) {
    console.error(
      chalk.red("Init command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * List available presets
 */
export async function listPresets(): Promise<void> {
  const presets = await discoverPresets();
  await printPresetList(presets);
  console.log();
  console.log(chalk.dim("Usage: arbiter init <name> --preset <preset-id>"));
  console.log(chalk.dim("Example: arbiter init my-cli --preset cli-node"));
}

async function printPresetList(presets: PresetInfo[]): Promise<void> {
  console.log(chalk.cyan("\nAvailable presets:"));
  console.log();

  // Group by category
  const byCategory = new Map<string, PresetInfo[]>();
  for (const preset of presets) {
    const category = preset.category || "other";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(preset);
  }

  // Display grouped presets
  for (const [category, categoryPresets] of byCategory) {
    console.log(chalk.yellow(`  ${category.toUpperCase()}`));
    for (const preset of categoryPresets) {
      const sourceBadge =
        preset.source === "builtin"
          ? ""
          : preset.source === "project"
            ? chalk.dim(" [project]")
            : chalk.dim(" [user]");
      console.log(`    ${chalk.green(preset.id.padEnd(20))} ${preset.description}${sourceBadge}`);
    }
    console.log();
  }
}
