/**
 * CLI Platform Generator
 * 
 * Generates CLI commands and subcommands, interactive prompts, and handles
 * validation and error display for command-line interfaces.
 */

import path from 'path';

import {
  UIGenerator,
  ProfileUI,
  GeneratorOptions,
  GeneratedArtifact,
  Route,
  Component,
  Form,
  TestDefinition,
  CLIGeneratorConfig,
  TemplateContext,
  GeneratorError,
} from '../types.js';

/**
 * CLI Platform Generator Implementation
 * 
 * Generates modern CLI applications with:
 * - Commander.js command structure
 * - Interactive prompts with inquirer
 * - Input validation and error handling
 * - TypeScript support
 * - Comprehensive testing with Vitest
 */
export class CLIGenerator implements UIGenerator {
  readonly platform = 'cli' as const;
  private config: CLIGeneratorConfig;

  constructor(config?: Partial<CLIGeneratorConfig>) {
    this.config = {
      framework: 'commander',
      typescript: true,
      testing: 'vitest',
      ...config,
    };
  }

  /**
   * Generate all CLI artifacts from Profile.ui
   */
  async generate(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    try {
      // Generate main CLI entry point
      const mainCliArtifact = await this.generateMainCLI(ui, options);
      artifacts.push(mainCliArtifact);

      // Generate command structure from routes
      if (ui.routes) {
        for (const [routePath, route] of Object.entries(ui.routes)) {
          const commandArtifact = await this.generateRoute(route, options);
          artifacts.push(commandArtifact);
        }
      }

      // Generate interactive forms as CLI prompts
      if (ui.forms) {
        for (const [formName, form] of Object.entries(ui.forms)) {
          const formArtifact = await this.generateForm(form, options);
          artifacts.push(formArtifact);
        }
      }

      // Generate utility components as CLI helpers
      if (ui.components) {
        for (const [componentName, component] of Object.entries(ui.components)) {
          const componentArtifact = await this.generateComponent(component, options);
          artifacts.push(componentArtifact);
        }
      }

      // Generate tests
      if (ui.tests) {
        const testArtifacts = await this.generateTests(ui.tests, options);
        artifacts.push(...testArtifacts);
      }

      // Generate configuration files
      const configArtifacts = await this.generateConfigFiles(ui, options);
      artifacts.push(...configArtifacts);

    } catch (error) {
      throw new GeneratorError(
        `Failed to generate CLI artifacts: ${error instanceof Error ? error.message : String(error)}`,
        'cli',
        'generation'
      );
    }

    return artifacts;
  }

  /**
   * Generate a CLI command from route
   */
  async generateRoute(route: Route, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const commandName = this.getCommandNameFromPath(route.path);
    const filename = `${commandName}.ts`;
    const relativePath = path.join('commands', filename);

    const content = this.generateCommandModule({
      platform: 'cli',
      route,
      config: this.config,
      imports: this.getCommandImports(),
      exports: [commandName],
    });

    return {
      type: 'route',
      filename,
      path: relativePath,
      content,
      dependencies: this.getCommandDependencies(),
      platform: 'cli',
    };
  }

  /**
   * Generate a CLI utility component
   */
  async generateComponent(component: Component, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${component.name}.ts`;
    const relativePath = path.join('utils', filename);

    const content = this.generateUtilityModule({
      platform: 'cli',
      component,
      config: this.config,
      imports: this.getUtilityImports(component),
      exports: [component.name],
    });

    return {
      type: 'component',
      filename,
      path: relativePath,
      content,
      dependencies: this.getUtilityDependencies(component),
      platform: 'cli',
    };
  }

  /**
   * Generate interactive CLI form with prompts
   */
  async generateForm(form: Form, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const filename = `${form.name}Prompt.ts`;
    const relativePath = path.join('prompts', filename);

    const content = this.generatePromptModule({
      platform: 'cli',
      form,
      config: this.config,
      imports: this.getPromptImports(),
      exports: [`${form.name}Prompt`],
    });

    return {
      type: 'form',
      filename,
      path: relativePath,
      content,
      dependencies: this.getPromptDependencies(),
      platform: 'cli',
    };
  }

  /**
   * Generate CLI tests
   */
  async generateTests(tests: TestDefinition, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    for (const scenario of tests.scenarios) {
      const filename = `${scenario.name.replace(/\s+/g, '-').toLowerCase()}.test.ts`;
      const relativePath = path.join('__tests__', filename);

      const content = this.generateTestFile({
        platform: 'cli',
        tests,
        config: this.config,
        imports: this.getTestImports(),
        exports: [],
      }, scenario);

      artifacts.push({
        type: 'test',
        filename,
        path: relativePath,
        content,
        dependencies: this.getTestDependencies(),
        platform: 'cli',
      });
    }

    return artifacts;
  }

  /**
   * Validate generator options
   */
  validateOptions(options: GeneratorOptions): boolean {
    if (options.platform !== 'cli') {
      return false;
    }

    if (!options.outputDir) {
      return false;
    }

    return true;
  }

  // Private helper methods

  private async generateMainCLI(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact> {
    const content = `#!/usr/bin/env node
/**
 * Main CLI Entry Point
 * Auto-generated from Profile.ui specification
 */

import { Command } from 'commander';
import { version } from '../package.json';

// Import all commands
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const commandName = this.getCommandNameFromPath(path);
  return `import { ${commandName}Command } from './commands/${commandName}.js';`;
}).join('\n') : ''}

