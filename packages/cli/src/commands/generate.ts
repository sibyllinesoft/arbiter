/**
 * Generate command - Core code generation based on assembly.cue configuration
 *
 * This is the primary command for generating project files, CI workflows,
 * language-specific configurations, and other artifacts based on the
 * specification stored in the .arbiter/ directory.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AppSpec,
  AssemblyConfig,
  ConfigWithVersion,
  DeploymentConfig,
  ServiceConfig as DeploymentServiceConfig,
  DeploymentTarget,
  EnhancedGenerateOptions,
  SchemaVersion,
  TestCase,
  TestCompositionResult,
  TestSuite,
} from '@arbiter/shared';
import chalk from 'chalk';
import fs from 'fs-extra';
import { ApiClient } from '../api-client.js';
import { DEFAULT_PROJECT_STRUCTURE } from '../config.js';
import {
  generateComponent,
  generateService,
  initializeProject,
  registry as languageRegistry,
} from '../language-plugins/index.js';
import type {
  ProjectConfig as LanguageProjectConfig,
  ServiceConfig as LanguageServiceConfig,
} from '../language-plugins/index.js';
import { extractVariablesFromCue, templateManager } from '../templates/index.js';
import type { CLIConfig, ProjectStructureConfig } from '../types.js';
import { GenerationHookManager } from '../utils/generation-hooks.js';
import {
  createRepositoryConfig,
  getSmartRepositoryConfig,
  validateRepositoryConfig,
} from '../utils/git-detection.js';
import { GitHubSyncClient } from '../utils/github-sync.js';
import { ShardedCUEStorage } from '../utils/sharded-storage.js';
import { formatWarnings, validateSpecification } from '../validation/warnings.js';

export interface GenerateOptions {
  outputDir?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  spec?: string;
  syncGithub?: boolean;
  githubDryRun?: boolean;
}

const PATH_SEPARATOR_REGEX = /[\\/]+/;

function toPathSegments(value: string): string[] {
  return value.split(PATH_SEPARATOR_REGEX).filter(Boolean);
}

function joinRelativePath(...parts: string[]): string {
  return parts
    .flatMap(part => part.split(PATH_SEPARATOR_REGEX))
    .filter(Boolean)
    .join('/');
}

function slugify(value: string | undefined, fallback = 'app'): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return normalized.length > 0 ? normalized : fallback;
}

function configureLanguagePluginRuntime(language: string, cliConfig: CLIConfig): void {
  const generatorConfig = cliConfig.generator;
  const overridesEntry = generatorConfig?.templateOverrides?.[language];
  const overrideList = Array.isArray(overridesEntry)
    ? overridesEntry
    : overridesEntry
      ? [overridesEntry]
      : [];

  const baseDir = cliConfig.configDir || cliConfig.projectDir || process.cwd();
  const resolvedOverrides = overrideList.map(dir =>
    path.isAbsolute(dir) ? dir : path.resolve(baseDir, dir)
  );

  languageRegistry.configure(language, {
    templateOverrides: resolvedOverrides,
    pluginConfig: generatorConfig?.plugins?.[language],
    workspaceRoot: cliConfig.projectDir,
  });
}

let activeHookManager: GenerationHookManager | null = null;

function setActiveHookManager(manager: GenerationHookManager | null): void {
  activeHookManager = manager;
}

async function writeFileWithHooks(
  filePath: string,
  content: string,
  options: GenerateOptions,
  mode?: number
): Promise<void> {
  let finalContent = content;
  if (activeHookManager) {
    finalContent = await activeHookManager.beforeFileWrite(filePath, finalContent);
  }

  if (!options.dryRun) {
    if (mode !== undefined) {
      await fs.writeFile(filePath, finalContent, { mode });
    } else {
      await fs.writeFile(filePath, finalContent);
    }
  }

  if (activeHookManager) {
    await activeHookManager.afterFileWrite(filePath, finalContent);
  }
}

async function ensureDirectory(dir: string, options: GenerateOptions): Promise<void> {
  if (options.dryRun) {
    return;
  }
  await fs.ensureDir(dir);
}

interface ClientGenerationContext {
  slug: string;
  root: string;
  routesDir: string;
}

interface ServiceGenerationContext {
  name: string;
  root: string;
  routesDir: string;
  language: string;
}

function createClientContext(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string
): ClientGenerationContext {
  const slug = slugify(appSpec.product?.name, 'app');
  const root = path.join(outputDir, structure.clientsDirectory, slug);
  const routesDir = path.join(root, 'src', 'routes');

  return { slug, root, routesDir };
}

function createServiceContext(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string
): ServiceGenerationContext {
  const slug = slugify(serviceName, serviceName);
  const root = path.join(outputDir, structure.servicesDirectory, slug);
  const routesDir = path.join(root, 'src', 'routes');
  const language = (serviceConfig?.language as string | undefined) || 'typescript';

  return { name: slug, root, routesDir, language };
}

async function ensureBaseStructure(
  structure: ProjectStructureConfig,
  outputDir: string,
  options: GenerateOptions
): Promise<void> {
  const baseDirs = [
    structure.clientsDirectory,
    structure.servicesDirectory,
    structure.modulesDirectory,
    structure.toolsDirectory,
    structure.docsDirectory,
    structure.testsDirectory,
    structure.infraDirectory,
  ].filter(Boolean);

  for (const dir of baseDirs) {
    await ensureDirectory(path.join(outputDir, dir), options);
  }
}

// Simple command execution for CUE evaluation
async function executeCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', data => (stdout += data.toString()));
    proc.stderr?.on('data', data => (stderr += data.toString()));

    const timeout = setTimeout(() => {
      proc.kill();
      resolve({ success: false, stdout, stderr: 'Command timed out' });
    }, options.timeout || 10000);

    proc.on('close', code => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    proc.on('error', error => {
      clearTimeout(timeout);
      resolve({ success: false, stdout, stderr: error.message });
    });
  });
}

/**
 * Discover available specs in .arbiter/ directories
 */
function discoverSpecs(): Array<{ name: string; path: string }> {
  const specs: Array<{ name: string; path: string }> = [];

  if (fs.existsSync('.arbiter')) {
    const specDirs = fs
      .readdirSync('.arbiter', { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const specName of specDirs) {
      const assemblyPath = path.join('.arbiter', specName, 'assembly.cue');
      if (fs.existsSync(assemblyPath)) {
        specs.push({ name: specName, path: assemblyPath });
      }
    }
  }

  return specs;
}

/**
 * Handle GitHub synchronization for epics and tasks
 */
async function handleGitHubSync(options: GenerateOptions, config: CLIConfig): Promise<void> {
  if (options.verbose) {
    console.log(chalk.dim('🔄 Starting GitHub sync handler...'));
  }

  try {
    // Smart repository configuration with Git auto-detection
    const smartRepoConfig = getSmartRepositoryConfig(config.github?.repository, {
      verbose: options.verbose,
    });

    // Handle case where no repository info could be determined
    if (!smartRepoConfig) {
      console.error(chalk.red('❌ No GitHub repository configuration found'));
      console.log(chalk.dim('Options to fix this:'));
      console.log(
        chalk.dim(
          '  1. Initialize Git and add GitHub remote: git remote add origin https://github.com/owner/repo.git'
        )
      );
      console.log(chalk.dim('  2. Or add GitHub configuration to your .arbiter/config.json:'));
      console.log(
        chalk.dim(`{
  "github": {
    "repository": {
      "owner": "your-org",
      "repo": "your-repo"
    },
    "mapping": {
      "epicPrefix": "[Epic]",
      "taskPrefix": "[Task]",
      "defaultLabels": ["arbiter-generated"]
    },
    "behavior": {
      "createMilestones": true,
      "autoClose": true,
      "syncAcceptanceCriteria": true,
      "syncAssignees": false
    }
  }
}`)
      );
      console.log(chalk.dim('\\nAnd set your GitHub token as an environment variable:'));
      console.log(chalk.dim('  export GITHUB_TOKEN=your_github_personal_access_token'));
      return;
    }

    const finalRepo = smartRepoConfig.repo;

    // Validate the final repository configuration
    const validation = validateRepositoryConfig(finalRepo);
    if (!validation.valid) {
      console.error(chalk.red('❌ Invalid repository configuration:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
      if (validation.suggestions.length > 0) {
        console.log(chalk.dim('\\nSuggestions:'));
        validation.suggestions.forEach(suggestion => {
          console.log(chalk.dim(`  • ${suggestion}`));
        });
      }
      return;
    }

    // Ensure we have owner and repo from somewhere
    if (!finalRepo.owner || !finalRepo.repo) {
      console.error(chalk.red('❌ Repository owner and name are required'));
      console.log(
        chalk.dim(
          'Either configure them in .arbiter/config.json or ensure your Git remote is set correctly'
        )
      );
      return;
    }

    // Create GitHub configuration with the resolved repository info
    const githubConfig = {
      repository: finalRepo,
      mapping: config.github?.mapping || {
        epicPrefix: '[Epic]',
        taskPrefix: '[Task]',
        defaultLabels: ['arbiter-generated'],
      },
      behavior: config.github?.behavior || {
        createMilestones: true,
        autoClose: true,
        syncAcceptanceCriteria: true,
        syncAssignees: false,
      },
    };

    // Display repository info
    if (options.verbose || smartRepoConfig.source !== 'config') {
      const sourceInfo =
        smartRepoConfig.source === 'detected'
          ? 'auto-detected from Git remote'
          : smartRepoConfig.source === 'merged'
            ? 'merged from config and Git remote'
            : 'from configuration';

      console.log(chalk.dim(`📁 Repository: ${finalRepo.owner}/${finalRepo.repo} (${sourceInfo})`));
    }

    // Load epics from the project
    console.log(chalk.blue('📋 Loading epics and tasks...'));
    const storage = new ShardedCUEStorage();
    await storage.initialize();
    const epics = await storage.listEpics();

    if (epics.length === 0) {
      console.log(chalk.yellow('⚠️  No epics found to sync'));
      console.log(chalk.dim('Create epics with: arbiter epic create <name>'));
      return;
    }

    console.log(
      chalk.dim(
        `Found ${epics.length} epics with ${epics.reduce((sum, epic) => sum + epic.tasks.length, 0)} total tasks`
      )
    );

    // Create GitHub sync client
    const githubClient = new GitHubSyncClient(githubConfig);

    // Determine if this is a dry run
    const isDryRun = options.githubDryRun || options.dryRun;

    if (isDryRun) {
      console.log(chalk.blue('🔍 GitHub Sync Preview (dry run)'));

      // Generate preview
      const preview = await githubClient.generateSyncPreview(epics);

      // Display preview results
      console.log(chalk.green('\\n📊 Sync Preview:'));

      // Epics
      if (preview.epics.create.length > 0) {
        console.log(chalk.cyan(`\\n  📝 Epics to create: ${preview.epics.create.length}`));
        preview.epics.create.forEach(epic => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.update.length > 0) {
        console.log(chalk.yellow(`\\n  📝 Epics to update: ${preview.epics.update.length}`));
        preview.epics.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name}`));
        });
      }

      if (preview.epics.close.length > 0) {
        console.log(chalk.red(`\\n  📝 Epics to close: ${preview.epics.close.length}`));
        preview.epics.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • ${epic.name} (${epic.status})`));
        });
      }

      // Tasks
      if (preview.tasks.create.length > 0) {
        console.log(chalk.cyan(`\\n  🔧 Tasks to create: ${preview.tasks.create.length}`));
        preview.tasks.create.forEach(task => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.update.length > 0) {
        console.log(chalk.yellow(`\\n  🔧 Tasks to update: ${preview.tasks.update.length}`));
        preview.tasks.update.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.type})`));
        });
      }

      if (preview.tasks.close.length > 0) {
        console.log(chalk.red(`\\n  🔧 Tasks to close: ${preview.tasks.close.length}`));
        preview.tasks.close.forEach(({ task }) => {
          console.log(chalk.dim(`    • ${task.name} (${task.status})`));
        });
      }

      // Milestones
      if (preview.milestones.create.length > 0) {
        console.log(
          chalk.cyan(`\\n  🎯 Milestones to create: ${preview.milestones.create.length}`)
        );
        preview.milestones.create.forEach(epic => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.update.length > 0) {
        console.log(
          chalk.yellow(`\\n  🎯 Milestones to update: ${preview.milestones.update.length}`)
        );
        preview.milestones.update.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name}`));
        });
      }

      if (preview.milestones.close.length > 0) {
        console.log(chalk.red(`\\n  🎯 Milestones to close: ${preview.milestones.close.length}`));
        preview.milestones.close.forEach(({ epic }) => {
          console.log(chalk.dim(`    • Epic: ${epic.name} (${epic.status})`));
        });
      }

      const totalChanges =
        preview.epics.create.length +
        preview.epics.update.length +
        preview.epics.close.length +
        preview.tasks.create.length +
        preview.tasks.update.length +
        preview.tasks.close.length +
        preview.milestones.create.length +
        preview.milestones.update.length +
        preview.milestones.close.length;

      if (totalChanges === 0) {
        console.log(chalk.green('\\n✅ No changes needed - everything is already in sync'));
      } else {
        console.log(
          chalk.blue('\\n💡 Run without --github-dry-run or --dry-run to apply these changes')
        );
      }
    } else {
      console.log(chalk.blue('🚀 Syncing to GitHub...'));

      // Perform actual sync
      const syncResults = await githubClient.syncToGitHub(epics, false);

      // Group and display results
      const created = syncResults.filter(r => r.action === 'created');
      const updated = syncResults.filter(r => r.action === 'updated');
      const closed = syncResults.filter(r => r.action === 'closed');
      const skipped = syncResults.filter(r => r.action === 'skipped');

      console.log(chalk.green('\\n✅ GitHub Sync Complete:'));

      if (created.length > 0) {
        console.log(chalk.cyan(`  📝 Created: ${created.length} items`));
        created.forEach(result => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`)
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (updated.length > 0) {
        console.log(chalk.yellow(`  📝 Updated: ${updated.length} items`));
        updated.forEach(result => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`)
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (closed.length > 0) {
        console.log(chalk.red(`  📝 Closed: ${closed.length} items`));
        closed.forEach(result => {
          if (result.githubNumber) {
            console.log(
              chalk.dim(`    • ${result.type} #${result.githubNumber}: ${result.details}`)
            );
          } else {
            console.log(chalk.dim(`    • ${result.type}: ${result.details}`));
          }
        });
      }

      if (skipped.length > 0 && options.verbose) {
        console.log(chalk.dim(`  ⏭️  Skipped: ${skipped.length} items (no changes needed)`));
      }

      console.log(
        chalk.green(
          `\\n🔗 Check your GitHub repository: https://github.com/${finalRepo.owner}/${finalRepo.repo}/issues`
        )
      );
    }
  } catch (error) {
    console.error(
      chalk.red('❌ GitHub sync failed:'),
      error instanceof Error ? error.message : String(error)
    );
    if (options.verbose) {
      console.error(chalk.dim('Full error:'), error);
    }

    console.log(chalk.dim('\\nTroubleshooting tips:'));
    console.log(
      chalk.dim('  • Ensure GITHUB_TOKEN environment variable is set with proper permissions')
    );
    console.log(chalk.dim("  • Verify your GitHub token has 'repo' or 'issues:write' permission"));
    console.log(chalk.dim('  • Check that the repository owner/name is correct'));
    console.log(chalk.dim('  • Ensure Git remote origin points to the correct GitHub repository'));
    console.log(chalk.dim('  • Use --verbose for more error details'));
    console.log(
      chalk.dim('  • Use --use-config or --use-git-remote to resolve repository conflicts')
    );
  }
}

