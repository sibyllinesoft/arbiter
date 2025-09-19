/**
 * Templates command - Template management for Arbiter
 *
 * This command provides template management functionality:
 * - List available templates
 * - Show template details
 * - Add/update template aliases
 * - Remove template aliases
 */

import chalk from 'chalk';
import { type TemplateAlias, templateManager } from '../templates/index.js';
import type { CLIConfig } from '../types.js';

export interface TemplatesOptions {
  verbose?: boolean;
  format?: 'table' | 'json';
  engine?: string;
}

/**
 * Main templates command dispatcher
 */
export async function templatesCommand(
  action: string,
  name?: string,
  options: TemplatesOptions & Record<string, any> = {},
  _config?: CLIConfig
): Promise<number> {
  try {
    // Load template configuration
    await templateManager.loadConfig();

    switch (action) {
      case 'list':
        return await listTemplates(options);
      case 'show':
        if (!name) {
          console.error(chalk.red('❌ Template name is required for show command'));
          return 1;
        }
        return await showTemplate(name, options);
      case 'add':
        if (!name) {
          console.error(chalk.red('❌ Template name is required for add command'));
          return 1;
        }
        return await addTemplate(name, options);
      case 'remove':
        if (!name) {
          console.error(chalk.red('❌ Template name is required for remove command'));
          return 1;
        }
        return await removeTemplate(name, options);
      case 'update':
        return await updateTemplates(options);
      default:
        console.error(chalk.red(`❌ Unknown templates action: ${action}`));
        console.log(chalk.dim('Available actions: list, show, add, remove, update'));
        return 1;
    }
  } catch (error) {
    console.error(chalk.red('❌ Templates command failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * List all available template aliases
 */
async function listTemplates(options: TemplatesOptions): Promise<number> {
  try {
    const aliases = templateManager.getAliases();
    const entries = Object.entries(aliases);

    if (entries.length === 0) {
      console.log(chalk.yellow('📋 No template aliases configured'));
      console.log(
        chalk.dim("Use 'arbiter templates add <name> --source <source>' to add templates")
      );
      return 0;
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(aliases, null, 2));
      return 0;
    }

    console.log(chalk.cyan('📋 Available Template Aliases:'));
    console.log();

    // Group by engine
    const engineGroups = new Map<string, Array<[string, TemplateAlias]>>();
    for (const [name, alias] of entries) {
      if (!engineGroups.has(alias.engine)) {
        engineGroups.set(alias.engine, []);
      }
      engineGroups.get(alias.engine)?.push([name, alias]);
    }

    for (const [engine, templates] of engineGroups.entries()) {
      console.log(chalk.bold(chalk.blue(`${engine.toUpperCase()} Templates:`)));

      for (const [name, alias] of templates) {
        console.log(`  ${chalk.green(name)}`);
        console.log(`    ${chalk.dim(alias.description)}`);
        console.log(`    ${chalk.dim(`Source: ${alias.source}`)}`);

        if (alias.prerequisites && alias.prerequisites.length > 0) {
          console.log(`    ${chalk.dim(`Prerequisites: ${alias.prerequisites.join(', ')}`)}`);
        }

        console.log();
      }
    }

    console.log(chalk.dim("Use 'arbiter templates show <name>' to view template details"));
    console.log(chalk.dim("Use 'arbiter add service <name> --template <alias>' to use a template"));

    return 0;
  } catch (error) {
    console.error(chalk.red('Failed to list templates:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Show details for a specific template alias
 */
async function showTemplate(name: string, options: TemplatesOptions): Promise<number> {
  try {
    const alias = templateManager.getAlias(name);

    if (!alias) {
      return handleTemplateNotFound(name);
    }

    if (options.format === 'json') {
      return displayTemplateAsJson(name, alias);
    }

    return displayTemplateDetails(name, alias);
  } catch (error) {
    return handleTemplateDisplayError(error);
  }
}

/**
 * Handle template not found scenario
 */
function handleTemplateNotFound(name: string): number {
  console.error(chalk.red(`❌ Template alias '${name}' not found`));

  const availableTemplates = Object.keys(templateManager.getAliases());
  if (availableTemplates.length > 0) {
    console.log(chalk.dim('Available templates:'));
    availableTemplates.forEach(t => console.log(chalk.dim(`  • ${t}`)));
  }

  return 1;
}

/**
 * Display template in JSON format
 */
function displayTemplateAsJson(name: string, alias: any): number {
  console.log(JSON.stringify({ [name]: alias }, null, 2));
  return 0;
}

/**
 * Display template details in formatted output
 */
function displayTemplateDetails(name: string, alias: any): number {
  displayTemplateHeader(name);
  displayTemplateBasicInfo(alias);
  displayTemplatePrerequisites(alias);
  displayTemplateVariables(alias);
  displayTemplateUsage(name);

  return 0;
}

/**
 * Display template header
 */
function displayTemplateHeader(name: string): void {
  console.log(chalk.cyan(`📋 Template: ${chalk.bold(name)}`));
  console.log();
}

/**
 * Display basic template information
 */
function displayTemplateBasicInfo(alias: any): void {
  console.log(chalk.bold('Description:'));
  console.log(`  ${alias.description}`);
  console.log();

  console.log(chalk.bold('Engine:'));
  console.log(`  ${alias.engine}`);
  console.log();

  console.log(chalk.bold('Source:'));
  console.log(`  ${alias.source}`);
  console.log();
}

/**
 * Display template prerequisites if available
 */
function displayTemplatePrerequisites(alias: any): void {
  if (alias.prerequisites && alias.prerequisites.length > 0) {
    console.log(chalk.bold('Prerequisites:'));
    alias.prerequisites.forEach((prereq: string) => {
      console.log(`  • ${prereq}`);
    });
    console.log();
  }
}

/**
 * Display template variables if available
 */
function displayTemplateVariables(alias: any): void {
  if (alias.variables && Object.keys(alias.variables).length > 0) {
    console.log(chalk.bold('Default Variables:'));
    Object.entries(alias.variables).forEach(([key, value]) => {
      console.log(`  ${chalk.green(key)}: ${JSON.stringify(value)}`);
    });
    console.log();
  }
}

/**
 * Display template usage examples
 */
function displayTemplateUsage(name: string): void {
  console.log(chalk.bold('Usage:'));
  console.log(`  arbiter add service myapi --template ${name}`);
  console.log(`  arbiter add frontend web --template ${name}`);
}

/**
 * Handle template display errors
 */
function handleTemplateDisplayError(error: unknown): number {
  console.error(chalk.red('Failed to show template:'));
  console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  return 1;
}

/**
 * Add a new template alias
 */
async function addTemplate(name: string, options: Record<string, any>): Promise<number> {
  try {
    const { source, description, engine = 'cookiecutter', prerequisites } = options;

    if (!source) {
      console.error(chalk.red('❌ Template source is required'));
      console.log(chalk.dim('Use --source to specify the template source (URL, path, or repo)'));
      return 1;
    }

    if (!description) {
      console.error(chalk.red('❌ Template description is required'));
      console.log(chalk.dim('Use --description to provide a template description'));
      return 1;
    }

    // Check if engine is supported
    const supportedEngines = templateManager.getEngines();
    if (!supportedEngines.includes(engine)) {
      console.error(chalk.red(`❌ Unsupported engine: ${engine}`));
      console.log(chalk.dim(`Supported engines: ${supportedEngines.join(', ')}`));
      return 1;
    }

    const alias: TemplateAlias = {
      engine,
      source,
      description,
      ...(prerequisites && {
        prerequisites: prerequisites.split(',').map((p: string) => p.trim()),
      }),
    };

    await templateManager.addAlias(name, alias);

    console.log(chalk.green(`✅ Template alias '${name}' added successfully`));
    console.log(chalk.dim(`Engine: ${engine}`));
    console.log(chalk.dim(`Source: ${source}`));
    console.log(chalk.dim(`Description: ${description}`));

    if (prerequisites) {
      console.log(chalk.dim(`Prerequisites: ${prerequisites}`));
    }

    console.log();
    console.log(chalk.bold('Usage:'));
    console.log(`  arbiter add service myapi --template ${name}`);

    return 0;
  } catch (error) {
    console.error(chalk.red('Failed to add template:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Remove a template alias
 */
async function removeTemplate(name: string, options: TemplatesOptions): Promise<number> {
  try {
    const alias = templateManager.getAlias(name);

    if (!alias) {
      console.error(chalk.red(`❌ Template alias '${name}' not found`));
      return 1;
    }

    await templateManager.removeAlias(name);

    console.log(chalk.green(`✅ Template alias '${name}' removed successfully`));
    console.log(chalk.dim(`Was: ${alias.description} (${alias.engine})`));

    return 0;
  } catch (error) {
    console.error(chalk.red('Failed to remove template:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}

/**
 * Update template configuration (reload/refresh)
 */
async function updateTemplates(options: TemplatesOptions): Promise<number> {
  try {
    console.log(chalk.blue('🔄 Updating template configuration...'));

    // Reload configuration
    await templateManager.loadConfig();

    const aliases = templateManager.getAliases();
    const count = Object.keys(aliases).length;

    console.log(chalk.green('✅ Template configuration updated'));
    console.log(chalk.dim(`Found ${count} template aliases`));

    if (options.verbose) {
      console.log();
      console.log(chalk.bold('Available templates:'));
      Object.keys(aliases).forEach(name => {
        console.log(`  • ${name}`);
      });
    }

    return 0;
  } catch (error) {
    console.error(chalk.red('Failed to update templates:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    return 1;
  }
}
