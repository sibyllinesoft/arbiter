import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import inquirer from "inquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateOptions {
  interactive?: boolean;
  template?: string;
  output?: string;
  name?: string;
}

export interface SchemaConfig {
  systemType: "api" | "microservice" | "agent_framework" | "data_pipeline" | "web_app" | "cli_tool";
  projectName: string;
  hasBudgetConstraints: boolean;
  budgetLimit?: number;
  budgetCurrency?: string;
  budgetPeriod?: string;
  hasQualityGates: boolean;
  qualityThresholds?: {
    testCoverage?: number;
    performanceTarget?: string;
    securityLevel?: string;
  };
  hasSelectionRubric: boolean;
  selectionCriteria?: string[];
  hasDependencyChain: boolean;
  dependencySteps?: string[];
  customConstraints?: string[];
  outputPath: string;
}

/**
 * Get templates directory path
 */
function getTemplatesDir(): string {
  return path.resolve(__dirname, "../../templates");
}

/**
 * Load template content
 */
async function loadTemplateContent(templateName: string): Promise<string | null> {
  try {
    const templatesDir = getTemplatesDir();
    const cuePath = path.join(templatesDir, `${templateName}.cue`);
    return await fs.readFile(cuePath, "utf-8");
  } catch (_error) {
    return null;
  }
}

/**
 * Interactive schema configuration prompts
 */
async function interactiveSchemaConfig(): Promise<SchemaConfig> {
  console.log(chalk.cyan("🚀 Arbiter Interactive Schema Builder"));
  console.log(
    chalk.dim("Answer a few questions to generate a tailored CUE schema with constraints\n"),
  );

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "What is your project name?",
      default: "my-project",
      validate: (input: string) => {
        if (!input.trim()) return "Project name is required";
        if (!/^[a-z][a-z0-9-_]*$/.test(input)) {
          return "Project name must start with lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores";
        }
        return true;
      },
    },
    {
      type: "list",
      name: "systemType",
      message: "What type of system are you building?",
      choices: [
        { name: "🌐 API/REST Service", value: "api" },
        { name: "🔧 Microservice", value: "microservice" },
        { name: "🤖 Agent Framework", value: "agent_framework" },
        { name: "📊 Data Pipeline", value: "data_pipeline" },
        { name: "💻 Web Application", value: "web_app" },
        { name: "⚡ CLI Tool", value: "cli_tool" },
      ],
    },
    {
      type: "confirm",
      name: "hasBudgetConstraints",
      message: "Do you need budget/resource constraints?",
      default: false,
    },
  ]);

  let budgetConfig = {};
  if (answers.hasBudgetConstraints) {
    const budgetAnswers = await inquirer.prompt([
      {
        type: "number",
        name: "budgetLimit",
        message: "What is your budget limit?",
        default: 1000,
        validate: (input: number) => input > 0 || "Budget must be greater than 0",
      },
      {
        type: "list",
        name: "budgetCurrency",
        message: "What currency/unit?",
        choices: ["USD", "EUR", "credits", "GB", "CPU hours", "API calls"],
        default: "USD",
      },
      {
        type: "list",
        name: "budgetPeriod",
        message: "What time period?",
        choices: ["hourly", "daily", "weekly", "monthly", "yearly"],
        default: "monthly",
      },
    ]);
    budgetConfig = budgetAnswers;
  }

  const qualityAnswers = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasQualityGates",
      message: "Do you want quality gates (performance, testing, security)?",
      default: true,
    },
  ]);

  let qualityConfig = {};
  if (qualityAnswers.hasQualityGates) {
    const thresholds = await inquirer.prompt([
      {
        type: "number",
        name: "testCoverage",
        message: "Minimum test coverage percentage?",
        default: 80,
        validate: (input: number) =>
          (input >= 0 && input <= 100) || "Coverage must be between 0 and 100",
      },
      {
        type: "input",
        name: "performanceTarget",
        message: 'Performance target (e.g., "< 200ms", "1000 RPS")?',
        default: "< 200ms",
      },
      {
        type: "list",
        name: "securityLevel",
        message: "Security level requirement?",
        choices: ["basic", "standard", "high", "critical"],
        default: "standard",
      },
    ]);
    qualityConfig = { qualityThresholds: thresholds };
  }

  const selectionAnswers = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasSelectionRubric",
      message: "Do you need a selection/evaluation rubric?",
      default: false,
    },
  ]);

  let selectionConfig = {};
  if (selectionAnswers.hasSelectionRubric) {
    const criteria = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectionCriteria",
        message: "Select evaluation criteria:",
        choices: [
          "Performance",
          "Cost",
          "Reliability",
          "Security",
          "Scalability",
          "Maintainability",
          "User Experience",
          "Documentation",
        ],
        validate: (input: string[]) => input.length > 0 || "Select at least one criteria",
      },
    ]);
    selectionConfig = criteria;
  }

  const dependencyAnswers = await inquirer.prompt([
    {
      type: "confirm",
      name: "hasDependencyChain",
      message: "Do you have complex dependencies/workflows to model?",
      default: false,
    },
  ]);

  let dependencyConfig = {};
  if (dependencyAnswers.hasDependencyChain) {
    const steps = await inquirer.prompt([
      {
        type: "input",
        name: "dependencySteps",
        message: "Enter main workflow steps (comma-separated):",
        default: "validate,build,test,deploy",
        filter: (input: string) => input.split(",").map((s) => s.trim()),
        validate: (input: string[]) => input.length > 0 || "Enter at least one step",
      },
    ]);
    dependencyConfig = steps;
  }

  const outputAnswers = await inquirer.prompt([
    {
      type: "input",
      name: "outputPath",
      message: "Output file path:",
      default: `${answers.projectName}-schema.cue`,
      validate: (input: string) => {
        if (!input.trim()) return "Output path is required";
        if (!input.endsWith(".cue")) return "File must have .cue extension";
        return true;
      },
    },
  ]);

  return {
    ...answers,
    ...budgetConfig,
    ...qualityConfig,
    ...selectionConfig,
    ...dependencyConfig,
    ...outputAnswers,
  };
}