/**
 * Main generate command implementation
 */
export async function generateCommand(
  options: GenerateOptions,
  config: CLIConfig,
  specName?: string
): Promise<number> {
  if (options.verbose) {
    console.log(chalk.dim('🔧 Generate options:'), JSON.stringify(options, null, 2));
  }
  try {
    console.log(chalk.blue('🏗️  Generating project artifacts from assembly.cue...'));

    // First, try to emit the CUE file from stored specification in service
    await emitSpecificationFromService(config);

    let assemblyPath: string;
    let assemblyContent: string;

    // Determine which assembly file to use
    if (specName || options.spec) {
      // Use specified spec name
      const targetSpec = specName || options.spec!;
      assemblyPath = path.join('.arbiter', targetSpec, 'assembly.cue');

      if (!fs.existsSync(assemblyPath)) {
        console.error(chalk.red(`❌ Spec "${targetSpec}" not found at ${assemblyPath}`));

        // Show available specs
        const availableSpecs = discoverSpecs();
        if (availableSpecs.length > 0) {
          console.log(chalk.yellow('\n📋 Available specs:'));
          availableSpecs.forEach(spec => {
            console.log(chalk.cyan(`  • ${spec.name}`));
          });
          console.log(chalk.dim(`\n💡 Usage: arbiter generate ${availableSpecs[0].name}`));
        } else {
          console.log(chalk.dim('No specs found in .arbiter/ directory'));
        }
        return 1;
      }

      console.log(chalk.dim(`📁 Using spec: ${targetSpec}`));
    } else {
      // Auto-discover approach
      const availableSpecs = discoverSpecs();

      if (availableSpecs.length === 0) {
        // Check for assembly.cue in .arbiter directory first
        const arbiterPath = path.resolve('.arbiter', 'assembly.cue');

        if (fs.existsSync(arbiterPath)) {
          assemblyPath = arbiterPath;
          console.log(chalk.dim('📁 Using .arbiter/assembly.cue'));
        } else {
          console.error(chalk.red('❌ No assembly specifications found'));
          console.log(chalk.dim('Create a spec with: arbiter add service <name>'));
          console.log(chalk.dim('Or initialize with: arbiter init'));
          return 1;
        }
      } else if (availableSpecs.length === 1) {
        // Use the single available spec
        assemblyPath = availableSpecs[0].path;
        console.log(chalk.green(`✅ Auto-detected spec: ${availableSpecs[0].name}`));
      } else {
        // Multiple specs found - require user to specify
        console.error(chalk.red('❌ Multiple specs found. Please specify which one to use:'));
        console.log(chalk.yellow('\n📋 Available specs:'));
        availableSpecs.forEach(spec => {
          console.log(chalk.cyan(`  • arbiter generate ${spec.name}`));
        });
        return 1;
      }
    }

    assemblyContent = fs.readFileSync(assemblyPath, 'utf-8');
    const configWithVersion = await parseAssemblyFile(assemblyPath);

    if (options.verbose) {
      console.log(chalk.dim('Assembly configuration:'));
      console.log(
        chalk.dim(
          `Schema version: ${configWithVersion.schema.version} (detected from: ${configWithVersion.schema.detected_from})`
        )
      );
      console.log(chalk.dim(JSON.stringify(configWithVersion, null, 2)));
    }

    // Validate specification completeness
    console.log(chalk.blue('🔍 Validating specification completeness...'));
    const validationResult = validateSpecification(configWithVersion.app || configWithVersion);

    if (validationResult.hasErrors) {
      console.log(formatWarnings(validationResult));
      console.error(
        chalk.red('\n❌ Cannot generate with errors present. Please fix the errors above.')
      );
      return 1;
    }

    if (validationResult.hasWarnings && !options.force) {
      console.log('\n' + chalk.yellow('⚠️  Specification validation warnings found:'));
      console.log(formatWarnings(validationResult));
      console.log(chalk.blue('\n💡 To proceed: Add --force flag to generate with warnings'));
      console.log(
        chalk.dim(
          'Recommendation: Fix the warnings above for a complete, production-ready specification.'
        )
      );

      return 1;
    }

    if (validationResult.hasWarnings && options.force) {
      console.log(formatWarnings(validationResult));
      console.log(chalk.yellow('\n⚠️  Generating despite warnings (--force used)'));
      console.log(chalk.red.bold('\n🚨 REMINDER FOR AI AGENTS:'));
      console.log(
        chalk.yellow(
          'You should have requested user approval before using --force with incomplete specifications.'
        )
      );
      console.log(
        chalk.dim('This may result in production issues that require additional work later.')
      );
    }

    if (!validationResult.hasWarnings && !validationResult.hasErrors) {
      console.log(chalk.green('✅ Specification validation passed'));
    }

    // Determine output directory
    const outputDir = options.outputDir || '.';

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const hookManager = config.generator?.hooks
      ? new GenerationHookManager({
          hooks: config.generator.hooks,
          workspaceRoot: config.projectDir || process.cwd(),
          outputDir: path.resolve(outputDir),
          configDir: config.configDir,
          dryRun: Boolean(options.dryRun),
        })
      : null;

    if (hookManager) {
      setActiveHookManager(hookManager);
      await hookManager.runBeforeGenerate();
    }

    const results = [];

    try {
      // Generate application artifacts
      if (configWithVersion.app) {
        console.log(chalk.blue('🎨 Generating application artifacts...'));
        const projectStructure: ProjectStructureConfig = {
          ...DEFAULT_PROJECT_STRUCTURE,
          ...config.projectStructure,
        };

        const appResults = await generateAppArtifacts(
          configWithVersion,
          outputDir,
          options,
          projectStructure,
          config
        );
        results.push(...appResults);
      } else {
        throw new Error('Invalid configuration: missing app specification data');
      }

      // Report results
      if (options.dryRun) {
        console.log(chalk.yellow('🔍 Dry run - files that would be generated:'));
        results.forEach(file => console.log(chalk.dim(`  ${file}`)));
      } else {
        console.log(chalk.green(`✅ Generated ${results.length} files:`));
        results.forEach(file => console.log(chalk.dim(`  ✓ ${file}`)));
      }

      if (hookManager) {
        await hookManager.runAfterGenerate(results);
      }

      // Handle GitHub synchronization if requested
      if (options.syncGithub || options.githubDryRun) {
        await handleGitHubSync(options, config);
      }

      return 0;
    } finally {
      if (hookManager) {
        setActiveHookManager(null);
      }
    }
  } catch (error) {
    console.error(
      chalk.red('❌ Generate failed:'),
      error instanceof Error ? error.message : String(error)
    );
    return 1;
  }
}

/**
 * Parse assembly.cue file and extract configuration with schema version detection
 */
async function parseAssemblyFile(assemblyPath: string): Promise<ConfigWithVersion> {
  try {
    // Use CUE to evaluate and export as JSON
    const result = await executeCommand('cue', ['eval', '--out', 'json', assemblyPath], {
      timeout: 10000,
    });

    if (!result.success) {
      console.error('CUE evaluation failed:', result.stderr);
      return fallbackParseAssembly(assemblyPath);
    }

    const cueData = JSON.parse(result.stdout);

    // Detect schema version based on structure
    const schemaVersion = detectSchemaVersion(cueData);

    // Parse app schema
    return parseAppSchema(cueData, schemaVersion);
  } catch (error) {
    console.error('Error parsing CUE file:', error);
    return fallbackParseAssembly(assemblyPath);
  }
}

/**
 * Detect schema version based on CUE data structure
 */
function detectSchemaVersion(cueData: any): SchemaVersion {
  // Always use app schema - it's the primary and only supported schema now
  return {
    version: 'app',
    detected_from: 'metadata',
  };
}

/**
 * Parse App Specification schema
 */
function parseAppSchema(cueData: any, schemaVersion: SchemaVersion): ConfigWithVersion {
  const appSpec: AppSpec = {
    product: cueData.product || {
      name: 'Unknown App',
    },
    config: cueData.config,
    ui: cueData.ui || {
      routes: [],
    },
    locators: cueData.locators || {},
    flows: cueData.flows || [],
    services: cueData.services,
    domain: cueData.domain,
    components: cueData.components,
    paths: cueData.paths,
    testability: cueData.testability,
    ops: cueData.ops,
    stateModels: cueData.stateModels,
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = cueData;

  return config;
}

// Fallback to file-based regex parsing if CUE evaluation fails
async function fallbackParseAssembly(assemblyPath: string): Promise<ConfigWithVersion> {
  const content = await fs.readFile(assemblyPath, 'utf-8');

  // Always use app schema
  const schemaVersion: SchemaVersion = { version: 'app', detected_from: 'default' };

  console.warn('⚠️  CUE evaluation failed - using limited fallback parsing');

  // Extract basic information from the CUE file
  const nameMatch = content.match(/name:\s*"([^"]+)"/);
  const languageMatch = content.match(/language:\s*"([^"]+)"/);
  const productName = nameMatch ? nameMatch[1] : 'Unknown App';
  const language = languageMatch ? languageMatch[1] : 'typescript';

  const appSpec: AppSpec = {
    product: { name: productName },
    config: { language },
    ui: { routes: [] },
    locators: {},
    flows: [],
  };

  const config: ConfigWithVersion = {
    schema: schemaVersion,
    app: appSpec,
  };

  (config as any)._fullCueData = { product: appSpec.product, config: appSpec.config };

  return config;
}

/**
 * Generate app-centric artifacts from app specification
 */
async function generateAppArtifacts(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig
): Promise<string[]> {
  const files: string[] = [];
  const appSpec = configWithVersion.app;

  if (!appSpec) {
    return files;
  }

  console.log(chalk.green(`📱 Generating artifacts for: ${appSpec.product.name}`));

  await ensureBaseStructure(structure, outputDir, options);

  const clientContext = createClientContext(appSpec, structure, outputDir);
  await ensureDirectory(clientContext.root, options);

  const routeFiles = await generateUIComponents(appSpec, clientContext, options);
  files.push(
    ...routeFiles.map(file =>
      joinRelativePath(structure.clientsDirectory, clientContext.slug, file)
    )
  );

  if (Object.keys(appSpec.locators).length > 0) {
    const locatorFiles = await generateLocatorDefinitions(appSpec, clientContext, options);
    files.push(
      ...locatorFiles.map(file =>
        joinRelativePath(structure.clientsDirectory, clientContext.slug, file)
      )
    );
  }

  if (appSpec.flows.length > 0) {
    const testFiles = await generateFlowBasedTests(
      appSpec,
      outputDir,
      options,
      structure,
      clientContext
    );
    files.push(...testFiles);
  }

  if (appSpec.components || appSpec.paths) {
    const apiFiles = await generateAPISpecifications(appSpec, outputDir, options, structure);
    files.push(...apiFiles);
  }

  if (appSpec.services && Object.keys(appSpec.services).length > 0) {
    const serviceFiles = await generateServiceStructures(appSpec, outputDir, options, structure);
    files.push(...serviceFiles);
  }

  const moduleFiles = await generateModuleArtifacts(appSpec, outputDir, options, structure);
  files.push(...moduleFiles);

  const toolingFiles = await generateToolingArtifacts(appSpec, outputDir, options, structure);
  files.push(...toolingFiles);

  const docFiles = await generateDocumentationArtifacts(appSpec, outputDir, options, structure);
  files.push(...docFiles);

  const clientProjectFiles = await generateProjectStructure(
    appSpec,
    outputDir,
    options,
    structure,
    clientContext,
    cliConfig
  );
  files.push(...clientProjectFiles);

  const infraFiles = await generateInfrastructureArtifacts(
    configWithVersion,
    outputDir,
    options,
    structure,
    appSpec
  );
  files.push(...infraFiles);

  return files;
}

/**
 * Generate UI components from app spec routes
 */
async function generateUIComponents(
  appSpec: AppSpec,
  clientContext: ClientGenerationContext,
  options: GenerateOptions
): Promise<string[]> {
  const files: string[] = [];
  const language = appSpec.config?.language || 'typescript';

  if (language !== 'typescript') {
    console.log(
      chalk.yellow(
        `⚠️  UI route generation currently supports TypeScript React projects. Skipping for '${language}'.`
      )
    );
    return files;
  }

  await ensureDirectory(clientContext.routesDir, options);

  const typeFilePath = path.join(clientContext.routesDir, 'types.ts');
  const typeFileRelative = joinRelativePath('src', 'routes', 'types.ts');
  await writeFileWithHooks(
    typeFilePath,
    `import type { ComponentType } from 'react';\n\nexport interface RouteDefinition {\n  id: string;\n  path: string;\n  Component: ComponentType;\n  description?: string;\n  children?: RouteDefinition[];\n}\n\nexport type RouteDefinitions = RouteDefinition[];\n`,
    options
  );
  files.push(typeFileRelative);

  const routeDefinitions: Array<{ importName: string }> = [];

  for (const route of appSpec.ui.routes) {
    const baseName = route.id
      .split(':')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    const componentName = `${baseName}View`;
    const definitionName = `${baseName}Route`;
    const fileName = `${definitionName}.tsx`;
    const relPath = joinRelativePath('src', 'routes', fileName);
    const filePath = path.join(clientContext.routesDir, fileName);
    const rawPath = route.path || `/${route.id.replace(/:/g, '/')}`;
    const safePath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const title = route.name || baseName;
    const description =
      route.summary ||
      route.description ||
      (Array.isArray(route.capabilities) && route.capabilities.length > 0
        ? `Capabilities: ${route.capabilities.join(', ')}`
        : 'Auto-generated view');

    const capabilityList = Array.isArray(route.capabilities)
      ? route.capabilities.map(cap => `          <li>${cap}</li>`).join('\n')
      : '';

    const capabilityBlock = capabilityList
      ? `        <section className="route-capabilities">\n          <h2>Capabilities</h2>\n          <ul>\n${capabilityList}\n          </ul>\n        </section>\n`
      : '';

    const componentContent = `import React from 'react';\nimport type { RouteDefinition } from './types';\n\nconst ${componentName}: React.FC = () => {\n  return (\n    <section data-route="${route.id}" role="main">\n      <header>\n        <h1>${title}</h1>\n        <p>${description}</p>\n      </header>\n${capabilityBlock}    </section>\n  );\n};\n\nexport const ${definitionName}: RouteDefinition = {\n  id: '${route.id}',\n  path: '${safePath}',\n  Component: ${componentName},\n};\n`;

    await writeFileWithHooks(filePath, componentContent, options);
    files.push(relPath);
    routeDefinitions.push({ importName: definitionName });
  }

  const aggregatorPath = path.join(clientContext.routesDir, 'index.tsx');
  const aggregatorRelative = joinRelativePath('src', 'routes', 'index.tsx');
  const imports = routeDefinitions
    .map(definition => `import { ${definition.importName} } from './${definition.importName}';`)
    .join('\n');
  const definitionsArray = routeDefinitions.map(definition => definition.importName).join(', ');

  const aggregatorContent = `import React from 'react';\nimport type { RouteObject } from 'react-router-dom';\nimport type { RouteDefinition } from './types';\n${imports ? `${imports}\n` : ''}\nconst definitions: RouteDefinition[] = [${definitionsArray}];\n\nconst toRouteObject = (definition: RouteDefinition): RouteObject => {\n  const View = definition.Component;\n  return {\n    path: definition.path,\n    element: <View />,\n    children: definition.children?.map(toRouteObject),\n  };\n};\n\nexport const routes: RouteObject[] = definitions.map(toRouteObject);\nexport type { RouteDefinition } from './types';\n`;

  await writeFileWithHooks(aggregatorPath, aggregatorContent, options);
  files.push(aggregatorRelative);

  const appRoutesPath = path.join(clientContext.routesDir, 'AppRoutes.tsx');
  const appRoutesRelative = joinRelativePath('src', 'routes', 'AppRoutes.tsx');
  const appRoutesContent = `import React from 'react';
import { useRoutes } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

export interface AppRoutesProps {
  routes: RouteObject[];
}

export function AppRoutes({ routes }: AppRoutesProps) {
  return useRoutes(routes);
}
`;

  await writeFileWithHooks(appRoutesPath, appRoutesContent, options);
  files.push(appRoutesRelative);

  return files;
}

