/**
 * @packageDocumentation
 * Interactive prompts for `arbiter init --prompt` command.
 *
 * Uses inquirer to guide users through project type selection and
 * drill down to specific framework/language choices.
 */

import inquirer from "inquirer";

/**
 * Project archetype definitions
 */
export type ProjectType = "cli-tool" | "web-app" | "api-service" | "full-stack" | "monorepo";

/**
 * Result from interactive init flow
 */
export interface InteractiveInitResult {
  projectName: string;
  projectType: ProjectType;
  language?: string;
  backend?: string;
  frontend?: string;
  buildSystem?: string;
  database?: string;
  /** Resolved preset ID for simple presets */
  presetId?: string;
  /** For full-stack/monorepo, selections for module composer */
  moduleSelections?: {
    backend?: string;
    frontend?: string;
    database?: string;
    infra?: string[];
    build?: string[];
  };
}

/**
 * Backend language choices
 */
const BACKEND_LANGUAGES = [
  { name: "TypeScript (Node.js/Bun)", value: "typescript" },
  { name: "Python", value: "python" },
  { name: "Rust", value: "rust" },
  { name: "Go", value: "go" },
  { name: "Kotlin", value: "kotlin" },
] as const;

/**
 * Backend frameworks grouped by language
 */
const BACKEND_FRAMEWORKS_BY_LANGUAGE: Record<string, Array<{ name: string; value: string }>> = {
  typescript: [
    { name: "Hono", value: "node-hono" },
    { name: "Express", value: "node-express" },
  ],
  python: [{ name: "FastAPI", value: "python-fastapi" }],
  rust: [{ name: "Axum", value: "rust-axum" }],
  go: [{ name: "Chi", value: "go-chi" }],
  kotlin: [{ name: "Ktor", value: "kotlin-ktor" }],
};

/**
 * Frontend framework choices
 */
const FRONTEND_FRAMEWORKS = [
  { name: "React + Vite", value: "react-vite" },
  { name: "Vue + Vite", value: "vue-vite" },
  { name: "Solid + Vite", value: "solid-vite" },
] as const;

/**
 * Build system choices for monorepos
 */
const BUILD_SYSTEMS = [
  { name: "Turborepo", value: "turborepo" },
  { name: "Nx", value: "nx" },
  { name: "Bazel", value: "bazel" },
] as const;

/**
 * Database choices
 */
const DATABASES = [
  { name: "None", value: "none" },
  { name: "PostgreSQL", value: "postgres" },
  { name: "SQLite", value: "sqlite" },
  { name: "MongoDB", value: "mongodb" },
] as const;

/**
 * Map CLI language to preset ID
 */
function getCliPresetId(language: string): string {
  const presetMap: Record<string, string> = {
    typescript: "cli-node",
    python: "cli-python",
    rust: "cli-rust",
    go: "cli-go",
  };
  return presetMap[language] || "cli-node";
}

/**
 * Run the interactive init flow
 */
export async function runInteractiveInit(): Promise<InteractiveInitResult> {
  // Step 1: Get project name
  const { projectName } = await inquirer.prompt<{ projectName: string }>([
    {
      type: "input",
      name: "projectName",
      message: "Project name:",
      validate: (input: string) => (input.trim() ? true : "Project name is required"),
    },
  ]);

  // Step 2: Select project type
  const { projectType } = await inquirer.prompt<{ projectType: ProjectType }>([
    {
      type: "list",
      name: "projectType",
      message: "What type of project are you building?",
      choices: [
        { name: "CLI Tool - Command-line application", value: "cli-tool" },
        { name: "Web App - Frontend web application", value: "web-app" },
        { name: "API Service - Backend API service", value: "api-service" },
        { name: "Full-Stack - Frontend + Backend", value: "full-stack" },
        { name: "Monorepo - Multi-package workspace", value: "monorepo" },
      ],
    },
  ]);

  // Step 3: Drill down based on project type
  switch (projectType) {
    case "cli-tool":
      return promptCliTool(projectName);
    case "web-app":
      return promptWebApp(projectName);
    case "api-service":
      return promptApiService(projectName);
    case "full-stack":
      return promptFullStack(projectName);
    case "monorepo":
      return promptMonorepo(projectName);
    default:
      throw new Error(`Unknown project type: ${projectType}`);
  }
}

/**
 * Prompt for CLI tool options
 */
async function promptCliTool(projectName: string): Promise<InteractiveInitResult> {
  const { language } = await inquirer.prompt<{ language: string }>([
    {
      type: "list",
      name: "language",
      message: "Select language:",
      choices: BACKEND_LANGUAGES.filter((l) => l.value !== "kotlin"), // No Kotlin CLI preset
    },
  ]);

  return {
    projectName,
    projectType: "cli-tool",
    language,
    presetId: getCliPresetId(language),
  };
}

