/**
 * Enhanced Project Onboarding System for Arbiter
 *
 * This command provides intelligent analysis and smooth migration of existing projects
 * into the Arbiter ecosystem with minimal friction and maximum safety.
 */

import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import { syncProject } from "@/services/sync/index.js";
import type { CLIConfig } from "@/types.js";
import { ProgressBar } from "@/utils/progress.js";
import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";

interface OnboardOptions {
  projectPath?: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
  skipAnalysis?: boolean;
  interactive?: boolean;
}

interface ProjectStructure {
  root: string;
  files: string[];
  directories: string[];
  hasFile: (filename: string) => boolean;
  hasDirectory: (dirname: string) => boolean;
  hasPackage: (packageName: string) => boolean;
  hasPattern: (pattern: RegExp) => boolean;
}

interface ServiceDetection {
  name: string;
  type: "api" | "frontend" | "worker" | "database" | "cache" | "message-queue" | "unknown";
  language: string;
  framework?: string;
  port?: number;
  configFiles: string[];
  dependencies: string[];
  confidence: number;
}

interface OnboardAnalysis {
  projectType: "monorepo" | "single-service" | "unknown";
  languages: string[];
  frameworks: string[];
  services: ServiceDetection[];
  databases: string[];
  messageQueues: string[];
  cloudProviders: string[];
}

/**
 * Analyze an existing project and generate initial Arbiter specification
 */
export async function onboardCommand(options: OnboardOptions, config: CLIConfig): Promise<number> {
  const projectPath = path.resolve(options.projectPath || process.cwd());
  console.log(chalk.blue(`🚀 Analyzing project at ${projectPath}`));

  const progress = new ProgressBar({ title: "Scanning project", total: 5 });
  progress.update(0);

  // Build project structure metadata
  const structure = await analyzeProjectStructure(projectPath);
  progress.increment();

  // Detect services, databases, and infra components
  const analysis = options.skipAnalysis
    ? createEmptyAnalysis()
    : await detectServices(structure, progress);

  // Generate initial spec
  const spec = generateInitialSpec(analysis);
  progress.increment();

  // Write spec files
  const outputPath = path.join(projectPath, ".arbiter", "assembly.cue");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await safeFileOperation("write", outputPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, spec, "utf-8");
  });
  progress.increment();

  // Optionally sync manifests
  if (!options.dryRun && !config.localMode) {
    await syncProject({ verbose: options.verbose }, config);
  }
  progress.increment();

  progress.complete("Onboarding steps complete");
  console.log(chalk.green("✅ Onboarding complete!"));
  console.log(chalk.dim(`Spec written to ${outputPath}`));
  return 0;
}

async function analyzeProjectStructure(root: string): Promise<ProjectStructure> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const directories = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  return {
    root,
    files,
    directories,
    hasFile: (filename: string) => files.includes(filename),
    hasDirectory: (dirname: string) => directories.includes(dirname),
    hasPackage: (packageName: string) => files.includes(packageName),
    hasPattern: (pattern: RegExp) => files.some((f) => pattern.test(f)),
  };
}

async function detectServices(
  structure: ProjectStructure,
  progress: ProgressBar,
): Promise<OnboardAnalysis> {
  const services: ServiceDetection[] = [];
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const databases = new Set<string>();
  const messageQueues = new Set<string>();
  const cloudProviders = new Set<string>();

  // Simple heuristic-based detection
  if (structure.hasFile("package.json")) {
    languages.add("typescript");
    services.push({
      name: "api",
      type: "api",
      language: "typescript",
      framework: "fastify",
      configFiles: ["package.json"],
      dependencies: [],
      confidence: 0.8,
    });
    frameworks.add("fastify");
  }

  if (structure.hasFile("docker-compose.yml")) {
    const compose = await fs.readFile(path.join(structure.root, "docker-compose.yml"), "utf-8");
    if (/postgres/i.test(compose)) databases.add("postgres");
    if (/redis/i.test(compose))
      services.push({
        name: "cache",
        type: "cache",
        language: "unknown",
        configFiles: ["docker-compose.yml"],
        dependencies: [],
        confidence: 0.6,
      });
  }

  progress.increment();

  return {
    projectType: "single-service",
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    services,
    databases: Array.from(databases),
    messageQueues: Array.from(messageQueues),
    cloudProviders: Array.from(cloudProviders),
  };
}

function createEmptyAnalysis(): OnboardAnalysis {
  return {
    projectType: "unknown",
    languages: [],
    frameworks: [],
    services: [],
    databases: [],
    messageQueues: [],
    cloudProviders: [],
  };
}

export function generateInitialSpec(analysis: OnboardAnalysis): string {
  const services = analysis.services
    .map(
      (svc) => `
services: {
  ${svc.name}: {
    type: "${svc.type}"
    language: "${svc.language}"
    framework: "${svc.framework ?? "unknown"}"
    configFiles: [${svc.configFiles.map((f) => `"${f}"`).join(", ")}]
    dependencies: [${svc.dependencies.map((d) => `"${d}"`).join(", ")}]
  }
}
`,
    )
    .join("\n");

  return `// Generated by Arbiter onboard
project: {
  type: "${analysis.projectType}"
  languages: [${analysis.languages.map((l) => `"${l}"`).join(", ")}]
  frameworks: [${analysis.frameworks.map((f) => `"${f}"`).join(", ")}]
}

${services}
`;
}