/**
 * Generate test cases based on app flows
 */
async function generateFlowBasedTests(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientContext?: ClientGenerationContext
): Promise<string[]> {
  const files: string[] = [];

  console.log(chalk.blue('🧪 Generating tests from flows...'));

  // Determine language for test generation
  const language = appSpec.config?.language || 'typescript';
  const plugin = languageRegistry.get(language);

  if (!plugin) {
    console.log(
      chalk.yellow(`⚠️  No plugin available for ${language}, using default Playwright tests`)
    );
  }

  const testsDirSegments = [
    ...toPathSegments(structure.testsDirectory),
    clientContext?.slug ?? 'app',
    'flows',
  ];
  const testsDir = path.join(outputDir, ...testsDirSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }

  for (const flow of appSpec.flows) {
    // Use plugin-specific test generation if available, otherwise fallback to default
    let testContent: string;

    if (plugin?.capabilities?.testing) {
      // Generate using language plugin
      const testConfig = {
        name: flow.id,
        type: 'e2e',
        framework: 'playwright',
        flow: flow,
        locators: appSpec.locators,
      };

      try {
        // Note: This would need to be implemented in each language plugin
        testContent = `// ${flow.id} flow test - Generated by Arbiter (${plugin.name})
// TODO: Implement plugin-specific test generation
import { test, expect } from '@playwright/test';`;
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  Plugin test generation failed, using default: ${error.message}`)
        );
        testContent = generateDefaultFlowTest(flow, appSpec.locators);
      }
    } else {
      testContent = generateDefaultFlowTest(flow, appSpec.locators);
    }

    const testFileName = `${flow.id.replace(/:/g, '_')}.test.ts`;
    const testPath = path.join(testsDir, testFileName);
    await writeFileWithHooks(testPath, testContent, options);
    files.push(
      joinRelativePath(
        structure.testsDirectory,
        clientContext?.slug ?? 'app',
        'flows',
        testFileName
      )
    );
  }

  return files;
}

/**
 * Generate default Playwright test content
 */
function generateDefaultFlowTest(flow: any, locators: any): string {
  const preconditionsCode = flow.preconditions
    ? `
  test.beforeEach(async ({ page }) => {
    // Setup preconditions
    ${flow.preconditions.role ? `// Role: ${flow.preconditions.role}` : ''}
    ${flow.preconditions.env ? `// Environment: ${flow.preconditions.env}` : ''}
    ${
      flow.preconditions.seed
        ? flow.preconditions.seed
            .map((seed: any) => `// Seed: ${seed.factory} as ${seed.as}`)
            .join('\n    ')
        : ''
    }
  });
  `
    : '';

  const stepsCode = flow.steps
    .map((step: any, index: number) => {
      if (step.visit) {
        return `// Step ${index + 1}: Visit ${step.visit}
    await page.goto('${typeof step.visit === 'string' ? step.visit : `/${step.visit.replace(':', '/')}`}');`;
      }
      if (step.click) {
        const locator = locators[step.click];
        return `// Step ${index + 1}: Click ${step.click}
    await page.click('${locator || step.click}');`;
      }
      if (step.fill) {
        const locator = locators[step.fill.locator];
        return `// Step ${index + 1}: Fill ${step.fill.locator} with "${step.fill.value}"
    await page.fill('${locator || step.fill.locator}', '${step.fill.value}');`;
      }
      if (step.expect) {
        const locator = locators[step.expect.locator];
        return `// Step ${index + 1}: Expect ${step.expect.locator} to be ${step.expect.state || 'visible'}
    await expect(page.locator('${locator || step.expect.locator}')).${step.expect.state === 'visible' ? 'toBeVisible' : `toHaveAttribute('data-state', '${step.expect.state}')`}();`;
      }
      if (step.expect_api) {
        return `// Step ${index + 1}: Expect API ${step.expect_api.method} ${step.expect_api.path} to return ${step.expect_api.status}
    // TODO: Implement API expectation`;
      }
      return `// Step ${index + 1}: Unknown step type`;
    })
    .join('\n    ');

  const variantsCode = flow.variants
    ? flow.variants
        .map(
          (variant: any) => `
  test('${flow.id} - ${variant.name} variant', async ({ page }) => {
    // TODO: Implement variant testing with override: ${JSON.stringify(variant.override)}
  });`
        )
        .join('')
    : '';

  return `// ${flow.id} flow test - Generated by Arbiter
import { test, expect } from '@playwright/test';

test.describe('${flow.id} flow', () => {${preconditionsCode}
  
  test('${flow.id} - main flow', async ({ page }) => {
    ${stepsCode}
  });${variantsCode}
});
`;
}

/**
 * Generate API specifications from components and paths
 */
async function generateAPISpecifications(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];

  console.log(chalk.blue('📋 Generating API specifications...'));

  // Determine language for API generation
  const language = appSpec.config?.language || 'typescript';
  const plugin = languageRegistry.get(language);

  const apiDir = path.join(outputDir, structure.docsDirectory, 'api');
  if (!fs.existsSync(apiDir) && !options.dryRun) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Generate API services using language plugin if available
  if (plugin?.capabilities?.api && appSpec.components) {
    console.log(chalk.blue(`🚀 Generating ${language} API services using ${plugin.name}...`));

    // Generate services for each component that has API methods
    for (const [componentName, component] of Object.entries(appSpec.components || {})) {
      if (component.methods && component.methods.length > 0) {
        const serviceConfig: LanguageServiceConfig = {
          name: componentName,
          type: 'api',
          methods: component.methods,
          validation: true,
        };

        try {
          const result = await generateService(language, serviceConfig);

          // Write all generated files
          for (const file of result.files) {
            const fullPath = path.join(apiDir, file.path.replace(/^src\//i, ''));
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir) && !options.dryRun) {
              fs.mkdirSync(dir, { recursive: true });
            }

            await writeFileWithHooks(fullPath, file.content, options);

            files.push(
              joinRelativePath(structure.docsDirectory, 'api', file.path.replace(/^src\//i, ''))
            );
          }
        } catch (error) {
          console.error(
            chalk.red(`❌ Failed to generate ${language} service for ${componentName}:`),
            error.message
          );
        }
      }
    }
  }

  // Generate OpenAPI spec if paths are defined (universal, not language-specific)
  if (appSpec.paths) {
    const openApiSpec = {
      openapi: '3.0.3',
      info: {
        title: appSpec.product.name,
        version: '1.0.0',
        description: appSpec.product.goals?.join('; ') || 'Generated API specification',
      },
      paths: {} as Record<string, any>,
      components: { schemas: {} as Record<string, any> },
    };

    // Add component schemas if available
    if (appSpec.components?.schemas) {
      openApiSpec.components.schemas = Object.fromEntries(
        Object.entries(appSpec.components.schemas).map(([name, schema]) => [
          name,
          {
            type: 'object',
            example: schema.example,
            ...(schema.examples && { examples: schema.examples }),
          },
        ])
      );
    }

    // Convert paths to OpenAPI format
    for (const [pathKey, pathSpec] of Object.entries(appSpec.paths)) {
      openApiSpec.paths[pathKey] = {};

      for (const [method, operation] of Object.entries(pathSpec)) {
        openApiSpec.paths[pathKey][method] = {
          summary: `${method.toUpperCase()} ${pathKey}`,
          ...(operation.request && {
            requestBody: {
              content: {
                'application/json': {
                  schema: operation.request.$ref ? { $ref: operation.request.$ref } : {},
                  example: operation.request.example,
                },
              },
            },
          }),
          responses: {
            [operation.status || (method === 'get' ? 200 : 201)]: {
              description: 'Success',
              content: {
                'application/json': {
                  schema: operation.response?.$ref ? { $ref: operation.response.$ref } : {},
                  example: operation.response?.example,
                },
              },
            },
          },
        };
      }
    }

    const specPath = path.join(apiDir, 'openapi.json');
    await writeFileWithHooks(specPath, JSON.stringify(openApiSpec, null, 2), options);
    files.push(joinRelativePath(structure.docsDirectory, 'api', 'openapi.json'));
  }

  return files;
}

async function generateModuleArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];

  if (!appSpec.components && !appSpec.domain && !appSpec.stateModels) {
    return files;
  }

  const modulesRoot = path.join(outputDir, structure.modulesDirectory);
  await ensureDirectory(modulesRoot, options);

  if (appSpec.components) {
    for (const [componentName, componentSpec] of Object.entries(appSpec.components)) {
      const fileName = `${componentName}.json`;
      const filePath = path.join(modulesRoot, fileName);
      await writeFileWithHooks(filePath, JSON.stringify(componentSpec, null, 2), options);
      files.push(joinRelativePath(structure.modulesDirectory, fileName));
    }
  }

  if (appSpec.domain) {
    const domainPath = path.join(modulesRoot, 'domain.json');
    await writeFileWithHooks(domainPath, JSON.stringify(appSpec.domain, null, 2), options);
    files.push(joinRelativePath(structure.modulesDirectory, 'domain.json'));
  }

  if (appSpec.stateModels) {
    const stateModelsPath = path.join(modulesRoot, 'state-models.json');
    await writeFileWithHooks(
      stateModelsPath,
      JSON.stringify(appSpec.stateModels, null, 2),
      options
    );
    files.push(joinRelativePath(structure.modulesDirectory, 'state-models.json'));
  }

  return files;
}

async function generateDocumentationArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];
  const docsRoot = path.join(outputDir, structure.docsDirectory);
  await ensureDirectory(docsRoot, options);

  const overviewSections: string[] = [];
  overviewSections.push(`# ${appSpec.product.name}

${appSpec.product.description || 'Auto-generated documentation overview.'}
`);

  if (appSpec.product.goals?.length) {
    overviewSections.push('## Product Goals\n');
    overviewSections.push(appSpec.product.goals.map(goal => `- ${goal}`).join('\n'));
    overviewSections.push('');
  }

  if (appSpec.ui.routes.length > 0) {
    overviewSections.push('## Routes\n');
    overviewSections.push(
      appSpec.ui.routes
        .map(route => {
          const routePath = route.path ?? route.id ?? '';
          const displayName = route.name ?? route.id ?? routePath;
          return `- \`${routePath}\`: ${displayName}`;
        })
        .join('\n')
    );
    overviewSections.push('');
  }

  if (appSpec.services && Object.keys(appSpec.services).length > 0) {
    overviewSections.push('## Services\n');
    overviewSections.push(
      Object.entries(appSpec.services)
        .map(
          ([name, svc]) =>
            `- **${name}**: ${svc?.description || svc?.technology || 'Service definition'}`
        )
        .join('\n')
    );
    overviewSections.push('');
  }

  const overviewPath = path.join(docsRoot, 'overview.md');
  await writeFileWithHooks(overviewPath, overviewSections.join('\n'), options);
  files.push(joinRelativePath(structure.docsDirectory, 'overview.md'));

  if (appSpec.flows.length > 0) {
    const flowsPath = path.join(docsRoot, 'flows.md');
    const flowsContent = ['# User Flows', '']
      .concat(
        appSpec.flows.map(flow => {
          const steps = flow.steps
            ?.map((step: any, idx: number) => `  ${idx + 1}. ${JSON.stringify(step)}`)
            .join('\n');
          return `## ${flow.id}\n\n${flow.description || 'Generated flow'}\n\n${steps ? '**Steps:**\n' + steps + '\n' : ''}`;
        })
      )
      .join('\n');

    await writeFileWithHooks(flowsPath, flowsContent, options);
    files.push(joinRelativePath(structure.docsDirectory, 'flows.md'));
  }

  return files;
}

async function generateToolingArtifacts(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];
  const toolsRoot = path.join(outputDir, structure.toolsDirectory);
  await ensureDirectory(toolsRoot, options);

  const automationNotes = appSpec.ops?.automation?.notes || [];
  const toolingContent = [
    `# Tooling for ${appSpec.product.name}`,
    '',
    appSpec.ops?.automation?.tools?.length
      ? '## Automated Tools\n' +
        appSpec.ops.automation.tools.map((tool: string) => `- ${tool}`).join('\n')
      : '## Automated Tools\n- No tooling defined in specification.\n',
    automationNotes.length
      ? ['## Notes\n', ...automationNotes.map((note: string) => `- ${note}`), ''].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const toolingPath = path.join(toolsRoot, 'README.md');
  await writeFileWithHooks(toolingPath, toolingContent, options);
  files.push(joinRelativePath(structure.toolsDirectory, 'README.md'));

  return files;
}

async function generateInfrastructureArtifacts(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  appSpec: AppSpec
): Promise<string[]> {
  const files: string[] = [];
  const cueData = (configWithVersion as any)._fullCueData;

  if (!cueData?.deployment && !cueData?.services) {
    return files;
  }

  const projectName = slugify(appSpec.product?.name, 'app');
  const baseConfig = {
    name: projectName,
    language: appSpec.config?.language || 'typescript',
  };

  const terraformFiles = await generateTerraformKubernetes(
    baseConfig,
    outputDir,
    configWithVersion,
    options,
    structure
  );
  files.push(...terraformFiles);

  const composeFiles = await generateDockerCompose(
    baseConfig,
    outputDir,
    configWithVersion,
    options,
    structure
  );
  files.push(...composeFiles);

  return files;
}

