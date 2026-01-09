/**
 * @packageDocumentation
 * CI/CD workflow generation for GitHub Actions.
 *
 * Generates continuous integration workflows including:
 * - Build and test pipelines
 * - Lint and type-checking steps
 * - Deployment configurations
 */

import path from "node:path";
import {
  getBuildCommand,
  getInstallCommand,
  getLintCommand,
  getTestCommand,
} from "@/services/generate/helpers/commands.js";
import { parseDeploymentServiceConfig } from "@/services/generate/infrastructure/terraform.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { slugify } from "@/services/generate/util/shared.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import type { AppSpec, ConfigWithVersion, ServiceArtifactType } from "@arbiter/shared";
import fs from "fs-extra";
import * as YAML from "yaml";

const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

export const ARBITER_APP_JOB_ID = "arbiter_app";
export const ARBITER_SERVICE_JOB_PREFIX = "arbiter_service_";

export interface ServiceSummary {
  name: string;
  displayName: string;
  slug: string;
  language: string;
  buildTool?: string;
  workingDirectory?: string;
  artifactType: ServiceArtifactType;
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

/**
 * Result of loading an existing workflow file
 */
interface WorkflowLoadResult {
  content: string;
  workflow: Record<string, any>;
}

/**
 * Parse YAML content safely, returning empty object on invalid structure
 */
function parseWorkflowYaml(content: string): Record<string, any> {
  const parsed = YAML.parse(content);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, any>;
  }
  return {};
}

/**
 * Load existing workflow file if it exists
 */
async function loadExistingWorkflow(workflowPath: string): Promise<WorkflowLoadResult> {
  if (!fs.existsSync(workflowPath)) {
    return { content: "", workflow: {} };
  }

  try {
    const content = await fs.readFile(workflowPath, "utf-8");
    return { content, workflow: parseWorkflowYaml(content) };
  } catch (error) {
    reporter.warn(
      `⚠️  Unable to parse existing workflow at ${workflowPath}: ${
        error instanceof Error ? error.message : String(error)
      }\n    A fresh workflow will be generated.`,
    );
    return { content: "", workflow: {} };
  }
}

/**
 * Create or update the main application job
 */
function createAppJob(
  applicationName: string,
  primaryLanguage: string,
  buildTool: string | undefined,
  jobs: Record<string, any>,
  managedJobIds: Set<string>,
): void {
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
}

/**
 * Create or update jobs for each managed service
 */
