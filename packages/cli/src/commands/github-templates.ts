import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import type { CLIConfig, TemplateManagementOptions } from "../types.js";
import { ConfigurableTemplateManager, DEFAULT_TEMPLATES_CONFIG } from "../utils/github-template-config.js";
import { FileBasedTemplateManager } from "../utils/file-based-template-manager.js";
import { loadConfig, saveConfig, getDefaultConfigPath } from "../config.js";

/**
 * GitHub Template management command - list, add, remove, and validate GitHub templates
 */
export async function githubTemplatesCommand(
  options: TemplateManagementOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    // Load current configuration
    const currentConfig = await loadConfig();
    const templateManager = new ConfigurableTemplateManager(currentConfig.github?.templates);
    const fileBasedTemplateManager = new FileBasedTemplateManager(
      currentConfig.github?.templates || {}, 
      config.projectDir
    );

    // List templates
    if (options.list) {
      return await listTemplates(templateManager, options.format || "table");
    }

    // Show specific template
    if (options.show && options.name) {
      return await showTemplate(templateManager, options.name, options.format || "table");
    }

    // Validate template configuration
    if (options.validate) {
      return await validateTemplates(templateManager);
    }

    // Initialize/scaffold templates
    if (options.init || options.scaffold) {
      return await scaffoldTemplates(options, config, fileBasedTemplateManager);
    }

    // Generate template example
    if (options.generate) {
      return await generateTemplateExample(options.generate, fileBasedTemplateManager);
    }

    // Add template (interactive or from config)
    if (options.add) {
      console.log(chalk.yellow("⚠️  Adding custom templates via CLI is not yet implemented."));
      console.log(chalk.cyan("💡 To add custom templates, edit your .arbiter/config.json file:"));
      console.log(chalk.dim(`    ${getDefaultConfigPath()}`));
      console.log(chalk.dim("   Add templates under github.templates section"));
      console.log(chalk.cyan("💡 Or use --init to scaffold file-based templates:"));
      console.log(chalk.dim("   arbiter github-templates --init"));
      return 0;
    }

    // Remove template
    if (options.remove && options.name) {
      return await removeTemplate(options.name, currentConfig);
    }

    // Default: show available commands
    console.log(chalk.blue("📝 GitHub Template Management"));
    console.log("");
    console.log("Available commands:");
    console.log(chalk.cyan("  --list                 ") + "List all available templates");
    console.log(chalk.cyan("  --show <name>          ") + "Show details of a specific template");
    console.log(chalk.cyan("  --validate             ") + "Validate template configuration");
    console.log(chalk.cyan("  --add                  ") + "Add a new template (interactive)");
    console.log(chalk.cyan("  --init                 ") + "Initialize/scaffold file-based templates");
    console.log(chalk.cyan("  --scaffold             ") + "Scaffold template directory structure");
    console.log(chalk.cyan("  --generate <type>      ") + "Generate template example");
    console.log(chalk.cyan("  --remove <name>        ") + "Remove a template");
    console.log("");
    console.log("Format options:");
    console.log(chalk.dim("  --format table|json|yaml  Output format"));
    console.log("");
    console.log("Examples:");
    console.log(chalk.dim("  arbiter github-templates --list"));
    console.log(chalk.dim("  arbiter github-templates --show epic"));
    console.log(chalk.dim("  arbiter github-templates --validate"));
    console.log(chalk.dim("  arbiter github-templates --list --format json"));

    return 0;
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
async function listTemplates(
  templateManager: ConfigurableTemplateManager,
  format: "table" | "json" | "yaml"
): Promise<number> {
  const templates = templateManager.getAvailableTemplates();

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

  const maxNameWidth = Math.max(...templates.map(t => t.name.length), 10);
  const maxTypeWidth = Math.max(...templates.map(t => t.type.length), 8);

  // Header
  const nameHeader = "NAME".padEnd(maxNameWidth);
  const typeHeader = "TYPE".padEnd(maxTypeWidth);
  console.log(chalk.bold(`${nameHeader} ${typeHeader} DESCRIPTION`));
  console.log("─".repeat(maxNameWidth + maxTypeWidth + 20));

  // Templates
  templates.forEach(template => {
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
async function showTemplate(
  templateManager: ConfigurableTemplateManager,
  templateName: string,
  format: "table" | "json" | "yaml"
): Promise<number> {
  const templates = templateManager.getAvailableTemplates();
  const template = templates.find(t => t.name === templateName || t.type === templateName);

  if (!template) {
    console.error(chalk.red(`❌ Template "${templateName}" not found`));
    console.log(chalk.dim("Available templates:"));
    templates.forEach(t => {
      console.log(chalk.dim(`  • ${t.name} (${t.type})`));
    });
    return 1;
  }

  if (format === "json") {
    console.log(JSON.stringify(template, null, 2));
    return 0;
  }

  if (format === "yaml") {
    const YAML = await import("yaml");
    console.log(YAML.stringify(template));
    return 0;
  }

  // Table format - show detailed template information
  console.log(chalk.blue(`📝 Template: ${template.name}`));
  console.log("");
  console.log(`${chalk.bold("Name:")}        ${template.name}`);
  console.log(`${chalk.bold("Type:")}        ${template.type}`);
  console.log(`${chalk.bold("Description:")} ${template.description || "No description"}`);
  console.log("");

  // Show template files that would be generated
  try {
    const allFiles = templateManager.generateRepositoryTemplates();
    const templateFile = Object.entries(allFiles).find(([path]) => 
      path.includes(template.type) || path.includes(template.name.toLowerCase())
    );

    if (templateFile) {
      console.log(chalk.bold("Template File:"));
      console.log(chalk.dim(templateFile[0]));
      console.log("");
      
      // Show first few lines of template
      const lines = templateFile[1].split('\n').slice(0, 10);
      lines.forEach(line => {
        console.log(chalk.dim(`  ${line}`));
      });
      
      if (templateFile[1].split('\n').length > 10) {
        console.log(chalk.dim("  ... (truncated)"));
      }
    }
  } catch (error) {
    console.log(chalk.yellow("⚠️  Could not generate template preview"));
  }

  return 0;
}

/**
 * Validate template configuration
 */
async function validateTemplates(templateManager: ConfigurableTemplateManager): Promise<number> {
  console.log(chalk.blue("🔍 Validating template configuration..."));
  
  const errors = templateManager.validateTemplateConfig();
  
  if (errors.length === 0) {
    console.log(chalk.green("✅ Template configuration is valid"));
    return 0;
  }

  console.log(chalk.red("❌ Template configuration has errors:"));
  console.log("");
  
  errors.forEach(error => {
    console.log(`  ${chalk.red("•")} ${chalk.bold(error.field)}: ${error.message}`);
  });
  
  console.log("");
  console.log(chalk.yellow("💡 Fix these errors in your .arbiter/config.json file"));
  
  return 1;
}

/**
 * Remove a template from configuration
 */
async function removeTemplate(templateName: string, currentConfig: CLIConfig): Promise<number> {
  const configPath = getDefaultConfigPath();
  
  // Check if template exists
  const availableTypes = ["epic", "task", "bugReport", "featureRequest"] as const;
  const templateType = availableTypes.find(type => 
    currentConfig.github?.templates?.[type]?.name === templateName ||
    type === templateName
  );

  if (!templateType) {
    console.error(chalk.red(`❌ Template "${templateName}" not found`));
    return 1;
  }

  try {
    // Create updated config without the template
    const updatedConfig = {
      ...currentConfig,
      github: {
        ...currentConfig.github,
        templates: {
          ...currentConfig.github?.templates,
          [templateType]: undefined
        }
      }
    };

    // Clean up undefined values
    if (updatedConfig.github?.templates) {
      Object.keys(updatedConfig.github.templates).forEach(key => {
        if ((updatedConfig.github!.templates as any)[key] === undefined) {
          delete (updatedConfig.github!.templates as any)[key];
        }
      });
    }

    // Save updated configuration
    await saveConfig(updatedConfig, configPath);
    
    console.log(chalk.green(`✅ Removed template "${templateName}"`));
    console.log(chalk.dim(`Updated configuration: ${configPath}`));
    
    return 0;
  } catch (error) {
    console.error(chalk.red("❌ Failed to remove template:"), error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Generate templates for a project
 */
export async function generateProjectTemplates(
  outputDir: string = ".github",
  config?: CLIConfig
): Promise<void> {
  const templateManager = new ConfigurableTemplateManager(config?.github?.templates);
  const templateFiles = templateManager.generateRepositoryTemplates();

  console.log(chalk.blue("📝 Generating GitHub templates..."));
  
  let generated = 0;
  for (const [filePath, content] of Object.entries(templateFiles)) {
    const fullPath = path.join(outputDir, filePath.replace(".github/", ""));
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write template file
    await fs.writeFile(fullPath, content);
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
  fileBasedTemplateManager: FileBasedTemplateManager
): Promise<number> {
  try {
    const outputDir = options.outputDir || path.join(config.projectDir, '.arbiter', 'templates', 'github');
    
    console.log(chalk.blue("🏗️ Scaffolding file-based GitHub templates..."));
    console.log(chalk.dim(`Output directory: ${outputDir}\n`));

    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });

    // Get existing templates from the created directory
    const existingTemplatesDir = path.join(config.projectDir, '.arbiter', 'templates', 'github');
    
    const templates = [
      { name: 'base.hbs', description: 'Base template for all GitHub issues' },
      { name: 'epic.hbs', description: 'Epic template with task overview' },
      { name: 'task.hbs', description: 'Task template with implementation details' },
      { name: 'bug-report.hbs', description: 'Bug report template with reproduction steps' },
      { name: 'feature-request.hbs', description: 'Feature request template with use cases' }
    ];

    let created = 0;

    // Create template files
    for (const template of templates) {
      const sourcePath = path.join(existingTemplatesDir, template.name);
      const targetPath = path.join(outputDir, template.name);
      
      if (await fs.access(targetPath).then(() => true).catch(() => false) && !options.force) {
        console.log(chalk.yellow(`⚠️  Skipping ${template.name} (already exists)`));
        continue;
      }

      try {
        if (await fs.access(sourcePath).then(() => true).catch(() => false)) {
          const content = await fs.readFile(sourcePath, 'utf-8');
          await fs.writeFile(targetPath, content);
          console.log(chalk.green(`✅ Created ${template.name}`));
          created++;
        } else {
          console.log(chalk.red(`❌ Source template ${template.name} not found in ${existingTemplatesDir}`));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Failed to create ${template.name}: ${error instanceof Error ? error.message : String(error)}`));
      }
      
      if (options.verbose) {
        console.log(chalk.dim(`   ${template.description}`));
      }
    }

    if (created > 0) {
      // Update config.json to reference templates
      await updateConfigForTemplates(config, outputDir);

      console.log(chalk.green(`\n🎉 Scaffolded ${created} template file(s)!`));
      console.log(chalk.dim("Edit the template files to customize your GitHub issue templates."));
      console.log(chalk.dim("Use 'arbiter github-templates --validate' to check your templates."));
    } else {
      console.log(chalk.yellow("\n⚠️  No templates were created."));
      console.log(chalk.dim("Use --force to overwrite existing files."));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red("Failed to scaffold templates:"), error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Generate template example for testing
 */
async function generateTemplateExample(
  templateType: string,
  fileBasedTemplateManager: FileBasedTemplateManager
): Promise<number> {
  try {
    console.log(chalk.blue(`🎯 Generating ${templateType} template example...\n`));

    // Get sample data for the template type
    const sampleData = getSampleDataForTemplate(templateType);
    let result;

    switch (templateType.toLowerCase()) {
      case 'epic':
        result = await fileBasedTemplateManager.generateEpicTemplate(sampleData);
        break;
      case 'task':
        result = await fileBasedTemplateManager.generateTaskTemplate(sampleData.task, sampleData.epic);
        break;
      case 'bug-report':
      case 'bug':
        result = await fileBasedTemplateManager.generateBugReportTemplate(sampleData);
        break;
      case 'feature-request':
      case 'feature':
        result = await fileBasedTemplateManager.generateFeatureRequestTemplate(sampleData);
        break;
      default:
        console.error(chalk.red(`Unknown template type: ${templateType}`));
        console.log("Available types: epic, task, bug-report, feature-request");
        return 1;
    }

    console.log(chalk.green("Generated Template Output:\n"));
    console.log(chalk.cyan(`Title: ${result.title}\n`));
    console.log(chalk.dim("Body:"));
    console.log(result.body);
    
    if (result.labels.length > 0) {
      console.log(chalk.dim(`\nLabels: ${result.labels.join(', ')}`));
    }
    
    if (result.assignees && result.assignees.length > 0) {
      console.log(chalk.dim(`Assignees: ${result.assignees.join(', ')}`));
    }

    return 0;
  } catch (error) {
    console.error(chalk.red(`Failed to generate ${templateType} template:`), error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Update config.json to reference template files
 */
async function updateConfigForTemplates(config: CLIConfig, templatesDir: string): Promise<void> {
  const configPath = getDefaultConfigPath();
  
  // Read existing config
  let existingConfig: any = {};
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(configContent);
  } catch (error) {
    // Config doesn't exist or is invalid, start fresh
    existingConfig = {};
  }

  // Ensure github.templates structure exists
  if (!existingConfig.github) {
    existingConfig.github = {};
  }
  if (!existingConfig.github.templates) {
    existingConfig.github.templates = {};
  }

  // Get relative path from project root
  const relativeTemplatesDir = path.relative(config.projectDir, templatesDir);

  // Update templates configuration
  existingConfig.github.templates = {
    ...existingConfig.github.templates,
    discoveryPaths: [relativeTemplatesDir, "~/.arbiter/templates/github"],
    defaultExtension: "hbs",
    base: {
      file: "base.hbs",
      metadata: {
        name: "Arbiter Base Template",
        description: "Base template for all Arbiter-managed GitHub issues"
      }
    },
    epic: {
      file: "epic.hbs",
      inherits: "base.hbs",
      metadata: {
        name: "Epic",
        description: "Template for epic issues",
        labels: ["epic", "priority:{{priority}}", "status:{{status}}"]
      }
    },
    task: {
      file: "task.hbs",
      inherits: "base.hbs",
      metadata: {
        name: "Task",
        description: "Template for task issues",
        labels: ["type:{{type}}", "priority:{{priority}}", "status:{{status}}", "epic:{{epicId}}"]
      }
    },
    bugReport: {
      file: "bug-report.hbs",
      metadata: {
        name: "Bug Report",
        description: "Template for bug report issues",
        labels: ["type:bug", "priority:{{priority}}"]
      }
    },
    featureRequest: {
      file: "feature-request.hbs",
      metadata: {
        name: "Feature Request",
        description: "Template for feature request issues",
        labels: ["type:feature", "priority:{{priority}}"]
      }
    }
  };

  // Write updated config
  await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2));
  console.log(chalk.dim("📝 Updated .arbiter/config.json with template references"));
}

/**
 * Get sample data for template testing
 */
function getSampleDataForTemplate(templateType: string): any {
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
      "Third acceptance criterion"
    ],
    dependencies: [
      "Complete prerequisite task A",
      "Review with stakeholders"
    ]
  };

  switch (templateType.toLowerCase()) {
    case 'epic':
      return {
        ...baseData,
        name: "Sample Epic",
        successCriteria: "Epic is complete when all tasks are done and users can successfully use the new feature",
        inScope: ["Feature A development", "Integration testing", "User documentation"],
        outOfScope: ["Advanced analytics", "Mobile app updates"],
        tasks: [
          {
            id: "task-001",
            name: "Implement core functionality",
            type: "feature",
            priority: "high",
            status: "todo",
            estimatedHours: 5
          },
          {
            id: "task-002", 
            name: "Add error handling",
            type: "feature",
            priority: "medium",
            status: "todo",
            estimatedHours: 3
          }
        ],
        stakeholders: [
          { role: "Product Owner", username: "product-owner" },
          { role: "Tech Lead", username: "tech-lead" }
        ]
      };

    case 'task':
      return {
        task: {
          ...baseData,
          name: "Sample Task",
          type: "feature",
          context: "This task is needed to implement the new user authentication flow.",
          implementationNotes: "Use the existing authentication library and extend it for SSO support.",
          testScenarios: [
            "User logs in with SSO",
            "User logs in with existing credentials",
            "Invalid credentials are handled correctly"
          ],
          technicalNotes: "Requires updating the user model and adding new API endpoints.",
          subtasks: [
            { name: "Update user model", description: "Add SSO fields to user schema" },
            { name: "Create SSO endpoints", description: "Implement /auth/sso endpoints" }
          ]
        },
        epic: {
          id: "epic-001",
          name: "User Authentication Epic"
        }
      };

    default:
      return baseData;
  }
}