/**
 * Generate locator definitions for UI testing
 */
async function generateLocatorDefinitions(
  appSpec: AppSpec,
  clientContext: ClientGenerationContext,
  options: GenerateOptions
): Promise<string[]> {
  const files: string[] = [];

  console.log(chalk.blue('🎯 Generating locator definitions...'));

  const locatorsContent = `// UI Locators - Generated by Arbiter
// These locators provide a stable contract between tests and UI implementation

export const locators = {
${Object.entries(appSpec.locators)
  .map(([token, selector]) => `  '${token}': '${selector}',`)
  .join('\n')}
} as const;

export type LocatorToken = keyof typeof locators;

// Helper function to get locator by token
export function getLocator(token: LocatorToken): string {
  return locators[token];
}

// Type-safe locator access
export function loc(token: LocatorToken): string {
  return locators[token];
}
`;

  const locatorsDir = path.join(clientContext.root, 'src', 'routes');
  const locatorsPath = path.join(locatorsDir, 'locators.ts');

  await ensureDirectory(locatorsDir, options);

  await writeFileWithHooks(locatorsPath, locatorsContent, options);
  files.push(joinRelativePath('src', 'routes', 'locators.ts'));

  return files;
}

/**
 * Generate project structure
 */
async function generateProjectStructure(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientContext: ClientGenerationContext,
  cliConfig: CLIConfig
): Promise<string[]> {
  const files: string[] = [];

  // Determine language from app spec config
  const language = appSpec.config?.language || 'typescript';
  const plugin = languageRegistry.get(language);

  if (plugin) {
    console.log(chalk.blue(`📦 Initializing ${language} project using ${plugin.name}...`));

    configureLanguagePluginRuntime(language, cliConfig);

    // Create project configuration for the language plugin
    const projectConfig: LanguageProjectConfig = {
      name: appSpec.product.name.toLowerCase().replace(/\s+/g, '-'),
      description: appSpec.product.goals?.join('; ') || 'Generated by Arbiter',
      features: [],
      testing: true,
    };

    try {
      const result = await initializeProject(language, projectConfig);

      // Write all generated files from the language plugin
      for (const file of result.files) {
        const fullPath = path.join(clientContext.root, file.path);
        const dir = path.dirname(fullPath);

        await ensureDirectory(dir, options);

        await writeFileWithHooks(
          fullPath,
          file.content,
          options,
          file.executable ? 0o755 : undefined
        );

        files.push(joinRelativePath(structure.clientsDirectory, clientContext.slug, file.path));
      }

      // Log additional setup instructions from the language plugin
      if (result.instructions) {
        result.instructions.forEach(instruction => console.log(chalk.green(`✅ ${instruction}`)));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to initialize ${language} project:`), error.message);
      return files;
    }
  } else {
    console.log(
      chalk.yellow(`⚠️  No language plugin available for '${language}', using minimal structure`)
    );

    // Fallback: create minimal project structure
    const packageJson = {
      name: appSpec.product.name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: appSpec.product.goals?.join('; ') || 'Generated by Arbiter',
      arbiter: {
        projectStructure: {
          services: structure.servicesDirectory,
          modules: structure.modulesDirectory,
          tools: structure.toolsDirectory,
          docs: structure.docsDirectory,
          tests: structure.testsDirectory,
          infra: structure.infraDirectory,
        },
      },
    };

    const packagePath = path.join(clientContext.root, 'package.json');
    await ensureDirectory(path.dirname(packagePath), options);
    await writeFileWithHooks(packagePath, JSON.stringify(packageJson, null, 2), options);
    files.push(joinRelativePath(structure.clientsDirectory, clientContext.slug, 'package.json'));
  }

  // Generate README
  const readmeContent = `# ${appSpec.product.name}

Generated by Arbiter from app specification.

## Overview

${appSpec.product.goals ? appSpec.product.goals.map(goal => `- ${goal}`).join('\n') : 'No goals specified'}

${
  appSpec.product.constraints
    ? `
## Constraints

${appSpec.product.constraints.map(constraint => `- ${constraint}`).join('\n')}
`
    : ''
}

## Routes

${appSpec.ui.routes.map(route => `- **${route.path}** (${route.id}): ${route.capabilities.join(', ')}`).join('\n')}

## Flows

${appSpec.flows.map(flow => `- **${flow.id}**: ${flow.steps.length} steps`).join('\n')}

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm run test        # Playwright tests
npm run test:unit   # Unit tests
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
`;

  const readmePath = path.join(clientContext.root, 'README.md');
  await writeFileWithHooks(readmePath, readmeContent, options);
  files.push(joinRelativePath(structure.clientsDirectory, clientContext.slug, 'README.md'));

  return files;
}

/**
 * Generate service structures from app specification
 */
async function generateServiceStructures(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];

  if (!appSpec.services || Object.keys(appSpec.services).length === 0) {
    return files;
  }

  console.log(chalk.blue('🔧 Generating service structures...'));

  for (const [serviceName, serviceConfig] of Object.entries(appSpec.services)) {
    if (!serviceConfig || typeof serviceConfig !== 'object') continue;

    const serviceContext = createServiceContext(serviceName, serviceConfig, structure, outputDir);
    await ensureDirectory(serviceContext.root, options);

    const language = serviceContext.language.toLowerCase();
    const relativePrefix = [structure.servicesDirectory, serviceContext.name];

    console.log(
      chalk.dim(`  • ${serviceName} (${language}) -> ${joinRelativePath(...relativePrefix)}`)
    );

    const generationPayload = {
      name: serviceContext.name,
      version: '1.0.0',
      service: serviceConfig,
      routesDir: serviceContext.routesDir,
    };

    let generated: string[] = [];

    switch (language) {
      case 'typescript':
        generated = await generateTypeScriptFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceContext
        );
        break;
      case 'python':
        generated = await generatePythonFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceContext
        );
        break;
      case 'go':
        generated = await generateGoFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceContext
        );
        break;
      case 'rust':
        generated = await generateRustFiles(
          generationPayload,
          serviceContext.root,
          options,
          structure,
          serviceContext
        );
        break;
      default:
        console.log(
          chalk.yellow(
            `    ⚠️  Service language '${language}' not supported for automated scaffolding.`
          )
        );
        continue;
    }

    files.push(
      ...generated.map(file => joinRelativePath(...relativePrefix, file.replace(/^\.\//, '')))
    );
  }

  return files;
}

/**
 * Generate language-specific files
 */
async function generateLanguageFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  assemblyConfig?: any,
  cliConfig?: CLIConfig
): Promise<string[]> {
  const files: string[] = [];

  // Use language plugin system for code generation
  const language = config.language || 'typescript';
  const plugin = languageRegistry.get(language);

  if (plugin) {
    console.log(chalk.blue(`📦 Generating ${language} project using ${plugin.name}...`));

    if (cliConfig) {
      configureLanguagePluginRuntime(language, cliConfig);
    }

    // Initialize project using the language plugin
    const projectConfig: LanguageProjectConfig = {
      name: config.name,
      description: config.description,
      features: config.features || [],
      testing: config.testing !== false,
    };

    try {
      const result = await initializeProject(language, projectConfig);

      // Write all generated files
      for (const file of result.files) {
        const fullPath = path.join(outputDir, file.path);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir) && !options.dryRun) {
          fs.mkdirSync(dir, { recursive: true });
        }

        await writeFileWithHooks(
          fullPath,
          file.content,
          options,
          file.executable ? 0o755 : undefined
        );

        files.push(file.path);
      }

      // Log additional setup instructions
      if (result.instructions) {
        result.instructions.forEach(instruction => console.log(chalk.green(`✅ ${instruction}`)));
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to generate ${language} project:`), error.message);
      // Fallback to legacy generation for unsupported languages
      if (language === 'shell' || language === 'bash') {
        files.push(...(await generateShellFiles(config, outputDir, options, structure)));
      }
    }
  } else {
    console.log(chalk.yellow(`⚠️  No plugin available for language: ${language}`));
    // Fallback for unsupported languages
    if (language === 'shell' || language === 'bash') {
      files.push(...(await generateShellFiles(config, outputDir, options, structure)));
    }
  }

  return files;
}

/**
 * Generate TypeScript project files
 */
async function generateTypeScriptFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceContext?: ServiceGenerationContext
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};

  const packageJson = {
    name: config.name,
    version: config.version,
    type: 'module',
    scripts: {
      dev: 'ts-node-dev --respawn src/index.ts',
      start: 'node dist/index.js',
      build: 'tsc -p tsconfig.json',
      test: 'vitest',
      lint: 'eslint "src/**/*.ts"',
    },
    dependencies: {
      fastify: '^4.25.0',
      '@fastify/cors': '^9.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0',
      'ts-node-dev': '^2.0.0',
      eslint: '^8.0.0',
      vitest: '^1.2.0',
    },
  };

  const packagePath = path.join(outputDir, 'package.json');
  await writeFileWithHooks(packagePath, JSON.stringify(packageJson, null, 2), options);
  files.push('package.json');

  const tsconfigJson = {
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src',
      module: 'ESNext',
      target: 'ES2022',
      moduleResolution: 'Node',
      resolveJsonModule: true,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
    },
    include: ['src'],
    exclude: ['dist', 'node_modules'],
  };

  const tsconfigPath = path.join(outputDir, 'tsconfig.json');
  await writeFileWithHooks(tsconfigPath, JSON.stringify(tsconfigJson, null, 2), options);
  files.push('tsconfig.json');

  const srcDir = path.join(outputDir, 'src');
  await ensureDirectory(srcDir, options);

  const indexContent = `import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerRoutes } from './routes';

async function bootstrap() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await registerRoutes(app);

  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info('Service "${config.name}" listening on %d', port);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export { bootstrap };
`;

  const indexPath = path.join(srcDir, 'index.ts');
  await writeFileWithHooks(indexPath, indexContent, options);
  files.push('src/index.ts');

  const routesDir = serviceContext?.routesDir || path.join(srcDir, 'routes');
  await ensureDirectory(routesDir, options);

  const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
  const parsedRoutes = endpoints.map((endpoint: any, index: number) => {
    if (typeof endpoint === 'string') {
      const [methodPart, ...urlParts] = endpoint.trim().split(/\s+/);
      return {
        method: (methodPart || 'GET').toUpperCase(),
        url: urlParts.join(' ') || `/${config.name}`,
        summary: undefined,
        reply: `not_implemented_${index}`,
      };
    }

    return {
      method: (endpoint.method || 'GET').toUpperCase(),
      url: endpoint.path || endpoint.url || `/${config.name}`,
      summary: endpoint.summary,
      reply: endpoint.replyExample || `not_implemented_${index}`,
    };
  });

  const routesIndexPath = path.join(routesDir, 'index.ts');
  const routesIndexContent = `import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RouteBinding {
  method: string;
  url: string;
  summary?: string;
  reply?: unknown;
}

const routeDefinitions: RouteBinding[] = ${JSON.stringify(parsedRoutes, null, 2)};

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  for (const definition of routeDefinitions) {
    app.route({
      method: definition.method as any,
      url: definition.url,
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.status(200).send({
          route: definition.url,
          status: 'not_implemented',
          summary: definition.summary,
          example: definition.reply,
        });
      },
    });
  }
}

export const routes = routeDefinitions;
`;

  await writeFileWithHooks(routesIndexPath, routesIndexContent, options);
  files.push('src/routes/index.ts');

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}

/**
 * Generate Python project files
 */
async function generatePythonFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceContext?: ServiceGenerationContext
): Promise<string[]> {
  const files: string[] = [];
  const serviceSpec = config.service ?? {};

  const pyprojectToml = `[build-system]\nrequires = [\"setuptools>=45\", \"wheel\"]\nbuild-backend = \"setuptools.build_meta\"\n\n[project]\nname = \"${config.name}\"\nversion = \"${config.version}\"\ndescription = \"Generated by Arbiter\"\nrequires-python = \">=3.10\"\ndependencies = [\n    \"fastapi>=0.110.0\",\n    \"uvicorn[standard]>=0.27.0\",\n    \"pydantic>=2.5.0\"\n]\n`;

  const pyprojectPath = path.join(outputDir, 'pyproject.toml');
  await writeFileWithHooks(pyprojectPath, pyprojectToml, options);
  files.push('pyproject.toml');

  const requirementsPath = path.join(outputDir, 'requirements.txt');
  const requirementsContent = `fastapi>=0.110.0\nuvicorn[standard]>=0.27.0\n`;
  await writeFileWithHooks(requirementsPath, requirementsContent, options);
  files.push('requirements.txt');

  const appDir = path.join(outputDir, 'app');
  await ensureDirectory(appDir, options);
  const routesDir = path.join(appDir, 'routes');
  await ensureDirectory(routesDir, options);

  const port = typeof serviceSpec.port === 'number' ? serviceSpec.port : 8000;
  const mainContent = `from fastapi import FastAPI\nfrom .routes import register_routes\n\napp = FastAPI(title=\"${config.name}\")\n\n@app.on_event(\"startup\")\nasync def startup_event() -> None:\n    await register_routes(app)\n\n\n@app.get(\"/health\")\nasync def healthcheck() -> dict[str, str]:\n    return {\"status\": \"ok\"}\n\n\ndef build_app() -> FastAPI:\n    return app\n\n\nif __name__ == \"__main__\":\n    import uvicorn\n\n    uvicorn.run(app, host=\"0.0.0.0\", port=${port})\n`;

  await writeFileWithHooks(path.join(appDir, 'main.py'), mainContent, options);
  files.push('app/main.py');

  const endpoints = Array.isArray(serviceSpec.endpoints) ? serviceSpec.endpoints : [];
  const parsedRoutes = endpoints.map((endpoint: any, index: number) => {
    if (typeof endpoint === 'string') {
      const [methodPart, ...urlParts] = endpoint.trim().split(/\\s+/);
      const method = (methodPart ?? 'GET').toLowerCase();
      const url = urlParts.join(' ') || `/${config.name}`;
      return {
        method,
        url,
        name: `${method}_${index}`,
        summary: undefined as string | undefined,
      };
    }

    const method = (endpoint?.method ?? 'GET').toLowerCase();
    const url = endpoint?.path ?? endpoint?.url ?? `/${config.name}`;
    return {
      method,
      url,
      name: endpoint?.operationId ?? `handler_${index}`,
      summary: endpoint?.summary as string | undefined,
    };
  });

  const defaultRoute = {
    method: 'get',
    url: '/',
    name: `${config.name}_root`,
    summary: `Default endpoint for ${config.name}`,
  };

  const routeBlocks = (parsedRoutes.length > 0 ? parsedRoutes : [defaultRoute])
    .map(route => {
      const summary = (route.summary ?? 'Generated endpoint stub')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ');
      return [
        `@router.${route.method}(\"${route.url}\")`,
        `async def ${route.name}() -> dict[str, str]:`,
        `    \"\"\"${summary}\"\"\"`,
        `    return {\"route\": \"${route.url}\", \"status\": \"not_implemented\"}`,
        '',
      ].join('\n');
    })
    .join('\n');

  const routesInit = [
    'from fastapi import APIRouter, FastAPI',
    '',
    'router = APIRouter()',
    '',
    routeBlocks,
    'async def register_routes(app: FastAPI) -> None:',
    '    app.include_router(router)',
    '',
  ]
    .filter(Boolean)
    .join('\n');

  await writeFileWithHooks(path.join(routesDir, '__init__.py'), routesInit, options);
  files.push('app/routes/__init__.py');

  await writeFileWithHooks(path.join(appDir, '__init__.py'), '', options);
  files.push('app/__init__.py');

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}

