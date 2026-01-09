/**
 * @packageDocumentation
 * Helper utilities for GitHub template management.
 *
 * Provides functionality to:
 * - Collect template summaries from configuration
 * - Find template configurations by name
 * - Generate sample data for template testing
 * - Scaffold and copy template files
 */

import fs from "node:fs/promises";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import { getDefaultConfigPath } from "@/io/config/config.js";
import type { CLIConfig, GitHubTemplatesConfig, TemplateManagementOptions } from "@/types.js";
import { DEFAULT_TEMPLATES_CONFIG } from "@/utils/github/templates/unified-github-template-manager.js";
import chalk from "chalk";

/** Template summary for listing */
export interface TemplateSummary {
  type: string;
  name: string;
  description: string;
}

/** Template definition for scaffolding */
export interface TemplateDefinition {
  name: string;
  description: string;
}

/** Template configuration entry */
export interface TemplateConfigEntry {
  type: string;
  config: any;
}

/** Template keys for iteration */
export const TEMPLATE_KEYS = [
  "group",
  "task",
  "bugReport",
  "featureRequest",
  "pullRequest",
  "releaseNotes",
] as const;

/** Scaffold template definitions */
export const SCAFFOLD_TEMPLATES: TemplateDefinition[] = [
  { name: "base.hbs", description: "Base template for all GitHub issues" },
  { name: "group.hbs", description: "Group template with task overview" },
  { name: "task.hbs", description: "Task template with implementation details" },
  { name: "bug-report.hbs", description: "Bug report template with reproduction steps" },
  { name: "feature-request.hbs", description: "Feature request template with use cases" },
];

/**
 * Collect template summaries from configuration.
 * @param config - GitHub templates configuration
 * @returns Array of template summaries
 */
export function collectTemplateSummaries(
  config: GitHubTemplatesConfig | undefined,
): TemplateSummary[] {
  return TEMPLATE_KEYS.reduce<TemplateSummary[]>((acc, key) => {
    const ref = config?.[key] ?? DEFAULT_TEMPLATES_CONFIG[key];
    if (!ref) return acc;
    const name =
      typeof ref === "object" && "name" in ref && typeof (ref as any).name === "string"
        ? (ref as any).name
        : key;
    const description =
      typeof ref === "object" && "description" in ref ? String((ref as any).description || "") : "";
    acc.push({ type: key, name, description });
    return acc;
  }, []);
}

/**
 * Find template configuration by name.
 * @param config - GitHub templates configuration
 * @param templateName - Template name to find
 * @returns Template configuration entry or undefined
 */
export function findTemplateConfig(
  config: GitHubTemplatesConfig | undefined,
  templateName: string,
): TemplateConfigEntry | undefined {
  const normalized = templateName.toLowerCase();
  for (const key of TEMPLATE_KEYS) {
    const ref = config?.[key] ?? DEFAULT_TEMPLATES_CONFIG[key];
    if (!ref) continue;
    const name =
      typeof ref === "object" && "name" in ref && typeof (ref as any).name === "string"
        ? (ref as any).name.toLowerCase()
        : key.toLowerCase();
    if (key.toLowerCase() === normalized || name === normalized) {
      return { type: key, config: ref };
    }
  }
  return undefined;
}

/**
 * Check if a file exists.
 * @param filePath - Path to check
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

/**
 * Write file safely using constraint system.
 * @param filePath - Path to write
 * @param content - Content to write
 * @param encoding - File encoding
 */
export async function writeFileSafe(
  filePath: string,
  content: string,
  encoding: BufferEncoding = "utf-8",
): Promise<void> {
  await safeFileOperation("write", filePath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, encoding);
  });
}

/**
 * Check if target file should be skipped (exists and not forcing)
 */
async function shouldSkipExistingTarget(
  template: TemplateDefinition,
  targetPath: string,
  force: boolean,
): Promise<boolean> {
  if ((await fileExists(targetPath)) && !force) {
    console.log(chalk.yellow(`⚠️  Skipping ${template.name} (already exists)`));
    return true;
  }
  return false;
}

/**
 * Check if source template exists
 */
async function checkSourceExists(
  template: TemplateDefinition,
  sourcePath: string,
): Promise<boolean> {
  if (!(await fileExists(sourcePath))) {
    console.log(chalk.red(`❌ Source template ${template.name} not found`));
    return false;
  }
  return true;
}

/**
 * Perform the actual file copy operation
 */
