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

/**
 * Available presets (require API server connection)
 */
const PRESETS = [
  {
    id: "web-app",
    name: "Web Application",
    description: "Full-stack web application with React frontend and Node.js backend",
  },
  {
    id: "mobile-app",
    name: "Mobile Application",
    description: "Cross-platform mobile app with React Native",
  },
  {
    id: "api-service",
    name: "API Service",
    description: "RESTful API service with database integration",
  },
  {
    id: "microservice",
    name: "Microservice",
    description: "Containerized microservice with monitoring",
  },
];

/**
 * Validate init command requirements
 */
function validateInitRequirements(
  options: InitOptions,
  config?: CLIConfig,
): { valid: false; exitCode: number } | { valid: true; preset: (typeof PRESETS)[number] } {
  if (!options.preset) {
    console.error(chalk.red("Please choose an init preset using --preset <id>."));
    printPresetList();
    return { valid: false, exitCode: 1 };
  }

  if (!config) {
    console.error(
      chalk.red("Config is required when using presets. Please run from a configured project."),
    );
    return { valid: false, exitCode: 2 };
  }

  const preset = PRESETS.find((p) => p.id === options.preset);
  if (!preset) {
    console.error(chalk.red(`Unknown preset: ${options.preset}`));
    printPresetList();
    return { valid: false, exitCode: 1 };
  }

  return { valid: true, preset };
}

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

    const validation = validateInitRequirements(options, config);
    if (!validation.valid) {
      return (validation as { valid: false; exitCode: number }).exitCode;
    }

    const projectName = displayName || options.name || path.basename(process.cwd());

    return await withProgress(
      {
        text: `Creating project "${projectName}" from ${validation.preset.name} preset...`,
        color: "green",
      },
      () => createProjectWithApi(config!, projectName, validation.preset),
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
  console.log(chalk.cyan("Available presets (require API server):"));
  console.log();

  PRESETS.forEach((preset) => {
    console.log(`${chalk.green(preset.id.padEnd(15))} ${preset.description}`);
  });
}
