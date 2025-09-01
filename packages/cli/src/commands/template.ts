import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import * as yaml from 'yaml';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TemplateOptions {
  output?: string;
  format?: 'cue' | 'json';
  list?: boolean;
  interactive?: boolean;
}

export interface TemplateMetadata {
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author: string;
  usage: string;
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    default?: any;
  }>;
  examples?: Array<{
    description: string;
    values: Record<string, any>;
  }>;
}

/**
 * Get the templates directory path
 */
function getTemplatesDir(): string {
  // Templates are in packages/cli/templates/
  return path.resolve(__dirname, '../../templates');
}

/**
 * Load template metadata from YAML file
 */
async function loadTemplateMetadata(templateName: string): Promise<TemplateMetadata | null> {
  try {
    const templatesDir = getTemplatesDir();
    const metadataPath = path.join(templatesDir, `${templateName}.yaml`);
    const content = await fs.readFile(metadataPath, 'utf-8');
    return yaml.parse(content) as TemplateMetadata;
  } catch (error) {
    return null;
  }
}

/**
 * Load template CUE content
 */
async function loadTemplateContent(templateName: string): Promise<string | null> {
  try {
    const templatesDir = getTemplatesDir();
    const cuePath = path.join(templatesDir, `${templateName}.cue`);
    return await fs.readFile(cuePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

/**
 * Get list of available templates
 */
async function getAvailableTemplates(): Promise<TemplateMetadata[]> {
  try {
    const templatesDir = getTemplatesDir();
    const files = await fs.readdir(templatesDir);
    const yamlFiles = files.filter(f => f.endsWith('.yaml'));
    
    const templates: TemplateMetadata[] = [];
    for (const file of yamlFiles) {
      const templateName = path.basename(file, '.yaml');
      const metadata = await loadTemplateMetadata(templateName);
      if (metadata) {
        templates.push(metadata);
      }
    }
    
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(chalk.red('Error loading templates:'), error instanceof Error ? error.message : String(error));
    return [];
  }
}

/**
 * List available templates
 */
export async function listTemplates(): Promise<void> {
  const templates = await getAvailableTemplates();
  
  if (templates.length === 0) {
    console.log(chalk.yellow('No templates available'));
    return;
  }
  
  console.log(chalk.cyan('Available Templates:'));
  console.log();
  
  // Group by category
  const categories = new Map<string, TemplateMetadata[]>();
  for (const template of templates) {
    if (!categories.has(template.category)) {
      categories.set(template.category, []);
    }
    categories.get(template.category)!.push(template);
  }
  
  for (const [category, categoryTemplates] of categories.entries()) {
    console.log(chalk.bold(chalk.blue(`${category.replace(/_/g, ' ').toUpperCase()}:`)));
    
    for (const template of categoryTemplates) {
      console.log(chalk.green(`  ${template.name}`) + chalk.dim(` (v${template.version})`));
      console.log(chalk.dim(`    ${template.description}`));
      
      if (template.tags && template.tags.length > 0) {
        console.log(chalk.dim(`    Tags: ${template.tags.join(', ')}`));
      }
      console.log();
    }
  }
  
  console.log(chalk.dim('Use `arbiter template add <name>` to insert a template'));
  console.log(chalk.dim('Use `arbiter template show <name>` to view template details'));
}

/**
 * Show template details
 */
export async function showTemplate(templateName: string): Promise<number> {
  const metadata = await loadTemplateMetadata(templateName);
  if (!metadata) {
    console.error(chalk.red(`Template '${templateName}' not found`));
    return 1;
  }
  
  console.log(chalk.cyan(`Template: ${metadata.name}`));
  console.log(chalk.dim(`Version: ${metadata.version} | Author: ${metadata.author}`));
  console.log();
  
  console.log(chalk.bold('Description:'));
  console.log(metadata.description);
  console.log();
  
  console.log(chalk.bold('Category:'), metadata.category);
  if (metadata.tags && metadata.tags.length > 0) {
    console.log(chalk.bold('Tags:'), metadata.tags.join(', '));
  }
  console.log();
  
  if (metadata.usage) {
    console.log(chalk.bold('Usage:'));
    console.log(metadata.usage);
    console.log();
  }
  
  if (metadata.parameters && metadata.parameters.length > 0) {
    console.log(chalk.bold('Parameters:'));
    for (const param of metadata.parameters) {
      console.log(`  ${chalk.green(param.name)} (${param.type}): ${param.description}`);
      if (param.default !== undefined) {
        console.log(chalk.dim(`    Default: ${JSON.stringify(param.default)}`));
      }
    }
    console.log();
  }
  
  if (metadata.examples && metadata.examples.length > 0) {
    console.log(chalk.bold('Examples:'));
    for (const example of metadata.examples) {
      console.log(`  ${chalk.blue('•')} ${example.description}`);
      if (example.values) {
        for (const [key, value] of Object.entries(example.values)) {
          console.log(`    ${key}: ${JSON.stringify(value)}`);
        }
      }
      console.log();
    }
  }
  
  return 0;
}

/**
 * Add/insert template to current directory or specified file
 */
export async function addTemplate(templateName: string, options: TemplateOptions): Promise<number> {
  // Load template metadata and content
  const metadata = await loadTemplateMetadata(templateName);
  const content = await loadTemplateContent(templateName);
  
  if (!metadata || !content) {
    console.error(chalk.red(`Template '${templateName}' not found`));
    console.log(chalk.dim('Use `arbiter template list` to see available templates'));
    return 1;
  }
  
  // Determine output file
  let outputPath: string;
  if (options.output) {
    outputPath = options.output;
  } else {
    // Default to current directory with template name
    outputPath = `${templateName}_constraint.cue`;
  }
  
  try {
    // Check if file exists
    try {
      await fs.access(outputPath);
      console.error(chalk.red(`File '${outputPath}' already exists`));
      console.log(chalk.dim('Use --output to specify a different file, or remove the existing file'));
      return 1;
    } catch {
      // File doesn't exist, which is what we want
    }
    
    // Write template content to file
    await fs.writeFile(outputPath, content, 'utf-8');
    
    console.log(chalk.green(`✓ Template '${templateName}' added to '${outputPath}'`));
    console.log();
    
    console.log(chalk.bold('Next steps:'));
    console.log(`1. Review and customize the template in ${chalk.blue(outputPath)}`);
    if (metadata.parameters && metadata.parameters.length > 0) {
      console.log('2. Adjust the following parameters for your use case:');
      for (const param of metadata.parameters) {
        console.log(`   - ${chalk.green(param.name)}: ${param.description}`);
      }
    }
    console.log(`3. Validate your configuration with ${chalk.cyan('arbiter validate')}`);
    
    if (metadata.examples && metadata.examples.length > 0) {
      console.log();
      console.log(chalk.dim('Tip: Check the examples section in the template file for common configurations'));
    }
    
    return 0;
  } catch (error) {
    console.error(chalk.red('Error writing template:'), error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/**
 * Main template command handler
 */
export async function templateCommand(action: string, templateName?: string, options: TemplateOptions = {}): Promise<number> {
  switch (action) {
    case 'list':
      await listTemplates();
      return 0;
      
    case 'show':
      if (!templateName) {
        console.error(chalk.red('Template name is required for show command'));
        return 1;
      }
      return await showTemplate(templateName);
      
    case 'add':
      if (!templateName) {
        console.error(chalk.red('Template name is required for add command'));
        return 1;
      }
      return await addTemplate(templateName, options);
      
    default:
      console.error(chalk.red(`Unknown template action: ${action}`));
      console.log(chalk.dim('Available actions: list, show, add'));
      return 1;
  }
}