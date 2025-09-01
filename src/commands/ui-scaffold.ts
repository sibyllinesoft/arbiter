/**
 * Arbiter UI Scaffold Command
 * 
 * Implements the comprehensive UI scaffolding system as a CLI command.
 * Provides the `arbiter ui scaffold` command that generates complete UI artifacts
 * from Profile.ui specifications with idempotent and stamped generation.
 * 
 * Usage:
 *   arbiter ui scaffold <cue-file> [options]
 *   arbiter ui scaffold profile.cue --platform web --output ./src
 */

import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

import { scaffoldComprehensive, ComprehensiveScaffoldOptions } from '../ui/ui-scaffolder.js';
import { Platform } from '../ui/types.js';

/**
 * CLI-specific scaffolding options
 */
interface CLIScaffoldOptions extends Partial<ComprehensiveScaffoldOptions> {
  /** CUE file path */
  cuePath: string;
  /** Show detailed output */
  verbose?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Dry run mode */
  dryRun?: boolean;
  /** Skip idempotent check */
  noIdempotent?: boolean;
  /** Skip stamping */
  noStamp?: boolean;
  /** Ticket ID for traceability */
  ticket?: string;
  /** Disable design system integration */
  noDesignSystem?: boolean;
  /** Skip tests generation */
  noTests?: boolean;
  /** Skip stories generation */
  noStories?: boolean;
  /** Output format for results */
  format?: 'json' | 'table' | 'minimal';
}

/**
 * Create the UI scaffold command
 */
export function createUIScaffoldCommand(): Command {
  const command = new Command('scaffold')
    .description('Generate UI artifacts from Profile.ui specifications')
    .argument('<cue-file>', 'Path to CUE file containing Profile.ui definition')
    .option('-o, --output <dir>', 'Output directory for generated files', './generated')
    .option('-p, --platform <platform>', 'Target platform (web|cli|tui|desktop)', 'web')
    .option('-v, --verbose', 'Show detailed output', false)
    .option('-f, --force', 'Force overwrite existing files', false)
    .option('-n, --dry-run', 'Preview changes without writing files', false)
    .option('--no-idempotent', 'Skip idempotent generation check', false)
    .option('--no-stamp', 'Skip Arbiter stamping', false)
    .option('-t, --ticket <id>', 'Ticket ID for traceability')
    .option('--no-design-system', 'Skip design system integration', false)
    .option('--no-tests', 'Skip test generation', false)
    .option('--no-stories', 'Skip Storybook stories', false)
    .option('--format <format>', 'Output format (json|table|minimal)', 'table')
    
    // Component options
    .option('--component-framework <framework>', 'Component framework (react|vue|svelte)', 'react')
    .option('--styling <approach>', 'Styling approach (css-modules|styled-components|tailwind)', 'css-modules')
    .option('--test-framework <framework>', 'Testing framework (jest|vitest|playwright)', 'vitest')
    
    // Route options
    .option('--route-framework <framework>', 'Routing framework (react-router|next-router|vue-router)', 'react-router')
    .option('--no-guards', 'Skip route guards generation', false)
    .option('--no-data-hooks', 'Skip data hooks generation', false)
    .option('--no-navigation', 'Skip navigation component', false)
    
    // CLI options
    .option('--cli-framework <framework>', 'CLI framework (commander|yargs|oclif)', 'commander')
    .option('--no-golden-tests', 'Skip golden tests for CLI', false)
    .option('--no-help', 'Skip help documentation', false)
    
    .action(async (cuePath: string, options: any) => {
      await executeScaffoldCommand(cuePath, options);
    });

  return command;
}

/**
 * Execute the scaffold command
 */
