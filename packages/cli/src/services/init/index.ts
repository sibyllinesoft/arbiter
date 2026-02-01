/**
 * @packageDocumentation
 * Init command - Initialize new Arbiter projects with markdown-first storage.
 *
 * Provides functionality to:
 * - Initialize projects from predefined presets
 * - Create markdown structure in .arbiter directory
 * - Support web-app, mobile-app, api-service, microservice templates
 * - Handle both local and server-assisted initialization
 */

import path from "node:path";
import { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig, InitOptions } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import { MarkdownStorage } from "@/utils/storage/markdown-storage.js";
import { createMarkdownFile } from "@/utils/storage/markdown.js";
import chalk from "chalk";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";

/**
 * Available presets with local template support
 */
const PRESETS = [
  {
    id: "web-app",
    name: "Web Application",
    description: "Full-stack web application with React frontend and Node.js backend",
    supportsLocal: true,
  },
  {
    id: "mobile-app",
    name: "Mobile Application",
    description: "Cross-platform mobile app with React Native",
    supportsLocal: false,
  },
  {
    id: "api-service",
    name: "API Service",
    description: "RESTful API service with database integration",
    supportsLocal: true,
  },
  {
    id: "microservice",
    name: "Microservice",
    description: "Containerized microservice with monitoring",
    supportsLocal: true,
  },
];

/**
 * Preset configuration for markdown generation
 */
interface PresetConfig {
  services?: Array<{
    name: string;
    language: string;
    port?: number;
    framework?: string;
    subtype?: "service" | "frontend" | "worker";
  }>;
  resources?: Array<{
    name: string;
    kind: string;
    engine?: string;
  }>;
}

/**
 * Get preset configuration based on preset ID
 */
function getPresetConfig(presetId: string): PresetConfig {
  switch (presetId) {
    case "web-app":
      return {
        services: [
          {
            name: "api",
            language: "typescript",
            port: 3001,
            subtype: "service",
          },
          {
            name: "web",
            language: "typescript",
            framework: "react",
            subtype: "frontend",
          },
        ],
      };

    case "api-service":
      return {
        services: [
          {
            name: "api",
            language: "typescript",
            port: 3000,
            subtype: "service",
          },
        ],
      };

    case "microservice":
      return {
        services: [
          {
            name: "service",
            language: "typescript",
            port: 8080,
            subtype: "service",
          },
        ],
      };

    default:
      return {};
  }
}

/**
 * Generate the root README.md content for the project
 */
function generateRootReadme(projectName: string, presetId: string): string {
  const now = new Date().toISOString();

  const frontmatter = {
    type: "project",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    tags: [presetId],
  };

  const body = `# ${projectName}

This is the specification for **${projectName}**, initialized from the \`${presetId}\` preset.

## Directory Structure

The \`.arbiter/\` directory contains your project specification as markdown files:

- **README.md** - This file (project root entity)
- **{service-name}/** - Service containers with their endpoints
- **{name}.md** - Leaf entities (resources, tasks, notes)

## Getting Started

1. Add services: \`arbiter add service my-service --language typescript\`
2. Add endpoints: \`arbiter add endpoint get-users --service my-service --path /users --methods GET\`
3. Add resources: \`arbiter add resource postgres --kind database --engine postgres\`
4. Add tasks: \`arbiter add task "Implement authentication"\`

## Viewing Your Spec

- **CLI**: \`arbiter list services\`, \`arbiter list endpoints\`
- **Obsidian**: Open the \`.arbiter/\` folder as a vault
- **Docsify**: Run \`arbiter view\` to start a local documentation server
`;

  return createMarkdownFile(frontmatter, body);
}

/**
 * Generate a service directory with README.md
 */
function generateServiceReadme(
  service: NonNullable<PresetConfig["services"]>[number],
  parentDir: string,
): { path: string; content: string } {
  const now = new Date().toISOString();

  const frontmatter: Record<string, unknown> = {
    type: "service",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    language: service.language,
    subtype: service.subtype || "service",
  };

  if (service.port) {
    frontmatter.port = service.port;
  }
  if (service.framework) {
    frontmatter.framework = service.framework;
  }

  const body = `# ${service.name}

${service.subtype === "frontend" ? "Frontend application" : "Backend service"} for the project.

## Configuration

- **Language**: ${service.language}
${service.port ? `- **Port**: ${service.port}` : ""}
${service.framework ? `- **Framework**: ${service.framework}` : ""}

## Endpoints

Add endpoints to this service using:

\`\`\`bash
arbiter add endpoint my-endpoint --service ${service.name} --path /api/example --methods GET,POST
\`\`\`
`;

  return {
    path: path.join(parentDir, service.name, "README.md"),
    content: createMarkdownFile(frontmatter, body),
  };
}

