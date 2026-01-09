/**
 * @packageDocumentation
 * GitHub Templates command - Manage GitHub workflow templates.
 *
 * Provides functionality to:
 * - List, show, and validate templates
 * - Scaffold template directory structures
 * - Generate example templates
 * - Add and remove custom templates
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getDefaultConfigPath, saveConfig } from "@/io/config/config.js";
import type { CLIConfig, GitHubTemplatesConfig, TemplateManagementOptions } from "@/types.js";
import { UnifiedGitHubTemplateManager } from "@/utils/github/templates/unified-github-template-manager.js";
import chalk from "chalk";
import {
  SCAFFOLD_TEMPLATES,
  collectTemplateSummaries,
  copyTemplateFile,
  findTemplateConfig,
  getSampleDataForTemplate,
  logScaffoldResult,
  updateConfigForTemplates,
  writeFileSafe,
} from "./template-helpers.js";

interface TemplateCommandContext {
  options: TemplateManagementOptions;
  config: CLIConfig;
  templatesConfig: GitHubTemplatesConfig | undefined;
  templateManager: UnifiedGitHubTemplateManager;
}

type TemplateSubcommandHandler = (ctx: TemplateCommandContext) => Promise<number>;

function getSubcommandHandler(
  options: TemplateManagementOptions,
): TemplateSubcommandHandler | null {
  if (options.list) return handleListTemplates;
  if (options.show && options.name) return handleShowTemplate;
  if (options.validate) return handleValidateTemplates;
  if (options.init || options.scaffold) return handleScaffoldTemplates;
  if (options.generate) return handleGenerateTemplateExample;
  if (options.add) return handleAddTemplate;
  if (options.remove && options.name) return handleRemoveTemplate;
  return null;
}

async function handleListTemplates(ctx: TemplateCommandContext): Promise<number> {
  return listTemplates(ctx.templatesConfig, ctx.options.format || "table");
}

async function handleShowTemplate(ctx: TemplateCommandContext): Promise<number> {
  return showTemplate(ctx.templatesConfig, ctx.options.name!, ctx.options.format || "table");
}

async function handleValidateTemplates(ctx: TemplateCommandContext): Promise<number> {
  return validateTemplates(ctx.templateManager);
}

async function handleScaffoldTemplates(ctx: TemplateCommandContext): Promise<number> {
  return scaffoldTemplates(ctx.options, ctx.config);
}

async function handleGenerateTemplateExample(ctx: TemplateCommandContext): Promise<number> {
  return generateTemplateExample(ctx.options.generate!, ctx.templateManager);
}

async function handleAddTemplate(_ctx: TemplateCommandContext): Promise<number> {
  console.log(chalk.yellow("⚠️  Adding custom templates via CLI is not yet implemented."));
  console.log(chalk.cyan("💡 To add custom templates, edit your .arbiter/config.json file:"));
  console.log(chalk.dim(`    ${getDefaultConfigPath()}`));
  console.log(chalk.dim("   Add templates under github.templates section"));
  console.log(chalk.cyan("💡 Or use --init to scaffold file-based templates:"));
  console.log(chalk.dim("   arbiter github-templates --init"));
  return 0;
}

async function handleRemoveTemplate(ctx: TemplateCommandContext): Promise<number> {
  return removeTemplate(ctx.options.name!, ctx.config);
}

function showDefaultHelp(): number {
  console.log(chalk.blue("📝 GitHub Template Management"));
  console.log("");
  console.log("Available commands:");
  console.log(`${chalk.cyan("  --list                 ")}List all available templates`);
  console.log(`${chalk.cyan("  --show <name>          ")}Show details of a specific template`);
  console.log(`${chalk.cyan("  --validate             ")}Validate template configuration`);
  console.log(`${chalk.cyan("  --add                  ")}Add a new template (interactive)`);
  console.log(`${chalk.cyan("  --init                 ")}Initialize/scaffold file-based templates`);
  console.log(`${chalk.cyan("  --scaffold             ")}Scaffold template directory structure`);
  console.log(`${chalk.cyan("  --generate <type>      ")}Generate template example`);
  console.log(`${chalk.cyan("  --remove <name>        ")}Remove a template`);
  console.log("");
  console.log("Format options:");
  console.log(chalk.dim("  --format table|json|yaml  Output format"));
  console.log("");
  console.log("Examples:");
  console.log(chalk.dim("  arbiter github-templates --list"));
  console.log(chalk.dim("  arbiter github-templates --show group"));
  console.log(chalk.dim("  arbiter github-templates --validate"));
  console.log(chalk.dim("  arbiter github-templates --list --format json"));
  return 0;
}

/**
 * GitHub Template management command - list, add, remove, and validate GitHub templates
 */