/**
 * Generate CUE schema from configuration
 */
async function generateSchemaFromConfig(config: SchemaConfig): Promise<string> {
  const templates = [];

  // Load and customize templates based on configuration
  if (config.hasBudgetConstraints) {
    const budgetTemplate = await loadTemplateContent("budget_constraint");
    if (budgetTemplate) {
      templates.push(budgetTemplate);
    }
  }

  if (config.hasSelectionRubric) {
    const rubricTemplate = await loadTemplateContent("selection_rubric");
    if (rubricTemplate) {
      templates.push(rubricTemplate);
    }
  }

  if (config.hasDependencyChain) {
    const dependencyTemplate = await loadTemplateContent("dependency_chain");
    if (dependencyTemplate) {
      templates.push(dependencyTemplate);
    }
  }

  // Generate the main schema
  let schema = `// ${config.projectName} - Generated Schema
// System Type: ${config.systemType}
// Generated: ${new Date().toISOString()}

package ${config.projectName.replace(/-/g, "_")}

import "strings"
import "list"

// Project metadata
#ProjectInfo: {
	name:        "${config.projectName}"
	system_type: "${config.systemType}"
	version:     "1.0.0"
	generated:   "${new Date().toISOString()}"
}

// System configuration
#SystemConfig: {
	project: #ProjectInfo
	
	// System-specific constraints
	constraints: {`;

  // Add budget constraints if enabled
  if (config.hasBudgetConstraints) {
    schema += `
		// Budget constraints
		budget: {
			limit:    ${config.budgetLimit}
			currency: "${config.budgetCurrency}"
			period:   "${config.budgetPeriod}"
		}`;
  }

  // Add quality gates if enabled
  if (config.hasQualityGates && config.qualityThresholds) {
    schema += `
		// Quality gates
		quality: {
			test_coverage:      ${config.qualityThresholds.testCoverage}
			performance_target: "${config.qualityThresholds.performanceTarget}"
			security_level:     "${config.qualityThresholds.securityLevel}"
		}`;
  }

  // Add selection criteria if enabled
  if (config.hasSelectionRubric && config.selectionCriteria) {
    schema += `
		// Selection criteria
		selection_criteria: [${config.selectionCriteria?.map((c) => `"${c}"`).join(", ")}]`;
  }

  // Add dependency steps if enabled
  if (config.hasDependencyChain && config.dependencySteps) {
    schema += `
		// Workflow dependencies
		workflow_steps: [${config.dependencySteps?.map((s) => `"${s}"`).join(", ")}]`;
  }

  schema += `
	}
	
	// Validation rules
	validation: {
		// All fields are required
		project.name:        string & !=""
		project.system_type: string & !=""
		project.version:     string & !=""`;

  if (config.hasBudgetConstraints) {
    schema += `
		
		// Budget validation
		constraints.budget.limit: number & >0
		constraints.budget.currency: string & !=""`;
  }

  if (config.hasQualityGates && config.qualityThresholds) {
    schema += `
		
		// Quality validation
		constraints.quality.test_coverage: number & >=0 & <=100`;
  }

  schema += `
	}
}

// Default instance
default_config: #SystemConfig & {
	project: {
		name:        "${config.projectName}"
		system_type: "${config.systemType}"
		version:     "1.0.0"
	}
}`;

  // Add template content if any templates were loaded
  if (templates.length > 0) {
    schema += `\n\n// ===== Template Includes =====\n`;
    schema += templates.join("\n\n");
  }

  return schema;
}

/**
 * Generate user guide content
 */
