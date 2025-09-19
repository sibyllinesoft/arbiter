/**
 * GitHub Template management command
 *
 * Handles GitHub template scaffolding, generation, and management
 */

import path from 'node:path';
import chalk from 'chalk';
import fs from 'fs-extra';
import type { CLIConfig } from '../types.js';
import { FileBasedTemplateManager } from '../utils/file-based-template-manager.js';

export interface GitHubTemplateOptions {
  /** List available templates */
  list?: boolean;
  /** Initialize templates from scratch */
  init?: boolean;
  /** Generate specific template type */
  generate?: string;
  /** Scaffold template files */
  scaffold?: boolean;
  /** Validate template configuration */
  validate?: boolean;
  /** Output directory for templates */
  outputDir?: string;
  /** Template discovery paths */
  discoveryPaths?: string[];
  /** Verbose output */
  verbose?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
}

/**
 * Main GitHub template command handler
 */
export async function githubTemplateCommand(
  options: GitHubTemplateOptions,
  config: CLIConfig
): Promise<number> {
  try {
    if (options.list) {
      return await listTemplates(options, config);
    }

    if (options.init || options.scaffold) {
      return await scaffoldTemplates(options, config);
    }

    if (options.validate) {
      return await validateTemplates(options, config);
    }

    if (options.generate) {
      return await generateTemplate(options.generate, options, config);
    }

    // Show help by default
    console.log(chalk.blue('Arbiter GitHub Template Management\n'));
    console.log('Available commands:');
    console.log('  --list          List available GitHub templates');
    console.log('  --init          Initialize default template files');
    console.log('  --scaffold      Scaffold template directory structure');
    console.log('  --validate      Validate template configuration');
    console.log('  --generate TYPE Generate a specific template');
    console.log('\nTemplate types: epic, task, bug-report, feature-request');
    console.log('\nOptions:');
    console.log('  --output-dir DIR    Output directory for templates');
    console.log('  --force             Force overwrite existing files');
    console.log('  --verbose           Verbose output');

    return 0;
  } catch (error) {
    console.error(
      chalk.red('GitHub template command failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * List available templates
 */
async function listTemplates(options: GitHubTemplateOptions, config: CLIConfig): Promise<number> {
  try {
    console.log(chalk.blue('📋 Available GitHub Templates\n'));

    // Load template manager
    const templatesConfig = config.github?.templates || {};
    const templateManager = new FileBasedTemplateManager(templatesConfig, config.projectDir);

    // Discover templates in discovery paths
    const discovered = await templateManager.discoverTemplates();

    if (discovered.length === 0) {
      console.log(chalk.yellow('No templates found. Use --init to create default templates.'));
      return 0;
    }

    // Group by directory
    const byDirectory: Record<string, typeof discovered> = {};
    discovered.forEach(template => {
      const dir = path.dirname(template.templatePath);
      if (!byDirectory[dir]) {
        byDirectory[dir] = [];
      }
      byDirectory[dir].push(template);
    });

    // Display templates by directory
    for (const [directory, templates] of Object.entries(byDirectory)) {
      console.log(chalk.cyan(`📁 ${path.relative(config.projectDir, directory)}/`));

      templates.forEach(template => {
        const filename = path.basename(template.templatePath);
        const metadata = template.metadata;

        console.log(`  • ${chalk.green(filename)}`);
        if (metadata?.name) {
          console.log(`    ${chalk.dim('Name:')} ${metadata.name}`);
        }
        if (metadata?.description) {
          console.log(`    ${chalk.dim('Description:')} ${metadata.description}`);
        }
        if (metadata?.inherits) {
          console.log(`    ${chalk.dim('Inherits:')} ${metadata.inherits}`);
        }
        console.log();
      });
    }

    // Show configured templates
    const configuredTemplates = Object.entries(templatesConfig)
      .filter(([key]) => ['base', 'epic', 'task', 'bugReport', 'featureRequest'].includes(key))
      .filter(([, value]) => value);

    if (configuredTemplates.length > 0) {
      console.log(chalk.blue('🔧 Configured Templates\n'));
      configuredTemplates.forEach(([type, templateRef]) => {
        console.log(`  • ${chalk.green(type)}`);
        if ('file' in templateRef) {
          console.log(`    ${chalk.dim('File:')} ${templateRef.file}`);
          if (templateRef.inherits) {
            console.log(`    ${chalk.dim('Inherits:')} ${templateRef.inherits}`);
          }
        } else if ('templateFile' in templateRef && templateRef.templateFile) {
          console.log(`    ${chalk.dim('File:')} ${templateRef.templateFile}`);
        }
        console.log();
      });
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red('Failed to list templates:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Scaffold template files and directory structure
 */
async function scaffoldTemplates(
  options: GitHubTemplateOptions,
  config: CLIConfig
): Promise<number> {
  try {
    const outputDir =
      options.outputDir || path.join(config.projectDir, '.arbiter', 'templates', 'github');

    console.log(chalk.blue('🏗️ Scaffolding GitHub templates...'));
    console.log(chalk.dim(`Output directory: ${outputDir}\n`));

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Copy templates from the existing created directory
    const existingTemplatesDir = path.join(config.projectDir, '.arbiter', 'templates', 'github');

    const templates = [
      { name: 'base.hbs', description: 'Base template for all GitHub issues' },
      { name: 'epic.hbs', description: 'Epic template with task overview' },
      { name: 'task.hbs', description: 'Task template with implementation details' },
      { name: 'bug-report.hbs', description: 'Bug report template with reproduction steps' },
      { name: 'feature-request.hbs', description: 'Feature request template with use cases' },
    ];

    // Create template files
    for (const template of templates) {
      const sourcePath = path.join(existingTemplatesDir, template.name);
      const targetPath = path.join(outputDir, template.name);

      if ((await fs.pathExists(targetPath)) && !options.force) {
        console.log(chalk.yellow(`⚠️  Skipping ${template.name} (already exists)`));
        continue;
      }

      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, targetPath);
        console.log(chalk.green(`✅ Created ${template.name}`));
      } else {
        console.log(chalk.red(`❌ Source template ${template.name} not found`));
      }

      if (options.verbose) {
        console.log(chalk.dim(`   ${template.description}`));
      }
    }

    // Update or create config.json to reference templates
    await updateConfigForTemplates(config, outputDir);

    console.log(chalk.green('\n🎉 Template scaffolding complete!'));
    console.log(chalk.dim('Edit the template files to customize your GitHub issue templates.'));
    console.log(chalk.dim("Use 'arbiter github-template --validate' to check your templates."));

    return 0;
  } catch (error) {
    console.error(
      chalk.red('Failed to scaffold templates:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Validate template configuration and files
 */
async function validateTemplates(
  options: GitHubTemplateOptions,
  config: CLIConfig
): Promise<number> {
  try {
    console.log(chalk.blue('🔍 Validating template configuration...\n'));

    const templatesConfig = config.github?.templates || {};
    const templateManager = new FileBasedTemplateManager(templatesConfig, config.projectDir);

    // Validate configuration
    const errors = await templateManager.validateTemplateConfig();

    if (errors.length === 0) {
      console.log(chalk.green('✅ All template configurations are valid'));
    } else {
      console.log(chalk.red(`❌ Found ${errors.length} validation error(s):\n`));
      errors.forEach(error => {
        console.log(chalk.red(`• ${error.field}: ${error.message}`));
      });
    }

    // Try to load each template to check for syntax errors
    const templateTypes = ['epic', 'task', 'bugReport', 'featureRequest'] as const;
    let syntaxErrors = 0;

    for (const templateType of templateTypes) {
      const templateRef = templatesConfig[templateType];
      if (!templateRef) continue;

      try {
        // Test template loading with sample data
        const sampleData = getSampleDataForTemplate(templateType);

        if (templateType === 'task') {
          await templateManager.generateTaskTemplate(sampleData.task, sampleData.epic);
        } else if (templateType === 'epic') {
          await templateManager.generateEpicTemplate(sampleData);
        } else if (templateType === 'bugReport') {
          await templateManager.generateBugReportTemplate(sampleData);
        } else if (templateType === 'featureRequest') {
          await templateManager.generateFeatureRequestTemplate(sampleData);
        }

        console.log(chalk.green(`✅ ${templateType} template syntax is valid`));
      } catch (error) {
        syntaxErrors++;
        console.log(chalk.red(`❌ ${templateType} template has syntax errors:`));
        console.log(chalk.red(`   ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    const totalErrors = errors.length + syntaxErrors;

    if (totalErrors === 0) {
      console.log(chalk.green('\n🎉 All templates are valid and ready to use!'));
      return 0;
    }
    console.log(chalk.red(`\n💥 Found ${totalErrors} error(s) in templates.`));
    return 1;
  } catch (error) {
    console.error(
      chalk.red('Failed to validate templates:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Generate a specific template for testing
 */
async function generateTemplate(
  templateType: string,
  options: GitHubTemplateOptions,
  config: CLIConfig
): Promise<number> {
  try {
    console.log(chalk.blue(`🎯 Generating ${templateType} template...\n`));

    const templatesConfig = config.github?.templates || {};
    const templateManager = new FileBasedTemplateManager(templatesConfig, config.projectDir);

    // Get sample data for the template type
    const sampleData = getSampleDataForTemplate(templateType);
    let result;

    switch (templateType.toLowerCase()) {
      case 'epic':
        result = await templateManager.generateEpicTemplate(sampleData);
        break;
      case 'task':
        result = await templateManager.generateTaskTemplate(sampleData.task, sampleData.epic);
        break;
      case 'bug-report':
      case 'bug':
        result = await templateManager.generateBugReportTemplate(sampleData);
        break;
      case 'feature-request':
      case 'feature':
        result = await templateManager.generateFeatureRequestTemplate(sampleData);
        break;
      default:
        console.error(chalk.red(`Unknown template type: ${templateType}`));
        console.log('Available types: epic, task, bug-report, feature-request');
        return 1;
    }

    console.log(chalk.green('Generated Template Output:\n'));
    console.log(chalk.cyan(`Title: ${result.title}\n`));
    console.log(chalk.dim('Body:'));
    console.log(result.body);

    if (result.labels.length > 0) {
      console.log(chalk.dim(`\nLabels: ${result.labels.join(', ')}`));
    }

    if (result.assignees && result.assignees.length > 0) {
      console.log(chalk.dim(`Assignees: ${result.assignees.join(', ')}`));
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red(`Failed to generate ${templateType} template:`),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Update config.json to reference template files
 */
async function updateConfigForTemplates(config: CLIConfig, templatesDir: string): Promise<void> {
  const configPath = path.join(config.projectDir, '.arbiter', 'config.json');

  // Read existing config
  let existingConfig: any = {};
  if (await fs.pathExists(configPath)) {
    existingConfig = await fs.readJson(configPath);
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
    discoveryPaths: [relativeTemplatesDir, '~/.arbiter/templates/github'],
    defaultExtension: 'hbs',
    base: {
      file: 'base.hbs',
      metadata: {
        name: 'Arbiter Base Template',
        description: 'Base template for all Arbiter-managed GitHub issues',
      },
    },
    epic: {
      file: 'epic.hbs',
      inherits: 'base.hbs',
      metadata: {
        name: 'Epic',
        description: 'Template for epic issues',
        labels: ['epic', 'priority:{{priority}}', 'status:{{status}}'],
      },
    },
    task: {
      file: 'task.hbs',
      inherits: 'base.hbs',
      metadata: {
        name: 'Task',
        description: 'Template for task issues',
        labels: ['type:{{type}}', 'priority:{{priority}}', 'status:{{status}}', 'epic:{{epicId}}'],
      },
    },
    bugReport: {
      file: 'bug-report.hbs',
      metadata: {
        name: 'Bug Report',
        description: 'Template for bug report issues',
        labels: ['type:bug', 'priority:{{priority}}'],
      },
    },
    featureRequest: {
      file: 'feature-request.hbs',
      metadata: {
        name: 'Feature Request',
        description: 'Template for feature request issues',
        labels: ['type:feature', 'priority:{{priority}}'],
      },
    },
  };

  // Write updated config
  await fs.writeJson(configPath, existingConfig, { spaces: 2 });
  console.log(chalk.dim('📝 Updated .arbiter/config.json with template references'));
}

/**
 * Get sample data for template testing
 */
function getSampleDataForTemplate(templateType: string): any {
  const baseData = {
    id: 'sample-001',
    name: 'Sample Item',
    description: 'This is a sample description for testing the template.',
    priority: 'high',
    status: 'in_progress',
    assignee: 'sample-user',
    estimatedHours: 8,
    acceptanceCriteria: [
      'First acceptance criterion',
      'Second acceptance criterion',
      'Third acceptance criterion',
    ],
    dependencies: ['Complete prerequisite task A', 'Review with stakeholders'],
  };

  switch (templateType.toLowerCase()) {
    case 'epic':
      return {
        ...baseData,
        name: 'Sample Epic',
        successCriteria:
          'Epic is complete when all tasks are done and users can successfully use the new feature',
        inScope: ['Feature A development', 'Integration testing', 'User documentation'],
        outOfScope: ['Advanced analytics', 'Mobile app updates'],
        tasks: [
          {
            id: 'task-001',
            name: 'Implement core functionality',
            type: 'feature',
            priority: 'high',
            status: 'todo',
            estimatedHours: 5,
          },
          {
            id: 'task-002',
            name: 'Add error handling',
            type: 'feature',
            priority: 'medium',
            status: 'todo',
            estimatedHours: 3,
          },
        ],
        stakeholders: [
          { role: 'Product Owner', username: 'product-owner' },
          { role: 'Tech Lead', username: 'tech-lead' },
        ],
      };

    case 'task':
      return {
        task: {
          ...baseData,
          name: 'Sample Task',
          type: 'feature',
          context: 'This task is needed to implement the new user authentication flow.',
          implementationNotes:
            'Use the existing authentication library and extend it for SSO support.',
          testScenarios: [
            'User logs in with SSO',
            'User logs in with existing credentials',
            'Invalid credentials are handled correctly',
          ],
          technicalNotes: 'Requires updating the user model and adding new API endpoints.',
          subtasks: [
            { name: 'Update user model', description: 'Add SSO fields to user schema' },
            { name: 'Create SSO endpoints', description: 'Implement /auth/sso endpoints' },
          ],
        },
        epic: {
          id: 'epic-001',
          name: 'User Authentication Epic',
        },
      };

    case 'bug-report':
    case 'bug':
      return {
        ...baseData,
        summary: 'Login button not responding on Safari',
        stepsToReproduce: [
          'Open the application in Safari browser',
          'Navigate to the login page',
          "Click the 'Log In' button",
          'Observe that nothing happens',
        ],
        expectedBehavior: 'Login modal should appear when clicking the Log In button',
        actualBehavior: 'Clicking the button has no effect and no modal appears',
        environment: {
          os: 'macOS 12.6',
          browser: 'Safari 16.1',
          version: 'v2.1.0',
          additional: 'Issue only occurs on Safari, works fine on Chrome and Firefox',
        },
        impact: {
          affectedUsers: '~15% of users using Safari browser',
          frequency: 'Every time user tries to log in via Safari',
          businessImpact: 'Users cannot access the application, leading to potential churn',
        },
        workaround: 'Users can use Chrome or Firefox browser as an alternative',
        severity: 'high',
        reportedBy: 'qa-tester',
      };

    case 'feature-request':
    case 'feature':
      return {
        ...baseData,
        summary: 'Add dark mode support',
        problemStatement:
          'Many users work in low-light environments and find the current light theme straining on their eyes, especially during extended usage sessions.',
        proposedSolution:
          'Implement a dark mode theme that users can toggle between light and dark modes. The preference should be saved and persist across sessions.',
        useCases: [
          {
            userType: 'developer',
            goal: 'work in low-light environments',
            benefit: 'I can reduce eye strain during long coding sessions',
          },
          {
            userType: 'designer',
            goal: 'review designs in different contexts',
            benefit: 'I can see how designs look in both light and dark themes',
          },
          {
            userType: 'power user',
            goal: 'customize my interface',
            benefit: 'I can personalize my workspace according to my preferences',
          },
        ],
        alternativesConsidered:
          'We considered automatic dark mode based on system settings, but decided to give users explicit control over the theme choice.',
        impact: {
          potentialUsers: 'Survey indicates 60% of users would use dark mode',
          businessValue: 'Improved user satisfaction and reduced eye strain complaints',
          technicalComplexity: 'Medium - requires CSS theme system and preference storage',
          dependencies: 'None - can be implemented independently',
        },
        technicalRequirements: [
          'CSS custom properties for theme switching',
          'User preference storage in localStorage/database',
          'Toggle component in user settings',
          'Dark mode versions of all UI components',
        ],
        targetVersion: 'v2.2.0',
        effortEstimate: '2-3 sprints',
        requestedBy: 'user-research-team',
      };

    default:
      return baseData;
  }
}