const program = new Command();

program
  .name('${this.getCliName(ui)}')
  .description('Auto-generated CLI from Profile.ui specification')
  .version(version);

// Register commands
${ui.routes ? Object.entries(ui.routes).map(([path, route]) => {
  const commandName = this.getCommandNameFromPath(path);
  return `program.addCommand(${commandName}Command);`;
}).join('\n') : ''}

// Global error handler
program.configureOutput({
  writeErr: (str) => process.stderr.write(str),
  writeOut: (str) => process.stdout.write(str),
});

program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  if (err.code === 'commander.version') {
    process.exit(0);
  }
  process.exit(err.exitCode);
});

// Parse command line arguments
program.parse();

export default program;
`;

    return {
      type: 'config',
      filename: 'cli.ts',
      path: 'cli.ts',
      content,
      dependencies: ['commander'],
      platform: 'cli',
    };
  }

  private generateCommandModule(context: TemplateContext): string {
    const { route } = context;
    if (!route) throw new GeneratorError('Route context required', 'cli', 'command');

    const commandName = this.getCommandNameFromPath(route.path);
    const commandDesc = route.props?.description || `Execute ${commandName} command`;

    return `/**
 * ${commandName} Command
 * Auto-generated from Profile.ui specification
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

// Import related utilities
${this.generateCommandImports(route)}

export const ${commandName}Command = new Command('${commandName.toLowerCase()}')
  .description('${commandDesc}')
${this.generateCommandOptions(route)}
  .action(async (options, command) => {
    const spinner = ora('Processing...').start();
    
    try {
      // Command implementation
      await execute${commandName}(options);
      
      spinner.succeed(chalk.green('Command completed successfully'));
    } catch (error) {
      spinner.fail(chalk.red('Command failed'));
      console.error(chalk.red(\`Error: \${error instanceof Error ? error.message : String(error)}\`));
      process.exit(1);
    }
  });

async function execute${commandName}(options: any) {
  // Main command logic
${this.generateCommandLogic(route)}
  
  // Handle capabilities
${route.capabilities ? route.capabilities.map(cap => 
  `  await handle${this.capitalize(cap)}(options);`
).join('\n') : ''}
}

${this.generateCapabilityHandlers(route)}

export default ${commandName}Command;
`;
  }

  private generatePromptModule(context: TemplateContext): string {
    const { form } = context;
    if (!form) throw new GeneratorError('Form context required', 'cli', 'prompt');

    const promptName = `${form.name}Prompt`;

    return `/**
 * ${promptName}
 * Auto-generated interactive prompt from Profile.ui form specification
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

export interface ${form.name}Data {
${form.fields.map(field => 
  `  ${field.name}${field.required ? '' : '?'}: ${this.getFieldType(field.type)};`
).join('\n')}
}

export async function ${promptName}(defaultValues?: Partial<${form.name}Data>): Promise<${form.name}Data> {
  console.log(chalk.blue('\\n📝 ${form.name} Configuration\\n'));

  const questions: inquirer.QuestionCollection = [
${form.fields.map(field => this.generatePromptQuestion(field)).join(',\n')}
  ];

  try {
    const answers = await inquirer.prompt(questions, defaultValues);
    
    // Validate the answers
    const validated = await validate${form.name}Data(answers);
    
    console.log(chalk.green('✅ Configuration completed successfully\\n'));
    
    return validated;
  } catch (error) {
    console.error(chalk.red('❌ Configuration failed:'), error);
    throw error;
  }
}

async function validate${form.name}Data(data: any): Promise<${form.name}Data> {
  const errors: string[] = [];

${form.fields.filter(f => f.required).map(field => 
  `  if (!data.${field.name}) {
    errors.push('${field.label} is required');
  }`
).join('\n')}

${form.fields.map(field => this.generateFieldValidation(field)).filter(Boolean).join('\n')}

  if (errors.length > 0) {
    throw new Error(\`Validation failed: \${errors.join(', ')}\`);
  }

  return data as ${form.name}Data;
}

export default ${promptName};
`;
  }

  private generateUtilityModule(context: TemplateContext): string {
    const { component } = context;
    if (!component) throw new GeneratorError('Component context required', 'cli', 'utility');

    return `/**
 * ${component.name} Utility
 * Auto-generated from Profile.ui component specification
 */