/**
 * Generate Rust project files
 */
async function generateRustFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceContext?: ServiceGenerationContext
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);

  // Cargo.toml
  const cargoToml = `[package]
name = "${config.name}"
version = "${config.version}"
edition = "2021"

[dependencies]

[dev-dependencies]
`;

  const cargoPath = path.join(outputDir, 'Cargo.toml');
  await writeFileWithHooks(cargoPath, cargoToml, options);
  files.push('Cargo.toml');

  // Create src directory
  const srcDir = path.join(outputDir, 'src');
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const libContent = `//! ${config.name} - Generated by Arbiter
//! Version: ${config.version}

pub fn main() {
    println!("Hello from ${config.name}!");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_main() {
        main(); // Should not panic
    }
}
`;

  await writeFileWithHooks(path.join(srcDir, 'lib.rs'), libContent, options);
  files.push('src/lib.rs');

  // Create tests directory
  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}

/**
 * Generate Go project files
 */
async function generateGoFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  serviceContext?: ServiceGenerationContext
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);

  // go.mod
  const goMod = `module ${config.name}

go 1.21

require ()
`;

  const goModPath = path.join(outputDir, 'go.mod');
  await writeFileWithHooks(goModPath, goMod, options);
  files.push('go.mod');

  // main.go
  const mainGo = `// ${config.name} - Generated by Arbiter
// Version: ${config.version}
package main

import "fmt"

func main() {
    fmt.Println("Hello from ${config.name}!")
}
`;

  const mainGoPath = path.join(outputDir, 'main.go');
  await writeFileWithHooks(mainGoPath, mainGo, options);
  files.push('main.go');

  // Create test directory
  const testDir = path.join(outputDir, 'test');
  if (!fs.existsSync(testDir) && !options.dryRun) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  files.push('test/');

  return files;
}

/**
 * Generate Shell/Bash project files
 */
async function generateShellFiles(
  config: any,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];

  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);

  // Makefile
  const makefile = `# ${config.name} - Generated by Arbiter
# Version: ${config.version}

.PHONY: test install clean

test:
\tbash test/run_tests.sh

install:
\tcp src/${config.name} /usr/local/bin/

clean:
\trm -f *.log *.tmp
`;

  const makefilePath = path.join(outputDir, 'Makefile');
  await writeFileWithHooks(makefilePath, makefile, options);
  files.push('Makefile');

  // Create src directory
  const srcDir = path.join(outputDir, 'src');
  if (!fs.existsSync(srcDir) && !options.dryRun) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  const mainScript = `#!/bin/bash
# ${config.name} - Generated by Arbiter  
# Version: ${config.version}

set -euo pipefail

main() {
    echo "Hello from ${config.name}!"
}

# Run main if script is executed directly
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "$@"
fi
`;

  const scriptPath = path.join(srcDir, config.name);
  await writeFileWithHooks(scriptPath, mainScript, options, 0o755);
  files.push(`src/${config.name}`);

  // Create tests directory
  const testsDir = path.join(outputDir, ...effectiveTestSegments);
  if (!fs.existsSync(testsDir) && !options.dryRun) {
    fs.mkdirSync(testsDir, { recursive: true });
  }
  if (testsDirRelative) {
    files.push(`${testsDirRelative}/`);
  }

  return files;
}

/**
 * Generate CI/CD workflows
 */
async function generateCIWorkflows(
  config: any,
  outputDir: string,
  options: GenerateOptions
): Promise<string[]> {
  const files: string[] = [];

  // GitHub Actions workflow
  const workflowDir = path.join(outputDir, '.github', 'workflows');
  if (!fs.existsSync(workflowDir) && !options.dryRun) {
    fs.mkdirSync(workflowDir, { recursive: true });
  }

  const workflow = `# ${config.name} CI/CD - Generated by Arbiter
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup ${config.language}
      uses: ${getSetupAction(config.language)}
      ${getSetupActionConfig(config.language)}
    
    - name: Install dependencies
      run: ${getInstallCommand(config.language, config.buildTool)}
    
    - name: Lint
      run: ${getLintCommand(config.language, config.buildTool)}
    
    - name: Test  
      run: ${getTestCommand(config.language, config.buildTool)}
    
    - name: Build
      run: ${getBuildCommand(config.language, config.buildTool)}
`;

  const workflowPath = path.join(workflowDir, 'ci.yml');
  await writeFileWithHooks(workflowPath, workflow, options);
  files.push('.github/workflows/ci.yml');

  return files;
}

/**
 * Generate documentation
 */
async function generateDocumentation(
  _config: any,
  _outputDir: string,
  _options: GenerateOptions
): Promise<string[]> {
  // Documentation generation will be handled by the docs command
  return [];
}

// Helper functions for CI workflow generation
function getSetupAction(language: string): string {
  switch (language) {
    case 'typescript':
      return 'actions/setup-node@v4';
    case 'python':
      return 'actions/setup-python@v4';
    case 'rust':
      return 'actions-rs/toolchain@v1';
    case 'go':
      return 'actions/setup-go@v4';
    default:
      return 'actions/setup-node@v4';
  }
}

function getSetupActionConfig(language: string): string {
  switch (language) {
    case 'typescript':
      return "with:\n        node-version: '20'";
    case 'python':
      return "with:\n        python-version: '3.11'";
    case 'rust':
      return 'with:\n        toolchain: stable';
    case 'go':
      return "with:\n        go-version: '1.21'";
    default:
      return "with:\n        node-version: '20'";
  }
}

function getPrerequisites(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun'
        ? '- [Bun](https://bun.sh) v1.0+'
        : '- [Node.js](https://nodejs.org) v18+\n- [npm](https://npmjs.com) or [yarn](https://yarnpkg.com)';
    case 'python':
      return '- [Python](https://python.org) 3.8+\n- [pip](https://pip.pypa.io)';
    case 'rust':
      return '- [Rust](https://rustup.rs) 1.70+';
    case 'go':
      return '- [Go](https://golang.org) 1.21+';
    case 'shell':
      return '- [Bash](https://www.gnu.org/software/bash/) 4.0+';
    default:
      return `- Development environment for ${language}`;
  }
}

function getInstallCommand(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun' ? 'bun install' : 'npm install';
    case 'python':
      return 'pip install -e .';
    case 'rust':
      return 'cargo build';
    case 'go':
      return 'go mod tidy';
    case 'shell':
      return 'make install';
    default:
      return 'echo "Install command not defined"';
  }
}

function getRunCommand(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun' ? 'bun run src/index.ts' : 'npm start';
    case 'python':
      return 'python -m ' + 'PLACEHOLDER';
    case 'rust':
      return 'cargo run';
    case 'go':
      return 'go run main.go';
    case 'shell':
      return './src/PLACEHOLDER';
    default:
      return 'echo "Run command not defined"';
  }
}

function getTestCommand(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun' ? 'bun test' : 'npm test';
    case 'python':
      return 'pytest';
    case 'rust':
      return 'cargo test';
    case 'go':
      return 'go test ./...';
    case 'shell':
      return 'make test';
    default:
      return 'echo "Test command not defined"';
  }
}

function getBuildCommand(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun' ? 'bun build' : 'npm run build';
    case 'python':
      return 'python -m build';
    case 'rust':
      return 'cargo build --release';
    case 'go':
      return 'go build';
    case 'shell':
      return 'echo "No build step needed"';
    default:
      return 'echo "Build command not defined"';
  }
}

function getLintCommand(language: string, buildTool?: string): string {
  switch (language) {
    case 'typescript':
      return buildTool === 'bun' ? 'bun run lint' : 'npm run lint';
    case 'python':
      return 'ruff check . && mypy .';
    case 'rust':
      return 'cargo clippy -- -D warnings';
    case 'go':
      return 'golangci-lint run';
    case 'shell':
      return 'shellcheck src/*';
    default:
      return 'echo "Lint command not defined"';
  }
}

// Terraform + Kubernetes generation
async function generateTerraformKubernetes(
  config: any,
  outputDir: string,
  assemblyConfig: any,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];
  const infraDirSegments = toPathSegments(structure.infraDirectory);
  const effectiveInfraSegments = infraDirSegments.length > 0 ? infraDirSegments : ['terraform'];
  const infraDirRelative = joinRelativePath(...effectiveInfraSegments);
  await ensureDirectory(path.join(outputDir, ...effectiveInfraSegments), options);

  // Parse assembly to extract services and cluster references
  const { services, cluster } = parseDeploymentServices(assemblyConfig);

  // Generate main.tf with provider configuration
  const mainTf = generateTerraformMain(cluster, config.name);
  const mainPath = path.join(outputDir, ...effectiveInfraSegments, 'main.tf');
  await writeFileWithHooks(mainPath, mainTf, options);
  files.push(joinRelativePath(infraDirRelative, 'main.tf'));

  // Generate variables.tf
  const variablesTf = generateTerraformVariables(services, cluster);
  const variablesPath = path.join(outputDir, ...effectiveInfraSegments, 'variables.tf');
  await writeFileWithHooks(variablesPath, variablesTf, options);
  files.push(joinRelativePath(infraDirRelative, 'variables.tf'));

  // Generate services.tf with Kubernetes resources
  const servicesTf = generateTerraformServices(services, config.name);
  const servicesPath = path.join(outputDir, ...effectiveInfraSegments, 'services.tf');
  await writeFileWithHooks(servicesPath, servicesTf, options);
  files.push(joinRelativePath(infraDirRelative, 'services.tf'));

  // Generate outputs.tf
  const outputsTf = generateTerraformOutputs(services, config.name);
  const outputsPath = path.join(outputDir, ...effectiveInfraSegments, 'outputs.tf');
  await writeFileWithHooks(outputsPath, outputsTf, options);
  files.push(joinRelativePath(infraDirRelative, 'outputs.tf'));

  // Generate README for Terraform deployment
  const readme = generateTerraformReadme(services, cluster, config.name);
  const readmePath = path.join(outputDir, ...effectiveInfraSegments, 'README.md');
  await writeFileWithHooks(readmePath, readme, options);
  files.push(joinRelativePath(infraDirRelative, 'README.md'));

  return files;
}

function parseDeploymentServices(assemblyConfig: any): {
  services: DeploymentService[];
  cluster: ClusterConfig | null;
} {
  const services: DeploymentService[] = [];
  let cluster: ClusterConfig | null = null;

  // Use the full CUE data if available
  const cueData = assemblyConfig._fullCueData || assemblyConfig;

  // Extract cluster configuration
  if (cueData?.deployment?.cluster) {
    cluster = {
      name: cueData.deployment.cluster.name || 'default',
      provider: cueData.deployment.cluster.provider || 'kubernetes',
      context: cueData.deployment.cluster.context,
      namespace: cueData.deployment.cluster.namespace || 'default',
      config: cueData.deployment.cluster.config || {},
    };
  }

  // Extract services from properly parsed CUE configuration
  if (cueData?.services) {
    for (const [serviceName, serviceConfig] of Object.entries(cueData.services)) {
      const service = parseDeploymentServiceConfig(serviceName, serviceConfig as any);
      if (service) {
        services.push(service);
      }
    }
  }

  return { services, cluster };
}

interface DeploymentService {
  name: string;
  language: string;
  serviceType: 'bespoke' | 'prebuilt' | 'external';
  type: 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob';
  image?: string;
  sourceDirectory?: string;
  buildContext?: {
    dockerfile?: string;
    target?: string;
    buildArgs?: Record<string, string>;
  };
  ports?: Array<{ name: string; port: number; targetPort?: number; protocol?: string }>;
  env?: Record<string, string>;
  volumes?: Array<{
    name: string;
    path: string;
    size?: string;
    type?: 'persistentVolumeClaim' | 'configMap' | 'secret';
  }>;
  config?: {
    files?: Array<{ name: string; content: string | Record<string, any> }>;
    [key: string]: any;
  };
  replicas?: number;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  healthCheck?: {
    path?: string;
    port?: number;
    initialDelay?: number;
    periodSeconds?: number;
  };
}

interface ClusterConfig {
  name: string;
  provider: 'kubernetes' | 'eks' | 'gke' | 'aks';
  context?: string;
  namespace: string;
  config: Record<string, any>;
}

function parseDeploymentServiceConfig(name: string, config: any): DeploymentService | null {
  // Determine service type based on configuration
  let serviceType: 'bespoke' | 'prebuilt' | 'external' = 'prebuilt';

  if (
    config.sourceDirectory ||
    (config.language && config.language !== 'container' && !config.image)
  ) {
    serviceType = 'bespoke';
  } else if (config.image && (config.language === 'container' || !config.language)) {
    serviceType = 'prebuilt';
  } else if (config.external) {
    serviceType = 'external';
  }

  const service: DeploymentService = {
    name: name,
    language: config.language || 'container',
    serviceType: serviceType,
    type: config.type || 'deployment',
    replicas: config.replicas || 1,
  };

  // Service configuration
  if (config.image) service.image = config.image;
  if (config.sourceDirectory) service.sourceDirectory = config.sourceDirectory;
  if (config.buildContext) service.buildContext = config.buildContext;
  if (config.ports) service.ports = config.ports;
  if (config.env) service.env = config.env;
  if (config.volumes) {
    service.volumes = config.volumes.map((vol: any) => ({
      ...vol,
      type: vol.type || 'persistentVolumeClaim',
    }));
  }
  if (config.resources) service.resources = config.resources;
  if (config.labels) service.labels = config.labels;
  if (config.annotations) service.annotations = config.annotations;
  if (config.config) service.config = config.config;
  if (config.healthCheck) service.healthCheck = config.healthCheck;

  return service;
}

// Terraform generation functions
function generateTerraformMain(cluster: ClusterConfig | null, projectName: string): string {
  const clusterName = cluster?.name || 'default';
  const namespace = cluster?.namespace || projectName.toLowerCase();

  return `terraform {
  required_version = ">= 1.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "kubernetes" {
  # Configuration will be loaded from kubeconfig by default
  # Override these values via terraform.tfvars if needed
  config_path    = var.kubeconfig_path
  config_context = var.cluster_context
}

# Create namespace if it doesn't exist
resource "kubernetes_namespace" "${namespace.replace(/-/g, '_')}" {
  metadata {
    name = "${namespace}"
    labels = {
      name    = "${namespace}"
      project = "${projectName.toLowerCase()}"
    }
  }
}
`;
}