/**
 * Generate a resource markdown file
 */
function generateResourceMarkdown(
  resource: NonNullable<PresetConfig["resources"]>[number],
  parentDir: string,
): { path: string; content: string } {
  const now = new Date().toISOString();

  const frontmatter: Record<string, unknown> = {
    type: "resource",
    entityId: uuidv4(),
    createdAt: now,
    updatedAt: now,
    kind: resource.kind,
  };

  if (resource.engine) {
    frontmatter.engine = resource.engine;
  }

  const body = `# ${resource.name}

Infrastructure resource of type \`${resource.kind}\`.

${resource.engine ? `**Engine**: ${resource.engine}` : ""}
`;

  return {
    path: path.join(parentDir, `${resource.name}.md`),
    content: createMarkdownFile(frontmatter, body),
  };
}

/**
 * Create project locally with markdown-first storage
 */
async function createProjectLocally(
  projectName: string,
  preset: (typeof PRESETS)[number],
): Promise<number> {
  const arbiterDir = path.join(process.cwd(), ".arbiter");
  const readmePath = path.join(arbiterDir, "README.md");

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

  // Generate and write the root README.md
  const rootContent = generateRootReadme(projectName, preset.id);
  await fs.writeFile(readmePath, rootContent, "utf-8");

  // Generate preset-specific entities
  const presetConfig = getPresetConfig(preset.id);

  // Create services
  if (presetConfig.services) {
    for (const service of presetConfig.services) {
      const { path: servicePath, content } = generateServiceReadme(service, arbiterDir);
      await fs.ensureDir(path.dirname(servicePath));
      await fs.writeFile(servicePath, content, "utf-8");
    }
  }

  // Create resources
  if (presetConfig.resources) {
    for (const resource of presetConfig.resources) {
      const { path: resourcePath, content } = generateResourceMarkdown(resource, arbiterDir);
      await fs.writeFile(resourcePath, content, "utf-8");
    }
  }

  showProjectCreatedMessage(projectName, preset.name);
  return 0;
}

/**
 * Display project creation success message
 */
function showProjectCreatedMessage(projectName: string, presetName: string): void {
  console.log(chalk.green(`\n✓ Created project "${projectName}" from ${presetName} preset`));
  console.log(chalk.dim("\n💡 Your project has been created with markdown-first storage"));
  console.log(chalk.dim("   Use 'arbiter list services' to see what was generated"));
  console.log(chalk.dim("   Use 'arbiter add <entity>' to add more components"));
  console.log(chalk.dim("   Use 'arbiter view' to browse your spec in a web browser"));
}

/**
 * Create project via API
 */
async function createProjectWithApi(
  config: CLIConfig,
  projectName: string,
  preset: (typeof PRESETS)[number],
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
    if (options.listPresets) {
      listPresets();
      return 0;
    }

    // Validate preset selection
    if (!options.preset) {
      console.error(chalk.red("Please choose an init preset using --preset <id>."));
      printPresetList();
      return 1;
    }

    const preset = PRESETS.find((p) => p.id === options.preset);
    if (!preset) {
      console.error(chalk.red(`Unknown preset: ${options.preset}`));
      printPresetList();
      return 1;
    }

    const projectName = displayName || options.name || path.basename(process.cwd());

    // Default to local mode - only use API if explicitly configured and preset doesn't support local
    const useLocalMode = config?.localMode !== false && preset.supportsLocal;

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
export function listPresets(): void {
  printPresetList();
  console.log();
  console.log(chalk.dim("Usage: arbiter init <name> --preset <preset-id>"));
  console.log(chalk.dim("Example: arbiter init my-app --preset web-app"));
}

function printPresetList(): void {
  console.log(chalk.cyan("Available presets:"));
  console.log();

  PRESETS.forEach((preset) => {
    const localBadge = preset.supportsLocal ? chalk.dim(" [local]") : chalk.dim(" [api-only]");
    console.log(`${chalk.green(preset.id.padEnd(15))} ${preset.description}${localBadge}`);
  });
}