async function performTemplateCopy(
  template: TemplateDefinition,
  sourcePath: string,
  targetPath: string,
  verbose: boolean,
): Promise<boolean> {
  try {
    const content = await fs.readFile(sourcePath, "utf-8");
    await writeFileSafe(targetPath, content);
    console.log(chalk.green(`✅ Created ${template.name}`));
    if (verbose) {
      console.log(chalk.dim(`   ${template.description}`));
    }
    return true;
  } catch (error) {
    console.log(
      chalk.red(
        `❌ Failed to create ${template.name}: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return false;
  }
}

/**
 * Copy template file from source to target.
 * @param template - Template definition
 * @param sourcePath - Source file path
 * @param targetPath - Target file path
 * @param options - Template management options
 * @returns True if copy succeeded
 */
export async function copyTemplateFile(
  template: TemplateDefinition,
  sourcePath: string,
  targetPath: string,
  options: TemplateManagementOptions,
): Promise<boolean> {
  if (await shouldSkipExistingTarget(template, targetPath, options.force ?? false)) {
    return false;
  }

  if (!(await checkSourceExists(template, sourcePath))) {
    return false;
  }

  return performTemplateCopy(template, sourcePath, targetPath, options.verbose ?? false);
}

/**
 * Log scaffold result summary.
 * @param created - Number of templates created
 */
export function logScaffoldResult(created: number): void {
  if (created > 0) {
    console.log(chalk.green(`\n🎉 Scaffolded ${created} template file(s)!`));
    console.log(chalk.dim("Edit the template files to customize your GitHub issue templates."));
    console.log(chalk.dim("Use 'arbiter github-templates --validate' to check your templates."));
  } else {
    console.log(chalk.yellow("\n⚠️  No templates were created."));
    console.log(chalk.dim("Use --force to overwrite existing files."));
  }
}

/**
 * Update config.json to reference template files.
 * @param config - CLI configuration
 * @param templatesDir - Templates directory path
 */
export async function updateConfigForTemplates(
  config: CLIConfig,
  templatesDir: string,
): Promise<void> {
  const configPath = getDefaultConfigPath();

  let existingConfig: any = {};
  try {
    const configContent = await fs.readFile(configPath, "utf-8");
    existingConfig = JSON.parse(configContent);
  } catch {
    existingConfig = {};
  }

  if (!existingConfig.github) {
    existingConfig.github = {};
  }
  if (!existingConfig.github.templates) {
    existingConfig.github.templates = {};
  }

  const relativeTemplatesDir = path.relative(config.projectDir, templatesDir);

  existingConfig.github.templates = {
    ...existingConfig.github.templates,
    discoveryPaths: [relativeTemplatesDir, "~/.arbiter/templates/github"],
    defaultExtension: "hbs",
    base: {
      file: "base.hbs",
      metadata: {
        name: "Arbiter Base Template",
        description: "Base template for all Arbiter-managed GitHub issues",
      },
    },
    group: {
      file: "group.hbs",
      inherits: "base.hbs",
      metadata: {
        name: "Group",
        description: "Template for group issues",
        labels: ["group", "priority:{{priority}}", "status:{{status}}"],
      },
    },
    task: {
      file: "task.hbs",
      inherits: "base.hbs",
      metadata: {
        name: "Task",
        description: "Template for task issues",
        labels: [
          "type:{{type}}",
          "priority:{{priority}}",
          "status:{{status}}",
          "group:{{groupId}}",
        ],
      },
    },
    bugReport: {
      file: "bug-report.hbs",
      metadata: {
        name: "Bug Report",
        description: "Template for bug report issues",
        labels: ["type:bug", "priority:{{priority}}"],
      },
    },
    featureRequest: {
      file: "feature-request.hbs",
      metadata: {
        name: "Feature Request",
        description: "Template for feature request issues",
        labels: ["type:feature", "priority:{{priority}}"],
      },
    },
  };

  await writeFileSafe(configPath, JSON.stringify(existingConfig, null, 2));
  console.log(chalk.dim("📝 Updated .arbiter/config.json with template references"));
}

/**
 * Get sample data for template testing.
 * @param templateType - Type of template
 * @returns Sample data object
 */
export function getSampleDataForTemplate(templateType: string): any {
  const baseData = {
    id: "sample-001",
    name: "Sample Item",
    description: "This is a sample description for testing the template.",
    priority: "high",
    status: "in_progress",
    assignee: "sample-user",
    estimatedHours: 8,
    acceptanceCriteria: [
      "First acceptance criterion",
      "Second acceptance criterion",
      "Third acceptance criterion",
    ],
    dependencies: ["Complete prerequisite task A", "Review with stakeholders"],
  };

  switch (templateType.toLowerCase()) {
    case "group":
      return {
        ...baseData,
        name: "Sample Group",
        successCriteria:
          "Group is complete when all tasks are done and users can successfully use the new feature",
        inScope: ["Feature A development", "Integration testing", "User documentation"],
        outOfScope: ["Advanced analytics", "Mobile app updates"],
        tasks: [
          {
            id: "task-001",
            name: "Implement core functionality",
            type: "feature",
            priority: "high",
            status: "todo",
            estimatedHours: 5,
          },
          {
            id: "task-002",
            name: "Add error handling",
            type: "feature",
            priority: "medium",
            status: "todo",
            estimatedHours: 3,
          },
        ],
        stakeholders: [
          { role: "Product Owner", username: "product-owner" },
          { role: "Tech Lead", username: "tech-lead" },
        ],
      };

    case "task":
      return {
        task: {
          ...baseData,
          name: "Sample Task",
          type: "feature",
          context: "This task is needed to implement the new user authentication flow.",
          implementationNotes:
            "Use the existing authentication library and extend it for SSO support.",
          testScenarios: [
            "User logs in with SSO",
            "User logs in with existing credentials",
            "Invalid credentials are handled correctly",
          ],
          technicalNotes: "Requires updating the user model and adding new API endpoints.",
          subtasks: [
            { name: "Update user model", description: "Add SSO fields to user schema" },
            { name: "Create SSO endpoints", description: "Implement /auth/sso endpoints" },
          ],
        },
        group: {
          id: "group-001",
          name: "User Authentication Group",
        },
      };

    default:
      return baseData;
  }
}
