/**
 * High-level artifact generation functions for documentation, tooling, and infrastructure.
 * Extracted from index.ts for modularity.
 */

import path from "node:path";
import { generateDockerComposeArtifacts } from "@/services/generate/core/compose/compose.js";
import { generateTerraformArtifacts } from "@/services/generate/infrastructure/terraform.js";
import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import { ensureDirectory, writeFileWithHooks } from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify } from "@/services/generate/util/shared.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import type { AppSpec, ConfigWithVersion } from "@arbiter/specification";
import fs from "fs-extra";

/**
 * Build product goals markdown section
 */
function buildGoalsSection(goals: string[] | undefined): string {
  if (!goals?.length) return "";
  return `## Product Goals\n\n${goals.map((goal) => `- ${goal}`).join("\n")}\n`;
}

/**
 * Build routes markdown section
 */
function buildRoutesSection(routes: any[] | undefined): string {
  if (!routes?.length) return "";
  const routeLines = routes.map((route: any) => {
    const routePath = route.path ?? route.id ?? "";
    const displayName = route.name ?? route.id ?? routePath;
    return `- \`${routePath}\`: ${displayName}`;
  });
  return `## Routes\n\n${routeLines.join("\n")}\n`;
}

/**
 * Build packages markdown section.
 */
function buildPackagesSection(packages: Record<string, any> | undefined): string {
  if (!packages || Object.keys(packages).length === 0) return "";

  const lines: string[] = [];
  for (const [name, pkg] of Object.entries(packages)) {
    const subtype = pkg?.subtype ? ` (${pkg.subtype})` : "";
    lines.push(`- **${name}**${subtype}: ${pkg?.description || pkg?.framework || "Package"}`);
  }

  return `## Packages\n\n${lines.join("\n")}\n`;
}

/**
 * Build overview markdown content
 */
function buildOverviewContent(appSpec: AppSpec): string {
  const header = `# ${appSpec.product.name}\n\n${appSpec.product.description || "Auto-generated documentation overview."}\n`;
  return [
    header,
    buildGoalsSection(appSpec.product.goals),
    buildRoutesSection((appSpec as any).ui?.routes),
    buildPackagesSection(appSpec.packages),
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build a single flow section
 */
function buildFlowSection(flow: any): string {
  const steps = flow.steps
    ?.map((step: any, idx: number) => `  ${idx + 1}. ${JSON.stringify(step)}`)
    .join("\n");
  const stepsBlock = steps ? `**Steps:**\n${steps}\n` : "";
  return `## ${flow.id}\n\n${flow.description || "Generated flow"}\n\n${stepsBlock}`;
}

/**
 * Build behaviors markdown content
 */
function buildBehaviorsContent(behaviors: any[]): string {
  return ["# User Flows", "", ...behaviors.map(buildFlowSection)].join("\n");
}

/**
 * Generate documentation artifacts (overview.md, behaviors.md, etc.)
 */
export async function generateDocumentationArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const files: string[] = [];
  const docsRoot = path.join(outputDir, structure.docsDirectory);
  await ensureDirectory(docsRoot, options);

  // Write overview.md
  const overviewPath = path.join(docsRoot, "overview.md");
  await writeFileWithHooks(overviewPath, buildOverviewContent(appSpec), options);
  files.push(joinRelativePath(structure.docsDirectory, "overview.md"));

  // Write behaviors.md if flows exist
  if (appSpec.behaviors?.length > 0) {
    const behaviorsPath = path.join(docsRoot, "behaviors.md");
    await writeFileWithHooks(behaviorsPath, buildBehaviorsContent(appSpec.behaviors), options);
    files.push(joinRelativePath(structure.docsDirectory, "behaviors.md"));
  }

  return files;
}

/**
 * Generate tooling artifacts (tools README, automation notes).
 */
export async function generateToolingArtifacts(
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

/**
 * Generate infrastructure artifacts (Terraform, Docker Compose).
 */
export async function generateInfrastructureArtifacts(
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

  if (!cueData?.environments && !cueData?.deployments && !cueData?.services) {
    return files;
  }

  const projectName = slugify(appSpec.product?.name, "app");
  const baseConfig = {
    name: projectName,
    language: appSpec.config?.language || "typescript",
  };

  const terraformFiles = await generateTerraformArtifacts(
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

export interface HealthConfiguration {
  path: string;
  port: number;
  interval: string;
  timeout: string;
  initialDelaySeconds: number;
}

export function getTerraformWorkloadType(type: string): string {
  switch (type) {
    case "statefulset":
      return "stateful_set";
    default:
      return type;
  }
}

export async function loadDockerTemplateContent(
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

/**
 * Stub for documentation generation (handled by docs command).
 */
export async function generateDocumentation(
  _config: any,
  _outputDir: string,
  _options: GenerateOptions,
): Promise<string[]> {
  return [];
}