/**
 * Prompt for web app options
 */
async function promptWebApp(projectName: string): Promise<InteractiveInitResult> {
  const { frontend } = await inquirer.prompt<{ frontend: string }>([
    {
      type: "list",
      name: "frontend",
      message: "Select frontend framework:",
      choices: FRONTEND_FRAMEWORKS,
    },
  ]);

  return {
    projectName,
    projectType: "web-app",
    language: "typescript",
    frontend,
    presetId: "web-app",
    moduleSelections: {
      frontend,
    },
  };
}

/**
 * Prompt for backend language and framework
 */
async function promptBackend(): Promise<{ language: string; backend: string }> {
  const { language } = await inquirer.prompt<{ language: string }>([
    {
      type: "list",
      name: "language",
      message: "Select backend language:",
      choices: BACKEND_LANGUAGES,
    },
  ]);

  const frameworks = BACKEND_FRAMEWORKS_BY_LANGUAGE[language] || [];

  // If only one framework for this language, auto-select it
  if (frameworks.length === 1) {
    console.log(`  Using ${frameworks[0].name} for ${language}`);
    return { language, backend: frameworks[0].value };
  }

  const { backend } = await inquirer.prompt<{ backend: string }>([
    {
      type: "list",
      name: "backend",
      message: "Select backend framework:",
      choices: frameworks,
    },
  ]);

  return { language, backend };
}

/**
 * Prompt for API service options
 */
async function promptApiService(projectName: string): Promise<InteractiveInitResult> {
  const { language, backend } = await promptBackend();

  const { database } = await inquirer.prompt<{ database: string }>([
    {
      type: "list",
      name: "database",
      message: "Select database:",
      choices: DATABASES,
    },
  ]);

  return {
    projectName,
    projectType: "api-service",
    language,
    backend,
    database,
    presetId: "api-service",
    moduleSelections: {
      backend,
      database,
    },
  };
}

/**
 * Prompt for full-stack options
 */
async function promptFullStack(projectName: string): Promise<InteractiveInitResult> {
  const { language, backend } = await promptBackend();

  const { frontend } = await inquirer.prompt<{ frontend: string }>([
    {
      type: "list",
      name: "frontend",
      message: "Select frontend framework:",
      choices: [...FRONTEND_FRAMEWORKS, { name: "None (API only)", value: "none" }],
    },
  ]);

  const { database } = await inquirer.prompt<{ database: string }>([
    {
      type: "list",
      name: "database",
      message: "Select database:",
      choices: DATABASES,
    },
  ]);

  return {
    projectName,
    projectType: "full-stack",
    language,
    backend,
    frontend: frontend === "none" ? undefined : frontend,
    database,
    moduleSelections: {
      backend,
      frontend: frontend === "none" ? undefined : frontend,
      database,
    },
  };
}

/**
 * Prompt for monorepo options
 */
async function promptMonorepo(projectName: string): Promise<InteractiveInitResult> {
  const { buildSystem } = await inquirer.prompt<{ buildSystem: string }>([
    {
      type: "list",
      name: "buildSystem",
      message: "Select build system:",
      choices: BUILD_SYSTEMS,
    },
  ]);

  // Ask what packages to include
  const { includeBackend, includeFrontend } = await inquirer.prompt<{
    includeBackend: boolean;
    includeFrontend: boolean;
  }>([
    {
      type: "confirm",
      name: "includeBackend",
      message: "Include backend package?",
      default: true,
    },
    {
      type: "confirm",
      name: "includeFrontend",
      message: "Include frontend package?",
      default: true,
    },
  ]);

  let language: string | undefined;
  let backend: string | undefined;
  let frontend: string | undefined;

  if (includeBackend) {
    const backendResult = await promptBackend();
    language = backendResult.language;
    backend = backendResult.backend;
  }

  if (includeFrontend) {
    const answers = await inquirer.prompt<{ frontend: string }>([
      {
        type: "list",
        name: "frontend",
        message: "Select frontend framework:",
        choices: FRONTEND_FRAMEWORKS,
      },
    ]);
    frontend = answers.frontend;
    // If no backend, language defaults to typescript for frontend
    if (!language) {
      language = "typescript";
    }
  }

  return {
    projectName,
    projectType: "monorepo",
    language,
    buildSystem,
    backend,
    frontend,
    moduleSelections: {
      backend,
      frontend,
      build: [buildSystem],
    },
  };
}