export async function githubTemplatesCommand(
  options: TemplateManagementOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    const templatesConfig = config.github?.templates;
    const templateManager = new UnifiedGitHubTemplateManager(
      templatesConfig || {},
      config.projectDir,
    );

    const ctx: TemplateCommandContext = { options, config, templatesConfig, templateManager };
    const handler = getSubcommandHandler(options);

    if (handler) {
      return await handler(ctx);
    }

    return showDefaultHelp();
  } catch (error) {
    console.error(
      chalk.red("❌ GitHub Template management failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * List available templates
 */
export async function listTemplates(
  templatesConfig: GitHubTemplatesConfig | undefined,
  format: "table" | "json" | "yaml",
): Promise<number> {
  const templates = collectTemplateSummaries(templatesConfig);

  if (format === "json") {
    console.log(JSON.stringify(templates, null, 2));
    return 0;
  }

  if (format === "yaml") {
    const YAML = await import("yaml");
    console.log(YAML.stringify(templates));
    return 0;
  }

  // Table format
  console.log(chalk.blue("📝 Available GitHub Templates"));
  console.log("");

  if (templates.length === 0) {
    console.log(chalk.yellow("No templates configured"));
    console.log(chalk.dim("Add templates to your .arbiter/config.json under github.templates"));
    return 0;
  }

  const maxNameWidth = Math.max(...templates.map((t) => t.name.length), 10);
  const maxTypeWidth = Math.max(...templates.map((t) => t.type.length), 8);

  // Header
  const nameHeader = "NAME".padEnd(maxNameWidth);
  const typeHeader = "TYPE".padEnd(maxTypeWidth);
  console.log(chalk.bold(`${nameHeader} ${typeHeader} DESCRIPTION`));
  console.log("─".repeat(maxNameWidth + maxTypeWidth + 20));

  // Templates
  templates.forEach((template) => {
    const name = template.name.padEnd(maxNameWidth);
    const type = template.type.padEnd(maxTypeWidth);
    const description = template.description || "No description";
    console.log(`${chalk.cyan(name)} ${chalk.yellow(type)} ${chalk.dim(description)}`);
  });

  console.log("");
  console.log(chalk.dim(`Found ${templates.length} template(s)`));
  return 0;
}

/**
 * Show specific template details
 */
export async function showTemplate(
  templatesConfig: GitHubTemplatesConfig | undefined,
  templateName: string,
  format: "table" | "json" | "yaml",
): Promise<number> {
  const entry = findTemplateConfig(templatesConfig, templateName);
  if (!entry) {
    console.error(chalk.red(`❌ Template "${templateName}" not found`));
    console.log(chalk.dim("Available templates:"));
    collectTemplateSummaries(templatesConfig).forEach((t) => {
      console.log(chalk.dim(`  • ${t.name} (${t.type})`));
    });
    return 1;
  }

  const { type, config } = entry;

  if (format === "json") {
    console.log(JSON.stringify(config, null, 2));
    return 0;
  }

  if (format === "yaml") {
    const YAML = await import("yaml");
    console.log(YAML.stringify(config));
    return 0;
  }

  console.log(chalk.blue(`📝 Template: ${type}`));
  console.log("");

  const name = (config as any)?.name ?? type;
  const description = (config as any)?.description ?? "No description";
  console.log(`${chalk.bold("Name:")}        ${name}`);
  console.log(`${chalk.bold("Type:")}        ${type}`);
  console.log(`${chalk.bold("Description:")} ${description}`);

  if ((config as any)?.sections) {
    console.log("");
    console.log(chalk.bold("Sections:"));
    Object.keys((config as any).sections).forEach((section) => {
      console.log(chalk.dim(`  • ${section}`));
    });
  }

  return 0;
}

/**
 * Validate template configuration
 */
export async function validateTemplates(
  templateManager: UnifiedGitHubTemplateManager,
): Promise<number> {
  console.log(chalk.blue("🔍 Validating template configuration..."));

  const errors = await templateManager.validateTemplateConfig();

  if (errors.length === 0) {
    console.log(chalk.green("✅ Template configuration is valid"));
    return 0;
  }

  console.log(chalk.red("❌ Template configuration has errors:"));
  console.log("");

  errors.forEach((error) => {
    console.log(`  ${chalk.red("•")} ${chalk.bold(error.field)}: ${error.message}`);
  });

  console.log("");
  console.log(chalk.yellow("💡 Fix these errors in your .arbiter/config.json file"));

  return 1;
}

/**
 * Check if a template entry matches the target name
 */
function templateEntryMatches(entry: unknown, type: string, templateName: string): boolean {
  if (!entry) return type === templateName;
  if (typeof entry === "string") return entry === templateName || type === templateName;
  if (typeof entry === "object" && entry !== null && "name" in entry) {
    return (entry as { name?: string }).name === templateName;
  }
  return type === templateName;
}

/**
 * Find the template type that matches the given name
 */
function findTemplateType(
  templateName: string,
  config: CLIConfig,
): "group" | "task" | "bugReport" | "featureRequest" | undefined {
  const availableTypes = ["group", "task", "bugReport", "featureRequest"] as const;
  return availableTypes.find((type) =>
    templateEntryMatches(config.github?.templates?.[type], type, templateName),
  );
}

/**
 * Create config with template removed
 */
function buildConfigWithoutTemplate(
  currentConfig: CLIConfig,
  templateType: string,
): Partial<CLIConfig> {
  const templates = currentConfig.github?.templates
    ? { ...currentConfig.github.templates }
    : undefined;

  if (templates) {
    delete (templates as Record<string, unknown>)[templateType];
  }

  if (!currentConfig.github) {
    return { ...currentConfig };
  }

  return {
    ...currentConfig,
    github: {
      ...currentConfig.github,
      templates: templates && Object.keys(templates).length > 0 ? templates : undefined,
    },
  };
}

/**
 * Remove a template from configuration
 */
async function removeTemplate(templateName: string, currentConfig: CLIConfig): Promise<number> {
  const configPath = getDefaultConfigPath();
  const templateType = findTemplateType(templateName, currentConfig);

  if (!templateType) {
    console.error(chalk.red(`❌ Template "${templateName}" not found`));
    return 1;
  }

  try {
    const updatedConfig = buildConfigWithoutTemplate(currentConfig, templateType);
    await saveConfig(updatedConfig, configPath);

    console.log(chalk.green(`✅ Removed template "${templateName}"`));
    console.log(chalk.dim(`Updated configuration: ${configPath}`));
    return 0;
  } catch (error) {
    console.error(
      chalk.red("❌ Failed to remove template:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

/**
 * Generate templates for a project
 */
export async function generateProjectTemplates(
  outputDir = ".github",
  config?: CLIConfig,
): Promise<void> {
  const templateManager = new UnifiedGitHubTemplateManager(
    config?.github?.templates || {},
    config?.projectDir || process.cwd(),
  );
  const templateFiles = await templateManager.generateRepositoryTemplateFiles();

  console.log(chalk.blue("📝 Generating GitHub templates..."));

  let generated = 0;
  for (const [filePath, content] of Object.entries(templateFiles)) {
    const fullPath = path.join(outputDir, filePath.replace(".github/", ""));

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Write template file
    await writeFileSafe(fullPath, content);
    console.log(chalk.green(`✅ Generated ${filePath}`));
    generated++;
  }

  console.log("");
  console.log(chalk.green(`🎉 Generated ${generated} template file(s)`));
  console.log(chalk.cyan("Next steps:"));
  console.log(chalk.dim("  1. Review and customize the generated templates"));
  console.log(chalk.dim("  2. Commit the templates to your repository"));
  console.log(chalk.dim("  3. Configure your .arbiter/config.json for custom templates"));
}

/**
 * Scaffold file-based templates
 */
async function scaffoldTemplates(
  options: TemplateManagementOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    const outputDir =
      options.outputDir || path.join(config.projectDir, ".arbiter", "templates", "github");
    const sourceDir = path.join(config.projectDir, ".arbiter", "templates", "github");

    console.log(chalk.blue("🏗️ Scaffolding file-based GitHub templates..."));
    console.log(chalk.dim(`Output directory: ${outputDir}\n`));

    await fs.mkdir(outputDir, { recursive: true });

    let created = 0;
    for (const template of SCAFFOLD_TEMPLATES) {
      const sourcePath = path.join(sourceDir, template.name);
      const targetPath = path.join(outputDir, template.name);
      const success = await copyTemplateFile(template, sourcePath, targetPath, options);
      if (success) created++;
    }

    if (created > 0) {
      await updateConfigForTemplates(config, outputDir);
    }
    logScaffoldResult(created);

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Failed to scaffold templates:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}

async function resolveTemplateResult(
  templateType: string,
  templateManager: UnifiedGitHubTemplateManager,
  sampleData: any,
): Promise<{ title: string; body: string; labels: string[]; assignees?: string[] } | null> {
  switch (templateType.toLowerCase()) {
    case "group":
      return templateManager.generateGroupTemplate(sampleData);
    case "task":
      return templateManager.generateTaskTemplate(sampleData.task, sampleData.group);
    case "bug-report":
    case "bug":
      return templateManager.generateBugReportTemplate(sampleData);
    case "feature-request":
    case "feature":
      return templateManager.generateFeatureRequestTemplate(sampleData);
    default:
      return null;
  }
}

function printTemplateResult(result: {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
}): void {
  console.log(chalk.green("Generated Template Output:\n"));
  console.log(chalk.cyan(`Title: ${result.title}\n`));
  console.log(chalk.dim("Body:"));
  console.log(result.body);

  if (result.labels.length > 0) {
    console.log(chalk.dim(`\nLabels: ${result.labels.join(", ")}`));
  }
  if (result.assignees && result.assignees.length > 0) {
    console.log(chalk.dim(`Assignees: ${result.assignees.join(", ")}`));
  }
}

/**
 * Generate template example for testing
 */
async function generateTemplateExample(
  templateType: string,
  templateManager: UnifiedGitHubTemplateManager,
): Promise<number> {
  try {
    console.log(chalk.blue(`🎯 Generating ${templateType} template example...\n`));

    const sampleData = getSampleDataForTemplate(templateType);
    const result = await resolveTemplateResult(templateType, templateManager, sampleData);

    if (!result) {
      console.error(chalk.red(`Unknown template type: ${templateType}`));
      console.log("Available types: group, task, bug-report, feature-request");
      return 1;
    }

    printTemplateResult(result);
    return 0;
  } catch (error) {
    console.error(
      chalk.red(`Failed to generate ${templateType} template:`),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