function generateTerraformVariables(
  services: DeploymentService[],
  cluster: ClusterConfig | null
): string {
  const clusterName = cluster?.name || 'default';

  return `variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "cluster_context" {
  description = "Kubernetes cluster context to use"
  type        = string
  default     = "${cluster?.context || clusterName}"
}

variable "namespace" {
  description = "Kubernetes namespace for deployment"
  type        = string
  default     = "${cluster?.namespace || 'default'}"
}

variable "image_tag" {
  description = "Docker image tag for services"
  type        = string
  default     = "latest"
}

${services
  .map(service => {
    const serviceName = service.name.replace(/-/g, '_');
    return `variable "${serviceName}_replicas" {
  description = "Number of replicas for ${service.name}"
  type        = number
  default     = ${service.replicas || 1}
}`;
  })
  .join('\n\n')}
`;
}

function generateTerraformServices(services: DeploymentService[], projectName: string): string {
  return services.map(service => generateTerraformService(service, projectName)).join('\n\n');
}

function generateTerraformService(service: DeploymentService, projectName: string): string {
  const serviceName = service.name.replace(/-/g, '_');
  const namespace = projectName.toLowerCase();

  let terraform = `# ${service.name} ${service.type}
resource "kubernetes_${service.type}" "${serviceName}" {
  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, '_')}.metadata[0].name
    labels = {
      app     = "${service.name}"
      project = "${projectName.toLowerCase()}"${
        service.labels
          ? Object.entries(service.labels)
              .map(([k, v]) => `\n      ${k} = "${v}"`)
              .join('')
          : ''
      }
    }${
      service.annotations
        ? `
    annotations = {${Object.entries(service.annotations)
      .map(([k, v]) => `\n      "${k}" = "${v}"`)
      .join('')}
    }`
        : ''
    }
  }

  spec {
    replicas = var.${serviceName}_replicas
    
    selector {
      match_labels = {
        app = "${service.name}"
      }
    }

    template {
      metadata {
        labels = {
          app     = "${service.name}"
          project = "${projectName.toLowerCase()}"
        }
      }

      spec {
        container {
          name  = "${service.name}"
          image = "${service.image || `${service.name}:\${var.image_tag}`}"
`;

  // Add ports
  if (service.ports && service.ports.length > 0) {
    service.ports.forEach(port => {
      terraform += `
          port {
            name           = "${port.name}"
            container_port = ${port.targetPort || port.port}
            protocol       = "${port.protocol || 'TCP'}"
          }`;
    });
  }

  // Add environment variables
  if (service.env && Object.keys(service.env).length > 0) {
    Object.entries(service.env).forEach(([key, value]) => {
      terraform += `
          env {
            name  = "${key}"
            value = "${value}"
          }`;
    });
  }

  // Add resources
  if (service.resources) {
    terraform += `
          resources {`;
    if (service.resources.requests) {
      terraform += `
            requests = {`;
      if (service.resources.requests.cpu)
        terraform += `
              cpu    = "${service.resources.requests.cpu}"`;
      if (service.resources.requests.memory)
        terraform += `
              memory = "${service.resources.requests.memory}"`;
      terraform += `
            }`;
    }
    if (service.resources.limits) {
      terraform += `
            limits = {`;
      if (service.resources.limits.cpu)
        terraform += `
              cpu    = "${service.resources.limits.cpu}"`;
      if (service.resources.limits.memory)
        terraform += `
              memory = "${service.resources.limits.memory}"`;
      terraform += `
            }`;
    }
    terraform += `
          }`;
  }

  // Add volume mounts
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach(volume => {
      terraform += `
          volume_mount {
            name       = "${volume.name}"
            mount_path = "${volume.path}"
          }`;
    });
  }

  terraform += `
        }`;

  // Add volumes
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach(volume => {
      terraform += `
        volume {
          name = "${volume.name}"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.${serviceName}_${volume.name.replace(/-/g, '_')}.metadata[0].name
          }
        }`;
    });
  }

  terraform += `
      }
    }
  }
}`;

  // Generate Service resource if has ports
  if (service.ports && service.ports.length > 0) {
    terraform += `

resource "kubernetes_service" "${serviceName}" {
  metadata {
    name      = "${service.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, '_')}.metadata[0].name
    labels = {
      app     = "${service.name}"
      project = "${projectName.toLowerCase()}"
    }
  }

  spec {
    selector = {
      app = "${service.name}"
    }

${service.ports
  .map(
    port => `    port {
      name        = "${port.name}"
      port        = ${port.port}
      target_port = ${port.targetPort || port.port}
      protocol    = "${port.protocol || 'TCP'}"
    }`
  )
  .join('\n')}
  }
}`;
  }

  // Generate PVCs for volumes
  if (service.volumes && service.volumes.length > 0) {
    service.volumes.forEach(volume => {
      terraform += `

resource "kubernetes_persistent_volume_claim" "${serviceName}_${volume.name.replace(/-/g, '_')}" {
  metadata {
    name      = "${service.name}-${volume.name}"
    namespace = kubernetes_namespace.${namespace.replace(/-/g, '_')}.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "${volume.size || '10Gi'}"
      }
    }
  }
}`;
    });
  }

  return terraform;
}

function generateTerraformOutputs(services: DeploymentService[], projectName: string): string {
  const outputs = services
    .filter(service => service.ports && service.ports.length > 0)
    .map(service => {
      const serviceName = service.name.replace(/-/g, '_');
      return `output "${serviceName}_service_ip" {
  description = "Cluster IP of the ${service.name} service"
  value       = kubernetes_service.${serviceName}.spec[0].cluster_ip
}

output "${serviceName}_ports" {
  description = "Ports exposed by ${service.name} service"
  value       = [${service.ports?.map(p => `"${p.port}"`).join(', ')}]
}`;
    });

  return `output "namespace" {
  description = "Kubernetes namespace"
  value       = kubernetes_namespace.${projectName.toLowerCase().replace(/-/g, '_')}.metadata[0].name
}

${outputs.join('\n\n')}
`;
}

function generateTerraformReadme(
  services: DeploymentService[],
  cluster: ClusterConfig | null,
  projectName: string
): string {
  const clusterName = cluster?.name || 'default';
  const namespace = cluster?.namespace || projectName.toLowerCase();

  return `# ${projectName} - Terraform Kubernetes Deployment

This directory contains Terraform configurations for deploying ${projectName} to Kubernetes.

## Prerequisites

- [Terraform](https://terraform.io) >= 1.0
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) configured with cluster access
- Kubernetes cluster accessible via kubeconfig

## Configuration

### Cluster Configuration
- **Cluster**: ${clusterName}
- **Namespace**: ${namespace}
- **Context**: ${cluster?.context || clusterName}

## Services

${services
  .map(
    service => `### ${service.name}
- **Language**: ${service.language}
- **Type**: ${service.type}
- **Image**: ${service.image || `${service.name}:latest`}${
      service.ports
        ? `
- **Ports**: ${service.ports.map(p => `${p.port}/${p.protocol || 'TCP'} (${p.name})`).join(', ')}`
        : ''
    }
- **Replicas**: ${service.replicas || 1}${
      service.volumes
        ? `
- **Storage**: ${service.volumes.map(v => `${v.name} → ${v.path} (${v.size || '10Gi'})`).join(', ')}`
        : ''
    }`
  )
  .join('\n\n')}

## Deployment

### 1. Initialize Terraform
\`\`\`bash
terraform init
\`\`\`

### 2. Review the Plan
\`\`\`bash
terraform plan
\`\`\`

### 3. Apply Configuration
\`\`\`bash
terraform apply
\`\`\`

### 4. Verify Deployment
\`\`\`bash
kubectl get all -n ${namespace}
\`\`\`

## Customization

Create a \`terraform.tfvars\` file to customize deployment:

\`\`\`hcl
# Cluster configuration
kubeconfig_path = "~/.kube/config"
cluster_context = "${cluster?.context || clusterName}"
namespace       = "${namespace}"

# Image configuration  
image_tag = "v1.0.0"

# Service scaling
${services.map(service => `${service.name.replace(/-/g, '_')}_replicas = ${service.replicas || 1}`).join('\n')}
\`\`\`

## Access Services

${services
  .filter(s => s.ports && s.ports.length > 0)
  .map(
    service => `### ${service.name}
\`\`\`bash
kubectl port-forward -n ${namespace} service/${service.name} ${service.ports?.[0].port}:${service.ports?.[0].port}
\`\`\`
Access at: http://localhost:${service.ports?.[0].port}
`
  )
  .join('\n')}

## State Management

This configuration uses local state. For production deployments, configure remote state:

\`\`\`hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state"
    key    = "${projectName}/terraform.tfstate"
    region = "us-west-2"
  }
}
\`\`\`

## Cleanup

\`\`\`bash
terraform destroy
\`\`\`

## Troubleshooting

### Check pod status
\`\`\`bash
kubectl get pods -n ${namespace}
kubectl describe pod <pod-name> -n ${namespace}
\`\`\`

### View logs
\`\`\`bash
kubectl logs -f <pod-name> -n ${namespace}
\`\`\`

### Apply changes
After modifying Terraform files:
\`\`\`bash
terraform plan
terraform apply
\`\`\`
`;
}

// ====================================================
// DOCKER COMPOSE GENERATION
// ====================================================

/**
 * Generate Docker Compose files for the given services
 */
async function generateDockerCompose(
  config: any,
  outputDir: string,
  assemblyConfig: any,
  options: GenerateOptions,
  structure: ProjectStructureConfig
): Promise<string[]> {
  const files: string[] = [];
  const composeSegments = [...toPathSegments(structure.infraDirectory), 'compose'];
  const composeRoot = path.join(outputDir, ...composeSegments);
  const composeRelativeRoot = composeSegments;

  await ensureDirectory(composeRoot, options);

  // Parse assembly to extract services and deployment configuration
  const { services, deployment } = parseDockerComposeServices(assemblyConfig);

  // Generate docker-compose.yml
  const composeYml = generateDockerComposeFile(services, deployment, config.name);
  const composePath = path.join(composeRoot, 'docker-compose.yml');
  await writeFileWithHooks(composePath, composeYml, options);
  files.push(joinRelativePath(...composeRelativeRoot, 'docker-compose.yml'));

  // Generate .env template
  const envTemplate = generateComposeEnvTemplate(services, config.name);
  const envPath = path.join(composeRoot, '.env.template');
  await writeFileWithHooks(envPath, envTemplate, options);
  files.push(joinRelativePath(...composeRelativeRoot, '.env.template'));

  // Generate build contexts for bespoke services
  const buildFiles = await generateBuildContexts(
    services,
    composeRoot,
    options,
    composeRelativeRoot
  );
  files.push(...buildFiles);

  // Generate compose README
  const readme = generateComposeReadme(services, deployment, config.name);
  const readmePath = path.join(composeRoot, 'README.md');
  await writeFileWithHooks(readmePath, readme, options);
  files.push(joinRelativePath(...composeRelativeRoot, 'README.md'));

  return files;
}

function parseDockerComposeServices(assemblyConfig: any): {
  services: DeploymentServiceConfig[];
  deployment: DeploymentConfig;
} {
  const services: DeploymentServiceConfig[] = [];
  const cueData = assemblyConfig._fullCueData || assemblyConfig;

  // Extract deployment configuration
  const deployment: DeploymentConfig = {
    target: cueData?.deployment?.target || 'compose',
    compose: {
      version: cueData?.deployment?.compose?.version || '3.8',
      networks: cueData?.deployment?.compose?.networks || {},
      volumes: cueData?.deployment?.compose?.volumes || {},
      profiles: cueData?.deployment?.compose?.profiles || [],
      environment: cueData?.deployment?.compose?.environment || {},
    },
  };

  // Parse services with enhanced schema
  if (cueData?.services) {
    for (const [serviceName, serviceConfig] of Object.entries(cueData.services)) {
      const service = parseServiceForCompose(serviceName, serviceConfig as any);
      if (service) {
        services.push(service);
      }
    }
  }

  return { services, deployment };
}

function parseServiceForCompose(name: string, config: any): DeploymentServiceConfig | null {
  // Detect service type based on configuration
  let serviceType: 'bespoke' | 'prebuilt' | 'external' = 'prebuilt';

  if (config.sourceDirectory) {
    serviceType = 'bespoke';
  } else if (config.image) {
    serviceType = 'prebuilt';
  } else if (config.language && !config.image) {
    // Language specified but no image - likely bespoke
    serviceType = 'bespoke';
  }

  const service: DeploymentServiceConfig = {
    name: name,
    serviceType: serviceType,
    language: config.language || 'container',
    type: config.type || 'deployment',
    replicas: config.replicas || 1,
    image: config.image,
    sourceDirectory: config.sourceDirectory,
    buildContext: config.buildContext,
    ports: config.ports,
    env: config.env,
    volumes: config.volumes,
    resources: config.resources,
    config: config.config,
    labels: config.labels,
    annotations: config.annotations,
  };

  return service;
}