function generateUserGuide(config: SchemaConfig): string {
  return `# ${config.projectName} Schema Guide

This schema was generated by Arbiter's Interactive Schema Builder.

## Schema Overview

- **System Type**: ${config.systemType}
- **Project Name**: ${config.projectName}
${config.hasBudgetConstraints ? `- **Budget Constraints**: ${config.budgetLimit} ${config.budgetCurrency} per ${config.budgetPeriod}` : ""}
${config.hasQualityGates ? `- **Quality Gates**: Enabled` : ""}
${config.hasSelectionRubric ? `- **Selection Rubric**: Enabled` : ""}
${config.hasDependencyChain ? `- **Dependency Chain**: Enabled` : ""}

## Next Steps

1. **Review the Schema**: Open \`${config.outputPath}\` and review the generated constraints
2. **Customize Values**: Adjust the default values to match your specific requirements
3. **Add Custom Constraints**: Extend the schema with your domain-specific rules
4. **Validate**: Run \`arbiter validate ${config.outputPath}\` to check your schema
5. **Export**: Use \`arbiter export ${config.outputPath} --format typescript,k8s\` to generate artifacts

## Schema Structure

The generated schema includes:

- \`#ProjectInfo\`: Basic project metadata
- \`#SystemConfig\`: Main configuration with constraints
- \`default_config\`: A working configuration instance
${config.hasBudgetConstraints ? "- Budget constraint templates with cost models and monitoring" : ""}
${config.hasSelectionRubric ? "- Selection rubric templates with weighted criteria" : ""}
${config.hasDependencyChain ? "- Dependency chain templates with workflow management" : ""}

## Validation Rules

The schema enforces:
${config.hasBudgetConstraints ? `- Budget limits and currency validation` : ""}
${config.hasQualityGates ? `- Quality thresholds (${config.qualityThresholds?.testCoverage}% test coverage, ${config.qualityThresholds?.performanceTarget} performance)` : ""}
- Required project metadata
- System type consistency

## Template Integration

${templates_included(config)}

## Support

For help with CUE syntax and Arbiter features:
- Run \`arbiter template list\` to see available constraint templates
- Run \`arbiter --help\` for CLI command reference
- Check the generated comments in your schema file for inline guidance
`;

  function templates_included(config: SchemaConfig): string {
    const included = [];
    if (config.hasBudgetConstraints) included.push("Budget Constraint Template");
    if (config.hasSelectionRubric) included.push("Selection Rubric Template");
    if (config.hasDependencyChain) included.push("Dependency Chain Template");

    if (included.length === 0) {
      return "No templates were included. You can add them later with `arbiter template add <name>`.";
    }

    return `The following templates are included:\n${included.map((t) => `- ${t}`).join("\n")}`;
  }
}

/**
 * Create schema command - Interactive schema builder
 */
export async function createCommand(
  type: string = "schema",
  options: CreateOptions = {},
): Promise<number> {
  if (type !== "schema") {
    console.error(chalk.red(`Unknown create type: ${type}`));
    console.log(chalk.dim("Available types: schema"));
    return 1;
  }

  try {
    let config: SchemaConfig;

    if (options.interactive !== false) {
      // Interactive mode (default)
      config = await interactiveSchemaConfig();
    } else {
      // Non-interactive mode - use provided options
      if (!options.name) {
        console.error(chalk.red("Project name is required in non-interactive mode"));
        return 1;
      }

      config = {
        systemType: "api", // default
        projectName: options.name,
        hasBudgetConstraints: false,
        hasQualityGates: true,
        hasSelectionRubric: false,
        hasDependencyChain: false,
        outputPath: options.output || `${options.name}-schema.cue`,
      };
    }

    // Generate schema
    console.log(chalk.dim("Generating schema..."));
    const schema = await generateSchemaFromConfig(config);

    // Write schema file
    await fs.writeFile(config.outputPath, schema, "utf-8");

    // Generate and write user guide
    const guideContent = generateUserGuide(config);
    const guidePath = config.outputPath.replace(".cue", "-guide.md");
    await fs.writeFile(guidePath, guideContent, "utf-8");

    // Success message
    console.log();
    console.log(chalk.green("✓ Schema created successfully!"));
    console.log();
    console.log(chalk.bold("Files generated:"));
    console.log(`  ${chalk.blue(config.outputPath)} - Your CUE schema`);
    console.log(`  ${chalk.blue(guidePath)} - Setup guide and documentation`);
    console.log();

    console.log(chalk.bold("Next steps:"));
    console.log(`1. Review your schema: ${chalk.cyan(`cat ${config.outputPath}`)}`);
    console.log(`2. Read the guide: ${chalk.cyan(`cat ${guidePath}`)}`);
    console.log(`3. Validate schema: ${chalk.cyan(`arbiter validate ${config.outputPath}`)}`);
    if (config.hasBudgetConstraints || config.hasSelectionRubric || config.hasDependencyChain) {
      console.log(`4. Customize templates: Edit the template sections in ${config.outputPath}`);
    }
    console.log();

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Error creating schema:"),
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }
}