async function executeScaffoldCommand(cuePath: string, cliOptions: any): Promise<void> {
  const startTime = performance.now();

  try {
    // Validate inputs
    const resolvedCuePath = path.resolve(cuePath);
    const outputDir = path.resolve(cliOptions.output);

    if (cliOptions.verbose) {
      console.log(chalk.blue('🎨 Arbiter UI Scaffolder'));
      console.log(chalk.gray(`Source: ${resolvedCuePath}`));
      console.log(chalk.gray(`Output: ${outputDir}`));
      console.log(chalk.gray(`Platform: ${cliOptions.platform}`));
      console.log('');
    }

    // Validate platform
    const validPlatforms: Platform[] = ['web', 'cli', 'tui', 'desktop'];
    if (!validPlatforms.includes(cliOptions.platform)) {
      throw new Error(`Invalid platform: ${cliOptions.platform}. Valid options: ${validPlatforms.join(', ')}`);
    }

    // Build comprehensive options
    const scaffoldOptions: ComprehensiveScaffoldOptions = {
      platform: cliOptions.platform as Platform,
      outputDir,
      idempotent: !cliOptions.noIdempotent,
      stamped: !cliOptions.noStamp,
      overwrite: cliOptions.force,
      dryRun: cliOptions.dryRun,
      verbose: cliOptions.verbose,
      ticketId: cliOptions.ticket,
      
      designSystem: {
        enabled: !cliOptions.noDesignSystem,
        cssVariables: true,
        storybookIntegration: !cliOptions.noStories
      },
      
      components: {
        includeTests: !cliOptions.noTests,
        includeStories: !cliOptions.noStories,
        testingFramework: cliOptions.testFramework,
        componentLibrary: cliOptions.componentFramework,
        stylingApproach: cliOptions.styling
      },
      
      routes: {
        framework: cliOptions.routeFramework,
        includeGuards: !cliOptions.noGuards,
        includeDataHooks: !cliOptions.noDataHooks,
        includeNavigation: !cliOptions.noNavigation
      },
      
      cli: {
        framework: cliOptions.cliFramework,
        includeGoldenTests: !cliOptions.noGoldenTests,
        includeHelp: !cliOptions.noHelp,
        includeCompletion: true
      }
    };

    // Execute scaffolding
    if (cliOptions.verbose) {
      console.log(chalk.yellow('⚡ Starting generation...'));
    }

    const { result, stamp, skippedFiles, updatedFiles } = await scaffoldComprehensive(
      resolvedCuePath,
      scaffoldOptions
    );

    const duration = performance.now() - startTime;

    // Handle results
    if (!result.success) {
      console.error(chalk.red('❌ Scaffolding failed:'));
      result.errors.forEach(error => console.error(chalk.red(`  • ${error}`)));
      process.exit(1);
    }

    // Display results based on format
    await displayResults({
      result,
      stamp,
      skippedFiles,
      updatedFiles,
      duration,
      format: cliOptions.format,
      verbose: cliOptions.verbose,
      dryRun: cliOptions.dryRun
    });

    // Show warnings if any
    if (result.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow('⚠️  Warnings:'));
      result.warnings.forEach(warning => console.log(chalk.yellow(`  • ${warning}`)));
    }

    if (cliOptions.verbose) {
      console.log('');
      console.log(chalk.green('✨ Generation completed successfully!'));
      console.log(chalk.gray(`Total duration: ${Math.round(duration)}ms`));
      console.log(chalk.gray(`Stamp ID: ${stamp.stampId}`));
      if (stamp.ticketId) {
        console.log(chalk.gray(`Ticket: ${stamp.ticketId}`));
      }
    }

  } catch (error) {
    console.error(chalk.red('❌ Scaffolding failed:'));
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    
    if (cliOptions.verbose && error instanceof Error && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

/**
 * Display scaffolding results in the requested format
 */
async function displayResults(options: {
  result: any;
  stamp: any;
  skippedFiles: string[];
  updatedFiles: string[];
  duration: number;
  format: string;
  verbose: boolean;
  dryRun: boolean;
}): Promise<void> {
  const { result, stamp, skippedFiles, updatedFiles, duration, format, verbose, dryRun } = options;

  switch (format) {
    case 'json':
      await displayJSONResults(options);
      break;
    case 'minimal':
      await displayMinimalResults(options);
      break;
    case 'table':
    default:
      await displayTableResults(options);
      break;
  }
}

/**
 * Display results in table format
 */
async function displayTableResults(options: {
  result: any;
  stamp: any;
  skippedFiles: string[];
  updatedFiles: string[];
  duration: number;
  verbose: boolean;
  dryRun: boolean;
}): Promise<void> {
  const { result, stamp, skippedFiles, updatedFiles, duration, verbose, dryRun } = options;
  
  console.log('');
  console.log(chalk.green('✅ Scaffolding Results'));
  console.log('');
  
  // Summary table
  const summaryData = [
    ['Routes Generated', result.stats.routesGenerated.toString()],
    ['Components Generated', result.stats.componentsGenerated.toString()],
    ['Forms Generated', result.stats.formsGenerated.toString()],
    ['Tests Generated', result.stats.testsGenerated.toString()],
    ['Total Artifacts', result.artifacts.length.toString()],
    ['Updated Files', updatedFiles.length.toString()],
    ['Skipped Files', skippedFiles.length.toString()],
    ['Duration', `${Math.round(duration)}ms`]
  ];

  // Simple table output
  const maxLabelLength = Math.max(...summaryData.map(row => row[0].length));
  summaryData.forEach(([label, value]) => {
    const paddedLabel = label.padEnd(maxLabelLength);
    console.log(`  ${chalk.cyan(paddedLabel)} │ ${chalk.white(value)}`);
  });

  // File details if verbose
  if (verbose && (updatedFiles.length > 0 || skippedFiles.length > 0)) {
    console.log('');
    
    if (updatedFiles.length > 0) {
      console.log(chalk.green(`📝 ${dryRun ? 'Would Update' : 'Updated'} Files (${updatedFiles.length}):`));
      updatedFiles.forEach(file => {
        console.log(`  ${chalk.green('✓')} ${file}`);
      });
    }
    
    if (skippedFiles.length > 0) {
      console.log('');
      console.log(chalk.yellow(`⏭️  Skipped Files (${skippedFiles.length}):`));
      skippedFiles.forEach(file => {
        console.log(`  ${chalk.yellow('–')} ${file}`);
      });
    }
  }

  // Stamp info if verbose
  if (verbose) {
    console.log('');
    console.log(chalk.blue('🏷️  Generation Stamp:'));
    console.log(`  ID: ${stamp.stampId}`);
    console.log(`  Generated: ${new Date(stamp.generatedAt).toLocaleString()}`);
    console.log(`  Version: ${stamp.version}`);
    if (stamp.ticketId) {
      console.log(`  Ticket: ${stamp.ticketId}`);
    }
  }
}

/**
 * Display results in JSON format
 */
async function displayJSONResults(options: {
  result: any;
  stamp: any;
  skippedFiles: string[];
  updatedFiles: string[];
  duration: number;
}): Promise<void> {
  const { result, stamp, skippedFiles, updatedFiles, duration } = options;
  
  const output = {
    success: result.success,
    stamp: {
      id: stamp.stampId,
      generatedAt: stamp.generatedAt,
      version: stamp.version,
      ticketId: stamp.ticketId
    },
    stats: {
      ...result.stats,
      totalDuration: Math.round(duration)
    },
    files: {
      updated: updatedFiles,
      skipped: skippedFiles,
      total: updatedFiles.length + skippedFiles.length
    },
    artifacts: result.artifacts.map((artifact: any) => ({
      type: artifact.type,
      path: artifact.path,
      platform: artifact.platform
    })),
    errors: result.errors,
    warnings: result.warnings
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Display results in minimal format
 */
async function displayMinimalResults(options: {
  result: any;
  stamp: any;
  skippedFiles: string[];
  updatedFiles: string[];
  duration: number;
  dryRun: boolean;
}): Promise<void> {
  const { result, stamp, skippedFiles, updatedFiles, duration, dryRun } = options;
  
  const action = dryRun ? 'Would update' : 'Updated';
  console.log(chalk.green(`✅ ${action} ${updatedFiles.length} files, skipped ${skippedFiles.length} files (${Math.round(duration)}ms)`));
  
  if (result.errors.length > 0) {
    console.log(chalk.red(`❌ ${result.errors.length} errors`));
  }
  
  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`⚠️  ${result.warnings.length} warnings`));
  }
}

/**
 * Create UI command group with all subcommands
 */
export function createUICommand(): Command {
  const uiCommand = new Command('ui')
    .description('UI generation and scaffolding commands');

  // Add scaffold subcommand
  uiCommand.addCommand(createUIScaffoldCommand());

  // Future subcommands could be added here:
  // - arbiter ui validate <cue-file>
  // - arbiter ui preview <cue-file>
  // - arbiter ui migrate <from-version> <to-version>
  // - arbiter ui diff <cue-file1> <cue-file2>

  return uiCommand;
}

/**
 * Default export for the scaffold command
 */
export default createUIScaffoldCommand;