function generateDockerComposeFile(
  services: DeploymentServiceConfig[],
  deployment: DeploymentConfig,
  projectName: string
): string {
  const version = deployment.compose?.version || '3.8';

  let compose = `version: "${version}"

services:
${services.map(service => generateComposeService(service, projectName)).join('\n')}`;

  // Add networks if specified
  if (deployment.compose?.networks && Object.keys(deployment.compose.networks).length > 0) {
    compose += `

networks:
${Object.entries(deployment.compose.networks)
  .map(
    ([name, config]) =>
      `  ${name}:
${Object.entries(config as any)
  .map(([k, v]) => `    ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
  .join('\n')}`
  )
  .join('\n')}`;
  }

  // Add named volumes if any services use them
  const namedVolumes = services.flatMap(s =>
    (s.volumes || [])
      .filter(v => v.type === 'persistentVolumeClaim')
      .map(v => `${s.name}_${v.name}`)
  );

  if (namedVolumes.length > 0) {
    compose += `

volumes:
${namedVolumes.map(volume => `  ${volume}:`).join('\n')}`;
  }

  return compose;
}

function generateComposeService(service: DeploymentServiceConfig, projectName: string): string {
  const serviceName = service.name;
  let serviceConfig = `  ${serviceName}:`;

  // Image or build configuration
  if (service.serviceType === 'bespoke') {
    // Build from source
    if (service.sourceDirectory) {
      serviceConfig += `
    build:
      context: ../${service.sourceDirectory}`;

      if (service.buildContext?.dockerfile) {
        serviceConfig += `
      dockerfile: ${service.buildContext.dockerfile}`;
      }

      if (service.buildContext?.target) {
        serviceConfig += `
      target: ${service.buildContext.target}`;
      }

      if (service.buildContext?.buildArgs) {
        serviceConfig += `
      args:
${Object.entries(service.buildContext.buildArgs)
  .map(([k, v]) => `        ${k}: ${v}`)
  .join('\n')}`;
      }
    } else {
      // Fallback to image for bespoke without sourceDirectory
      serviceConfig += `
    image: ${service.image || `${serviceName}:latest`}`;
    }
  } else {
    // Use pre-built image
    serviceConfig += `
    image: ${service.image}`;
  }

  // Container name
  serviceConfig += `
    container_name: ${projectName}_${serviceName}`;

  // Restart policy
  serviceConfig += `
    restart: unless-stopped`;

  // Ports
  if (service.ports && service.ports.length > 0) {
    serviceConfig += `
    ports:
${service.ports.map(p => `      - "${p.port}:${p.targetPort || p.port}"`).join('\n')}`;
  }

  // Environment variables
  if (service.env && Object.keys(service.env).length > 0) {
    serviceConfig += `
    environment:
${Object.entries(service.env)
  .map(([k, v]) => `      ${k}: ${v}`)
  .join('\n')}`;
  }

  // Volumes
  if (service.volumes && service.volumes.length > 0) {
    serviceConfig += `
    volumes:`;

    service.volumes.forEach(volume => {
      if (volume.type === 'persistentVolumeClaim') {
        serviceConfig += `
      - ${serviceName}_${volume.name}:${volume.path}`;
      } else if (volume.type === 'configMap' && service.config?.files) {
        // Handle config files
        const configFile = service.config.files.find(f => f.name === volume.name);
        if (configFile) {
          serviceConfig += `
      - ./config/${serviceName}/${configFile.name}:${volume.path}:ro`;
        }
      } else {
        // Default to bind mount or volume
        serviceConfig += `
      - ${volume.name}:${volume.path}`;
      }
    });
  }

  // Labels
  const labels = {
    project: projectName,
    service: serviceName,
    'service-type': service.serviceType,
    ...service.labels,
  };

  serviceConfig += `
    labels:
${Object.entries(labels)
  .map(([k, v]) => `      ${k}: "${v}"`)
  .join('\n')}`;

  // Health check (basic)
  if (service.ports && service.ports.length > 0) {
    const httpPort = service.ports.find(p => p.name === 'http' || p.name === 'web');
    if (httpPort) {
      serviceConfig += `
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${httpPort.targetPort || httpPort.port}"]
      interval: 30s
      timeout: 10s
      retries: 3`;
    }
  }

  // Resource limits (if specified)
  if (service.resources?.limits) {
    const limits = service.resources.limits;
    if (limits.memory) {
      serviceConfig += `
    mem_limit: ${limits.memory.replace('Mi', 'm').replace('Gi', 'g')}`;
    }
    if (limits.cpu) {
      const cpuLimit = limits.cpu.replace('m', '');
      const cpuFloat = (Number.parseInt(cpuLimit) / 1000).toFixed(2);
      serviceConfig += `
    cpus: "${cpuFloat}"`;
    }
  }

  return serviceConfig;
}

function generateComposeEnvTemplate(
  services: DeploymentServiceConfig[],
  projectName: string
): string {
  const envVars = new Set<string>();

  // Collect all environment variables from services
  services.forEach(service => {
    if (service.env) {
      Object.keys(service.env).forEach(key => envVars.add(key));
    }
  });

  let envContent = `# Environment variables for ${projectName}
# Copy this to .env and customize values

# Project Configuration
COMPOSE_PROJECT_NAME=${projectName}
COMPOSE_FILE=docker-compose.yml

# Image Tags (for pre-built services)
IMAGE_TAG=latest

`;

  // Add service-specific environment variables
  services.forEach(service => {
    if (service.env && Object.keys(service.env).length > 0) {
      envContent += `# ${service.name} Service
`;
      Object.entries(service.env).forEach(([key, value]) => {
        envContent += `${key}=${value}
`;
      });
      envContent += '\n';
    }
  });

  return envContent;
}

async function generateBuildContexts(
  services: DeploymentServiceConfig[],
  composeRoot: string,
  options: GenerateOptions,
  relativeRoot: string[]
): Promise<string[]> {
  const files: string[] = [];

  for (const service of services) {
    if (service.serviceType === 'bespoke' && service.config?.files) {
      // Generate config files for bespoke services
      const configDir = path.join(composeRoot, 'config', service.name);
      await ensureDirectory(configDir, options);

      for (const configFile of service.config.files) {
        const content =
          typeof configFile.content === 'string'
            ? configFile.content
            : JSON.stringify(configFile.content, null, 2);

        const filePath = path.join(configDir, configFile.name);
        await writeFileWithHooks(filePath, content, options);
        files.push(joinRelativePath(...relativeRoot, 'config', service.name, configFile.name));
      }
    }
  }

  return files;
}

function generateComposeReadme(
  services: DeploymentServiceConfig[],
  deployment: DeploymentConfig,
  projectName: string
): string {
  return `# ${projectName} - Docker Compose Deployment

This directory contains Docker Compose configurations for running ${projectName} locally.

## Prerequisites

- [Docker](https://docker.com) with Compose plugin
- [Docker Compose](https://docs.docker.com/compose/) v2.0+

## Services

${services
  .map(
    service => `### ${service.name} (${service.serviceType})
- **Language**: ${service.language}
- **Type**: ${service.type}
${
  service.serviceType === 'bespoke'
    ? `- **Source**: ${service.sourceDirectory || 'Built from local source'}`
    : `- **Image**: ${service.image}`
}${
      service.ports
        ? `
- **Ports**: ${service.ports.map(p => `${p.port}:${p.targetPort || p.port}`).join(', ')}`
        : ''
    }${
      service.volumes
        ? `
- **Volumes**: ${service.volumes.map(v => `${v.name} → ${v.path}`).join(', ')}`
        : ''
    }`
  )
  .join('\n\n')}

## Quick Start

### 1. Setup Environment
\`\`\`bash
cp .env.template .env
# Edit .env with your configuration
\`\`\`

### 2. Build and Start Services
\`\`\`bash
docker compose up --build -d
\`\`\`

### 3. View Logs
\`\`\`bash
docker compose logs -f
\`\`\`

### 4. Stop Services
\`\`\`bash
docker compose down
\`\`\`

## Service Management

### Build specific service
\`\`\`bash
${services
  .filter(s => s.serviceType === 'bespoke')
  .map(s => `docker compose build ${s.name}`)
  .join('\n')}
\`\`\`

### Access services
${services
  .filter(s => s.ports && s.ports.length > 0)
  .map(
    service => `
**${service.name}**: http://localhost:${service.ports?.[0].port}`
  )
  .join('')}

### Scale services
\`\`\`bash
${services.map(s => `docker compose up -d --scale ${s.name}=${s.replicas || 1}`).join('\n')}
\`\`\`

## Development Workflow

### For bespoke services
1. Make code changes in source directories
2. Rebuild specific services: \`docker compose build <service>\`
3. Restart: \`docker compose up -d <service>\`

### For configuration changes
1. Update files in \`./config/\` directories
2. Restart affected services: \`docker compose restart <service>\`

## Debugging

### Check service status
\`\`\`bash
docker compose ps
\`\`\`

### View service logs
\`\`\`bash
docker compose logs <service-name>
docker compose logs -f <service-name>  # Follow logs
\`\`\`

### Execute commands in containers
\`\`\`bash
docker compose exec <service-name> sh
\`\`\`

### Inspect networks and volumes
\`\`\`bash
docker network ls | grep ${projectName}
docker volume ls | grep ${projectName}
\`\`\`

## Production Considerations

This Docker Compose setup is designed for development and testing. For production:

1. **Security**: Remove development ports and debugging tools
2. **Secrets**: Use Docker secrets or external secret management
3. **Persistence**: Configure proper volume management and backups
4. **Monitoring**: Add health checks and monitoring services
5. **Scaling**: Consider using Docker Swarm or Kubernetes for production

## Cleanup

### Stop and remove containers
\`\`\`bash
docker compose down
\`\`\`

### Remove volumes (⚠️  destroys data)
\`\`\`bash
docker compose down -v
\`\`\`

### Clean up everything including images
\`\`\`bash
docker compose down --rmi all -v
\`\`\`

## Troubleshooting

### Port conflicts
If ports are already in use, edit the \`.env\` file or \`docker-compose.yml\` to use different ports.

### Build failures
Check that all source directories exist and contain proper build files (Dockerfile, etc.).

### Service won't start
Check logs with \`docker compose logs <service>\` and verify configuration files.

### Network issues
Services communicate using service names as hostnames (e.g., \`http://${services.length > 1 ? services[1].name : 'api'}:${services.find(s => s.ports)?.ports?.[0]?.port || '3000'}\`).
`;
}

// ====================================================
// TEST COMPOSITION AND INTELLIGENT NAMESPACING
// ====================================================

/**
 * Test composition engine for merging existing and generated tests
 */
class TestCompositionEngine {
  private specName: string;
  private namespace: string;

  constructor(specName: string, baseNamespace?: string) {
    this.specName = specName;
    this.namespace = baseNamespace || this.generateBaseNamespace(specName);
  }

  /**
   * Discover existing test files in the project
   */
  async discoverExistingTests(outputDir: string): Promise<TestSuite[]> {
    const testSuites: TestSuite[] = [];
    const testDirs = ['tests', 'test', '__tests__', 'spec'];

    for (const testDir of testDirs) {
      const fullPath = path.join(outputDir, testDir);
      if (fs.existsSync(fullPath)) {
        const testFiles = await this.findTestFiles(fullPath);
        for (const testFile of testFiles) {
          const suite = await this.parseTestFile(testFile);
          if (suite) {
            testSuites.push(suite);
          }
        }
      }
    }

    return testSuites;
  }

  /**
   * Generate namespace for new tests based on spec and service
   */
  generateTestNamespace(serviceName: string): string {
    return `${this.namespace}.${serviceName}`.toLowerCase().replace(/[^a-z0-9.]/g, '_');
  }

  /**
   * Merge existing and new test suites intelligently
   */
  mergeTestSuites(existing: TestSuite[], newSuites: TestSuite[]): TestCompositionResult {
    const result: TestCompositionResult = {
      merged: [],
      conflicts: [],
      generated: [],
      preserved: [],
    };

    // Create a map of existing tests by namespace
    const existingMap = new Map<string, TestSuite>();
    existing.forEach(suite => existingMap.set(suite.namespace, suite));

    // Process new test suites
    for (const newSuite of newSuites) {
      const existingSuite = existingMap.get(newSuite.namespace);

      if (!existingSuite) {
        // No conflict - add new suite as-is
        result.merged.push(newSuite);
        result.generated.push(...newSuite.cases);
      } else {
        // Conflict exists - merge intelligently
        const merged = this.mergeConflictingSuites(existingSuite, newSuite);
        result.merged.push(merged.suite);
        result.conflicts.push(...merged.conflicts);
        result.generated.push(...merged.generated);
        result.preserved.push(...merged.preserved);

        // Remove from existing map so we don't duplicate
        existingMap.delete(newSuite.namespace);
      }
    }

    // Add remaining existing suites (no conflicts)
    existingMap.forEach(suite => {
      result.merged.push(suite);
      result.preserved.push(...suite.cases);
    });

    return result;
  }

  /**
   * Safely merge two conflicting test suites
   */
  private mergeConflictingSuites(
    existing: TestSuite,
    newSuite: TestSuite
  ): {
    suite: TestSuite;
    conflicts: Array<{ test: string; reason: string; resolution: 'skip' | 'merge' | 'replace' }>;
    generated: TestCase[];
    preserved: TestCase[];
  } {
    const result = {
      suite: { ...existing },
      conflicts: [] as Array<{
        test: string;
        reason: string;
        resolution: 'skip' | 'merge' | 'replace';
      }>,
      generated: [] as TestCase[],
      preserved: [...existing.cases] as TestCase[],
    };

    // Create a map of existing test cases by name
    const existingCases = new Map<string, TestCase>();
    existing.cases.forEach(testCase => existingCases.set(testCase.name, testCase));

    // Process new test cases
    for (const newCase of newSuite.cases) {
      const existingCase = existingCases.get(newCase.name);

      if (!existingCase) {
        // No conflict - add new case
        result.suite.cases.push(newCase);
        result.generated.push(newCase);
      } else if (this.isGeneratedTest(existingCase)) {
        // Existing test is generated - safe to replace
        const index = result.suite.cases.findIndex(c => c.name === newCase.name);
        if (index >= 0) {
          result.suite.cases[index] = newCase;
          result.generated.push(newCase);
          result.conflicts.push({
            test: newCase.name,
            reason: 'Generated test updated',
            resolution: 'replace',
          });
        }
      } else {
        // Existing test is custom - preserve and rename new test
        const renamedCase = {
          ...newCase,
          name: `${newCase.name}_generated`,
          namespace: `${newCase.namespace}.generated`,
        };
        result.suite.cases.push(renamedCase);
        result.generated.push(renamedCase);
        result.conflicts.push({
          test: newCase.name,
          reason: 'Custom test exists',
          resolution: 'skip',
        });
      }
    }

    return result;
  }

  /**
   * Check if a test case was generated (vs. custom written)
   */
  private isGeneratedTest(testCase: TestCase): boolean {
    return (
      testCase.metadata?.generated === true ||
      testCase.metadata?.source === 'arbiter' ||
      testCase.namespace.includes('generated')
    );
  }

  /**
   * Generate base namespace from spec name
   */
  private generateBaseNamespace(specName: string): string {
    return `arbiter.${specName}`.toLowerCase().replace(/[^a-z0-9.]/g, '_');
  }

  /**
   * Find test files recursively in a directory
   */
  private async findTestFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.findTestFiles(fullPath)));
      } else if (this.isTestFile(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if a file is a test file based on naming conventions
   */
  private isTestFile(filename: string): boolean {
    const testPatterns = [
      /\.test\.(js|ts|py|rs|go)$/,
      /\.spec\.(js|ts|py|rs|go)$/,
      /_test\.(js|ts|py|rs|go)$/,
      /test_.*\.(py)$/,
    ];

    return testPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Parse a test file and extract test cases (simplified parser)
   */
  private async parseTestFile(filePath: string): Promise<TestSuite | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);

      // Basic parsing - in real implementation would use proper AST parsing
      const testCases: TestCase[] = [];

      if (ext === '.js' || ext === '.ts') {
        // JavaScript/TypeScript test parsing
        const testMatches = content.match(/(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/g);
        testMatches?.forEach((match, index) => {
          const nameMatch = match.match(/['"`]([^'"`]+)['"`]/);
          if (nameMatch) {
            testCases.push({
              name: nameMatch[1],
              namespace: this.extractNamespaceFromFile(filePath),
              steps: [], // Would extract from test body in real implementation
              metadata: {
                generated: false,
                source: 'existing',
                lastModified: new Date().toISOString(),
              },
            });
          }
        });
      } else if (ext === '.py') {
        // Python test parsing
        const testMatches = content.match(/def\s+(test_\w+)/g);
        testMatches?.forEach(match => {
          const nameMatch = match.match(/def\s+(test_\w+)/);
          if (nameMatch) {
            testCases.push({
              name: nameMatch[1],
              namespace: this.extractNamespaceFromFile(filePath),
              steps: [],
              metadata: {
                generated: false,
                source: 'existing',
                lastModified: new Date().toISOString(),
              },
            });
          }
        });
      }

      if (testCases.length > 0) {
        return {
          name: path.basename(filePath, path.extname(filePath)),
          namespace: this.extractNamespaceFromFile(filePath),
          cases: testCases,
          setup: [],
          teardown: [],
        };
      }
    } catch (error) {
      console.warn(`Warning: Could not parse test file ${filePath}:`, error);
    }

    return null;
  }

  /**
   * Extract namespace from file path
   */
  private extractNamespaceFromFile(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath);
    const parts = relativePath.split(path.sep);

    // Remove file extension and test suffix
    const fileName = path.basename(filePath, path.extname(filePath));
    const cleanFileName = fileName.replace(/\.(test|spec)$/, '');

    // Build namespace from path
    const namespaceParts = [...parts.slice(0, -1), cleanFileName];
    return namespaceParts
      .join('.')
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '_');
  }
}

/**
 * Generate test cases for services based on their configuration
 */
function generateServiceTests(services: DeploymentServiceConfig[], specName: string): TestSuite[] {
  const testSuites: TestSuite[] = [];
  const engine = new TestCompositionEngine(specName);

  for (const service of services) {
    const namespace = engine.generateTestNamespace(service.name);

    const testCases: TestCase[] = [];

    // Generate basic service tests
    if (service.ports && service.ports.length > 0) {
      // Health check test
      testCases.push({
        name: `${service.name}_health_check`,
        namespace: namespace,
        description: `Health check for ${service.name} service`,
        steps: [
          {
            action: 'http_request',
            params: {
              method: 'GET',
              url: `http://localhost:${service.ports[0].port}/health`,
              timeout: 5000,
            },
            expected: { status: 200 },
          },
        ],
        metadata: {
          generated: true,
          source: 'arbiter',
          lastModified: new Date().toISOString(),
        },
      });

      // Port connectivity test
      for (const port of service.ports) {
        testCases.push({
          name: `${service.name}_port_${port.port}_connectivity`,
          namespace: namespace,
          description: `Test ${port.name || port.port} port connectivity`,
          steps: [
            {
              action: 'tcp_connect',
              params: {
                host: 'localhost',
                port: port.port,
                timeout: 3000,
              },
              expected: { connected: true },
            },
          ],
          metadata: {
            generated: true,
            source: 'arbiter',
            lastModified: new Date().toISOString(),
          },
        });
      }
    }

    // Generate environment variable tests
    if (service.env && Object.keys(service.env).length > 0) {
      testCases.push({
        name: `${service.name}_environment_variables`,
        namespace: namespace,
        description: `Verify environment variables for ${service.name}`,
        steps: [
          {
            action: 'check_environment',
            params: {
              service: service.name,
              variables: Object.keys(service.env),
            },
            expected: { all_present: true },
          },
        ],
        metadata: {
          generated: true,
          source: 'arbiter',
          lastModified: new Date().toISOString(),
        },
      });
    }

    // Generate volume tests
    if (service.volumes && service.volumes.length > 0) {
      for (const volume of service.volumes) {
        testCases.push({
          name: `${service.name}_volume_${volume.name}_mounted`,
          namespace: namespace,
          description: `Verify ${volume.name} volume is mounted at ${volume.path}`,
          steps: [
            {
              action: 'check_volume_mount',
              params: {
                service: service.name,
                path: volume.path,
                volume: volume.name,
              },
              expected: { mounted: true, writable: true },
            },
          ],
          metadata: {
            generated: true,
            source: 'arbiter',
            lastModified: new Date().toISOString(),
          },
        });
      }
    }

    // Generate service-type specific tests
    if (service.serviceType === 'prebuilt') {
      // Test for pre-built services (like ClickHouse, Redis)
      testCases.push({
        name: `${service.name}_image_version`,
        namespace: namespace,
        description: `Verify ${service.name} is running expected image`,
        steps: [
          {
            action: 'check_image',
            params: {
              service: service.name,
              expectedImage: service.image,
            },
            expected: { image_matches: true },
          },
        ],
        metadata: {
          generated: true,
          source: 'arbiter',
          lastModified: new Date().toISOString(),
        },
      });
    }

    if (testCases.length > 0) {
      testSuites.push({
        name: `${service.name}_tests`,
        namespace: namespace,
        cases: testCases,
        setup: [
          {
            action: 'wait_for_service',
            params: {
              service: service.name,
              timeout: 30000,
            },
          },
        ],
        teardown: [],
      });
    }
  }

  return testSuites;
}

