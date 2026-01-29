/**
 * @packageDocumentation
 * Init command - Initialize new Arbiter projects from templates.
 *
 * Provides functionality to:
 * - Initialize projects from predefined presets
 * - Support web-app, mobile-app, api-service, microservice templates
 * - Configure project structure and dependencies
 * - Handle both local and server-assisted initialization
 */

import path from "node:path";
import { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig, InitOptions } from "@/types.js";
import { withProgress } from "@/utils/api/progress.js";
import chalk from "chalk";
import fs from "fs-extra";

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
 * Generate local preset CUE content based on preset type
 */
function generatePresetContent(projectName: string, presetId: string): string {
  const packageName = projectName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = projectName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const baseSpec = `package ${packageName}

product: {
	name: "${projectName}"
	goals: [
		"Application goals will be defined here"
	]
}

metadata: {
	name: "${slug}"
	version: "1.0.0"
}

config: {
	language: "typescript"
	kind: "${presetId === "web-app" ? "fullstack" : "service"}"
}

deployment: {
	target: "kubernetes"
}
`;

  switch (presetId) {
    case "web-app":
      return `${baseSpec}
services: {
	api: {
		type: "internal"
		language: "typescript"
		workload: "deployment"
		sourceDirectory: "./src/api"
		ports: [{
			name: "http"
			port: 3001
			targetPort: 3001
		}]
	}
}

clients: {
	web: {
		subtype: "frontend"
		framework: "react"
		language: "typescript"
		sourceDirectory: "./src/web"
	}
}

ui: {
	routes: [{
		id: "app:home"
		path: "/"
		capabilities: ["view"]
		components: ["HomePage"]
	}]
}

locators: {
	"page:home": "[data-testid=\\"home-page\\"]"
	"btn:start": "[data-testid=\\"start-button\\"]"
}
`;

    case "api-service":
      return `${baseSpec}
services: {
	api: {
		type: "internal"
		language: "typescript"
		workload: "deployment"
		sourceDirectory: "./src/api"
		ports: [{
			name: "http"
			port: 3000
			targetPort: 3000
		}]
	}
}

paths: {
	api: {
		"/health": {
			get: {
				summary: "Health check endpoint"
			}
		}
	}
}
`;

    case "microservice":
      return `${baseSpec}
services: {
	service: {
		type: "internal"
		language: "typescript"
		workload: "deployment"
		sourceDirectory: "./src/service"
		ports: [{
			name: "http"
			port: 8080
			targetPort: 8080
		}]
		resources: {
			limits: {
				cpu: "500m"
				memory: "512Mi"
			}
			requests: {
				cpu: "100m"
				memory: "128Mi"
			}
		}
	}
}

observability: {
	logging: {
		level: "info"
		format: "json"
	}
	monitoring: {
		enabled: true
		metricsPath: "/metrics"
	}
}
`;

    default:
      return baseSpec;
  }
}

/**
 * Create project locally without API server
 */
async function createProjectLocally(
  projectName: string,
  preset: (typeof PRESETS)[number],
): Promise<number> {
  const arbiterDir = path.join(process.cwd(), ".arbiter");
  const assemblyPath = path.join(arbiterDir, "assembly.cue");

  // Check if .arbiter directory already exists
  if (await fs.pathExists(assemblyPath)) {
    console.error(chalk.red("Project already initialized. Found existing .arbiter/assembly.cue"));
    return 1;
  }

  // Create .arbiter directory
  await fs.ensureDir(arbiterDir);

  // Generate and write the preset content
  const content = generatePresetContent(projectName, preset.id);
  await fs.writeFile(assemblyPath, content, "utf-8");

  showProjectCreatedMessage(projectName, preset.name);
  return 0;
}

// validateInitRequirements removed - validation moved inline to initCommand

/**
 * Display project creation success message
 */
function showProjectCreatedMessage(projectName: string, presetName: string): void {
  console.log(chalk.green(`\n✓ Created project "${projectName}" from ${presetName} preset`));
  console.log(chalk.dim("\n💡 Your project has been created with a full specification"));
  console.log(chalk.dim("   Use 'arbiter list <type>' to see what was generated"));
  console.log(chalk.dim("   Use 'arbiter generate' to create code from the specification"));
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
 * Initialize a new CUE project from a preset
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