function createServiceJobs(
  services: ServiceSummary[],
  buildTool: string | undefined,
  jobs: Record<string, any>,
  managedJobIds: Set<string>,
): void {
  for (const service of services) {
    const jobId = `${ARBITER_SERVICE_JOB_PREFIX}${service.slug}`;

    if (service.artifactType !== "internal") {
      delete jobs[jobId];
      continue;
    }

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
}

/**
 * Remove stale managed jobs that are no longer needed
 */
function removeStaleJobs(jobs: Record<string, any>, managedJobIds: Set<string>): void {
  for (const existingJobId of Object.keys(jobs)) {
    if (isManagedWorkflowJob(existingJobId) && !managedJobIds.has(existingJobId)) {
      delete jobs[existingJobId];
    }
  }
}

/**
 * Serialize workflow to YAML with header comment
 */
function serializeWorkflow(workflow: Record<string, any>, applicationName: string): string {
  const headerComment = `# ${applicationName} CI workflow\n# Arbiter-managed jobs (prefixed with '${ARBITER_SERVICE_JOB_PREFIX}' and '${ARBITER_APP_JOB_ID}') are kept in sync with your specifications.\n`;
  return headerComment + YAML.stringify(workflow, { indent: 2, lineWidth: 0 }).trimEnd() + "\n";
}

/**
 * Check if workflow content has changed
 */
function hasWorkflowChanged(existingContent: string, newContent: string): boolean {
  const normalizedExisting = existingContent
    ? existingContent.replace(/\r\n/g, "\n").trimEnd() + "\n"
    : "";
  return normalizedExisting !== newContent;
}

/**
 * Generate or update GitHub Actions workflows based on the current specification.
 *
 * The workflow writer is idempotent and only manages Arbiter-owned jobs,
 * allowing teams to add or customize additional jobs without losing changes.
 */
export async function generateCIWorkbehaviors(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
): Promise<string[]> {
  const appSpec = configWithVersion.app;
  if (!appSpec) {
    return [];
  }

  const workflowDir = path.join(outputDir, ".github", "workbehaviors");
  await ensureDirectory(workflowDir, options);

  const workflowPath = path.join(workflowDir, "ci.yml");
  const { content: existingContent, workflow } = await loadExistingWorkflow(workflowPath);

  const applicationName = appSpec.product?.name ?? "Application";
  const managedServices = extractServiceSummaries(configWithVersion);
  const primaryLanguage = inferPrimaryLanguage(appSpec, managedServices);
  const buildTool = appSpec.config?.buildTool;

  workflow.name ||= `${applicationName} CI`;
  workflow.on = ensureDefaultWorkflowTriggers(workflow.on);

  const jobs: Record<string, any> =
    workflow.jobs && typeof workflow.jobs === "object" ? { ...workflow.jobs } : {};
  const managedJobIds = new Set<string>();

  createAppJob(applicationName, primaryLanguage, buildTool, jobs, managedJobIds);
  createServiceJobs(managedServices, buildTool, jobs, managedJobIds);
  removeStaleJobs(jobs, managedJobIds);

  workflow.jobs = jobs;

  const serializedWorkflow = serializeWorkflow(workflow, applicationName);

  if (!hasWorkflowChanged(existingContent, serializedWorkflow)) {
    return [];
  }

  await writeFileWithHooks(workflowPath, serializedWorkflow, options);
  return [".github/workbehaviors/ci.yml"];
}

function buildServiceSummary(
  serviceName: string,
  rawConfig: any,
  parsed: ReturnType<typeof parseDeploymentServiceConfig>,
  defaultLanguage: string,
  defaultBuildTool: string | undefined,
): ServiceSummary {
  const language = parsed!.language || defaultLanguage;
  const buildTool = rawConfig?.buildTool || rawConfig?.build?.tool || defaultBuildTool;
  const workingDirectory =
    typeof parsed!.sourceDirectory === "string"
      ? parsed!.sourceDirectory
      : typeof rawConfig?.sourceDirectory === "string"
        ? rawConfig.sourceDirectory
        : undefined;

  return {
    name: serviceName,
    displayName: friendlyServiceName(serviceName),
    slug: slugify(serviceName, serviceName),
    language,
    buildTool,
    workingDirectory,
    artifactType: parsed!.artifactType,
  };
}

export function extractServiceSummaries(configWithVersion: ConfigWithVersion): ServiceSummary[] {
  const cueData = (configWithVersion as any)._fullCueData || {};
  const servicesInput =
    cueData.services && typeof cueData.services === "object" ? cueData.services : {};

  const defaultLanguage = configWithVersion.app.config?.language || "typescript";
  const defaultBuildTool = configWithVersion.app.config?.buildTool;

  const summaries: ServiceSummary[] = [];
  for (const [serviceName, rawConfig] of Object.entries(servicesInput)) {
    const parsed = parseDeploymentServiceConfig(serviceName, rawConfig);
    if (!parsed) {
      continue;
    }
    summaries.push(
      buildServiceSummary(serviceName, rawConfig, parsed, defaultLanguage, defaultBuildTool),
    );
  }

  return summaries;
}

export function ensureDefaultWorkflowTriggers(onConfig: any): Record<string, any> {
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

const LANGUAGE_SETUP_STEPS: Record<string, WorkflowStep[]> = {
  python: [
    { name: "Setup Python", uses: "actions/setup-python@v5", with: { "python-version": "3.11" } },
  ],
  rust: [{ name: "Setup Rust toolchain", uses: "dtolnay/rust-toolchain@stable" }],
  go: [{ name: "Setup Go", uses: "actions/setup-go@v5", with: { "go-version": "1.21" } }],
};

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
  if (language === "typescript") {
    const steps: WorkflowStep[] = [
      {
        name: "Setup Node.js",
        uses: "actions/setup-node@v4",
        with: { "node-version": "20", cache: buildTool === "bun" ? undefined : "npm" },
      },
    ];
    if (buildTool === "bun") {
      steps.push({ name: "Setup Bun", uses: "oven-sh/setup-bun@v1" });
    }
    return steps;
  }
  return LANGUAGE_SETUP_STEPS[language] ?? [];
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

export function isManagedWorkflowJob(jobId: string): boolean {
  return jobId === ARBITER_APP_JOB_ID || jobId.startsWith(ARBITER_SERVICE_JOB_PREFIX);
}

export function inferPrimaryLanguage(
  appSpec: AppSpec | undefined,
  services: ServiceSummary[],
): string {
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

export function friendlyServiceName(name: string): string {
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatLanguage(language: string): string {
  if (!language) {
    return "Unknown";
  }
  return language.charAt(0).toUpperCase() + language.slice(1);
}