/**
 * Write test composition results to files
 */
async function writeTestFiles(
  testResult: TestCompositionResult,
  outputDir: string,
  language: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig = DEFAULT_PROJECT_STRUCTURE
): Promise<string[]> {
  const files: string[] = [];
  const testsDirSegments = toPathSegments(structure.testsDirectory);
  const effectiveTestSegments = testsDirSegments.length > 0 ? testsDirSegments : ['tests'];
  const testsDirRelative = joinRelativePath(...effectiveTestSegments);
  const testsDir = path.join(outputDir, ...effectiveTestSegments);

  if (!fs.existsSync(testsDir) && !options.dryRun) {
    await fs.mkdir(testsDir, { recursive: true });
  }

  // Write test suites based on language
  for (const suite of testResult.merged) {
    const fileName = `${suite.name}.${getTestFileExtension(language)}`;
    const filePath = path.join(testsDir, fileName);

    const content = generateTestFileContent(suite, language);

    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(testsDirRelative, fileName));
  }

  // Write test composition report
  const reportPath = path.join(testsDir, 'composition_report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: testResult.merged.reduce((sum, suite) => sum + suite.cases.length, 0),
      generatedTests: testResult.generated.length,
      preservedTests: testResult.preserved.length,
      conflicts: testResult.conflicts.length,
    },
    details: {
      conflicts: testResult.conflicts,
      generated: testResult.generated.map(t => ({ name: t.name, namespace: t.namespace })),
      preserved: testResult.preserved.map(t => ({ name: t.name, namespace: t.namespace })),
    },
  };

  await writeFileWithHooks(reportPath, JSON.stringify(report, null, 2), options);
  files.push(joinRelativePath(testsDirRelative, 'composition_report.json'));

  return files;
}

function getTestFileExtension(language: string): string {
  switch (language) {
    case 'typescript':
      return 'test.ts';
    case 'javascript':
      return 'test.js';
    case 'python':
      return 'test.py';
    case 'rust':
      return 'rs';
    case 'go':
      return 'go';
    default:
      return 'test.js';
  }
}

function generateTestFileContent(suite: TestSuite, language: string): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return generateJavaScriptTestContent(suite);
    case 'python':
      return generatePythonTestContent(suite);
    case 'rust':
      return generateRustTestContent(suite);
    case 'go':
      return generateGoTestContent(suite);
    default:
      return generateJavaScriptTestContent(suite);
  }
}

function generateJavaScriptTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('${suite.name}', () => {
${
  suite.setup && suite.setup.length > 0
    ? `  beforeAll(async () => {
${suite.setup.map(step => `    // ${step.action}: ${JSON.stringify(step.params)}`).join('\n')}
  });

`
    : ''
}${suite.cases
    .map(
      testCase => `  test('${testCase.name}', async () => {
    // ${testCase.description || 'Generated test'}
${testCase.steps
  .map(
    step => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`
  )
  .join('\n')}
    
    // TODO: Implement test logic
    expect(true).toBe(true); // Placeholder
  });`
    )
    .join('\n\n')}
${
  suite.teardown && suite.teardown.length > 0
    ? `
  afterAll(async () => {
${suite.teardown.map(step => `    // ${step.action}: ${JSON.stringify(step.params)}`).join('\n')}
  });`
    : ''
}
});
`;
}

function generatePythonTestContent(suite: TestSuite): string {
  return `"""${suite.name} - Generated by Arbiter
Namespace: ${suite.namespace}
Generated: ${new Date().toISOString()}
"""

import pytest
import asyncio
from typing import Dict, Any


class Test${suite.name.replace(/_/g, '')}:
    """Test suite for ${suite.name}"""
${
  suite.setup && suite.setup.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def setup_class(self):
        """Setup for test class"""
${suite.setup.map(step => `        # ${step.action}: ${JSON.stringify(step.params)}`).join('\n')}
        pass
`
    : ''
}
${suite.cases
  .map(
    testCase => `    async def test_${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}(self):
        """${testCase.description || 'Generated test'}"""
${testCase.steps
  .map(
    step => `        # ${step.action}: ${JSON.stringify(step.params)}
        # Expected: ${JSON.stringify(step.expected)}`
  )
  .join('\n')}
        
        # TODO: Implement test logic
        assert True  # Placeholder`
  )
  .join('\n\n')}
${
  suite.teardown && suite.teardown.length > 0
    ? `
    @pytest.fixture(scope="class", autouse=True)
    async def teardown_class(self):
        """Teardown for test class"""
${suite.teardown.map(step => `        # ${step.action}: ${JSON.stringify(step.params)}`).join('\n')}
        pass`
    : ''
}
`;
}

function generateRustTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

#[cfg(test)]
mod ${suite.name.replace(/-/g, '_')} {
    use super::*;
    use tokio_test;

${suite.cases
  .map(
    testCase => `    #[tokio::test]
    async fn ${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}() {
        // ${testCase.description || 'Generated test'}
${testCase.steps
  .map(
    step => `        // ${step.action}: ${JSON.stringify(step.params)}
        // Expected: ${JSON.stringify(step.expected)}`
  )
  .join('\n')}
        
        // TODO: Implement test logic
        assert!(true); // Placeholder
    }`
  )
  .join('\n\n')}
}
`;
}

function generateGoTestContent(suite: TestSuite): string {
  return `// ${suite.name} - Generated by Arbiter
// Namespace: ${suite.namespace}
// Generated: ${new Date().toISOString()}

package main

import (
    "testing"
    "context"
    "time"
)

${suite.cases
  .map(
    testCase => `func Test${testCase.name.replace(/[^a-zA-Z0-9]/g, '')}(t *testing.T) {
    // ${testCase.description || 'Generated test'}
${testCase.steps
  .map(
    step => `    // ${step.action}: ${JSON.stringify(step.params)}
    // Expected: ${JSON.stringify(step.expected)}`
  )
  .join('\n')}
    
    // TODO: Implement test logic
    if true != true { // Placeholder
        t.Errorf("Test failed")
    }
}`
  )
  .join('\n\n')}
`;
}

/**
 * Main function to generate and compose tests with existing test suites
 */
async function generateAndComposeTests(
  assemblyConfig: any,
  outputDir: string,
  options: GenerateOptions
): Promise<string[]> {
  try {
    const testConfig = extractTestConfiguration(assemblyConfig);
    const testComposition = await composeTestSuites(testConfig, outputDir);
    const files = await writeTestFiles(
      testComposition.result,
      outputDir,
      testConfig.language,
      options
    );

    if (options.verbose) {
      reportTestComposition(testComposition.result);
    }

    return files;
  } catch (error) {
    return handleTestGenerationError(error);
  }
}

/**
 * Extract test configuration from assembly config
 */
function extractTestConfiguration(assemblyConfig: any) {
  const { services } = parseDockerComposeServices(assemblyConfig);
  const specName = assemblyConfig?.metadata?.name || 'default';
  const language = assemblyConfig?.config?.language || 'typescript';

  return { services, specName, language };
}

/**
 * Compose test suites by merging existing and new tests
 */
async function composeTestSuites(
  config: { services: any; specName: string; language: string },
  outputDir: string
) {
  const engine = new TestCompositionEngine(config.specName);

  const existingTests = await engine.discoverExistingTests(outputDir);
  const newTestSuites = generateServiceTests(config.services, config.specName);
  const result = engine.mergeTestSuites(existingTests, newTestSuites);

  return { engine, result };
}

/**
 * Report test composition results
 */
function reportTestComposition(testResult: any): void {
  console.log(chalk.blue('\n📋 Test Composition Summary:'));
  console.log(chalk.dim(`  Generated: ${testResult.generated.length} test cases`));
  console.log(chalk.dim(`  Preserved: ${testResult.preserved.length} existing test cases`));
  console.log(chalk.dim(`  Conflicts: ${testResult.conflicts.length} resolved`));

  if (testResult.conflicts.length > 0) {
    reportTestConflicts(testResult.conflicts);
  }
}

/**
 * Report test conflict resolution details
 */
function reportTestConflicts(conflicts: any[]): void {
  console.log(chalk.yellow('\n⚠️  Test Conflicts Resolved:'));
  conflicts.forEach(conflict => {
    console.log(chalk.dim(`  • ${conflict.test}: ${conflict.reason} (${conflict.resolution})`));
  });
}

/**
 * Handle test generation errors
 */
function handleTestGenerationError(error: unknown): string[] {
  console.warn(
    chalk.yellow(
      `⚠️  Test generation failed: ${error instanceof Error ? error.message : String(error)}`
    )
  );
  return [];
}

/**
 * Emit sharded CUE specifications from service to .arbiter directory before generation
 */
async function emitSpecificationFromService(config: CLIConfig): Promise<void> {
  try {
    const apiClient = new ApiClient(config);

    // Ensure .arbiter directory exists
    await fs.ensureDir('.arbiter');

    // Try to get the stored specifications from service (sharded)
    const assemblyPath = path.resolve('.arbiter', 'assembly.cue');
    const storedSpec = await apiClient.getSpecification('assembly', assemblyPath);

    if (storedSpec.success && storedSpec.data && storedSpec.data.content) {
      // Emit the main assembly CUE file to .arbiter directory
      await fs.writeFile(assemblyPath, storedSpec.data.content, 'utf-8');
      console.log(
        chalk.green('📄 Emitted CUE specification from service to .arbiter/assembly.cue')
      );

      // Also try to get any sharded specification files
      await emitShardedSpecifications(apiClient);
    } else {
      console.log(chalk.dim('💡 No stored specification found, using existing CUE files'));
    }
  } catch (error) {
    // Service unavailable, continue with existing file-based workflow
    console.log(chalk.dim('💡 Service unavailable, using existing CUE files'));
  }
}

/**
 * Emit additional sharded CUE files from service
 */
async function emitShardedSpecifications(apiClient: ApiClient): Promise<void> {
  try {
    // Try to get any additional sharded files (services, endpoints, etc.)
    const shardTypes = ['services', 'endpoints', 'schemas', 'flows'];

    for (const shardType of shardTypes) {
      const shardPath = path.resolve('.arbiter', `${shardType}.cue`);
      const shardSpec = await apiClient.getSpecification(shardType, shardPath);

      if (shardSpec.success && shardSpec.data && shardSpec.data.content) {
        await fs.writeFile(shardPath, shardSpec.data.content, 'utf-8');
        console.log(chalk.dim(`  📄 Emitted ${shardType} shard to .arbiter/${shardType}.cue`));
      }
    }
  } catch (error) {
    // Sharded files are optional, continue silently
  }
}
