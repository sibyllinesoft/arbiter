/**
 * Test runner and workspace manifest generation.
 * Extracted from index.ts for modularity.
 */

import path from "node:path";
import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify } from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type {
  CLIConfig,
  GeneratorConfig,
  GeneratorTestingConfig,
  LanguageTestingConfig,
  MasterTestRunnerConfig,
  ProjectStructureConfig,
} from "@/types.js";
import {
  type PackageManagerCommandSet,
  detectPackageManager,
  getPackageManagerCommands,
} from "@/utils/io/package-manager.js";
import { type AppSpec, getPackages } from "@arbiter/specification";
import fs from "fs-extra";

const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

export type TestTask = {
  name: string;
  command: string;
  cwd: string;
};

export function buildDefaultTestCommands(
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

export function getPluginTestingConfig(
  generatorConfig: GeneratorConfig | undefined,
  language: string,
): LanguageTestingConfig | undefined {
  return generatorConfig?.plugins?.[language]?.testing;
}

export function getMasterRunnerConfig(
  testing: GeneratorTestingConfig | undefined,
): MasterTestRunnerConfig | undefined {
  return testing?.master;
}

export function resolveTestingCommand(
  language: string,
  config: LanguageTestingConfig | undefined,
  defaults: Record<string, string>,
): string | undefined {
  if (config?.command && config.command.trim().length > 0) {
    return config.command.trim();
  }
  return defaults[language];
}

export function isWorkspaceFriendlyLanguage(language?: string): boolean {
  if (!language) return true;
  const normalized = language.toLowerCase();
  return normalized === "typescript" || normalized === "javascript" || normalized === "node";
}

export async function buildClientTestTasks(
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

export async function buildEndpointAssertionTask(
  appSpec: AppSpec,
  outputDir: string,
  structure: ProjectStructureConfig,
  generatorConfig: GeneratorConfig | undefined,
  packageManager: PackageManagerCommandSet,
): Promise<TestTask | null> {
  // Collect TypeScript packages
  const tsServices = Object.entries(getPackages(appSpec)).filter(
    ([, pkg]) => ((pkg as any)?.language as string | undefined)?.toLowerCase() === "typescript",
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

export function createNodeRunnerScript(tasks: TestTask[]): string {
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
    "    console.info('\\n▶ ' + task.name + ' (cwd: ' + (task.cwd || '.') + ')');",
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
    "    console.info('No automated tests are configured yet.');",
    "    return;",
    "  }",
    "  for (const task of tasks) {",
    "    await runTask(task);",
    "  }",
    "  console.info('\\n✅ All tests completed successfully');",
    "}",
    "",
    "main().catch(error => {",
    "  console.error('\\n❌ ' + error.message);",
    "  process.exit(1);",
    "});",
    "",
  ].join("\n");
}

/**
 * Build test tasks for all packages in the app spec.
 */
export function buildServiceTestTasks(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  generatorConfig: GeneratorConfig | undefined,
  defaultTestCommands: Record<string, string>,
): TestTask[] {
  const tasks: TestTask[] = [];

  const packageEntries = Object.entries(getPackages(appSpec));
  for (const [packageName, packageConfig] of packageEntries) {
    if (!packageConfig || typeof packageConfig !== "object") continue;

    const slug = slugify(packageName, packageName);
    const language =
      ((packageConfig as any).language as string | undefined)?.toLowerCase() ?? "typescript";
    const languageConfig = getPluginTestingConfig(generatorConfig, language);
    const testCommand = resolveTestingCommand(language, languageConfig, defaultTestCommands);

    if (!testCommand) continue;

    tasks.push({
      name: `test-package-${slug}`,
      command: testCommand,
      cwd: joinRelativePath(structure.packagesDirectory, slug),
    });
  }

  return tasks;
}

/**
 * Generate a single Makefile task entry.
 */
function generateMakefileTask(task: TestTask): string {
  const cwd = task.cwd || ".";
  const command = cwd === "." ? task.command : `(cd ${cwd} && ${task.command})`;
  return `${task.name}:\n\t${command}\n\n`;
}

/**
 * Generate Makefile content from tasks and configuration.
 */
export function generateMakefileContent(
  tasks: TestTask[],
  pm: PackageManagerCommandSet,
  testsWorkspace?: string,
): string {
  const aggregatorTargets = ["test", "lint", "build", "test-e2e"];
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

  for (const task of tasks) {
    makefile += generateMakefileTask(task);
  }

  return makefile;
}

/**
 * Write Node.js test runner script and return relative path.
 */
async function writeNodeRunner(
  outputDir: string,
  outputPath: string,
  tasks: TestTask[],
  options: GenerateOptions,
): Promise<string> {
  const scriptPath = path.join(outputDir, outputPath);
  await ensureDirectory(path.dirname(scriptPath), options);

  const scriptContent = createNodeRunnerScript(tasks);
  await writeFileWithHooks(scriptPath, scriptContent, options, 0o755);

  if (options.verbose) {
    reporter.info(`🧰 Master test runner written to ${scriptPath}`);
  }

  const relativePath = path.relative(outputDir, scriptPath).replace(/\\/g, "/");
  return relativePath.length > 0 ? relativePath : path.basename(scriptPath);
}

/**
 * Write Makefile and return relative path.
 */
async function writeMakefile(
  outputDir: string,
  outputPath: string,
  content: string,
  options: GenerateOptions,
): Promise<string> {
  const makefilePath = path.join(outputDir, outputPath);
  await ensureDirectory(path.dirname(makefilePath), options);

  await writeFileWithHooks(makefilePath, content, options);

  if (options.verbose) {
    reporter.info(`🧰 Master test runner written to ${makefilePath}`);
  }

  const relativePath = path.relative(outputDir, makefilePath).replace(/\\/g, "/");
  return relativePath.length > 0 ? relativePath : path.basename(makefilePath);
}

export async function generateMasterTestRunner(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  testsWorkspace?: string,
  clientTargets: ClientGenerationTarget[] = [],
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const generatorConfig = cliConfig.generator;
  const masterConfig = getMasterRunnerConfig(generatorConfig?.testing);
  const runnerType = masterConfig?.type ?? "make";

  const pm =
    packageManager ?? getPackageManagerCommands(detectPackageManager(undefined, outputDir));
  const defaultTestCommands = buildDefaultTestCommands(pm);

  // Build all test tasks
  const tasks: TestTask[] = buildServiceTestTasks(
    appSpec,
    structure,
    generatorConfig,
    defaultTestCommands,
  );

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

  // Generate output based on runner type
  if (runnerType === "node") {
    const outputPath = masterConfig?.output ?? path.join("tests", "run-all.mjs");
    const relativePath = await writeNodeRunner(outputDir, outputPath, tasks, options);
    return [relativePath];
  }

  const outputPath = masterConfig?.output ?? "Makefile";
  const makefileContent = generateMakefileContent(tasks, pm, testsWorkspace);
  const relativePath = await writeMakefile(outputDir, outputPath, makefileContent, options);
  return [relativePath];
}

interface WorkspaceCollectionResult {
  workspaces: string[];
  unitWorkspaces: string[];
}

function collectWorkspaces(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  clientTargets: ClientGenerationTarget[],
  testsWorkspace?: string,
): WorkspaceCollectionResult {
  const workspaceSet = new Set<string>();
  const unitWorkspaceSet = new Set<string>();

  const addUnitWorkspace = (workspace: string) => {
    workspaceSet.add(workspace);
    unitWorkspaceSet.add(workspace);
  };

  for (const target of clientTargets) {
    addUnitWorkspace(target.relativeRoot);
  }

  // Collect packages
  if (getPackages(appSpec)) {
    for (const [packageName, packageSpec] of Object.entries(getPackages(appSpec))) {
      if (!isWorkspaceFriendlyLanguage((packageSpec as any)?.language as string | undefined))
        continue;
      const slug = slugify(packageName, packageName);
      addUnitWorkspace(joinRelativePath(structure.packagesDirectory, slug));
    }
  }

  if (testsWorkspace) {
    workspaceSet.add(testsWorkspace);
  }

  return {
    workspaces: Array.from(workspaceSet).sort(),
    unitWorkspaces: Array.from(unitWorkspaceSet).sort(),
  };
}

function createWorkspaceScriptRunner(
  pm: PackageManagerCommandSet,
  workspaces: string[],
): (script: string) => string {
  const workspaceCommandBuilders: Record<string, (script: string) => string> = {
    npm: (script) => `${pm.run(script)} --workspaces --if-present`,
    pnpm: (script) => `pnpm run -r --if-present ${script}`,
    yarn: (script) => `yarn workspaces run ${script}`,
  };

  return (script: string): string => {
    const builder = workspaceCommandBuilders[pm.name];
    return builder
      ? builder(script)
      : workspaces.map((workspace) => `(cd ${workspace} && ${pm.run(script)})`).join(" && ");
  };
}

function buildWorkspaceScripts(
  pm: PackageManagerCommandSet,
  workspaces: string[],
  unitWorkspaces: string[],
  testsWorkspace?: string,
): Record<string, string> {
  const runAcrossAll = createWorkspaceScriptRunner(pm, workspaces);

  const unitTestCommand =
    unitWorkspaces.length > 0
      ? unitWorkspaces.map((ws) => `(cd ${ws} && ${pm.run("test")})`).join(" && ")
      : 'echo "No unit test workspaces defined yet."';

  const scripts: Record<string, string> = {
    lint: runAcrossAll("lint"),
    build: runAcrossAll("build"),
    test: unitTestCommand,
    format: runAcrossAll("format"),
  };

  if (testsWorkspace) {
    scripts["test:e2e"] = `(cd ${testsWorkspace} && ${pm.run("test")})`;
  }

  return scripts;
}

export async function generateWorkspaceManifest(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTargets: ClientGenerationTarget[],
  testsWorkspace?: string,
  packageManager?: PackageManagerCommandSet,
): Promise<string[]> {
  const pm =
    packageManager ?? getPackageManagerCommands(detectPackageManager(undefined, outputDir));
  const { workspaces, unitWorkspaces } = collectWorkspaces(
    appSpec,
    structure,
    clientTargets,
    testsWorkspace,
  );

  if (workspaces.length === 0) {
    return [];
  }

  const scripts = buildWorkspaceScripts(pm, workspaces, unitWorkspaces, testsWorkspace);
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