import chalk from 'chalk';
import { table } from 'table';
import ora from 'ora';

export interface ${component.name}Options {
${component.props ? Object.entries(component.props).map(([key, value]) => 
  `  ${key}?: ${this.getTypeFromValue(value)};`
).join('\n') : '  // No options defined'}
}

${this.generateUtilityFunctions(component)}

export default {
${this.generateUtilityExports(component)}
};
`;
  }

  private generateTestFile(context: TemplateContext, scenario: any): string {
    const { tests } = context;
    if (!tests) throw new GeneratorError('Test context required', 'cli', 'test');

    return `/**
 * ${scenario.name} CLI Test
 * Auto-generated from Profile.ui specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock external dependencies
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

describe('${scenario.name}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('${scenario.description}', async () => {
${this.generateCLITestSteps(scenario.steps)}
  });

  it('handles errors gracefully', async () => {
    // Error handling test
    const { stderr } = await execAsync('node cli.js invalid-command').catch(e => e);
    expect(stderr).toContain('Unknown command');
  });

  it('shows help when requested', async () => {
    const { stdout } = await execAsync('node cli.js --help');
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('Commands:');
  });

  it('shows version when requested', async () => {
    const { stdout } = await execAsync('node cli.js --version');
    expect(stdout).toMatch(/\\d+\\.\\d+\\.\\d+/);
  });
});
`;
  }

  private async generateConfigFiles(ui: ProfileUI, options: GeneratorOptions): Promise<GeneratedArtifact[]> {
    const artifacts: GeneratedArtifact[] = [];

    // Generate package.json for CLI
    artifacts.push({
      type: 'config',
      filename: 'package.json',
      path: 'package.json',
      content: this.generatePackageJson(ui),
      platform: 'cli',
    });

    // Generate TypeScript config
    if (this.config.typescript) {
      artifacts.push({
        type: 'config',
        filename: 'tsconfig.json',
        path: 'tsconfig.json',
        content: this.generateTsConfig(),
        platform: 'cli',
      });
    }

    return artifacts;
  }

  // Utility methods

  private getCommandNameFromPath(path: string): string {
    return path
      .replace(/^\//, '')
      .replace(/\/:/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .replace(/^./, str => str.toUpperCase()) || 'UnknownCommand';
  }

  private getCliName(ui: ProfileUI): string {
    return ui.config?.name || 'generated-cli';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private getFieldType(fieldType: string): string {
    switch (fieldType) {
      case 'number': return 'number';
      case 'checkbox': return 'boolean';
      case 'select': return 'string';
      default: return 'string';
    }
  }

  private getTypeFromValue(value: any): string {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'any[]';
    return 'any';
  }

  private generateCommandOptions(route: Route): string {
    if (!route.props) return '';
    
    return Object.entries(route.props).map(([key, value]) => {
      const type = typeof value === 'boolean' ? 'boolean' : 'string';
      return `  .option('--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}', '${key} option')`;
    }).join('\n');
  }

  private generateCommandLogic(route: Route): string {
    return `  console.log(chalk.blue('Executing ${route.component || 'command'}...'));
  
  // Implementation will be added based on route capabilities
  console.log('Options:', options);`;
  }

  private generateCapabilityHandlers(route: Route): string {
    if (!route.capabilities) return '';

    return route.capabilities.map(cap => `
async function handle${this.capitalize(cap)}(options: any) {
  console.log(chalk.yellow(\`Handling ${cap}...\`));
  // Implementation for ${cap} capability
}
`).join('\n');
  }

  private generateCommandImports(route: Route): string {
    return '// Additional imports will be added based on command requirements';
  }

  private generatePromptQuestion(field: any): string {
    const questionType = this.getInquirerType(field.type);
    
    return `    {
      type: '${questionType}',
      name: '${field.name}',
      message: '${field.label}:',
      ${field.required ? 'validate: (input) => input ? true : \'This field is required\',' : ''}
      ${field.placeholder ? `default: '${field.placeholder}',` : ''}
      ${field.options ? `choices: ${JSON.stringify(field.options.map((opt: any) => ({ name: opt.label, value: opt.value })))},` : ''}
    }`;
  }

  private getInquirerType(fieldType: string): string {
    switch (fieldType) {
      case 'password': return 'password';
      case 'number': return 'number';
      case 'checkbox': return 'confirm';
      case 'select': return 'list';
      case 'textarea': return 'editor';
      default: return 'input';
    }
  }

  private generateFieldValidation(field: any): string {
    const validations: string[] = [];

    if (field.type === 'email') {
      validations.push(`  if (data.${field.name} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${field.name})) {
    errors.push('${field.label} must be a valid email address');
  }`);
    }

    if (field.validation?.min) {
      if (field.type === 'number') {
        validations.push(`  if (data.${field.name} && data.${field.name} < ${field.validation.min}) {
    errors.push('${field.label} must be at least ${field.validation.min}');
  }`);
      } else {
        validations.push(`  if (data.${field.name} && data.${field.name}.length < ${field.validation.min}) {
    errors.push('${field.label} must be at least ${field.validation.min} characters');
  }`);
      }
    }

    return validations.join('\n');
  }

  private generateUtilityFunctions(component: Component): string {
    switch (component.type) {
      case 'list':
        return `
export function display${component.name}List(items: any[], options?: ${component.name}Options) {
  if (!items || items.length === 0) {
    console.log(chalk.yellow('No items to display'));
    return;
  }

  const tableData = items.map(item => [
    item.id || '',
    item.name || '',
    item.status || '',
  ]);

  const output = table([
    ['ID', 'Name', 'Status'],
    ...tableData
  ]);

  console.log(output);
}

export function filter${component.name}(items: any[], filter: string) {
  return items.filter(item => 
    JSON.stringify(item).toLowerCase().includes(filter.toLowerCase())
  );
}`;

      case 'form':
        return `
export async function process${component.name}Form(data: any, options?: ${component.name}Options) {
  const spinner = ora('Processing form data...').start();
  
  try {
    // Process form data
    console.log('Form data:', data);
    spinner.succeed('Form processed successfully');
  } catch (error) {
    spinner.fail('Form processing failed');
    throw error;
  }
}`;

      default:
        return `
export function process${component.name}(data: any, options?: ${component.name}Options) {
  console.log(chalk.blue(\`Processing ${component.name}...\`));
  console.log('Data:', data);
  console.log('Options:', options);
}`;
    }
  }

  private generateUtilityExports(component: Component): string {
    switch (component.type) {
      case 'list':
        return `  display${component.name}List,
  filter${component.name},`;
      case 'form':
        return `  process${component.name}Form,`;
      default:
        return `  process${component.name},`;
    }
  }

  private generateCLITestSteps(steps: any[]): string {
    return steps.map(step => {
      switch (step.action) {
        case 'click':
          return `    // Simulate command execution
    const result = await execAsync('node cli.js ${step.target}');
    expect(result.stdout).toBeTruthy();`;
        case 'fill':
          return `    // Mock prompt input
    const inquirer = await import('inquirer');
    vi.mocked(inquirer.default.prompt).mockResolvedValue({ ${step.target}: '${step.value}' });`;
        case 'expect':
          return `    expect(result.stdout).toContain('${step.assertion}');`;
        default:
          return `    // ${step.action} step implementation for CLI`;
      }
    }).join('\n    ');
  }

  // Import and dependency helpers

  private getCommandImports(): string[] {
    return ['commander', 'inquirer', 'chalk', 'ora'];
  }

  private getUtilityImports(component: Component): string[] {
    const imports = ['chalk'];
    if (component.type === 'list') {
      imports.push('table');
    }
    return imports;
  }

  private getPromptImports(): string[] {
    return ['inquirer', 'chalk'];
  }

  private getTestImports(): string[] {
    return ['vitest', 'child_process'];
  }

  private getCommandDependencies(): string[] {
    return ['commander', 'inquirer', 'chalk', 'ora'];
  }

  private getUtilityDependencies(component: Component): string[] {
    const deps = ['chalk'];
    if (component.type === 'list') {
      deps.push('table');
    }
    return deps;
  }

  private getPromptDependencies(): string[] {
    return ['inquirer', 'chalk'];
  }

  private getTestDependencies(): string[] {
    return ['vitest'];
  }

  // Config generators

  private generatePackageJson(ui: ProfileUI): string {
    return `{
  "name": "${ui.config?.name || 'generated-cli'}",
  "version": "1.0.0",
  "description": "Auto-generated CLI from Profile.ui specification",
  "type": "module",
  "bin": {
    "${ui.config?.name || 'generated-cli'}": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/cli.ts",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0",
    "table": "^6.8.0"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}`;
  }

  private generateTsConfig(): string {
    return `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": false,
    "outDir": "dist",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`;
  }
}